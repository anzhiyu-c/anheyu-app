package frontend

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"testing"
	"time"
)

func TestLauncherReadinessConnectsWithoutHTTPRequest(t *testing.T) {
	listener := newReadinessListener(t)
	observed := observeReadinessConnection(listener, time.Second)
	launcher := NewLauncher(Config{Port: listener.Addr().(*net.TCPAddr).Port})
	// The readiness loop only checks the process handle; no process is started or signaled.
	cmd := &exec.Cmd{Process: &os.Process{Pid: os.Getpid()}}
	launcher.cmd = cmd
	done := make(chan struct{})
	go func() {
		launcher.waitForReady(cmd)
		close(done)
	}()

	select {
	case result := <-observed:
		if result.err != nil {
			t.Fatalf("observe readiness connection: %v", result.err)
		}
		if len(result.payload) != 0 {
			t.Errorf("readiness sent application data: %q; want a TCP connection only", result.payload)
		}
	case <-time.After(4 * time.Second):
		t.Fatal("readiness never connected to the frontend listener")
	}

	select {
	case <-done:
	case <-time.After(4 * time.Second):
		t.Fatal("readiness did not return after a successful connection")
	}
}

func TestLauncherReadinessSkipsStoppedProcess(t *testing.T) {
	tests := []struct {
		name    string
		current *exec.Cmd
	}{
		{name: "exited"},
		{name: "replaced", current: &exec.Cmd{Process: &os.Process{Pid: os.Getpid()}}},
		{name: "no process", current: &exec.Cmd{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			listener := newReadinessListener(t)
			observed := observeReadinessConnection(listener, 100*time.Millisecond)
			launcher := NewLauncher(Config{Port: listener.Addr().(*net.TCPAddr).Port})
			cmd := &exec.Cmd{Process: &os.Process{Pid: os.Getpid()}}
			if tt.current != nil && tt.current.Process == nil {
				cmd = tt.current
			}
			launcher.cmd = tt.current
			launcher.waitForReady(cmd)
			result := <-observed
			var timeout net.Error
			if !errors.As(result.err, &timeout) || !timeout.Timeout() {
				t.Fatalf("stopped process should not receive a probe; payload=%q, error=%v", result.payload, result.err)
			}
		})
	}
}

type readinessObservation struct {
	payload string
	err     error
}

func newReadinessListener(t *testing.T) *net.TCPListener {
	t.Helper()
	listener, err := net.ListenTCP("tcp4", &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatalf("listen for readiness probe: %v", err)
	}
	t.Cleanup(func() {
		if err := listener.Close(); err != nil {
			t.Errorf("close readiness listener: %v", err)
		}
	})
	return listener
}

func observeReadinessConnection(listener *net.TCPListener, timeout time.Duration) <-chan readinessObservation {
	observed := make(chan readinessObservation, 1)
	go func() {
		result := readinessObservation{}
		defer func() { observed <- result }()
		if err := listener.SetDeadline(time.Now().Add(timeout)); err != nil {
			result.err = err
			return
		}
		conn, err := listener.AcceptTCP()
		if err != nil {
			result.err = err
			return
		}
		defer func() {
			if err := conn.Close(); err != nil && result.err == nil {
				result.err = err
			}
		}()
		if err := conn.SetReadDeadline(time.Now().Add(timeout)); err != nil {
			result.err = err
			return
		}
		buffer := make([]byte, 512)
		n, err := conn.Read(buffer)
		result.payload = string(buffer[:n])
		if err != nil && !errors.Is(err, io.EOF) {
			result.err = fmt.Errorf("read probe data: %w", err)
			return
		}
		if n > 0 {
			// Let the old HTTP probe finish, so a regression fails promptly.
			if _, err := io.WriteString(conn, "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); err != nil {
				result.err = fmt.Errorf("reply to HTTP probe: %w", err)
			}
		}
	}()
	return observed
}
