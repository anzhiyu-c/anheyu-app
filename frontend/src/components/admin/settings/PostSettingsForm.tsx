"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormImageUpload } from "@/components/ui/form-image-upload";
import { FormCodeEditor } from "@/components/ui/form-code-editor";
import { FormMonacoEditor } from "@/components/ui/form-monaco-editor";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { PlaceholderHelpPanel } from "@/components/ui/placeholder-help-panel";
import { SettingsHelpPanel } from "./SettingsHelpPanel";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_IP_API,
  KEY_IP_API_TOKEN,
  KEY_POST_EXPIRATION_TIME,
  KEY_POST_DEFAULT_COVER,
  KEY_POST_DOUBLE_COLUMN,
  KEY_POST_PAGE_SIZE,
  KEY_POST_ENABLE_PRIMARY_COLOR,
  KEY_POST_404_IMAGE,
  KEY_POST_REWARD_ENABLE,
  KEY_POST_REWARD_WECHAT_QR,
  KEY_POST_REWARD_ALIPAY_QR,
  KEY_POST_REWARD_WECHAT_ENABLE,
  KEY_POST_REWARD_ALIPAY_ENABLE,
  KEY_POST_REWARD_BUTTON_TEXT,
  KEY_POST_REWARD_TITLE,
  KEY_POST_REWARD_WECHAT_LABEL,
  KEY_POST_REWARD_ALIPAY_LABEL,
  KEY_POST_REWARD_LIST_BTN_TEXT,
  KEY_POST_REWARD_LIST_BTN_DESC,
  KEY_POST_CODE_MAX_LINES,
  KEY_POST_CODE_MAC_STYLE,
  KEY_POST_COPY_ENABLE,
  KEY_POST_COPY_COPYRIGHT_ENABLE,
  KEY_POST_COPY_COPYRIGHT_ORIGINAL,
  KEY_POST_COPY_COPYRIGHT_REPRINT,
  KEY_POST_TOC_HASH_MODE,
  KEY_POST_WAVES_ENABLE,
  KEY_POST_COPYRIGHT_ORIGINAL,
  KEY_POST_COPYRIGHT_REPRINT_WITH_URL,
  KEY_POST_COPYRIGHT_REPRINT_NO_URL,
  KEY_POST_SHOW_REWARD_BTN,
  KEY_POST_SHOW_SHARE_BTN,
  KEY_POST_SHOW_SUBSCRIBE_BTN,
  KEY_POST_SUBSCRIBE_ENABLE,
  KEY_POST_SUBSCRIBE_BTN_TEXT,
  KEY_POST_SUBSCRIBE_TITLE,
  KEY_POST_SUBSCRIBE_DESC,
  KEY_POST_SUBSCRIBE_MAIL_SUBJECT,
  KEY_POST_SUBSCRIBE_MAIL_TEMPLATE,
  KEY_CDN_ENABLE,
  KEY_CDN_PROVIDER,
  KEY_CDN_SECRET_ID,
  KEY_CDN_SECRET_KEY,
  KEY_CDN_REGION,
  KEY_CDN_DOMAIN,
  KEY_CDN_ZONE_ID,
  KEY_CDN_BASE_URL,
  KEY_MULTI_AUTHOR_ENABLE,
  KEY_MULTI_AUTHOR_NEED_REVIEW,
  KEY_ARTICLE_REVIEW_NOTIFY_ENABLE,
  KEY_ARTICLE_REVIEW_NOTIFY_EMAIL,
  KEY_ARTICLE_REVIEW_NOTIFY_PUSH,
  KEY_ARTICLE_REVIEW_PUSH_CHANNEL,
  KEY_ARTICLE_REVIEW_PUSH_URL,
  KEY_ARTICLE_REVIEW_WEBHOOK_BODY,
  KEY_ARTICLE_REVIEW_WEBHOOK_HEADERS,
  KEY_ARTICLE_REVIEW_MAIL_SUBJECT_APPROVED,
  KEY_ARTICLE_REVIEW_MAIL_TEMPLATE_APPROVED,
  KEY_ARTICLE_REVIEW_MAIL_SUBJECT_REJECTED,
  KEY_ARTICLE_REVIEW_MAIL_TEMPLATE_REJECTED,
} from "@/lib/settings/setting-keys";

