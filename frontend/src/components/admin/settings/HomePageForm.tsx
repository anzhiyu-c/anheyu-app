"use client";

import * as React from "react";
import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormImageUpload } from "@/components/ui/form-image-upload";
import { DatePicker } from "@heroui/date-picker";
import { AdminDatePickerLocale } from "@/components/admin/AdminDatePickerLocale";
import { parseDateTime, CalendarDateTime as CalDateTime } from "@internationalized/date";
import type { CalendarDateTime } from "@internationalized/date";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  HomeTopEditor,
  CreativityEditor,
  HeaderMenuEditor,
  NavMenuEditor,
  VisualArrayEditor,
  ProjectListEditor,
} from "./editors";
import type { FieldDef } from "./editors";
import {
  KEY_HOME_TOP,
  KEY_CREATIVITY,
  KEY_HEADER_MENU,
  KEY_HEADER_NAV_TRAVELLING,
  KEY_HEADER_NAV_MENU,
  KEY_FRONT_DESK_SITE_OWNER_NAME,
  KEY_FRONT_DESK_SITE_OWNER_EMAIL,
  KEY_FOOTER_OWNER_NAME,
  KEY_FOOTER_OWNER_SINCE,
  KEY_FOOTER_CUSTOM_TEXT,
  KEY_FOOTER_RUNTIME_ENABLE,
  KEY_FOOTER_RUNTIME_LAUNCH_TIME,
  KEY_FOOTER_RUNTIME_WORK_IMG,
  KEY_FOOTER_RUNTIME_WORK_DESC,
  KEY_FOOTER_RUNTIME_OFFDUTY_IMG,
  KEY_FOOTER_RUNTIME_OFFDUTY_DESC,
  KEY_FOOTER_SOCIALBAR_CENTER_IMG,
  KEY_FOOTER_LIST_RANDOM_FRIENDS,
  KEY_FOOTER_BAR_AUTHOR_LINK,
  KEY_FOOTER_BAR_CC_LINK,
  KEY_FOOTER_BADGE_ENABLE,
  KEY_FOOTER_BADGE_LIST,
  KEY_FOOTER_SOCIALBAR_LEFT,
  KEY_FOOTER_SOCIALBAR_RIGHT,
  KEY_FOOTER_PROJECT_LIST,
  KEY_FOOTER_BAR_LINK_LIST,
  KEY_FOOTER_UPTIME_KUMA_ENABLE,
  KEY_FOOTER_UPTIME_KUMA_PAGE_URL,
} from "@/lib/settings/setting-keys";

// ─── 社交栏图标字段定义 ─────────────────────────────────────────

const socialIconFields: FieldDef[] = [
  { key: "title", label: "标题", type: "text", placeholder: "例如：GitHub" },
  { key: "icon", label: "图标", type: "icon", placeholder: "选择图标或输入 URL" },
  { key: "link", label: "链接", type: "url", placeholder: "https://..." },
];

const defaultSocialIcon: Record<string, unknown> = {
  title: "",
  icon: "",
  link: "",
};

// ─── 徽章字段定义 ────────────────────────────────────────────────

const badgeFields: FieldDef[] = [
  { key: "message", label: "提示文案", type: "text", placeholder: "例如：本站使用AnHeYu框架" },
  { key: "shields", label: "徽章图片", type: "url", placeholder: "徽章图片 URL（shields.io 等）" },
  { key: "link", label: "链接", type: "url", placeholder: "https://..." },
];

const defaultBadge: Record<string, unknown> = {
  message: "",
  shields: "",
  link: "",
};

// ─── 底部链接字段定义 ──────────────────────────────────────────

const linkFields: FieldDef[] = [
  { key: "text", label: "文本", type: "text", placeholder: "链接文本" },
  { key: "link", label: "链接", type: "url", placeholder: "https://..." },
  { key: "external", label: "新标签页打开", type: "switch" },
];

const defaultLink: Record<string, unknown> = {
  text: "",
  link: "",
  external: false,
};

// ─── 上线时间解析/格式化（后端格式 YYYY-MM-DD HH:mm:ss 或 MM/DD/YYYY HH:mm:ss） ───

