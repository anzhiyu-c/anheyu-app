"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormImageUpload } from "@/components/ui/form-image-upload";
import { FormMonacoEditor } from "@/components/ui/form-monaco-editor";
import { FormStringList } from "@/components/ui/form-string-list";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { HighlightTagSelector } from "./editors/HighlightTagSelector";
import { SocialLinksEditor } from "./editors/SocialLinksEditor";
import { VisualArrayEditor } from "./editors/VisualArrayEditor";
import type { FieldDef } from "./editors/VisualArrayEditor";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_SIDEBAR_AUTHOR_ENABLE,
  KEY_SIDEBAR_AUTHOR_DESCRIPTION,
  KEY_SIDEBAR_AUTHOR_STATUS_IMG,
  KEY_SIDEBAR_AUTHOR_SKILLS,
  KEY_SIDEBAR_AUTHOR_SOCIAL,
  KEY_SIDEBAR_WECHAT_ENABLE,
  KEY_SIDEBAR_WECHAT_FACE,
  KEY_SIDEBAR_WECHAT_BACK_FACE,
  KEY_SIDEBAR_WECHAT_BLUR_BG,
  KEY_SIDEBAR_WECHAT_LINK,
  KEY_SIDEBAR_TAGS_ENABLE,
  KEY_SIDEBAR_TAGS_HIGHLIGHT,
  KEY_SIDEBAR_SITEINFO_POST_COUNT,
  KEY_SIDEBAR_SITEINFO_RUNTIME,
  KEY_SIDEBAR_SITEINFO_WORD_COUNT,
  KEY_SIDEBAR_ARCHIVE_MONTHS,
  KEY_SIDEBAR_CUSTOM_SHOW_IN_POST,
  KEY_SIDEBAR_TOC_COLLAPSE_MODE,
  KEY_SIDEBAR_SERIES_POST_COUNT,
  KEY_SIDEBAR_RECENT_POST_ENABLE,
  KEY_SIDEBAR_RECENT_POST_COUNT,
  KEY_SIDEBAR_DOC_LINKS,
  KEY_CUSTOM_SIDEBAR,
  KEY_WEATHER_ENABLE,
  KEY_WEATHER_ENABLE_PAGE,
  KEY_WEATHER_QWEATHER_KEY,
  KEY_WEATHER_QWEATHER_API_HOST,
  KEY_WEATHER_IP_API_KEY,
  KEY_WEATHER_LOADING,
  KEY_WEATHER_DEFAULT_RECT,
  KEY_WEATHER_RECTANGLE,
} from "@/lib/settings/setting-keys";

// 自定义侧边栏块字段定义
const customSidebarFields: FieldDef[] = [
  { key: "title", label: "标题", type: "text", placeholder: "块标题（留空则不显示）" },
  { key: "content", label: "HTML 内容", type: "textarea", placeholder: "<div>自定义内容</div>", colSpan: 2 },
  { key: "showInPost", label: "在文章页显示", type: "switch" },
];

// 文档链接字段定义
const docLinkFields: FieldDef[] = [
  { key: "title", label: "标题", type: "text", placeholder: "链接标题" },
  { key: "link", label: "链接", type: "url", placeholder: "https://..." },
  { key: "icon", label: "图标", type: "icon", placeholder: "ri:external-link-line" },
  { key: "external", label: "外部链接", type: "switch" },
];

