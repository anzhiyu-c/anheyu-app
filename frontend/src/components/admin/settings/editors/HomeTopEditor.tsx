"use client";

import * as React from "react";
import { Input } from "@heroui/react";
import { cn } from "@/lib/utils";
import { VisualArrayEditor, type FieldDef } from "./VisualArrayEditor";

// ─── 类型 ──────────────────────────────────────────────────────────

interface HomeTopCategory {
  name: string;
  path: string;
  icon?: string;
  background?: string;
  isExternal?: boolean;
}

interface HomeTopBanner {
  tips?: string;
  title?: string;
  image?: string;
  link?: string;
}

interface HomeTopConfig {
  title?: string;
  subTitle?: string;
  siteText?: string;
  category?: HomeTopCategory[];
  banner?: HomeTopBanner;
}

interface HomeTopEditorProps {
  label?: string;
  description?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

// ─── 工具函数 ─────────────────────────────────────────────────────

function parseConfig(value: string | undefined): HomeTopConfig {
  if (value == null) return {};
  // 如果已经是对象（后端可能返回已解析的 JSON），直接使用
  if (typeof value === "object") return value as unknown as HomeTopConfig;
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// ─── 分类列表的字段定义 ──────────────────────────────────────────

const categoryFields: FieldDef[] = [
  { key: "name", label: "名称", type: "text", placeholder: "例如：技术" },
  { key: "path", label: "路径", type: "url", placeholder: "例如：/categories/tech" },
  { key: "icon", label: "图标", type: "icon", placeholder: "选择图标或输入 URL" },
  { key: "background", label: "背景图", type: "url", placeholder: "背景图片 URL" },
  { key: "isExternal", label: "外部链接", type: "switch" },
];

const defaultCategory: Record<string, unknown> = {
  name: "",
  path: "",
  icon: "",
  background: "",
  isExternal: false,
};

// ─── 输入框组件 ─────────────────────────────────────────────────

function InlineInput({
  label,
  value,
  placeholder,
  onChange,
  description,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  description?: string;
}) {
  return (
    <Input
      label={label}
      labelPlacement="outside"
      size="sm"
      value={value}
      placeholder={placeholder}
      onValueChange={onChange}
      description={description}
      classNames={{
        label: "text-[11px] font-medium tracking-wide text-foreground/60",
        inputWrapper: cn(
          "h-9 min-h-9 rounded-xl border border-border/60 bg-card shadow-none!",
          "data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted data-[hover=true]:border-border/80",
          "group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted group-data-[focus=true]:border-primary/65 group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/15",
          "transition-all duration-200"
        ),
        input: "text-sm text-foreground/90 placeholder:text-muted-foreground",
        description: "text-xs leading-relaxed text-muted-foreground",
      }}
    />
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────

export function HomeTopEditor({ label, description, value, onValueChange, className }: HomeTopEditorProps) {
  const config = React.useMemo(() => parseConfig(value), [value]);

  const updateConfig = React.useCallback(
    (updater: (prev: HomeTopConfig) => HomeTopConfig) => {
      const current = parseConfig(value);
      const updated = updater(current);
      onValueChange?.(JSON.stringify(updated, null, 2));
    },
    [value, onValueChange]
  );

  const handleFieldChange = (field: keyof HomeTopConfig, val: string) => {
    updateConfig(prev => ({ ...prev, [field]: val }));
  };

  const handleBannerChange = (field: keyof HomeTopBanner, val: string) => {
    updateConfig(prev => ({
      ...prev,
      banner: { ...prev.banner, [field]: val },
    }));
  };

  // 分类列表需要通过 VisualArrayEditor 的 JSON 字符串接口交互
  const categoryJsonValue = React.useMemo(() => {
    return config.category ? JSON.stringify(config.category, null, 2) : "[]";
  }, [config.category]);

  const handleCategoryChange = React.useCallback(
    (categoryJson: string) => {
      try {
        const categories = JSON.parse(categoryJson);
        updateConfig(prev => ({ ...prev, category: categories }));
      } catch {
        // 忽略无效 JSON
      }
    },
    [updateConfig]
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {label && <label className="text-sm font-semibold tracking-tight text-foreground/80">{label}</label>}

      {/* 基本信息 */}
      <div className="rounded-xl border border-border/60 p-4 space-y-3">
        <h5 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">基本信息</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InlineInput
            label="主标题"
            value={config.title || ""}
            placeholder="首页主标题"
            onChange={v => handleFieldChange("title", v)}
          />
          <InlineInput
            label="副标题"
            value={config.subTitle || ""}
            placeholder="首页副标题"
            onChange={v => handleFieldChange("subTitle", v)}
          />
        </div>
        <InlineInput
          label="站点文案"
          value={config.siteText || ""}
          placeholder="首页展示的站点文案"
          onChange={v => handleFieldChange("siteText", v)}
        />
      </div>

      {/* 分类列表 */}
      <div className="rounded-xl border border-border/60 p-4 space-y-3">
        <h5 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">分类列表</h5>
        <VisualArrayEditor
          value={categoryJsonValue}
          onValueChange={handleCategoryChange}
          fields={categoryFields}
          defaultItem={defaultCategory}
          itemLabel={item => (item.name as string) || "未命名分类"}
          addButtonText="添加分类"
        />
      </div>

      {/* Banner 配置 */}
      <div className="rounded-xl border border-border/60 p-4 space-y-3">
        <h5 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">Banner 配置</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InlineInput
            label="提示文案"
            value={config.banner?.tips || ""}
            placeholder="Banner 提示文案"
            onChange={v => handleBannerChange("tips", v)}
          />
          <InlineInput
            label="标题"
            value={config.banner?.title || ""}
            placeholder="Banner 标题"
            onChange={v => handleBannerChange("title", v)}
          />
          <InlineInput
            label="图片地址"
            value={config.banner?.image || ""}
            placeholder="Banner 图片 URL"
            onChange={v => handleBannerChange("image", v)}
          />
          <InlineInput
            label="链接"
            value={config.banner?.link || ""}
            placeholder="Banner 跳转链接"
            onChange={v => handleBannerChange("link", v)}
          />
        </div>
      </div>

      {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
