"use client";

import * as React from "react";
import { Input, Switch, Select, SelectItem } from "@heroui/react";
import { cn } from "@/lib/utils";
import type { PageOneImageItem } from "@/types/site-config";

const ROUTE_KEYS = ["home", "categories", "tags", "archives"] as const;
const ROUTE_LABELS: Record<(typeof ROUTE_KEYS)[number], string> = {
  home: "首页",
  categories: "分类页",
  tags: "标签页",
  archives: "归档页",
};

const DEFAULT_ITEM: PageOneImageItem = {
  enable: false,
  background: "",
  mediaType: "image",
  mainTitle: "安和鱼",
  subTitle: "生活明朗，万物可爱",
  typingEffect: false,
  hitokoto: false,
  videoAutoplay: true,
  videoLoop: true,
  videoMuted: true,
  mobileBackground: "",
  mobileMediaType: "image",
  mobileVideoAutoplay: true,
  mobileVideoLoop: true,
  mobileVideoMuted: true,
};

export interface OneImageConfigEditorProps {
  label?: string;
  description?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

function parseConfig(value: string | undefined): Record<string, PageOneImageItem> {
  const result: Record<string, PageOneImageItem> = {};
  for (const key of ROUTE_KEYS) {
    result[key] = { ...DEFAULT_ITEM };
  }
  if (!value?.trim()) return result;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return result;
    for (const key of ROUTE_KEYS) {
      const raw = parsed[key];
      result[key] = raw && typeof raw === "object" ? { ...DEFAULT_ITEM, ...raw } : { ...DEFAULT_ITEM };
    }
    return result;
  } catch {
    return result;
  }
}

function serializeConfig(config: Record<string, PageOneImageItem>): string {
  return JSON.stringify(config, null, 2);
}

export function OneImageConfigEditor({
  label,
  description,
  value,
  onValueChange,
  className,
}: OneImageConfigEditorProps) {
  const config = React.useMemo(() => parseConfig(value), [value]);

  const updateRoute = React.useCallback(
    (route: (typeof ROUTE_KEYS)[number], item: PageOneImageItem) => {
      const next = { ...config, [route]: item };
      onValueChange?.(serializeConfig(next));
    },
    [config, onValueChange]
  );

  const ensureRoute = (route: (typeof ROUTE_KEYS)[number]) => config[route] ?? { ...DEFAULT_ITEM };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {label && <label className="text-sm font-semibold tracking-tight text-foreground/80">{label}</label>}
      {ROUTE_KEYS.map(route => (
        <RouteCard
          key={route}
          route={route}
          label={ROUTE_LABELS[route]}
          item={ensureRoute(route)}
          onUpdate={item => updateRoute(route, item)}
        />
      ))}
      {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

const inputWrapper = cn(
  "h-9 min-h-9 rounded-xl border border-border/60 bg-card shadow-none!",
  "data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted data-[hover=true]:border-border/80",
  "group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted group-data-[focus=true]:border-primary/65",
  "group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/15 transition-all duration-200"
);

function RouteCard({
  label,
  item,
  onUpdate,
}: {
  route: string;
  label: string;
  item: PageOneImageItem;
  onUpdate: (item: PageOneImageItem) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const update = (patch: Partial<PageOneImageItem>) => onUpdate({ ...item, ...patch });

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.6)] transition-all duration-200 hover:border-border/80">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 bg-linear-to-r from-default-50/60 via-default-50/20 to-transparent px-3.5 py-2.5 text-left transition-colors hover:from-default-100/55"
        onClick={() => setExpanded(e => !e)}
      >
        <svg
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0",
            expanded && "rotate-90"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-medium text-foreground/85">{label}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">一图流</span>
        <div className="ml-auto flex items-center gap-2">
          <Switch
            size="sm"
            isSelected={!!item.enable}
            onValueChange={v => update({ enable: v })}
            onClick={e => e.stopPropagation()}
            aria-label={`启用${label}一图流`}
            classNames={{ wrapper: "group-data-[selected=true]:bg-primary" }}
          />
        </div>
      </button>
      {expanded && (
        <div className="space-y-4 border-t border-border/60 bg-muted/30 px-3.5 py-3.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="主标题"
              labelPlacement="outside"
              size="sm"
              value={item.mainTitle ?? ""}
              onValueChange={v => update({ mainTitle: v })}
              placeholder="主标题"
              classNames={{ inputWrapper }}
            />
            <Input
              label="副标题"
              labelPlacement="outside"
              size="sm"
              value={item.subTitle ?? ""}
              onValueChange={v => update({ subTitle: v })}
              placeholder="副标题"
              classNames={{ inputWrapper }}
            />
            <Input
              label="背景图 URL"
              labelPlacement="outside"
              size="sm"
              value={item.background ?? ""}
              onValueChange={v => update({ background: v })}
              placeholder="https://..."
              classNames={{ inputWrapper }}
            />
            <Input
              label="移动端背景 URL"
              labelPlacement="outside"
              size="sm"
              value={item.mobileBackground ?? ""}
              onValueChange={v => update({ mobileBackground: v })}
              placeholder="留空则使用桌面背景"
              classNames={{ inputWrapper }}
            />
            <Select
              label="媒体类型"
              labelPlacement="outside"
              size="sm"
              selectedKeys={[item.mediaType ?? "image"]}
              onSelectionChange={keys => {
                const k = Array.from(keys)[0];
                if (k) update({ mediaType: k as "image" | "video" });
              }}
              classNames={{ trigger: inputWrapper }}
            >
              <SelectItem key="image">图片</SelectItem>
              <SelectItem key="video">视频</SelectItem>
            </Select>
            <Select
              label="移动端媒体类型"
              labelPlacement="outside"
              size="sm"
              selectedKeys={[item.mobileMediaType ?? "image"]}
              onSelectionChange={keys => {
                const k = Array.from(keys)[0];
                if (k) update({ mobileMediaType: k as "image" | "video" });
              }}
              classNames={{ trigger: inputWrapper }}
            >
              <SelectItem key="image">图片</SelectItem>
              <SelectItem key="video">视频</SelectItem>
            </Select>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Switch size="sm" isSelected={!!item.typingEffect} onValueChange={v => update({ typingEffect: v })} />
              <span className="text-xs text-foreground/70">打字机效果</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch size="sm" isSelected={!!item.hitokoto} onValueChange={v => update({ hitokoto: v })} />
              <span className="text-xs text-foreground/70">一言</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                size="sm"
                isSelected={item.videoAutoplay !== false}
                onValueChange={v => update({ videoAutoplay: v })}
              />
              <span className="text-xs text-foreground/70">视频自动播放</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch size="sm" isSelected={item.videoLoop !== false} onValueChange={v => update({ videoLoop: v })} />
              <span className="text-xs text-foreground/70">视频循环</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch size="sm" isSelected={item.videoMuted !== false} onValueChange={v => update({ videoMuted: v })} />
              <span className="text-xs text-foreground/70">视频静音</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