interface SidebarFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function SidebarForm({ values, onChange, loading }: SidebarFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 作者卡片 */}
      <SettingsSection title="作者卡片">
        <FormSwitch
          label="启用作者卡片"
          description="在侧边栏显示作者信息卡片"
          checked={values[KEY_SIDEBAR_AUTHOR_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_SIDEBAR_AUTHOR_ENABLE, String(v))}
        />

        <FormMonacoEditor
          label="作者描述"
          value={values[KEY_SIDEBAR_AUTHOR_DESCRIPTION]}
          onValueChange={v => onChange(KEY_SIDEBAR_AUTHOR_DESCRIPTION, v)}
          language="markdown"
          height={180}
          wordWrap
          description="支持 Markdown 与简单 HTML，用于侧边栏作者卡片文案。"
        />

        <FormImageUpload
          label="状态图标"
          value={values[KEY_SIDEBAR_AUTHOR_STATUS_IMG]}
          onValueChange={v => onChange(KEY_SIDEBAR_AUTHOR_STATUS_IMG, v)}
          previewSize="sm"
          description="作者卡片上显示的状态表情/图标"
        />

        <FormStringList
          label="技能标签"
          value={values[KEY_SIDEBAR_AUTHOR_SKILLS]}
          onValueChange={v => onChange(KEY_SIDEBAR_AUTHOR_SKILLS, v)}
          placeholder="例如：🤖️ 数码科技爱好者"
          addButtonText="添加技能标签"
          description="作者卡片下方显示的技能标签列表"
        />

        <SocialLinksEditor
          value={values[KEY_SIDEBAR_AUTHOR_SOCIAL]}
          onValueChange={v => onChange(KEY_SIDEBAR_AUTHOR_SOCIAL, v)}
        />
      </SettingsSection>

      {/* 微信二维码 */}
      <SettingsSection title="微信二维码">
        <FormSwitch
          label="启用微信二维码"
          description="在侧边栏显示微信二维码卡片"
          checked={values[KEY_SIDEBAR_WECHAT_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_SIDEBAR_WECHAT_ENABLE, String(v))}
        />

        <SettingsFieldGroup cols={2}>
          <FormImageUpload
            label="正面图片"
            value={values[KEY_SIDEBAR_WECHAT_FACE]}
            onValueChange={v => onChange(KEY_SIDEBAR_WECHAT_FACE, v)}
            description="二维码卡片正面图片"
          />
          <FormImageUpload
            label="背面图片"
            value={values[KEY_SIDEBAR_WECHAT_BACK_FACE]}
            onValueChange={v => onChange(KEY_SIDEBAR_WECHAT_BACK_FACE, v)}
            description="二维码卡片背面图片"
          />
        </SettingsFieldGroup>

        <FormImageUpload
          label="模糊背景"
          value={values[KEY_SIDEBAR_WECHAT_BLUR_BG]}
          onValueChange={v => onChange(KEY_SIDEBAR_WECHAT_BLUR_BG, v)}
          description="二维码卡片的模糊背景图"
        />

        <FormInput
          label="微信卡片链接"
          placeholder="微信卡片点击后跳转链接"
          value={values[KEY_SIDEBAR_WECHAT_LINK]}
          onValueChange={v => onChange(KEY_SIDEBAR_WECHAT_LINK, v)}
        />
      </SettingsSection>

      {/* 标签云 */}
      <SettingsSection title="标签云">
        <FormSwitch
          label="启用标签云"
          description="在侧边栏显示标签云组件"
          checked={values[KEY_SIDEBAR_TAGS_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_SIDEBAR_TAGS_ENABLE, String(v))}
        />

        <HighlightTagSelector
          value={values[KEY_SIDEBAR_TAGS_HIGHLIGHT]}
          onValueChange={v => onChange(KEY_SIDEBAR_TAGS_HIGHLIGHT, v)}
        />
      </SettingsSection>

      {/* 站点信息 */}
      <SettingsSection title="站点信息">
        <FormSwitch
          label="显示文章总数"
          description="侧边栏显示站点文章总数（数值由系统自动统计）"
          checked={values[KEY_SIDEBAR_SITEINFO_POST_COUNT] !== "-1"}
          onCheckedChange={v => onChange(KEY_SIDEBAR_SITEINFO_POST_COUNT, v ? "0" : "-1")}
        />

        <FormSwitch
          label="显示运行时间"
          description="侧边栏显示站点运行时间"
          checked={values[KEY_SIDEBAR_SITEINFO_RUNTIME] === "true"}
          onCheckedChange={v => onChange(KEY_SIDEBAR_SITEINFO_RUNTIME, String(v))}
        />

        <FormSwitch
          label="显示总字数"
          description="侧边栏显示站点总字数统计（数值由系统自动统计）"
          checked={values[KEY_SIDEBAR_SITEINFO_WORD_COUNT] !== "-1"}
          onCheckedChange={v => onChange(KEY_SIDEBAR_SITEINFO_WORD_COUNT, v ? "0" : "-1")}
        />

        <FormInput
          label="归档显示月数"
          placeholder="例如：12"
          value={values[KEY_SIDEBAR_ARCHIVE_MONTHS]}
          onValueChange={v => onChange(KEY_SIDEBAR_ARCHIVE_MONTHS, v)}
          description="侧边栏归档模块显示的最近月数"
        />
      </SettingsSection>

      {/* 目录与文档 */}
      <SettingsSection title="目录与文档">
        <FormSwitch
          label="目录折叠模式"
          checked={values[KEY_SIDEBAR_TOC_COLLAPSE_MODE] === "true"}
          onCheckedChange={v => onChange(KEY_SIDEBAR_TOC_COLLAPSE_MODE, String(v))}
          description="开启后，目录会根据当前阅读位置自动折叠/展开子标题"
        />

        <FormInput
          label="系列文章数量"
          placeholder="系列文章显示数量"
          value={values[KEY_SIDEBAR_SERIES_POST_COUNT]}
          onValueChange={v => onChange(KEY_SIDEBAR_SERIES_POST_COUNT, v)}
          description="侧边栏系列文章模块显示的文章数量"
        />

        <FormSwitch
          label="启用最近文章"
          description="在文章详情页侧边栏显示最近发布模块"
          checked={values[KEY_SIDEBAR_RECENT_POST_ENABLE] !== "false"}
          onCheckedChange={v => onChange(KEY_SIDEBAR_RECENT_POST_ENABLE, String(v))}
        />

        {values[KEY_SIDEBAR_RECENT_POST_ENABLE] !== "false" && (
          <FormInput
            label="最近文章数量"
            placeholder="最近文章显示数量（推荐 1-20）"
            value={values[KEY_SIDEBAR_RECENT_POST_COUNT]}
            onValueChange={v => onChange(KEY_SIDEBAR_RECENT_POST_COUNT, v)}
            description="文章详情页侧边栏最近发布模块显示的文章数量"
          />
        )}

        <VisualArrayEditor
          label="文档链接"
          value={values[KEY_SIDEBAR_DOC_LINKS]}
          onValueChange={v => onChange(KEY_SIDEBAR_DOC_LINKS, v)}
          description="文档模式下侧边栏顶部显示的快捷链接列表"
          fields={docLinkFields}
          defaultItem={{ title: "", link: "/", icon: "", external: false }}
          itemLabel={item => (item.title as string) || "未命名链接"}
          addButtonText="添加文档链接"
        />
      </SettingsSection>

      {/* 自定义侧边栏 */}
      <SettingsSection title="自定义侧边栏">
        <FormSwitch
          label="文章页显示自定义侧边栏"
          description="在文章页面也显示自定义侧边栏内容"
          checked={values[KEY_SIDEBAR_CUSTOM_SHOW_IN_POST] === "true"}
          onCheckedChange={v => onChange(KEY_SIDEBAR_CUSTOM_SHOW_IN_POST, String(v))}
        />

        <VisualArrayEditor
          label="自定义侧边栏块"
          value={values[KEY_CUSTOM_SIDEBAR]}
          onValueChange={v => onChange(KEY_CUSTOM_SIDEBAR, v)}
          description="可添加 0-3 个自定义侧边栏块，支持完整 HTML 代码，按顺序显示在侧边栏顶部"
          fields={customSidebarFields}
          defaultItem={{ title: "", content: "", showInPost: true }}
          itemLabel={item => (item.title as string) || "未命名块"}
          addButtonText="添加侧边栏块"
          maxItems={3}
        />
      </SettingsSection>

      {/* 天气时钟 */}
      <SettingsSection title="天气时钟">
        <FormSwitch
          label="启用天气时钟"
          description="在侧边栏显示实时时钟和天气信息"
          checked={values[KEY_WEATHER_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_WEATHER_ENABLE, String(v))}
        />

        {values[KEY_WEATHER_ENABLE] === "true" && (
          <>
            <FormSelect
              label="应用页面"
              value={values[KEY_WEATHER_ENABLE_PAGE]}
              onValueChange={v => onChange(KEY_WEATHER_ENABLE_PAGE, v)}
              placeholder="请选择显示范围"
              description="选择天气时钟显示的页面范围"
            >
              <FormSelectItem key="all">所有页面</FormSelectItem>
              <FormSelectItem key="post">仅文章页</FormSelectItem>
            </FormSelect>

            <FormInput
              label="和风天气 Key"
              placeholder="请输入和风天气 API Key"
              type="password"
              value={values[KEY_WEATHER_QWEATHER_KEY]}
              onValueChange={v => onChange(KEY_WEATHER_QWEATHER_KEY, v)}
              description={
                <>
                  从{""}
                  <a
                    href="https://dev.qweather.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    和风天气开发平台
                  </a>
                  {""}
                  获取
                </>
              }
            />

            <FormInput
              label="和风天气 API 域名"
              placeholder="例如: devapi.qweather.com"
              value={values[KEY_WEATHER_QWEATHER_API_HOST]}
              onValueChange={v => onChange(KEY_WEATHER_QWEATHER_API_HOST, v)}
              description="和风天气API域名或自定义域名"
            />

            <FormInput
              label="IP 定位 API Key"
              placeholder="请输入 IP 定位服务的 API Key"
              type="password"
              value={values[KEY_WEATHER_IP_API_KEY]}
              onValueChange={v => onChange(KEY_WEATHER_IP_API_KEY, v)}
              description={
                <>
                  用于获取访问者地理位置，从{""}
                  <a
                    href="https://api.nsuuu.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    NSUUU API
                  </a>
                  {""}
                  获取
                </>
              }
            />

            <FormInput
              label="加载动画 URL"
              placeholder="加载动画图片地址"
              value={values[KEY_WEATHER_LOADING]}
              onValueChange={v => onChange(KEY_WEATHER_LOADING, v)}
              description="自定义加载动画，建议使用GIF格式"
            />

            <FormSwitch
              label="默认显示固定位置"
              description="开启后将一直显示下方设置的固定位置天气，否则将获取访问者的地理位置与天气"
              checked={values[KEY_WEATHER_DEFAULT_RECT] === "true"}
              onCheckedChange={v => onChange(KEY_WEATHER_DEFAULT_RECT, String(v))}
            />

            <FormInput
              label="默认/后备位置坐标"
              placeholder="格式: 经度,纬度 (例: 112.6534116,27.96920845)"
              value={values[KEY_WEATHER_RECTANGLE]}
              onValueChange={v => onChange(KEY_WEATHER_RECTANGLE, v)}
              description={
                "获取访问者位置失败时会显示该位置的天气；开启\u201c默认显示固定位置\u201d后，将始终显示此位置的天气"
              }
            />
          </>
        )}
      </SettingsSection>
    </div>
  );
}
