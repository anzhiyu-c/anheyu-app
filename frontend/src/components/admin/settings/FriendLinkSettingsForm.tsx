"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormJsonEditor } from "@/components/ui/form-json-editor";
import { FormMonacoEditor } from "@/components/ui/form-monaco-editor";
import { FormStringList } from "@/components/ui/form-string-list";
import { PlaceholderHelpPanel } from "@/components/ui/placeholder-help-panel";
import { SettingsHelpPanel } from "./SettingsHelpPanel";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_FRIEND_LINK_DEFAULT_CATEGORY,
  KEY_FRIEND_LINK_APPLY_CONDITION,
  KEY_FRIEND_LINK_APPLY_CUSTOM_CODE_HTML,
  KEY_FRIEND_LINK_PLACEHOLDER_NAME,
  KEY_FRIEND_LINK_PLACEHOLDER_URL,
  KEY_FRIEND_LINK_PLACEHOLDER_LOGO,
  KEY_FRIEND_LINK_PLACEHOLDER_DESC,
  KEY_FRIEND_LINK_PLACEHOLDER_SITESHOT,
  KEY_FRIEND_LINK_NOTIFY_ADMIN,
  KEY_FRIEND_LINK_SC_MAIL_NOTIFY,
  KEY_FRIEND_LINK_PUSHOO_CHANNEL,
  KEY_FRIEND_LINK_PUSHOO_URL,
  KEY_FRIEND_LINK_WEBHOOK_BODY,
  KEY_FRIEND_LINK_WEBHOOK_HEADERS,
  KEY_FRIEND_LINK_MAIL_SUBJECT_ADMIN,
  KEY_FRIEND_LINK_MAIL_TEMPLATE_ADMIN,
  KEY_FRIEND_LINK_REVIEW_MAIL_ENABLE,
  KEY_FRIEND_LINK_REVIEW_MAIL_SUBJECT_APPROVED,
  KEY_FRIEND_LINK_REVIEW_MAIL_TEMPLATE_APPROVED,
  KEY_FRIEND_LINK_REVIEW_MAIL_SUBJECT_REJECTED,
  KEY_FRIEND_LINK_REVIEW_MAIL_TEMPLATE_REJECTED,
} from "@/lib/settings/setting-keys";

interface FriendLinkSettingsFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

function isStringArrayJson(raw: string | undefined): boolean {
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(item => typeof item === "string");
  } catch {
    return false;
  }
}

