// Package frontend manages the built-in Next.js frontend process lifecycle.
// Two modes are supported:
//   - Built-in: Go starts a Node.js process automatically (single-container deployment)
//   - External: an environment variable points to an already running Next.js service
package frontend

import (
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	DefaultPort                 = 3000
	DefaultFrontendDir          = "./frontend"
	HealthCheckTimeout          = 60 * time.Second
	HealthCheckInterval         = 2 * time.Second
	FrontendRestartInitialDelay = time.Second
	FrontendRestartMaxDelay     = 30 * time.Second
	FrontendRestartWindow       = 5 * time.Minute
	FrontendRestartLimit        = 5
	FrontendStopTimeout         = 10 * time.Second
)

type Launcher struct {
	frontendDir string
	port        int
	externalURL string
	// skipStaticProxy：true 时不代理 /static，由 Go 提供（自定义主题目录）；默认 false，即 /static 代理到 Next.js
	skipStaticProxy bool

	cmd            *exec.Cmd
	mu             sync.RWMutex
	done           chan struct{}
	stopCh         chan struct{}
	stopping       bool
	supervising    bool
	restartHistory []time.Time
}

type Config struct {
	FrontendDir string
	Port        int
	ExternalURL string
	// SkipStaticProxy：true 时不代理 /static，由 Go 提供主题目录（自定义前端在 /static 时设为 true）；默认 false，即 /static 代理到 Next.js
	SkipStaticProxy bool
}

func NewLauncher(cfg Config) *Launcher {
	if cfg.FrontendDir == "" {
		cfg.FrontendDir = DefaultFrontendDir
	}
	if cfg.Port == 0 {
		cfg.Port = DefaultPort
	}
	if cfg.ExternalURL != "" {
		if u, err := url.Parse(cfg.ExternalURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			log.Printf("[Frontend] 警告: ANHEYU_FRONTEND_URL 格式无效（仅允许 http/https），忽略: %s", cfg.ExternalURL)
			cfg.ExternalURL = ""
		}
	}
	return &Launcher{
		frontendDir:     cfg.FrontendDir,
		port:            cfg.Port,
		externalURL:     cfg.ExternalURL,
		skipStaticProxy: cfg.SkipStaticProxy,
		done:            make(chan struct{}),
		stopCh:          make(chan struct{}),
	}
}

// SkipStaticProxy 为 true 时代理不处理 /static，由 Go 提供（自定义主题目录）；默认 false，/static 代理到 Next.js。
func (l *Launcher) SkipStaticProxy() bool {
	return l.skipStaticProxy
}

func (l *Launcher) GetFrontendURL() string {
	if l.externalURL != "" {
		return l.externalURL
	}
	return fmt.Sprintf("http://127.0.0.1:%d", l.port)
}

func (l *Launcher) IsExternal() bool {
	return l.externalURL != ""
}

func (l *Launcher) Start() error {
	if l.externalURL != "" {
		log.Printf("[Frontend] 使用外部前端服务: %s", l.externalURL)
		return nil
	}

	l.mu.Lock()
	if l.cmd != nil || l.supervising {
		l.mu.Unlock()
		return nil
	}
	if l.stopping {
		l.stopCh = make(chan struct{})
		l.stopping = false
		l.restartHistory = nil
	}
	l.supervising = true
	stopCh := l.stopCh
	l.mu.Unlock()

	serverJS, absDir, err := l.resolveRuntime()
	if err != nil {
		l.clearSupervising()
		return err
	}

	cmd, done, logFile, err := l.startProcess(serverJS, absDir)
	if err != nil {
		l.clearSupervising()
		return err
	}

	go l.superviseProcess(cmd, done, logFile, serverJS, absDir, stopCh)
	go l.waitForReady(cmd)

	log.Printf("[Frontend] Next.js 前端启动中: %s (port=%d)", absDir, l.port)
	return nil
}

