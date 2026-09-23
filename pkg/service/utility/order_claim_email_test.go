package utility

import (
	"strings"
	"testing"
)

func TestOrderClaimEmailExplainsAccountBindingAndEscapesContent(t *testing.T) {
	subject, body := orderClaimEmail("<site>", "PAY<1>", "12345678")
	if !strings.Contains(subject, "订单认领") || !strings.Contains(body, "绑定") || !strings.Contains(body, "5 分钟") || !strings.Contains(body, "12345678") {
		t.Fatal("missing claim purpose or code")
	}
	if strings.Contains(body, "<site>") || strings.Contains(body, "PAY<1>") {
		t.Fatal("unescaped HTML")
	}
}