interface PostSettingsFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function PostSettingsForm({ values, onChange, loading }: PostSettingsFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const hasCdnHistory =
    values[KEY_CDN_ENABLE] !== "true" &&
    [
      KEY_CDN_PROVIDER,
      KEY_CDN_SECRET_ID,
      KEY_CDN_SECRET_KEY,
      KEY_CDN_REGION,
      KEY_CDN_DOMAIN,
      KEY_CDN_ZONE_ID,
      KEY_CDN_BASE_URL,
    ]
      .map(key => values[key] ?? "")
      .some(value => value.trim() !== "");
  const subscribeEnabled = values[KEY_POST_SUBSCRIBE_ENABLE] === "true";
  const hasSubscribeHistory =
    !subscribeEnabled &&
    [KEY_POST_SUBSCRIBE_BTN_TEXT, KEY_POST_SUBSCRIBE_TITLE, KEY_POST_SUBSCRIBE_DESC, KEY_POST_SUBSCRIBE_MAIL_SUBJECT]
      .map(key => values[key] ?? "")
      .some(value => value.trim() !== "");
  const reviewNotifyEnabled = values[KEY_ARTICLE_REVIEW_NOTIFY_ENABLE] === "true";
  const reviewNotifyPushEnabled = values[KEY_ARTICLE_REVIEW_NOTIFY_PUSH] === "true";
  const reviewNotifyEmailEnabled = values[KEY_ARTICLE_REVIEW_NOTIFY_EMAIL] === "true";
  const hasReviewNotifyHistory =
    !reviewNotifyEnabled &&
    (values[KEY_ARTICLE_REVIEW_NOTIFY_EMAIL] === "true" ||
      values[KEY_ARTICLE_REVIEW_NOTIFY_PUSH] === "true" ||
      [
        KEY_ARTICLE_REVIEW_PUSH_CHANNEL,
        KEY_ARTICLE_REVIEW_PUSH_URL,
        KEY_ARTICLE_REVIEW_WEBHOOK_BODY,
        KEY_ARTICLE_REVIEW_WEBHOOK_HEADERS,
      ]
        .map(key => values[key] ?? "")
        .some(value => value.trim() !== ""));
  const hasReviewPushHistory =
    reviewNotifyEnabled &&
    !reviewNotifyPushEnabled &&
    [
      KEY_ARTICLE_REVIEW_PUSH_CHANNEL,
      KEY_ARTICLE_REVIEW_PUSH_URL,
      KEY_ARTICLE_REVIEW_WEBHOOK_BODY,
      KEY_ARTICLE_REVIEW_WEBHOOK_HEADERS,
    ]
      .map(key => values[key] ?? "")
      .some(value => value.trim() !== "");

  return (
    <div className="space-y-8">
      {/* 基本配置 */}
      <SettingsSection title="基本配置">
        <FormImageUpload
          label="默认封面"
          value={values[KEY_POST_DEFAULT_COVER]}
          onValueChange={v => onChange(KEY_POST_DEFAULT_COVER, v)}
          description="文章没有设置封面时使用的默认封面图"
        />

        <SettingsFieldGroup cols={2}>
          <FormSwitch
            label="双栏布局"
            description="文章列表是否使用双栏布局"
            checked={values[KEY_POST_DOUBLE_COLUMN] === "true"}
            onCheckedChange={v => onChange(KEY_POST_DOUBLE_COLUMN, String(v))}
          />
          <FormSwitch
            label="启用主色调标签"
            description="文章列表封面启用主色调标签"
            checked={values[KEY_POST_ENABLE_PRIMARY_COLOR] === "true"}
            onCheckedChange={v => onChange(KEY_POST_ENABLE_PRIMARY_COLOR, String(v))}
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup cols={2}>
          <FormInput
            label="每页文章数"
            placeholder="10"
            value={values[KEY_POST_PAGE_SIZE]}
            onValueChange={v => onChange(KEY_POST_PAGE_SIZE, v)}
          />
          <FormInput
            label="文章过期提示时间（天）"
            placeholder="30"
            value={values[KEY_POST_EXPIRATION_TIME]}
            onValueChange={v => onChange(KEY_POST_EXPIRATION_TIME, v)}
            description="文章超过该天数显示过期提示，0 为不提示"
          />
        </SettingsFieldGroup>

        <FormImageUpload
          label="404 页面图片"
          value={values[KEY_POST_404_IMAGE]}
          onValueChange={v => onChange(KEY_POST_404_IMAGE, v)}
        />

        <SettingsFieldGroup cols={2}>
          <FormInput
            label="IP 查询 API"
            placeholder="https://api.example.com/ip"
            value={values[KEY_IP_API]}
            onValueChange={v => onChange(KEY_IP_API, v)}
          />
          <FormInput
            label="IP API Token"
            placeholder="请输入 Token"
            type="password"
            value={values[KEY_IP_API_TOKEN]}
            onValueChange={v => onChange(KEY_IP_API_TOKEN, v)}
            autoComplete="new-password"
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* 代码块 */}
      <SettingsSection title="代码块">
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="代码最大显示行数"
            placeholder="留空则不限制"
            value={values[KEY_POST_CODE_MAX_LINES]}
            onValueChange={v => onChange(KEY_POST_CODE_MAX_LINES, v)}
            description="超过该行数后折叠显示"
          />
          <FormSwitch
            label="Mac 风格代码块"
            description="代码块顶部显示 Mac 风格的三色圆点"
            checked={values[KEY_POST_CODE_MAC_STYLE] === "true"}
            onCheckedChange={v => onChange(KEY_POST_CODE_MAC_STYLE, String(v))}
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* 复制版权 */}
      <SettingsSection title="复制版权">
        <SettingsFieldGroup cols={2}>
          <FormSwitch
            label="启用复制功能"
            description="是否允许用户复制文章内容"
            checked={values[KEY_POST_COPY_ENABLE] === "true"}
            onCheckedChange={v => onChange(KEY_POST_COPY_ENABLE, String(v))}
          />
          <FormSwitch
            label="复制追加版权信息"
            description="复制时自动在内容末尾追加版权声明"
            checked={values[KEY_POST_COPY_COPYRIGHT_ENABLE] === "true"}
            onCheckedChange={v => onChange(KEY_POST_COPY_COPYRIGHT_ENABLE, String(v))}
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup cols={2}>
          <div className="space-y-2">
            <FormInput
              label="原创版权文本"
              placeholder="版权声明：本文为原创..."
              value={values[KEY_POST_COPY_COPYRIGHT_ORIGINAL]}
              onValueChange={v => onChange(KEY_POST_COPY_COPYRIGHT_ORIGINAL, v)}
            />
            <PlaceholderHelpPanel
              title="原创可用的魔法变量"
              subtitle="点击可复制"
              items={[
                { variable: "{siteName}", description: "站点名称" },
                { variable: "{author}", description: "作者" },
                { variable: "{url}", description: "当前文章地址" },
              ]}
            />
          </div>
          <div className="space-y-2">
            <FormInput
              label="转载版权文本"
              placeholder="版权声明：本文为转载..."
              value={values[KEY_POST_COPY_COPYRIGHT_REPRINT]}
              onValueChange={v => onChange(KEY_POST_COPY_COPYRIGHT_REPRINT, v)}
            />
            <PlaceholderHelpPanel
              title="转载可用的魔法变量"
              subtitle="点击可复制"
              items={[
                { variable: "{originalAuthor}", description: "原作者" },
                { variable: "{originalUrl}", description: "原文链接" },
                { variable: "{currentUrl}", description: "当前文章地址" },
              ]}
            />
          </div>
        </SettingsFieldGroup>
      </SettingsSection>

      {/* 目录与波浪 */}
      <SettingsSection title="目录与波浪">
        <FormSelect
          label="目录哈希模式"
          value={values[KEY_POST_TOC_HASH_MODE]}
          onValueChange={v => onChange(KEY_POST_TOC_HASH_MODE, v)}
          placeholder="请选择模式"
          description="点击目录时 URL 哈希的更新方式"
        >
          <FormSelectItem key="replace">replace（替换哈希）</FormSelectItem>
          <FormSelectItem key="scroll">scroll（滚动更新）</FormSelectItem>
          <FormSelectItem key="click">click（点击更新）</FormSelectItem>
          <FormSelectItem key="none">none（不更新）</FormSelectItem>
        </FormSelect>

        <FormSwitch
          label="启用波浪效果"
          description="文章页面底部显示波浪动画效果"
          checked={values[KEY_POST_WAVES_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_POST_WAVES_ENABLE, String(v))}
        />
      </SettingsSection>

      {/* 打赏配置 */}
      <SettingsSection title="打赏配置">
        <FormSwitch
          label="启用打赏"
          description="是否在文章底部显示打赏按钮"
          checked={values[KEY_POST_REWARD_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_POST_REWARD_ENABLE, String(v))}
        />

        <SettingsFieldGroup cols={2}>
          <FormInput
            label="打赏按钮文本"
            placeholder="打赏"
            value={values[KEY_POST_REWARD_BUTTON_TEXT]}
            onValueChange={v => onChange(KEY_POST_REWARD_BUTTON_TEXT, v)}
          />
          <FormInput
            label="打赏弹窗标题"
            placeholder="感谢您的支持"
            value={values[KEY_POST_REWARD_TITLE]}
            onValueChange={v => onChange(KEY_POST_REWARD_TITLE, v)}
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup cols={2}>
          <FormSwitch
            label="启用微信打赏"
            checked={values[KEY_POST_REWARD_WECHAT_ENABLE] === "true"}
            onCheckedChange={v => onChange(KEY_POST_REWARD_WECHAT_ENABLE, String(v))}
          />
          <FormSwitch
            label="启用支付宝打赏"
            checked={values[KEY_POST_REWARD_ALIPAY_ENABLE] === "true"}
            onCheckedChange={v => onChange(KEY_POST_REWARD_ALIPAY_ENABLE, String(v))}
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup cols={2}>
          <FormImageUpload
            label="微信收款码"
            value={values[KEY_POST_REWARD_WECHAT_QR]}
            onValueChange={v => onChange(KEY_POST_REWARD_WECHAT_QR, v)}
          />
          <FormImageUpload
            label="支付宝收款码"
            value={values[KEY_POST_REWARD_ALIPAY_QR]}
            onValueChange={v => onChange(KEY_POST_REWARD_ALIPAY_QR, v)}
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup cols={2}>
          <FormInput
            label="微信标签"
            placeholder="微信"
            value={values[KEY_POST_REWARD_WECHAT_LABEL]}
            onValueChange={v => onChange(KEY_POST_REWARD_WECHAT_LABEL, v)}
          />
          <FormInput
            label="支付宝标签"
            placeholder="支付宝"
            value={values[KEY_POST_REWARD_ALIPAY_LABEL]}
            onValueChange={v => onChange(KEY_POST_REWARD_ALIPAY_LABEL, v)}
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup cols={2}>
          <FormInput
            label="打赏列表按钮文本"
            placeholder="查看打赏列表"
            value={values[KEY_POST_REWARD_LIST_BTN_TEXT]}
            onValueChange={v => onChange(KEY_POST_REWARD_LIST_BTN_TEXT, v)}
          />
          <FormInput
            label="打赏列表按钮描述"
            placeholder="感谢以下小伙伴的支持"
            value={values[KEY_POST_REWARD_LIST_BTN_DESC]}
            onValueChange={v => onChange(KEY_POST_REWARD_LIST_BTN_DESC, v)}
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* 版权区域 */}
      <SettingsSection title="版权区域">
        <SettingsFieldGroup cols={2}>
          <FormSwitch
            label="显示打赏按钮"
            checked={values[KEY_POST_SHOW_REWARD_BTN] === "true"}
            onCheckedChange={v => onChange(KEY_POST_SHOW_REWARD_BTN, String(v))}
          />
          <FormSwitch
            label="显示分享按钮"
            checked={values[KEY_POST_SHOW_SHARE_BTN] === "true"}
            onCheckedChange={v => onChange(KEY_POST_SHOW_SHARE_BTN, String(v))}
          />
        </SettingsFieldGroup>

        <FormSwitch
          label="显示订阅按钮"
          checked={values[KEY_POST_SHOW_SUBSCRIBE_BTN] === "true"}
          onCheckedChange={v => onChange(KEY_POST_SHOW_SUBSCRIBE_BTN, String(v))}
        />

        <FormCodeEditor
          label="原创版权模板"
          language="html"
          value={values[KEY_POST_COPYRIGHT_ORIGINAL]}
          onValueChange={v => onChange(KEY_POST_COPYRIGHT_ORIGINAL, v)}
          minRows={6}
        />
        <PlaceholderHelpPanel
          title="可用占位符"
          subtitle="点击可复制"
          items={[
            { variable: "{license}", description: "许可协议文案" },
            { variable: "{licenseUrl}", description: "协议链接" },
            { variable: "{author}", description: "作者" },
            { variable: "{siteUrl}", description: "站点链接" },
          ]}
          className="mt-2"
        />

        <FormCodeEditor
          label="转载版权模板（有来源链接）"
          language="html"
          value={values[KEY_POST_COPYRIGHT_REPRINT_WITH_URL]}
          onValueChange={v => onChange(KEY_POST_COPYRIGHT_REPRINT_WITH_URL, v)}
          minRows={6}
        />
        <PlaceholderHelpPanel
          title="可用占位符"
          subtitle="点击可复制"
          items={[
            { variable: "{originalAuthor}", description: "原作者" },
            { variable: "{originalUrl}", description: "原文链接" },
          ]}
          className="mt-2"
        />

        <FormCodeEditor
          label="转载版权模板（无来源链接）"
          language="html"
          value={values[KEY_POST_COPYRIGHT_REPRINT_NO_URL]}
          onValueChange={v => onChange(KEY_POST_COPYRIGHT_REPRINT_NO_URL, v)}
          minRows={6}
        />
        <PlaceholderHelpPanel
          title="可用占位符"
          subtitle="点击可复制"
          items={[{ variable: "{originalAuthor}", description: "原作者" }]}
          className="mt-2"
        />
      </SettingsSection>

      {/* 订阅配置 */}
      <SettingsSection title="订阅配置">
        <SettingsHelpPanel
          title="文章订阅配置说明"
          steps={[
            { title: "先启用订阅", description: "关闭时不会展示订阅入口，也不会发送订阅邮件。" },
            {
              title: "配置邮件主题与模板",
              description: "建议先使用默认模板，再按需增改样式。模板可用变量见各编辑器下方说明。",
            },
            { title: "验证退订链路", description: "测试一次订阅与退订，确认链接可访问。" },
          ]}
          className="mb-1"
        />
        <FormSwitch
          label="启用订阅"
          description="是否允许用户订阅文章更新通知"
          checked={subscribeEnabled}
          onCheckedChange={v => onChange(KEY_POST_SUBSCRIBE_ENABLE, String(v))}
        />

        {subscribeEnabled ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="订阅按钮文本"
                placeholder="订阅"
                value={values[KEY_POST_SUBSCRIBE_BTN_TEXT]}
                onValueChange={v => onChange(KEY_POST_SUBSCRIBE_BTN_TEXT, v)}
              />
              <FormInput
                label="订阅弹窗标题"
                placeholder="订阅更新"
                value={values[KEY_POST_SUBSCRIBE_TITLE]}
                onValueChange={v => onChange(KEY_POST_SUBSCRIBE_TITLE, v)}
              />
            </SettingsFieldGroup>

            <FormInput
              label="订阅弹窗描述"
              placeholder="输入邮箱，获取文章更新通知"
              value={values[KEY_POST_SUBSCRIBE_DESC]}
              onValueChange={v => onChange(KEY_POST_SUBSCRIBE_DESC, v)}
            />

            <FormInput
              label="订阅邮件主题"
              placeholder="您订阅的文章有更新"
              value={values[KEY_POST_SUBSCRIBE_MAIL_SUBJECT]}
              onValueChange={v => onChange(KEY_POST_SUBSCRIBE_MAIL_SUBJECT, v)}
            />

            <FormMonacoEditor
              label="订阅邮件模板"
              language="html"
              value={values[KEY_POST_SUBSCRIBE_MAIL_TEMPLATE]}
              onValueChange={v => onChange(KEY_POST_SUBSCRIBE_MAIL_TEMPLATE, v)}
              height={200}
              wordWrap
              description="具体可用变量以后端邮件渲染为准。"
            />
            <PlaceholderHelpPanel
              title="可用占位符"
              subtitle="点击可复制"
              items={[
                { variable: "{{post_title}}", description: "文章标题" },
                { variable: "{{post_link}}", description: "文章链接" },
                { variable: "{{unsubscribe_link}}", description: "退订链接" },
                { variable: "{{site_name}}", description: "站点名称" },
              ]}
              className="mt-2"
            />
          </>
        ) : (
          hasSubscribeHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              订阅功能当前关闭，但历史订阅文案与邮件模板已保留；重新开启后会继续生效。
            </div>
          )
        )}
      </SettingsSection>

      {/* CDN 缓存清除 */}
      <SettingsSection title="CDN 缓存清除">
        <FormSwitch
          label="启用 CDN 缓存清除"
          description="文章发布/更新时自动清除 CDN 缓存"
          checked={values[KEY_CDN_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_CDN_ENABLE, String(v))}
        />

        {hasCdnHistory && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
            检测到历史 CDN 配置。当前开关关闭时不会生效，但配置仍已保留；重新开启后会继续使用。
          </div>
        )}

        {values[KEY_CDN_ENABLE] === "true" && (
          <>
            <FormSelect
              label="CDN 服务商"
              value={values[KEY_CDN_PROVIDER]}
              onValueChange={v => onChange(KEY_CDN_PROVIDER, v)}
              placeholder="请选择 CDN 服务商"
              description="选择您使用的 CDN 服务提供商"
            >
              <FormSelectItem key="tencent">腾讯云 CDN</FormSelectItem>
              <FormSelectItem key="edgeone">EdgeOne</FormSelectItem>
              <FormSelectItem key="aliyun-esa">阿里云 ESA</FormSelectItem>
              <FormSelectItem key="cdnfly">CDNFLY</FormSelectItem>
            </FormSelect>

            {values[KEY_CDN_PROVIDER] === "cdnfly" ? (
              <>
                <SettingsFieldGroup cols={2}>
                  <FormInput
                    label="API Key"
                    type="password"
                    placeholder="请输入 API Key"
                    value={values[KEY_CDN_SECRET_KEY]}
                    onValueChange={v => onChange(KEY_CDN_SECRET_KEY, v)}
                  />
                  <FormInput
                    label="API Secret"
                    type="password"
                    placeholder="请输入 API Secret"
                    value={values[KEY_CDN_SECRET_ID]}
                    onValueChange={v => onChange(KEY_CDN_SECRET_ID, v)}
                  />
                </SettingsFieldGroup>

                <FormInput
                  label="Base URL"
                  placeholder="https://api.example.com"
                  value={values[KEY_CDN_BASE_URL]}
                  onValueChange={v => onChange(KEY_CDN_BASE_URL, v)}
                  description="CDNFLY 面板 API 地址"
                />
              </>
            ) : (
              <>
                <SettingsFieldGroup cols={2}>
                  <FormInput
                    label={values[KEY_CDN_PROVIDER] === "aliyun-esa" ? "AccessKey ID" : "Secret ID"}
                    type="password"
                    placeholder={values[KEY_CDN_PROVIDER] === "aliyun-esa" ? "请输入 AccessKey ID" : "请输入 Secret ID"}
                    value={values[KEY_CDN_SECRET_ID]}
                    onValueChange={v => onChange(KEY_CDN_SECRET_ID, v)}
                    description={
                      values[KEY_CDN_PROVIDER] === "aliyun-esa"
                        ? "阿里云控制台「AccessKey 管理」中获取"
                        : "腾讯云控制台「访问管理 > API 密钥管理」中获取"
                    }
                  />
                  <FormInput
                    label={values[KEY_CDN_PROVIDER] === "aliyun-esa" ? "AccessKey Secret" : "Secret Key"}
                    type="password"
                    placeholder={
                      values[KEY_CDN_PROVIDER] === "aliyun-esa" ? "请输入 AccessKey Secret" : "请输入 Secret Key"
                    }
                    value={values[KEY_CDN_SECRET_KEY]}
                    onValueChange={v => onChange(KEY_CDN_SECRET_KEY, v)}
                  />
                </SettingsFieldGroup>

                {values[KEY_CDN_PROVIDER] !== "aliyun-esa" && (
                  <FormInput
                    label="腾讯云地域"
                    placeholder={values[KEY_CDN_PROVIDER] === "edgeone" ? "ap-singapore" : "ap-beijing"}
                    value={values[KEY_CDN_REGION]}
                    onValueChange={v => onChange(KEY_CDN_REGION, v)}
                    description={
                      values[KEY_CDN_PROVIDER] === "edgeone"
                        ? "EdgeOne 默认使用 ap-singapore"
                        : "常用：ap-beijing、ap-shanghai、ap-guangzhou"
                    }
                  />
                )}

                {values[KEY_CDN_PROVIDER] === "tencent" && (
                  <FormInput
                    label="CDN 加速域名"
                    placeholder="blog.example.com"
                    value={values[KEY_CDN_DOMAIN]}
                    onValueChange={v => onChange(KEY_CDN_DOMAIN, v)}
                    description="腾讯云 CDN 的加速域名（不含 http://），仅腾讯云 CDN 需要"
                  />
                )}

                {values[KEY_CDN_PROVIDER] === "edgeone" && (
                  <FormInput
                    label="EdgeOne 站点 ID"
                    placeholder="zone-xxxxxxxxxxxx"
                    value={values[KEY_CDN_ZONE_ID]}
                    onValueChange={v => onChange(KEY_CDN_ZONE_ID, v)}
                    description="EdgeOne 控制台「站点列表」中查看"
                  />
                )}

                {values[KEY_CDN_PROVIDER] === "aliyun-esa" && (
                  <FormInput
                    label="阿里云 ESA 站点 ID"
                    placeholder="123456789"
                    value={values[KEY_CDN_ZONE_ID]}
                    onValueChange={v => onChange(KEY_CDN_ZONE_ID, v)}
                    description="阿里云 ESA 控制台中获取的站点 ID"
                  />
                )}
              </>
            )}
          </>
        )}
      </SettingsSection>

      {/* 多人共创 */}
      <SettingsSection title="多人共创" description="PRO 功能">
        <FormSwitch
          label="启用多人共创"
          description="允许多位作者协作创作文章"
          isPro
          checked={values[KEY_MULTI_AUTHOR_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_MULTI_AUTHOR_ENABLE, String(v))}
        />
        <FormSwitch
          label="投稿需要审核"
          description="其他作者提交的文章需要管理员审核后才能发布"
          isPro
          checked={values[KEY_MULTI_AUTHOR_NEED_REVIEW] === "true"}
          onCheckedChange={v => onChange(KEY_MULTI_AUTHOR_NEED_REVIEW, String(v))}
        />
      </SettingsSection>

      {/* 审核通知 */}
      <SettingsSection title="审核通知" description="PRO 功能 - 文章审核结果通知配置">
        <SettingsHelpPanel
          title="审核通知配置说明"
          steps={[
            { title: "先启用审核通知", description: "关闭时不会发送审核结果通知。" },
            { title: "选择通知通道", description: "可单独启用邮件或推送（Pushoo/Webhook），各通道独立开关。" },
            { title: "配置模板与变量", description: "通过/拒绝各一套模板，可用占位符见各编辑器下方说明。" },
            { title: "测试通过与拒绝场景", description: "确保两套模板都能正确渲染变量。" },
          ]}
          className="mb-1"
        />
        <FormSwitch
          label="启用审核通知"
          description="文章审核完成后通知作者"
          isPro
          checked={reviewNotifyEnabled}
          onCheckedChange={v => onChange(KEY_ARTICLE_REVIEW_NOTIFY_ENABLE, String(v))}
        />
        {reviewNotifyEnabled ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormSwitch
                label="邮件通知"
                description="通过邮件通知审核结果"
                isPro
                checked={reviewNotifyEmailEnabled}
                onCheckedChange={v => onChange(KEY_ARTICLE_REVIEW_NOTIFY_EMAIL, String(v))}
              />
              <FormSwitch
                label="推送通知"
                description="通过推送渠道通知审核结果"
                isPro
                checked={reviewNotifyPushEnabled}
                onCheckedChange={v => onChange(KEY_ARTICLE_REVIEW_NOTIFY_PUSH, String(v))}
              />
            </SettingsFieldGroup>

            {reviewNotifyPushEnabled ? (
              <>
                <SettingsFieldGroup cols={2}>
                  <FormSelect
                    label="Pushoo Channel"
                    placeholder="请选择推送渠道"
                    value={values[KEY_ARTICLE_REVIEW_PUSH_CHANNEL] ?? ""}
                    onValueChange={v => onChange(KEY_ARTICLE_REVIEW_PUSH_CHANNEL, v)}
                    description="文章审核结果推送渠道"
                  >
                    <FormSelectItem key="bark">bark</FormSelectItem>
                    <FormSelectItem key="webhook">webhook</FormSelectItem>
                  </FormSelect>
                  <FormInput
                    label="Pushoo URL"
                    placeholder="请输入推送地址"
                    value={values[KEY_ARTICLE_REVIEW_PUSH_URL] ?? ""}
                    onValueChange={v => onChange(KEY_ARTICLE_REVIEW_PUSH_URL, v)}
                    description="推送地址；选 webhook 时请求体可用下方占位符自定义。"
                  />
                </SettingsFieldGroup>
                <PlaceholderHelpPanel
                  title="Pushoo / Webhook 可用占位符"
                  subtitle="选 webhook 时，请求体模板（JSON）中可使用以下 Go 模板变量，点击可复制"
                  items={[
                    { variable: "{{.TITLE}}", description: "推送标题" },
                    { variable: "{{.CONTENT}}", description: "推送内容摘要" },
                    { variable: "{{.SITE_NAME}}", description: "站点名称" },
                    { variable: "{{.SITE_URL}}", description: "站点地址" },
                    { variable: "{{.AUTHOR_NAME}}", description: "作者昵称" },
                    { variable: "{{.ARTICLE_TITLE}}", description: "文章标题" },
                    { variable: "{{.ARTICLE_ID}}", description: "文章 ID" },
                    { variable: "{{.IS_APPROVED}}", description: "是否通过 (true/false)" },
                    { variable: "{{.REVIEW_COMMENT}}", description: "审核意见/拒绝原因" },
                    { variable: "{{.TIMESTAMP}}", description: "通知时间" },
                  ]}
                  className="mt-2"
                />

                <FormCodeEditor
                  label="Webhook Body"
                  language="json"
                  value={values[KEY_ARTICLE_REVIEW_WEBHOOK_BODY] ?? ""}
                  onValueChange={v => onChange(KEY_ARTICLE_REVIEW_WEBHOOK_BODY, v)}
                  description="留空时使用系统默认 JSON（含 title、content、site_name 等）。"
                  minRows={4}
                />
                <PlaceholderHelpPanel
                  title="Webhook Body 可用占位符"
                  subtitle="Go 模板格式，点击可复制"
                  items={[
                    { variable: "{{.TITLE}}", description: "推送标题" },
                    { variable: "{{.CONTENT}}", description: "推送内容摘要" },
                    { variable: "{{.SITE_NAME}}", description: "站点名称" },
                    { variable: "{{.SITE_URL}}", description: "站点地址" },
                    { variable: "{{.AUTHOR_NAME}}", description: "作者昵称" },
                    { variable: "{{.ARTICLE_TITLE}}", description: "文章标题" },
                    { variable: "{{.ARTICLE_ID}}", description: "文章 ID" },
                    { variable: "{{.IS_APPROVED}}", description: "是否通过" },
                    { variable: "{{.REVIEW_COMMENT}}", description: "审核意见" },
                    { variable: "{{.TIMESTAMP}}", description: "通知时间" },
                  ]}
                  className="mt-2"
                />
                <FormCodeEditor
                  label="Webhook Headers"
                  language="json"
                  value={values[KEY_ARTICLE_REVIEW_WEBHOOK_HEADERS] ?? ""}
                  onValueChange={v => onChange(KEY_ARTICLE_REVIEW_WEBHOOK_HEADERS, v)}
                  description={
                    '审核通知 Webhook 请求头（JSON 键值对），如 {"Content-Type": "application/json"}；通常为静态，无需占位符。'
                  }
                  minRows={3}
                />
              </>
            ) : (
              hasReviewPushHistory && (
                <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
                  推送通知当前关闭，但检测到历史推送配置已保留；重新开启后会继续生效。
                </div>
              )
            )}

            {reviewNotifyEmailEnabled ? (
              <>
                <FormInput
                  label="审核通过邮件主题"
                  placeholder="您的文章已通过审核"
                  value={values[KEY_ARTICLE_REVIEW_MAIL_SUBJECT_APPROVED]}
                  onValueChange={v => onChange(KEY_ARTICLE_REVIEW_MAIL_SUBJECT_APPROVED, v)}
                />
                <FormMonacoEditor
                  label="审核通过邮件模板"
                  value={values[KEY_ARTICLE_REVIEW_MAIL_TEMPLATE_APPROVED]}
                  onValueChange={v => onChange(KEY_ARTICLE_REVIEW_MAIL_TEMPLATE_APPROVED, v)}
                  language="html"
                  height={220}
                  wordWrap
                  description="留空则使用系统默认模板。"
                />
                <PlaceholderHelpPanel
                  title="可用占位符"
                  subtitle="Go 模板格式，点击可复制"
                  items={[
                    { variable: "{{.SiteName}}", description: "站点名称" },
                    { variable: "{{.SiteURL}}", description: "站点地址" },
                    { variable: "{{.ArticleTitle}}", description: "文章标题" },
                    { variable: "{{.ArticleURL}}", description: "文章链接" },
                    { variable: "{{.AuthorName}}", description: "作者昵称" },
                    { variable: "{{.ReviewComment}}", description: "审核意见" },
                  ]}
                  className="mt-2"
                />

                <FormInput
                  label="审核拒绝邮件主题"
                  placeholder="您的文章未通过审核"
                  value={values[KEY_ARTICLE_REVIEW_MAIL_SUBJECT_REJECTED]}
                  onValueChange={v => onChange(KEY_ARTICLE_REVIEW_MAIL_SUBJECT_REJECTED, v)}
                />
                <FormMonacoEditor
                  label="审核拒绝邮件模板"
                  value={values[KEY_ARTICLE_REVIEW_MAIL_TEMPLATE_REJECTED]}
                  onValueChange={v => onChange(KEY_ARTICLE_REVIEW_MAIL_TEMPLATE_REJECTED, v)}
                  language="html"
                  height={220}
                  wordWrap
                  description="留空则使用系统默认模板。"
                />
                <PlaceholderHelpPanel
                  title="可用占位符"
                  subtitle="Go 模板格式，点击可复制"
                  items={[
                    { variable: "{{.SiteName}}", description: "站点名称" },
                    { variable: "{{.SiteURL}}", description: "站点地址" },
                    { variable: "{{.ArticleTitle}}", description: "文章标题" },
                    { variable: "{{.ArticleURL}}", description: "文章链接" },
                    { variable: "{{.AuthorName}}", description: "作者昵称" },
                    { variable: "{{.ReviewComment}}", description: "拒绝原因" },
                  ]}
                  className="mt-2"
                />
              </>
            ) : null}
          </>
        ) : (
          hasReviewNotifyHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              审核通知当前关闭，但检测到历史审核通知配置已保留；重新开启后会继续生效。
            </div>
          )
        )}
      </SettingsSection>
    </div>
  );
}
