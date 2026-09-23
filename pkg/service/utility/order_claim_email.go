package utility

import (
	"context"
	"fmt"
	"html"
	"net/mail"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

func orderClaimEmail(siteName, orderNo, code string) (string, string) {
	return "订单认领验证码", fmt.Sprintf(`<p>您正在将 %s 的历史订单 <strong>%s</strong> 绑定到当前登录账号。</p><p>验证码：<strong>%s</strong>，5 分钟内有效，仅可使用一次。</p><p>绑定后，该账号可以查看订单和购买内容。请勿将验证码转发给他人；如非本人操作，请忽略此邮件。</p>`, html.EscapeString(siteName), html.EscapeString(orderNo), html.EscapeString(code))
}

// SendOrderClaimEmail reuses the configured SMTP transport with a purpose-specific message.
func SendOrderClaimEmail(ctx context.Context, settingSvc setting.SettingService, toEmail, orderNo, code string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	address, err := mail.ParseAddress(toEmail)
	if err != nil || address.Address != toEmail || strings.ContainsAny(toEmail, "\r\n") {
		return fmt.Errorf("付款邮箱无效")
	}
	subject, body := orderClaimEmail(settingSvc.Get(constant.KeyAppName.String()), orderNo, code)
	sender := &emailService{settingSvc: settingSvc}
	if err := sender.send(toEmail, subject, body); err != nil {
		return fmt.Errorf("发送订单认领邮件失败: %w", err)
	}
	return nil
}