export function FriendLinkSettingsForm({ values, onChange, loading }: FriendLinkSettingsFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const notifyAdminEnabled = values[KEY_FRIEND_LINK_NOTIFY_ADMIN] === "true";
  const hasNotifyConfigHistory =
    !notifyAdminEnabled &&
    (values[KEY_FRIEND_LINK_SC_MAIL_NOTIFY] === "true" ||
      [
        KEY_FRIEND_LINK_PUSHOO_CHANNEL,
        KEY_FRIEND_LINK_PUSHOO_URL,
        KEY_FRIEND_LINK_WEBHOOK_BODY,
        KEY_FRIEND_LINK_WEBHOOK_HEADERS,
        KEY_FRIEND_LINK_MAIL_SUBJECT_ADMIN,
        KEY_FRIEND_LINK_MAIL_TEMPLATE_ADMIN,
      ]
        .map(key => values[key] ?? "")
        .some(value => value.trim() !== ""));
  const mailNotifyEnabled = values[KEY_FRIEND_LINK_SC_MAIL_NOTIFY] === "true";
  const hasMailNotifyHistory =
    notifyAdminEnabled &&
    !mailNotifyEnabled &&
    [KEY_FRIEND_LINK_MAIL_SUBJECT_ADMIN, KEY_FRIEND_LINK_MAIL_TEMPLATE_ADMIN]
      .map(key => values[key] ?? "")
      .some(value => value.trim() !== "");
  const reviewMailEnabled = values[KEY_FRIEND_LINK_REVIEW_MAIL_ENABLE] === "true";
  const hasReviewMailHistory =
    !reviewMailEnabled &&
    [
      KEY_FRIEND_LINK_REVIEW_MAIL_SUBJECT_APPROVED,
      KEY_FRIEND_LINK_REVIEW_MAIL_TEMPLATE_APPROVED,
      KEY_FRIEND_LINK_REVIEW_MAIL_SUBJECT_REJECTED,
      KEY_FRIEND_LINK_REVIEW_MAIL_TEMPLATE_REJECTED,
    ]
      .map(key => values[key] ?? "")
      .some(value => value.trim() !== "");
  const canVisualEditApplyCondition = isStringArrayJson(values[KEY_FRIEND_LINK_APPLY_CONDITION]);

  return (
    <div className="space-y-8">
      {/* 基本配置 */}
      <SettingsSection title="基本配置">
        <FormInput
          label="默认分类"
          placeholder="请输入友链默认分类名"
          value={values[KEY_FRIEND_LINK_DEFAULT_CATEGORY]}
          onValueChange={v => onChange(KEY_FRIEND_LINK_DEFAULT_CATEGORY, v)}
        />
        <FormJsonEditor
          label="申请条件（JSON 兜底）"
          description={'当前数据不是字符串数组，暂时切换为 JSON 编辑模式。建议格式：["条件1","条件2"]'}
          value={values[KEY_FRIEND_LINK_APPLY_CONDITION]}
          onValueChange={v => onChange(KEY_FRIEND_LINK_APPLY_CONDITION, v)}
          className={canVisualEditApplyCondition ? "hidden" : ""}
        />
        <FormStringList
          label="申请条件"
          description="申请友链时用户需勾选的条款，每行一条，支持 HTML（如 <b>加粗</b>）"
          value={values[KEY_FRIEND_LINK_APPLY_CONDITION]}
          onValueChange={v => onChange(KEY_FRIEND_LINK_APPLY_CONDITION, v)}
          placeholder="例如：我已添加贵站友链"
          addButtonText="添加条件"
          className={canVisualEditApplyCondition ? "" : "hidden"}
        />
      </SettingsSection>

      {/* 申请表单 */}
      <SettingsSection title="申请表单">
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="名称占位符"
            placeholder="请输入站点名称"
            value={values[KEY_FRIEND_LINK_PLACEHOLDER_NAME]}
            onValueChange={v => onChange(KEY_FRIEND_LINK_PLACEHOLDER_NAME, v)}
          />
          <FormInput
            label="URL 占位符"
            placeholder="https://example.com"
            value={values[KEY_FRIEND_LINK_PLACEHOLDER_URL]}
            onValueChange={v => onChange(KEY_FRIEND_LINK_PLACEHOLDER_URL, v)}
          />
        </SettingsFieldGroup>
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="Logo 占位符"
            placeholder="https://example.com/logo.png"
            value={values[KEY_FRIEND_LINK_PLACEHOLDER_LOGO]}
            onValueChange={v => onChange(KEY_FRIEND_LINK_PLACEHOLDER_LOGO, v)}
          />
          <FormInput
            label="描述占位符"
            placeholder="一句话介绍你的站点"
            value={values[KEY_FRIEND_LINK_PLACEHOLDER_DESC]}
            onValueChange={v => onChange(KEY_FRIEND_LINK_PLACEHOLDER_DESC, v)}
          />
        </SettingsFieldGroup>
        <FormInput
          label="截图占位符"
          placeholder="https://example.com/screenshot.png"
          value={values[KEY_FRIEND_LINK_PLACEHOLDER_SITESHOT]}
          onValueChange={v => onChange(KEY_FRIEND_LINK_PLACEHOLDER_SITESHOT, v)}
        />
      </SettingsSection>

      {/* 自定义代码 */}
      <SettingsSection title="自定义代码">
        <FormMonacoEditor
          label="申请表单自定义内容"
          language="html"
          value={values[KEY_FRIEND_LINK_APPLY_CUSTOM_CODE_HTML]}
          onValueChange={v => onChange(KEY_FRIEND_LINK_APPLY_CUSTOM_CODE_HTML, v)}
          height={260}
          wordWrap
          description="直接填写 HTML 作为申请页说明与自定义区块。"
        />
      </SettingsSection>

      {/* 通知配置 */}
      <SettingsSection
        title="通知配置"
        description="友链申请提交后可通知管理员（邮件、Pushoo、Webhook）。建议先配置一种通知链路并验证成功，再逐步叠加。"
      >
        <SettingsHelpPanel
          title="友链申请通知说明"
          steps={[
            { title: "先开通知管理员", description: "只有启用后，后续邮件/推送/Webhook 才会触发。" },
            { title: "优先单链路验证", description: "建议先用邮件通知验证，再接入 Pushoo/Webhook。" },
            { title: "再调模板变量", description: "模板中变量由后端替换，建议先用示例变量联调。" },
          ]}
          sections={[
            {
              title: "管理员通知参数",
              params: [
                { name: "friend_link.notify_admin", meaning: "是否通知管理员", required: true },
                { name: "friend_link.sc_mail_notify", meaning: "是否发送邮件通知" },
                { name: "friend_link.mail_subject_admin", meaning: "管理员邮件主题" },
              ],
            },
          ]}
          className="mb-1"
        />
        <FormSwitch
          label="通知管理员"
          description="有新的友链申请时通知管理员"
          checked={notifyAdminEnabled}
          onCheckedChange={v => onChange(KEY_FRIEND_LINK_NOTIFY_ADMIN, String(v))}
        />
        {notifyAdminEnabled ? (
          <>
            <FormSwitch
              label="邮件通知"
              description="通过邮件通知管理员"
              checked={mailNotifyEnabled}
              onCheckedChange={v => onChange(KEY_FRIEND_LINK_SC_MAIL_NOTIFY, String(v))}
            />
            <SettingsFieldGroup cols={2}>
              <FormSelect
                label="Pushoo Channel"
                placeholder="请选择推送渠道"
                value={values[KEY_FRIEND_LINK_PUSHOO_CHANNEL] ?? ""}
                onValueChange={v => onChange(KEY_FRIEND_LINK_PUSHOO_CHANNEL, v)}
              >
                <FormSelectItem key="bark">bark</FormSelectItem>
                <FormSelectItem key="webhook">webhook</FormSelectItem>
              </FormSelect>
              <FormInput
                label="Pushoo URL"
                placeholder="请输入 Pushoo 推送地址"
                value={values[KEY_FRIEND_LINK_PUSHOO_URL]}
                onValueChange={v => onChange(KEY_FRIEND_LINK_PUSHOO_URL, v)}
              />
            </SettingsFieldGroup>
            <FormJsonEditor
              label="Webhook Body"
              description="Webhook 请求体 JSON，可包含申请相关变量（如站点名、URL、描述等），具体变量名以后端为准"
              value={values[KEY_FRIEND_LINK_WEBHOOK_BODY]}
              onValueChange={v => onChange(KEY_FRIEND_LINK_WEBHOOK_BODY, v)}
            />
            <PlaceholderHelpPanel
              title="Webhook 常见变量"
              subtitle="点击可复制；以实际后端模板渲染为准"
              items={[
                { variable: "{{site_name}}", description: "当前站点名称" },
                { variable: "{{apply_site_name}}", description: "申请者站点名称" },
                { variable: "{{apply_url}}", description: "申请者 URL" },
                { variable: "{{apply_desc}}", description: "申请描述" },
              ]}
              className="mt-2"
            />
            <FormJsonEditor
              label="Webhook Headers"
              description={'请求头 JSON，如 {"Content-Type": "application/json"}，用于鉴权等'}
              value={values[KEY_FRIEND_LINK_WEBHOOK_HEADERS]}
              onValueChange={v => onChange(KEY_FRIEND_LINK_WEBHOOK_HEADERS, v)}
            />
            {mailNotifyEnabled ? (
              <>
                <FormInput
                  label="管理员邮件主题"
                  placeholder="新友链申请通知"
                  value={values[KEY_FRIEND_LINK_MAIL_SUBJECT_ADMIN]}
                  onValueChange={v => onChange(KEY_FRIEND_LINK_MAIL_SUBJECT_ADMIN, v)}
                />
                <FormMonacoEditor
                  label="管理员邮件模板"
                  language="html"
                  value={values[KEY_FRIEND_LINK_MAIL_TEMPLATE_ADMIN]}
                  onValueChange={v => onChange(KEY_FRIEND_LINK_MAIL_TEMPLATE_ADMIN, v)}
                  height={180}
                  wordWrap
                  description="HTML 模板，具体可用变量以后端渲染为准。"
                />
                <PlaceholderHelpPanel
                  title="可用占位符"
                  subtitle="常见变量，点击可复制；以实际后端为准"
                  items={[
                    { variable: "{{site_name}}", description: "站点名称" },
                    { variable: "{{apply_site_name}}", description: "申请者站点名" },
                    { variable: "{{apply_url}}", description: "申请者 URL" },
                    { variable: "{{apply_desc}}", description: "申请描述" },
                  ]}
                  className="mt-2"
                />
              </>
            ) : (
              hasMailNotifyHistory && (
                <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
                  邮件通知当前关闭，但检测到历史管理员邮件模板已保留；重新开启后会继续生效。
                </div>
              )
            )}
          </>
        ) : (
          hasNotifyConfigHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              管理员通知当前关闭，但检测到历史通知配置已保留；重新开启后会继续生效。
            </div>
          )
        )}
      </SettingsSection>

      {/* 审核邮件 */}
      <SettingsSection
        title="审核邮件"
        description="审核通过或拒绝后，可向申请者发送邮件。模板占位符统一使用 Go 模板变量（如 {{.SITE_NAME}}）。"
      >
        <SettingsHelpPanel
          title="审核邮件说明"
          steps={[
            { title: "启用审核邮件", description: "不启用时不会向申请者发送审核结果邮件。" },
            { title: "配置主题与模板", description: "分别配置通过、拒绝的邮件主题和 HTML 模板。" },
            { title: "使用占位符", description: "模板中可使用 {{.SITE_NAME}}、{{.LINK_URL}}、{{.REJECT_REASON}} 等变量，由后端渲染替换。" },
          ]}
          sections={[
            {
              title: "模板参数",
              params: [
                { name: "review_mail_enable", meaning: "是否启用审核结果邮件", required: true },
                { name: "review_mail_subject_approved", meaning: "通过邮件主题" },
                { name: "review_mail_subject_rejected", meaning: "拒绝邮件主题" },
                { name: "review_mail_template_*", meaning: "邮件 HTML 模板，可使用变量" },
              ],
            },
          ]}
          className="mb-1"
        />
        <FormSwitch
          label="启用审核邮件"
          description="友链审核结果通过邮件通知申请者"
          checked={reviewMailEnabled}
          onCheckedChange={v => onChange(KEY_FRIEND_LINK_REVIEW_MAIL_ENABLE, String(v))}
        />
        {reviewMailEnabled ? (
          <>
            <FormInput
              label="通过邮件主题"
              placeholder="【{{.SITE_NAME}}】友链申请已通过"
              value={values[KEY_FRIEND_LINK_REVIEW_MAIL_SUBJECT_APPROVED]}
              onValueChange={v => onChange(KEY_FRIEND_LINK_REVIEW_MAIL_SUBJECT_APPROVED, v)}
            />
            <FormMonacoEditor
              label="通过邮件模板"
              language="html"
              value={values[KEY_FRIEND_LINK_REVIEW_MAIL_TEMPLATE_APPROVED]}
              onValueChange={v => onChange(KEY_FRIEND_LINK_REVIEW_MAIL_TEMPLATE_APPROVED, v)}
              height={220}
              wordWrap
              description="具体可用变量以后端为准。"
            />
            <PlaceholderHelpPanel
              title="可用占位符"
              subtitle="常见变量，点击可复制；以实际后端为准"
              items={[
                { variable: "{{.SITE_NAME}}", description: "站点名称" },
                { variable: "{{.SITE_URL}}", description: "站点地址" },
                { variable: "{{.LINK_NAME}}", description: "申请站点名称" },
                { variable: "{{.LINK_URL}}", description: "申请站点地址" },
                { variable: "{{.LINK_DESCRIPTION}}", description: "申请站点描述" },
                { variable: "{{.REJECT_REASON}}", description: "拒绝原因（仅拒绝邮件可用）" },
              ]}
              className="mt-2"
            />
            <FormInput
              label="拒绝邮件主题"
              placeholder="【{{.SITE_NAME}}】友链申请未通过"
              value={values[KEY_FRIEND_LINK_REVIEW_MAIL_SUBJECT_REJECTED]}
              onValueChange={v => onChange(KEY_FRIEND_LINK_REVIEW_MAIL_SUBJECT_REJECTED, v)}
            />
            <FormMonacoEditor
              label="拒绝邮件模板"
              language="html"
              value={values[KEY_FRIEND_LINK_REVIEW_MAIL_TEMPLATE_REJECTED]}
              onValueChange={v => onChange(KEY_FRIEND_LINK_REVIEW_MAIL_TEMPLATE_REJECTED, v)}
              height={220}
              wordWrap
              description="具体可用变量以后端为准。"
            />
          </>
        ) : (
          hasReviewMailHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              审核邮件当前关闭，但检测到历史模板配置已保留；重新开启后将继续生效。
            </div>
          )
        )}
      </SettingsSection>
    </div>
  );
}