function parseLaunchTime(value: string | undefined): CalendarDateTime | null {
  if (!value?.trim()) return null;
  const s = value.trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoMatch) {
    const iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T${isoMatch[4] || "00"}:${isoMatch[5] || "00"}:${
      isoMatch[6] || "00"
    }`;
    try {
      return parseDateTime(iso);
    } catch {
      return null;
    }
  }
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (usMatch) {
    const month = parseInt(usMatch[1], 10);
    const day = parseInt(usMatch[2], 10);
    const year = parseInt(usMatch[3], 10);
    const hour = usMatch[4] ? parseInt(usMatch[4], 10) : 0;
    const minute = usMatch[5] ? parseInt(usMatch[5], 10) : 0;
    const second = usMatch[6] ? parseInt(usMatch[6], 10) : 0;
    return new CalDateTime(year, month, day, hour, minute, second);
  }
  return null;
}

function formatLaunchTime(d: CalendarDateTime): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const second = typeof d.second === "number" ? d.second : 0;
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)} ${pad2(d.hour)}:${pad2(d.minute)}:${pad2(second)}`;
}

function LaunchTimePicker({
  label,
  value,
  onValueChange,
  description,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  description?: string;
}) {
  const dateValue = React.useMemo(() => parseLaunchTime(value), [value]);
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-semibold tracking-tight text-foreground/80">{label}</label>}
      <AdminDatePickerLocale>
        <DatePicker
          label={undefined}
          granularity="minute"
          hideTimeZone
          hourCycle={24}
          value={dateValue ?? undefined}
          onChange={d => {
            if (d) {
              onValueChange(formatLaunchTime(d as CalendarDateTime));
            } else {
              onValueChange("");
            }
          }}
          labelPlacement="outside"
          classNames={{
            inputWrapper:
              "h-9 min-h-9 rounded-xl border border-border/60 bg-card shadow-none transition-all duration-200",
          }}
        />
      </AdminDatePickerLocale>
      {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────

interface HomePageFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

function hasMeaningfulValue(raw: string | undefined): boolean {
  const value = (raw ?? "").trim();
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === "object") return Object.keys(parsed as Record<string, unknown>).length > 0;
    if (typeof parsed === "string") return parsed.trim().length > 0;
    return true;
  } catch {
    return true;
  }
}

