"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormMonacoEditor } from "@/components/ui/form-monaco-editor";
import { PlaceholderHelpPanel } from "@/components/ui/placeholder-help-panel";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_SMTP_HOST,
  KEY_SMTP_PORT,
  KEY_SMTP_USERNAME,
  KEY_SMTP_PASSWORD,
  KEY_SMTP_SENDER_NAME,
  KEY_SMTP_SENDER_EMAIL,
  KEY_SMTP_REPLY_TO_EMAIL,
  KEY_SMTP_FORCE_SSL,
  KEY_RESET_PASSWORD_SUBJECT,
  KEY_RESET_PASSWORD_TEMPLATE,
  KEY_ACTIVATE_ACCOUNT_SUBJECT,
  KEY_ACTIVATE_ACCOUNT_TEMPLATE,
  KEY_ENABLE_USER_ACTIVATION,
} from "@/lib/settings/setting-keys";

interface EmailSettingsFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function EmailSettingsForm({ values, onChange, loading }: EmailSettingsFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* SMTP 配置 */}
      <SettingsSection
        title="SMTP 配置"
        description="用于发送密码重置、账号激活等系统邮件。支持 QQ 邮箱、163、SendGrid 等，需在邮箱设置中开启 SMTP 并获取授权码（非登录密码）。"
      >
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-medium text-foreground/80 mb-3">快速配置</p>
          <ol className="space-y-2 text-xs text-foreground/70">
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary">
                1
              </span>
              <span>开启 SMTP 并获取授权码</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary">
                2
              </span>
              <span>填写主机与端口（SSL 常用 465，STARTTLS 常用 587）</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary">
                3
              </span>
              <span>发件人邮箱建议与 SMTP 用户一致，避免被拦截</span>
            </li>
          </ol>
        </div>

        <div className="space-y-5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.3)]">
          <SettingsFieldGroup cols={2}>
            <FormInput
              label="SMTP 主机"
              placeholder="smtp.qq.com"
              value={values[KEY_SMTP_HOST]}
              onValueChange={v => onChange(KEY_SMTP_HOST, v)}
            />
            <FormInput
              label="SMTP 端口"
              placeholder="465"
              value={values[KEY_SMTP_PORT]}
              onValueChange={v => onChange(KEY_SMTP_PORT, v)}
            />
          </SettingsFieldGroup>

          <SettingsFieldGroup cols={2}>
            <FormInput
              label="用户名"
              placeholder="user@example.com"
              value={values[KEY_SMTP_USERNAME]}
              onValueChange={v => onChange(KEY_SMTP_USERNAME, v)}
            />
            <FormInput
              label="密码"
              type="password"
              placeholder="请输入 SMTP 授权码"
              value={values[KEY_SMTP_PASSWORD]}
              onValueChange={v => onChange(KEY_SMTP_PASSWORD, v)}
            />
          </SettingsFieldGroup>

          <SettingsFieldGroup cols={2}>
            <FormInput
              label="发件人名称"
              placeholder="AnHeYu Blog"
              value={values[KEY_SMTP_SENDER_NAME]}
              onValueChange={v => onChange(KEY_SMTP_SENDER_NAME, v)}
            />
            <FormInput
              label="发件人邮箱"
              placeholder="noreply@example.com"
              value={values[KEY_SMTP_SENDER_EMAIL]}
              onValueChange={v => onChange(KEY_SMTP_SENDER_EMAIL, v)}
              description="建议与 SMTP 用户名一致"
            />
          </SettingsFieldGroup>

          <FormInput
            label="回复邮箱"
            placeholder="reply@example.com"
            value={values[KEY_SMTP_REPLY_TO_EMAIL]}
            onValueChange={v => onChange(KEY_SMTP_REPLY_TO_EMAIL, v)}
            description="收件人回复时使用的邮箱地址"
          />

          <FormSwitch
            label="强制 SSL"
            description="使用 SSL/TLS 加密连接 SMTP 服务器"
            checked={values[KEY_SMTP_FORCE_SSL] === "true"}
            onCheckedChange={v => onChange(KEY_SMTP_FORCE_SSL, String(v))}
          />
        </div>
      </SettingsSection>

      {/* 密码重置 */}
      <SettingsSection
        title="密码重置"
        description="用户请求重置密码时发送。建议主题清晰标识站点名，并在模板中明确链接有效期，降低钓鱼误判。"
      >
        <FormInput
          label="邮件主题"
          placeholder="[{{site_name}}] 密码重置"
          value={values[KEY_RESET_PASSWORD_SUBJECT]}
          onValueChange={v => onChange(KEY_RESET_PASSWORD_SUBJECT, v)}
        />
        <PlaceholderHelpPanel
          title="可用占位符"
          subtitle="点击可复制"
          items={[{ variable: "{{site_name}}", description: "站点名称" }]}
          className="mt-2"
        />
        <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground/70">
          配置建议：重置链接最好标注有效分钟数，并提醒“若非本人操作请忽略此邮件”。
        </div>
        <FormMonacoEditor
          label="邮件模板"
          language="html"
          value={values[KEY_RESET_PASSWORD_TEMPLATE]}
          onValueChange={v => onChange(KEY_RESET_PASSWORD_TEMPLATE, v)}
          height={220}
          wordWrap
        />
        <PlaceholderHelpPanel
          title="可用占位符"
          subtitle="点击可复制"
          items={[
            { variable: "{{nick}}", description: "用户昵称" },
            { variable: "{{reset_link}}", description: "重置链接" },
            { variable: "{{site_name}}", description: "站点名称" },
            { variable: "{{expire_minutes}}", description: "链接有效分钟数" },
          ]}
          className="mt-2"
        />
      </SettingsSection>

      {/* 账号激活 */}
      <SettingsSection
        title="账号激活"
        description="启用后，新用户注册将收到激活邮件。建议与注册流程文案保持一致，避免用户误认为注册失败。"
      >
        <FormSwitch
          label="启用账号激活"
          description="新用户注册后需要通过邮件激活账号"
          checked={values[KEY_ENABLE_USER_ACTIVATION] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_USER_ACTIVATION, String(v))}
        />
        <FormInput
          label="邮件主题"
          placeholder="[{{site_name}}] 账号激活"
          value={values[KEY_ACTIVATE_ACCOUNT_SUBJECT]}
          onValueChange={v => onChange(KEY_ACTIVATE_ACCOUNT_SUBJECT, v)}
        />
        <PlaceholderHelpPanel
          title="可用占位符"
          subtitle="点击可复制"
          items={[{ variable: "{{site_name}}", description: "站点名称" }]}
          className="mt-2"
        />
        <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground/70">
          配置建议：激活模板中建议明确说明“点击后将自动登录/跳转到哪里”，减少用户流失。
        </div>
        <FormMonacoEditor
          label="邮件模板"
          language="html"
          value={values[KEY_ACTIVATE_ACCOUNT_TEMPLATE]}
          onValueChange={v => onChange(KEY_ACTIVATE_ACCOUNT_TEMPLATE, v)}
          height={220}
          wordWrap
        />
        <PlaceholderHelpPanel
          title="可用占位符"
          subtitle="点击可复制"
          items={[
            { variable: "{{nick}}", description: "用户昵称" },
            { variable: "{{activate_link}}", description: "激活链接" },
            { variable: "{{site_name}}", description: "站点名称" },
            { variable: "{{expire_minutes}}", description: "链接有效分钟数" },
          ]}
          className="mt-2"
        />
      </SettingsSection>
    </div>
  );
}