func (l *Launcher) resolveRuntime() (serverJS string, absDir string, err error) {

	serverJS = filepath.Join(l.frontendDir, "server.js")
	if _, err := os.Stat(serverJS); os.IsNotExist(err) {
		standalonePath := filepath.Join(l.frontendDir, ".next", "standalone", "server.js")
		if _, statErr := os.Stat(standalonePath); statErr == nil {
			serverJS = standalonePath
		} else {
			return "", "", fmt.Errorf("frontend runtime not found: expected server.js in %s or %s", l.frontendDir, filepath.Dir(standalonePath))
		}
	} else if err != nil {
		return "", "", fmt.Errorf("check frontend runtime failed: %w", err)
	}

	if _, err := exec.LookPath("node"); err != nil {
		return "", "", fmt.Errorf("node runtime not found in PATH; embedded Next.js frontend requires Node.js: %w", err)
	}

	absDir, err = filepath.Abs(l.frontendDir)
	if err != nil {
		return "", "", fmt.Errorf("resolve frontend dir failed: %w", err)
	}

	return serverJS, absDir, nil
}

func (l *Launcher) startProcess(serverJS, absDir string) (*exec.Cmd, chan struct{}, *os.File, error) {
	apiURL := strings.TrimSpace(os.Getenv("API_URL"))
	if apiURL == "" {
		apiURL = "http://127.0.0.1:8091"
	}
	backendURL := strings.TrimSpace(os.Getenv("BACKEND_URL"))
	if backendURL == "" {
		backendURL = apiURL
	}

	cmd := exec.Command("node", "server.js")
	cmd.Dir = filepath.Dir(serverJS)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("PORT=%d", l.port),
		"HOSTNAME=0.0.0.0",
		"NODE_ENV=production",
		fmt.Sprintf("API_URL=%s", apiURL),
		fmt.Sprintf("BACKEND_URL=%s", backendURL),
	)

	logFile, logErr := os.OpenFile(
		filepath.Join(absDir, "frontend.log"),
		os.O_CREATE|os.O_WRONLY|os.O_APPEND,
		0644,
	)
	if logErr == nil {
		cmd.Stdout = logFile
		cmd.Stderr = logFile
	} else {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	if l.stopping {
		if logFile != nil {
			if err := logFile.Close(); err != nil {
				log.Printf("[Frontend] close log: %v", err)
			}
		}
		return nil, nil, nil, fmt.Errorf("frontend launcher is stopping")
	}
	if err := cmd.Start(); err != nil {
		if logFile != nil {
			if closeErr := logFile.Close(); closeErr != nil {
				log.Printf("[Frontend] close log: %v", closeErr)
			}
		}
		return nil, nil, nil, fmt.Errorf("start frontend process failed: %w", err)
	}

	done := make(chan struct{})
	l.cmd = cmd
	l.done = done

	return cmd, done, logFile, nil
}

func (l *Launcher) superviseProcess(cmd *exec.Cmd, done chan struct{}, logFile *os.File, serverJS, absDir string, stopCh <-chan struct{}) {
	defer l.clearSupervising()

	for {
		waitErr := cmd.Wait()
		if logFile != nil {
			if closeErr := logFile.Close(); closeErr != nil {
				log.Printf("[Frontend] close log: %v", closeErr)
			}
		}

		l.mu.Lock()
		if l.cmd == cmd {
			l.cmd = nil
		}
		stopping := l.stopping
		l.mu.Unlock()

		close(done)

		if waitErr != nil {
			log.Printf("[Frontend] Next.js 进程异常退出: %v", waitErr)
		} else {
			log.Println("[Frontend] Next.js 进程已退出")
		}

		if stopping || isStopRequested(stopCh) {
			return
		}

		for {
			restartCount, ok := l.recordRestartFailure(time.Now())
			if !ok {
				log.Printf("[Frontend] Next.js 重启次数超过限制（%d 次 / %.0f 秒），停止自动重启", FrontendRestartLimit, FrontendRestartWindow.Seconds())
				return
			}

			delay := restartDelay(restartCount)
			log.Printf("[Frontend] 将在 %s 后尝试重启 Next.js 前端进程", delay)
			if !waitBeforeRestart(stopCh, delay) {
				return
			}

			nextCmd, nextDone, nextLogFile, err := l.startProcess(serverJS, absDir)
			if err != nil {
				log.Printf("[Frontend] Next.js 前端进程重启失败: %v", err)
				continue
			}

			log.Printf("[Frontend] Next.js 前端进程已重启: %s (port=%d)", absDir, l.port)
			go l.waitForReady(nextCmd)
			cmd = nextCmd
			done = nextDone
			logFile = nextLogFile
			break
		}
	}
}