export function HomePageForm({ values, onChange, loading }: HomePageFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const runtimeEnabled = values[KEY_FOOTER_RUNTIME_ENABLE] === "true";
  const hasRuntimeHistory =
    !runtimeEnabled &&
    [
      KEY_FOOTER_RUNTIME_LAUNCH_TIME,
      KEY_FOOTER_RUNTIME_WORK_IMG,
      KEY_FOOTER_RUNTIME_WORK_DESC,
      KEY_FOOTER_RUNTIME_OFFDUTY_IMG,
      KEY_FOOTER_RUNTIME_OFFDUTY_DESC,
    ]
      .map(key => values[key] ?? "")
      .some(value => hasMeaningfulValue(value));
  const badgeEnabled = values[KEY_FOOTER_BADGE_ENABLE] === "true";
  const hasBadgeHistory = !badgeEnabled && hasMeaningfulValue(values[KEY_FOOTER_BADGE_LIST]);
  const uptimeEnabled = values[KEY_FOOTER_UPTIME_KUMA_ENABLE] === "true";
  const hasUptimeHistory = !uptimeEnabled && hasMeaningfulValue(values[KEY_FOOTER_UPTIME_KUMA_PAGE_URL]);

  return (
    <div className="space-y-8">
      {/* 首页顶部 */}
      <SettingsSection title="首页顶部">
        <HomeTopEditor
          label="首页顶部配置"
          value={values[KEY_HOME_TOP]}
          onValueChange={v => onChange(KEY_HOME_TOP, v)}
          description="配置首页顶部区域的标题、分类和 Banner"
        />
        <CreativityEditor
          label="创意模块配置"
          value={values[KEY_CREATIVITY]}
          onValueChange={v => onChange(KEY_CREATIVITY, v)}
          description="首页创意图标展示区域"
        />
      </SettingsSection>

      {/* 导航菜单 */}
      <SettingsSection title="导航菜单">
        <HeaderMenuEditor
          label="顶部菜单"
          value={values[KEY_HEADER_MENU]}
          onValueChange={v => onChange(KEY_HEADER_MENU, v)}
          description="顶部导航菜单配置，支持直链和下拉菜单两种类型"
        />

        <SettingsFieldGroup cols={2}>
          <FormSwitch
            label="开往"
            description="导航栏显示开往入口"
            checked={values[KEY_HEADER_NAV_TRAVELLING] === "true"}
            onCheckedChange={v => onChange(KEY_HEADER_NAV_TRAVELLING, String(v))}
          />
        </SettingsFieldGroup>

        <NavMenuEditor
          label="导航菜单扩展"
          value={values[KEY_HEADER_NAV_MENU]}
          onValueChange={v => onChange(KEY_HEADER_NAV_MENU, v)}
          description="导航栏右侧扩展菜单，支持分组管理"
        />
      </SettingsSection>

      {/* 站点信息 */}
      <SettingsSection title="站点信息">
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="站长名称"
            placeholder="请输入站长名称"
            value={values[KEY_FRONT_DESK_SITE_OWNER_NAME]}
            onValueChange={v => onChange(KEY_FRONT_DESK_SITE_OWNER_NAME, v)}
          />
          <FormInput
            label="站长邮箱"
            placeholder="请输入站长邮箱"
            value={values[KEY_FRONT_DESK_SITE_OWNER_EMAIL]}
            onValueChange={v => onChange(KEY_FRONT_DESK_SITE_OWNER_EMAIL, v)}
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup cols={2}>
          <FormInput
            label="页脚版权名称"
            placeholder="请输入页脚显示的名称"
            value={values[KEY_FOOTER_OWNER_NAME]}
            onValueChange={v => onChange(KEY_FOOTER_OWNER_NAME, v)}
          />
          <FormInput
            label="建站年份"
            placeholder="例如：2020"
            value={values[KEY_FOOTER_OWNER_SINCE]}
            onValueChange={v => onChange(KEY_FOOTER_OWNER_SINCE, v)}
          />
        </SettingsFieldGroup>

        <FormInput
          label="页脚自定义文本"
          placeholder="页脚自定义显示的文本"
          value={values[KEY_FOOTER_CUSTOM_TEXT]}
          onValueChange={v => onChange(KEY_FOOTER_CUSTOM_TEXT, v)}
        />
      </SettingsSection>

      {/* 运行时间 */}
      <SettingsSection title="运行时间">
        <FormSwitch
          label="启用运行时间"
          description="在页脚显示站点运行时间"
          checked={runtimeEnabled}
          onCheckedChange={v => onChange(KEY_FOOTER_RUNTIME_ENABLE, String(v))}
        />

        {runtimeEnabled ? (
          <>
            <LaunchTimePicker
              label="上线时间"
              value={values[KEY_FOOTER_RUNTIME_LAUNCH_TIME]}
              onValueChange={v => onChange(KEY_FOOTER_RUNTIME_LAUNCH_TIME, v)}
              description="站点上线时间，用于计算运行时长"
            />

            <SettingsFieldGroup cols={2}>
              <FormImageUpload
                label="工作状态图片"
                value={values[KEY_FOOTER_RUNTIME_WORK_IMG]}
                onValueChange={v => onChange(KEY_FOOTER_RUNTIME_WORK_IMG, v)}
                description="工作状态时显示的图片"
              />
              <FormInput
                label="工作状态描述"
                placeholder="例如：努力工作中..."
                value={values[KEY_FOOTER_RUNTIME_WORK_DESC]}
                onValueChange={v => onChange(KEY_FOOTER_RUNTIME_WORK_DESC, v)}
              />
            </SettingsFieldGroup>

            <SettingsFieldGroup cols={2}>
              <FormImageUpload
                label="休息状态图片"
                value={values[KEY_FOOTER_RUNTIME_OFFDUTY_IMG]}
                onValueChange={v => onChange(KEY_FOOTER_RUNTIME_OFFDUTY_IMG, v)}
                description="休息状态时显示的图片"
              />
              <FormInput
                label="休息状态描述"
                placeholder="例如：已下班..."
                value={values[KEY_FOOTER_RUNTIME_OFFDUTY_DESC]}
                onValueChange={v => onChange(KEY_FOOTER_RUNTIME_OFFDUTY_DESC, v)}
              />
            </SettingsFieldGroup>
          </>
        ) : (
          hasRuntimeHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              运行时间当前关闭，但检测到历史配置已保留；重新开启后将继续生效。
            </div>
          )
        )}
      </SettingsSection>

      {/* 社交与链接 */}
      <SettingsSection title="社交与链接">
        <FormImageUpload
          label="社交栏中心图片"
          value={values[KEY_FOOTER_SOCIALBAR_CENTER_IMG]}
          onValueChange={v => onChange(KEY_FOOTER_SOCIALBAR_CENTER_IMG, v)}
          description="页脚社交栏中间显示的图片"
        />

        <SettingsFieldGroup cols={2}>
          <VisualArrayEditor
            label="社交栏左侧"
            value={values[KEY_FOOTER_SOCIALBAR_LEFT]}
            onValueChange={v => onChange(KEY_FOOTER_SOCIALBAR_LEFT, v)}
            fields={socialIconFields}
            defaultItem={defaultSocialIcon}
            itemLabel={item => (item.title as string) || "未命名图标"}
            addButtonText="添加图标"
            description="页脚社交栏左侧图标列表"
          />
          <VisualArrayEditor
            label="社交栏右侧"
            value={values[KEY_FOOTER_SOCIALBAR_RIGHT]}
            onValueChange={v => onChange(KEY_FOOTER_SOCIALBAR_RIGHT, v)}
            fields={socialIconFields}
            defaultItem={defaultSocialIcon}
            itemLabel={item => (item.title as string) || "未命名图标"}
            addButtonText="添加图标"
            description="页脚社交栏右侧图标列表"
          />
        </SettingsFieldGroup>

        <ProjectListEditor
          label="项目列表"
          value={values[KEY_FOOTER_PROJECT_LIST]}
          onValueChange={v => onChange(KEY_FOOTER_PROJECT_LIST, v)}
          description="页脚展示的项目列表，支持分组管理"
        />

        <VisualArrayEditor
          label="底部链接列表"
          value={values[KEY_FOOTER_BAR_LINK_LIST]}
          onValueChange={v => onChange(KEY_FOOTER_BAR_LINK_LIST, v)}
          fields={linkFields}
          defaultItem={defaultLink}
          itemLabel={item => (item.text as string) || "未命名链接"}
          addButtonText="添加链接"
          description="页脚底栏链接列表"
        />

        <SettingsFieldGroup cols={2}>
          <FormInput
            label="作者链接"
            placeholder="作者主页链接"
            value={values[KEY_FOOTER_BAR_AUTHOR_LINK]}
            onValueChange={v => onChange(KEY_FOOTER_BAR_AUTHOR_LINK, v)}
          />
          <FormInput
            label="CC 许可链接"
            placeholder="Creative Commons 许可链接"
            value={values[KEY_FOOTER_BAR_CC_LINK]}
            onValueChange={v => onChange(KEY_FOOTER_BAR_CC_LINK, v)}
          />
        </SettingsFieldGroup>

        <FormInput
          label="随机友链数量"
          placeholder="每次随机显示的友链数量"
          value={values[KEY_FOOTER_LIST_RANDOM_FRIENDS]}
          onValueChange={v => onChange(KEY_FOOTER_LIST_RANDOM_FRIENDS, v)}
          description="页脚随机展示的友链数量"
        />
      </SettingsSection>

      {/* 底部徽章 */}
      <SettingsSection title="底部徽章">
        <FormSwitch
          label="启用底部徽章"
          description="在页脚显示自定义徽章"
          checked={badgeEnabled}
          onCheckedChange={v => onChange(KEY_FOOTER_BADGE_ENABLE, String(v))}
        />

        {badgeEnabled && (
          <VisualArrayEditor
            label="徽章列表"
            value={values[KEY_FOOTER_BADGE_LIST]}
            onValueChange={v => onChange(KEY_FOOTER_BADGE_LIST, v)}
            fields={badgeFields}
            defaultItem={defaultBadge}
            itemLabel={item => (item.message as string) || "未命名徽章"}
            addButtonText="添加徽章"
            description="页脚徽章配置列表"
          />
        )}
        {!badgeEnabled && hasBadgeHistory && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
            底部徽章当前关闭，但历史徽章列表仍已保留；重新开启后会继续展示。
          </div>
        )}
      </SettingsSection>

      {/* Uptime Kuma */}
      <SettingsSection title="Uptime Kuma">
        <FormSwitch
          label="启用 Uptime Kuma"
          description="在页脚显示 Uptime Kuma 状态监控"
          checked={uptimeEnabled}
          onCheckedChange={v => onChange(KEY_FOOTER_UPTIME_KUMA_ENABLE, String(v))}
        />

        {uptimeEnabled && (
          <FormInput
            label="Uptime Kuma 页面地址"
            placeholder="https://status.example.com"
            value={values[KEY_FOOTER_UPTIME_KUMA_PAGE_URL]}
            onValueChange={v => onChange(KEY_FOOTER_UPTIME_KUMA_PAGE_URL, v)}
            description="Uptime Kuma 状态页面的 URL"
          />
        )}
        {!uptimeEnabled && hasUptimeHistory && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
            Uptime Kuma 当前关闭，但历史页面地址仍已保留；重新开启后会继续使用。
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
