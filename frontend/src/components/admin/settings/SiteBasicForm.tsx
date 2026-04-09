"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormMonacoEditor } from "@/components/ui/form-monaco-editor";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_APP_NAME,
  KEY_SUB_TITLE,
  KEY_SITE_DESCRIPTION,
  KEY_SITE_KEYWORDS,
  KEY_SITE_URL,
  KEY_SITE_ANNOUNCEMENT,
  KEY_ICP_NUMBER,
  KEY_POLICE_RECORD_NUMBER,
  KEY_POLICE_RECORD_ICON,
  KEY_ENABLE_REGISTRATION,
  KEY_DEFAULT_THEME_MODE,
  KEY_ABOUT_LINK,
  KEY_DEFAULT_THUMB_PARAM,
  KEY_DEFAULT_BIG_PARAM,
} from "@/lib/settings/setting-keys";

const SITE_ANNOUNCEMENT_EXAMPLE = `<p>站点维护通知：今晚 22:00–24:00 进行升级，期间可能短暂不可用。</p>
<p><a href="/about">查看详情</a> · <strong>感谢理解</strong></p>`;

interface SiteBasicFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function SiteBasicForm({ values, onChange, loading }: SiteBasicFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 站点信息 */}
      <SettingsSection title="站点信息">
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="站点名称"
            placeholder="请输入站点名称"
            value={values[KEY_APP_NAME]}
            onValueChange={v => onChange(KEY_APP_NAME, v)}
          />
          <FormInput
            label="副标题"
            placeholder="请输入副标题"
            value={values[KEY_SUB_TITLE]}
            onValueChange={v => onChange(KEY_SUB_TITLE, v)}
          />
        </SettingsFieldGroup>

        <FormTextarea
          label="站点描述"
          placeholder="请输入站点描述"
          value={values[KEY_SITE_DESCRIPTION]}
          onValueChange={v => onChange(KEY_SITE_DESCRIPTION, v)}
          minRows={3}
        />

        <FormInput
          label="站点关键词"
          placeholder="关键词之间用英文逗号分隔"
          value={values[KEY_SITE_KEYWORDS]}
          onValueChange={v => onChange(KEY_SITE_KEYWORDS, v)}
          description="用于 SEO，多个关键词用英文逗号分隔"
        />

        <SettingsFieldGroup cols={2}>
          <FormInput
            label="站点 URL"
            placeholder="https://example.com"
            value={values[KEY_SITE_URL]}
            onValueChange={v => onChange(KEY_SITE_URL, v)}
          />
          <FormInput
            label="ICP 备案号"
            placeholder="京ICP备XXXXXXXX号"
            value={values[KEY_ICP_NUMBER]}
            onValueChange={v => onChange(KEY_ICP_NUMBER, v)}
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup cols={2}>
          <FormInput
            label="公安备案号"
            placeholder="京公网安备XXXXXXXXXXXXXX号"
            value={values[KEY_POLICE_RECORD_NUMBER]}
            onValueChange={v => onChange(KEY_POLICE_RECORD_NUMBER, v)}
          />
          <FormInput
            label="公安备案图标"
            placeholder="公安备案图标 URL"
            value={values[KEY_POLICE_RECORD_ICON]}
            onValueChange={v => onChange(KEY_POLICE_RECORD_ICON, v)}
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* 站点功能 */}
      <SettingsSection title="站点功能">
        <FormSwitch
          label="开放注册"
          description="是否允许新用户注册账号"
          checked={values[KEY_ENABLE_REGISTRATION] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_REGISTRATION, String(v))}
        />

        <FormSelect
          label="默认主题模式"
          value={values[KEY_DEFAULT_THEME_MODE]}
          onValueChange={v => onChange(KEY_DEFAULT_THEME_MODE, v)}
          placeholder="请选择默认主题"
          description="新访客首次访问时的默认主题"
        >
          <FormSelectItem key="light">浅色模式</FormSelectItem>
          <FormSelectItem key="dark">深色模式</FormSelectItem>
        </FormSelect>

        <FormMonacoEditor
          label="站点公告（HTML）"
          language="html"
          height={220}
          wordWrap
          value={values[KEY_SITE_ANNOUNCEMENT] ?? ""}
          onValueChange={v => onChange(KEY_SITE_ANNOUNCEMENT, v)}
          description="与邮件模板相同：此处为 HTML 源码，保存后会在全站导航栏下方原样渲染（仅管理员可编辑，请自行确保内容安全）。留空则不显示公告条。"
        />
        <div
          className="rounded-lg border-2 border-primary/25 bg-muted/50 shadow-sm"
          role="note"
          aria-label="站点公告填写说明"
        >
          <div className="border-b border-border/80 bg-primary/5 px-3 py-2">
            <span className="text-xs font-semibold tracking-wide text-foreground/90">填写说明</span>
            <span className="ml-2 text-[11px] text-muted-foreground">（与邮件模板一致的 HTML 编辑方式）</span>
          </div>
          <div className="space-y-2 px-3 py-2.5">
            <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-foreground/75">
              <li>支持任意 HTML 标签与内联样式，例如段落、链接、加粗、列表等。</li>
              <li>不需要包裹整页结构（无需 <code className="rounded bg-muted px-1 font-mono text-[10px]">&lt;html&gt;</code> / <code className="rounded bg-muted px-1 font-mono text-[10px]">&lt;body&gt;</code>），只写公告区域片段即可。</li>
              <li>脚本类标签可能被浏览器拦截；图片请使用可访问的 HTTPS 地址。</li>
            </ul>
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-foreground/85">示例（可复制修改）</p>
              <pre
                className="max-h-40 overflow-auto rounded-md border border-border/80 bg-[#1e1e1e] p-3 font-mono text-[11px] leading-relaxed text-[#d4d4d4] dark:bg-black/40"
                tabIndex={0}
              >
                {SITE_ANNOUNCEMENT_EXAMPLE}
              </pre>
            </div>
          </div>
        </div>

        <SettingsFieldGroup cols={1}>
          <FormInput
            label="关于链接"
            placeholder="/about"
            value={values[KEY_ABOUT_LINK]}
            onValueChange={v => onChange(KEY_ABOUT_LINK, v)}
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup cols={2}>
          <FormInput
            label="默认缩略图参数"
            placeholder="?imageView2/1/w/400/h/250"
            value={values[KEY_DEFAULT_THUMB_PARAM]}
            onValueChange={v => onChange(KEY_DEFAULT_THUMB_PARAM, v)}
            description="图片缩略图 URL 后缀参数"
          />
          <FormInput
            label="默认大图参数"
            placeholder="?imageView2/0/w/1920"
            value={values[KEY_DEFAULT_BIG_PARAM]}
            onValueChange={v => onChange(KEY_DEFAULT_BIG_PARAM, v)}
            description="图片大图 URL 后缀参数"
          />
        </SettingsFieldGroup>
      </SettingsSection>
    </div>
  );
}
