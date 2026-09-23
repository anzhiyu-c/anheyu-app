package frontend

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestLauncherRestartsDirectoryFrontendAfterUnexpectedExit(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("fake node shell script is Unix-specific")
	}

	frontendDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(frontendDir, "server.js"), []byte("console.log('ok')\n"), 0o644); err != nil {
		t.Fatalf("write server.js failed: %v", err)
	}

	runFile := filepath.Join(t.TempDir(), "node-runs.txt")
	t.Setenv("ANHEYU_TEST_RUN_FILE", runFile)
	binDir := t.TempDir()
	fakeNode := filepath.Join(binDir, "node")
	if err := os.WriteFile(fakeNode, []byte("#!/bin/sh\nprintf 'run\\n' >> \"$ANHEYU_TEST_RUN_FILE\"\nexit 1\n"), 0o755); err != nil {
		t.Fatalf("write fake node failed: %v", err)
	}
	t.Setenv("PATH", binDir+string(os.PathListSeparator)+os.Getenv("PATH"))

	launcher := NewLauncher(Config{FrontendDir: frontendDir, Port: 39281})
	if err := launcher.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer launcher.Stop()

	deadline := time.Now().Add(4 * time.Second)
	for time.Now().Before(deadline) {
		if countRunFileLines(t, runFile) >= 2 {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}

	t.Fatalf("frontend process was not restarted; node run count = %d", countRunFileLines(t, runFile))
}

func countRunFileLines(t *testing.T, runFile string) int {
	t.Helper()
	content, err := os.ReadFile(runFile)
	if os.IsNotExist(err) {
		return 0
	}
	if err != nil {
		t.Fatalf("read run file failed: %v", err)
	}
	return strings.Count(string(content), "run\n")
}
