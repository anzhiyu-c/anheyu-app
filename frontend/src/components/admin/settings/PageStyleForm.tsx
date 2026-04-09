"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormCodeEditor } from "@/components/ui/form-code-editor";
import { OneImageConfigEditor } from "./editors/OneImageConfigEditor";
import { SettingsSection } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_ENABLE_EXTERNAL_LINK_WARNING,
  KEY_CUSTOM_HEADER_HTML,
  KEY_CUSTOM_FOOTER_HTML,
  KEY_CUSTOM_CSS,
  KEY_CUSTOM_JS,
  KEY_CUSTOM_POST_TOP_HTML,
  KEY_CUSTOM_POST_BOTTOM_HTML,
  KEY_PAGE_ONE_IMAGE_CONFIG,
  KEY_HITOKOTO_API,
  KEY_TYPING_SPEED,
} from "@/lib/settings/setting-keys";

interface PageStyleFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function PageStyleForm({ values, onChange, loading }: PageStyleFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 页面功能 */}
      <SettingsSection title="页面功能">
        <FormSwitch
          label="外部链接跳转提醒"
          description="开启后，点击外部链接时会显示中间提示页面，提醒用户即将跳转到外部网站，倒计时 5 秒后自动跳转。支持「本次会话不再提示」选项。"
          checked={values[KEY_ENABLE_EXTERNAL_LINK_WARNING] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_EXTERNAL_LINK_WARNING, String(v))}
        />
      </SettingsSection>

      {/* 一图流配置 */}
      <SettingsSection title="一图流配置">
        <OneImageConfigEditor
          label="一图流配置"
          value={values[KEY_PAGE_ONE_IMAGE_CONFIG]}
          onValueChange={v => onChange(KEY_PAGE_ONE_IMAGE_CONFIG, v)}
          description="按页面（首页/分类/标签/归档）配置一图流启用、背景、媒体类型与视频选项"
        />

        <FormInput
          label="一言 API"
          placeholder="https://v1.hitokoto.cn"
          value={values[KEY_HITOKOTO_API]}
          onValueChange={v => onChange(KEY_HITOKOTO_API, v)}
          description="一言（Hitokoto）API 地址"
        />

        <FormInput
          label="打字速度"
          placeholder="例如：100"
          value={values[KEY_TYPING_SPEED]}
          onValueChange={v => onChange(KEY_TYPING_SPEED, v)}
          description="一言打字机效果的速度（毫秒）"
        />
      </SettingsSection>

      {/* 自定义代码注入 */}
      <SettingsSection title="自定义代码注入">
        <FormCodeEditor
          label="头部 HTML"
          value={values[KEY_CUSTOM_HEADER_HTML]}
          onValueChange={v => onChange(KEY_CUSTOM_HEADER_HTML, v)}
          language="html"
          description="注入到 <head> 标签内的自定义 HTML 代码，支持 <script>、<link>、<meta> 等标签。如需引入外部 JS 文件，请在此处添加 <script src='...'></script>"
        />

        <FormCodeEditor
          label="底部 HTML"
          value={values[KEY_CUSTOM_FOOTER_HTML]}
          onValueChange={v => onChange(KEY_CUSTOM_FOOTER_HTML, v)}
          language="html"
          description="注入到 <body> 底部的自定义 HTML 代码，支持 <script>、<div> 等标签。如需引入外部 JS 文件，也可在此处添加 <script src='...'></script>"
        />

        <FormCodeEditor
          label="自定义 CSS"
          value={values[KEY_CUSTOM_CSS]}
          onValueChange={v => onChange(KEY_CUSTOM_CSS, v)}
          language="css"
          description="全站生效的自定义 CSS 样式，直接填写 CSS 代码即可，无需包裹 <style> 标签"
        />

        <FormCodeEditor
          label="自定义 JavaScript"
          value={values[KEY_CUSTOM_JS]}
          onValueChange={v => onChange(KEY_CUSTOM_JS, v)}
          language="javascript"
          description="全站生效的自定义 JavaScript 代码，直接填写 JS 代码即可，无需包裹 <script> 标签。如需引入外部 JS 文件请使用上方的「头部 HTML」或「底部 HTML」"
        />

        <FormCodeEditor
          label="文章顶部 HTML"
          value={values[KEY_CUSTOM_POST_TOP_HTML]}
          onValueChange={v => onChange(KEY_CUSTOM_POST_TOP_HTML, v)}
          language="html"
          description="注入到每篇文章顶部的自定义 HTML 代码"
        />

        <FormCodeEditor
          label="文章底部 HTML"
          value={values[KEY_CUSTOM_POST_BOTTOM_HTML]}
          onValueChange={v => onChange(KEY_CUSTOM_POST_BOTTOM_HTML, v)}
          language="html"
          description="注入到每篇文章底部的自定义 HTML 代码"
        />
      </SettingsSection>
    </div>
  );
}