func (l *Launcher) clearSupervising() {
	l.mu.Lock()
	l.supervising = false
	l.mu.Unlock()
}

// Stop 优雅停止内置 Next.js 进程
func (l *Launcher) Stop() {
	l.mu.Lock()
	if !l.stopping {
		l.stopping = true
		close(l.stopCh)
	}
	cmd := l.cmd
	done := l.done
	l.mu.Unlock()

	if cmd == nil || cmd.Process == nil {
		return
	}

	log.Println("[Frontend] 正在停止 Next.js 前端进程...")

	if err := cmd.Process.Signal(syscall.SIGTERM); err != nil {
		if killErr := cmd.Process.Kill(); killErr != nil && killErr != os.ErrProcessDone {
			log.Printf("[Frontend] kill process: %v", killErr)
		}
		return
	}

	select {
	case <-done:
	case <-time.After(FrontendStopTimeout):
		if killErr := cmd.Process.Kill(); killErr != nil && killErr != os.ErrProcessDone {
			log.Printf("[Frontend] kill process: %v", killErr)
		}
	}

	log.Println("[Frontend] Next.js 前端进程已停止")
}

// IsRunning 检查前端进程是否运行中
func (l *Launcher) IsRunning() bool {
	if l.externalURL != "" {
		return true
	}
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.cmd != nil && l.cmd.Process != nil
}

func (l *Launcher) waitForReady(cmd *exec.Cmd) {
	address := fmt.Sprintf("127.0.0.1:%d", l.port)
	start := time.Now()

	for {
		if time.Since(start) > HealthCheckTimeout {
			log.Printf("[Frontend] Next.js 监听探测超时（已等待 %.0f 秒）", HealthCheckTimeout.Seconds())
			return
		}

		l.mu.RLock()
		running := l.cmd == cmd && l.cmd != nil && l.cmd.Process != nil
		l.mu.RUnlock()
		if !running {
			log.Println("[Frontend] 进程已退出，停止监听探测")
			return
		}

		conn, err := net.DialTimeout("tcp", address, 3*time.Second)
		if err == nil {
			if closeErr := conn.Close(); closeErr != nil {
				log.Printf("[Frontend] close readiness connection: %v", closeErr)
			}
			log.Printf("[Frontend] Next.js 前端监听已就绪 (等待了 %.1f 秒)", time.Since(start).Seconds())
			return
		}

		time.Sleep(HealthCheckInterval)
	}
}

func (l *Launcher) recordRestartFailure(now time.Time) (int, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := now.Add(-FrontendRestartWindow)
	kept := l.restartHistory[:0]
	for _, restartAt := range l.restartHistory {
		if restartAt.After(cutoff) {
			kept = append(kept, restartAt)
		}
	}
	l.restartHistory = append(kept, now)
	return len(l.restartHistory), len(l.restartHistory) <= FrontendRestartLimit
}

func restartDelay(restartCount int) time.Duration {
	if restartCount < 1 {
		restartCount = 1
	}
	delay := FrontendRestartInitialDelay
	for i := 1; i < restartCount; i++ {
		delay *= 2
		if delay >= FrontendRestartMaxDelay {
			return FrontendRestartMaxDelay
		}
	}
	return delay
}

func waitBeforeRestart(stopCh <-chan struct{}, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-stopCh:
		return false
	case <-timer.C:
		return !isStopRequested(stopCh)
	}
}

func isStopRequested(stopCh <-chan struct{}) bool {
	select {
	case <-stopCh:
		return true
	default:
		return false
	}
}
