"use client";

import * as React from "react";
import { VisualArrayEditor, type FieldDef } from "./VisualArrayEditor";
import { Icon } from "@iconify/react";

// ─── 类型定义 ─────────────────────────────────────────────────────

/** 后端存储格式：{title: {link, icon}} */
type SocialObject = Record<string, { link: string; icon: string }>;

/** 编辑器内部使用的数组格式 */
interface SocialItem {
  title: string;
  link: string;
  icon: string;
}

interface SocialLinksEditorProps {
  /** 标签 */
  label?: string;
  /** 描述文本 */
  description?: string;
  /** 受控值（JSON 字符串，后端对象格式） */
  value?: string;
  /** 值变化回调（输出 JSON 字符串，后端对象格式） */
  onValueChange?: (value: string) => void;
  /** 容器额外 className */
  className?: string;
}

// ─── 工具函数 ─────────────────────────────────────────────────────

/** 将后端对象格式转为编辑器数组格式 */
function objectToArray(value: string | undefined): SocialItem[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    // 如果已经是数组格式，直接使用
    if (Array.isArray(parsed)) {
      return parsed.map((item: Record<string, unknown>) => ({
        title: String(item.title || ""),
        link: String(item.link || ""),
        icon: String(item.icon || ""),
      }));
    }
    // 对象格式 → 数组格式
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed as SocialObject).map(([title, data]) => ({
        title,
        link: data?.link || "",
        icon: data?.icon || "",
      }));
    }
    return [];
  } catch {
    return [];
  }
}

/** 将编辑器数组格式转回后端对象格式 */
function arrayToObject(items: SocialItem[]): string {
  const obj: SocialObject = {};
  for (const item of items) {
    const title = item.title?.trim();
    if (title) {
      obj[title] = {
        link: item.link || "",
        icon: item.icon || "",
      };
    }
  }
  return JSON.stringify(obj, null, 2);
}

// ─── 字段定义 ─────────────────────────────────────────────────────

const socialFields: FieldDef[] = [
  {
    key: "title",
    label: "名称",
    type: "text",
    placeholder: "例如：Github",
    colSpan: 1,
  },
  {
    key: "link",
    label: "链接",
    type: "url",
    placeholder: "https://github.com/username",
    colSpan: 1,
  },
  {
    key: "icon",
    label: "图标",
    type: "icon",
    placeholder: "选择图标或输入图片 URL",
    colSpan: 2,
  },
];

const defaultSocialItem: Record<string, unknown> = {
  title: "",
  link: "",
  icon: "",
};

// ─── 图标渲染 ─────────────────────────────────────────────────────

function SocialItemIcon({ item }: { item: Record<string, unknown> }) {
  const icon = item.icon as string;

  if (!icon) {
    return (
      <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-muted text-muted-foreground">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3l2 1" />
        </svg>
      </div>
    );
  }

  const isImageUrl = icon.startsWith("http://") || icon.startsWith("https://");
  const isIconify = icon.includes(":");

  if (isImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={icon} alt="" className="w-8 h-8 rounded-lg shrink-0 object-cover bg-muted" width={32} height={32} />
    );
  }

  if (isIconify) {
    return (
      <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-muted text-foreground">
        <Icon icon={icon} className="w-5 h-5" />
      </div>
    );
  }

  // 其他格式（如旧版 class name），显示首字母
  const firstChar = (item.title as string)?.charAt(0) || "?";
  return (
    <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-primary/10 text-primary text-sm font-semibold">
      {firstChar}
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────

export function SocialLinksEditor({
  label = "社交链接",
  description,
  value,
  onValueChange,
  className,
}: SocialLinksEditorProps) {
  // 将后端对象格式转为数组格式的 JSON 字符串，供 VisualArrayEditor 使用
  const arrayValue = React.useMemo(() => {
    const items = objectToArray(value);
    return items.length > 0 ? JSON.stringify(items, null, 2) : "";
  }, [value]);

  // VisualArrayEditor 输出数组 JSON → 转回对象格式
  const handleChange = React.useCallback(
    (arrayJson: string) => {
      try {
        const items: SocialItem[] = JSON.parse(arrayJson || "[]");
        const objectJson = arrayToObject(items);
        onValueChange?.(objectJson);
      } catch {
        onValueChange?.(arrayJson);
      }
    },
    [onValueChange]
  );

  return (
    <VisualArrayEditor
      label={label}
      description={description || "配置作者卡片上的社交平台图标与链接，图标支持 Iconify 图标名或图片 URL"}
      value={arrayValue}
      onValueChange={handleChange}
      fields={socialFields}
      defaultItem={defaultSocialItem}
      itemLabel={item => (item.title as string) || "未命名"}
      itemIcon={item => <SocialItemIcon item={item} />}
      addButtonText="添加社交链接"
      className={className}
    />
  );
}
