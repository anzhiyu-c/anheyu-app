"use client";

import { useMemo } from "react";
import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormImageUpload } from "@/components/ui/form-image-upload";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_ALBUM_BANNER_BG,
  KEY_ALBUM_BANNER_TITLE,
  KEY_ALBUM_BANNER_DESC,
  KEY_ALBUM_BANNER_TIP,
  KEY_ALBUM_LAYOUT_MODE,
  KEY_ALBUM_WATERFALL_COLUMNS,
  KEY_ALBUM_WATERFALL_GAP,
  KEY_ALBUM_PAGE_SIZE,
  KEY_ALBUM_ENABLE_COMMENT,
  KEY_ALBUM_API_URL,
  KEY_ALBUM_DEFAULT_THUMB_PARAM,
  KEY_ALBUM_DEFAULT_BIG_PARAM,
  KEY_ALBUM_ABOUT_LINK,
} from "@/lib/settings/setting-keys";

interface AlbumPageFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

const DEFAULT_COLUMNS = { large: 4, medium: 3, small: 1 };

function parseWaterfallColumns(raw: string | undefined): { large: number; medium: number; small: number } {
  if (!raw?.trim()) return DEFAULT_COLUMNS;
  try {
    const parsed = JSON.parse(raw);
    return {
      large: Number(parsed?.large) || DEFAULT_COLUMNS.large,
      medium: Number(parsed?.medium) || DEFAULT_COLUMNS.medium,
      small: Number(parsed?.small) || DEFAULT_COLUMNS.small,
    };
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function serializeWaterfallColumns(cols: { large: number; medium: number; small: number }): string {
  return JSON.stringify(cols);
}

export function AlbumPageForm({ values, onChange, loading }: AlbumPageFormProps) {
  const layoutMode = values[KEY_ALBUM_LAYOUT_MODE] || "waterfall";
  const isWaterfall = layoutMode === "waterfall";

  const waterfallColumnsValue = values[KEY_ALBUM_WATERFALL_COLUMNS];
  const waterfallColumns = useMemo(() => parseWaterfallColumns(waterfallColumnsValue), [waterfallColumnsValue]);

  const updateColumn = (size: "large" | "medium" | "small", val: number) => {
    const next = { ...waterfallColumns, [size]: val };
    onChange(KEY_ALBUM_WATERFALL_COLUMNS, serializeWaterfallColumns(next));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 横幅配置 */}
      <SettingsSection title="横幅" description="页面顶部展示区域">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.04)]">
          <FormImageUpload
            label="背景图"
            value={values[KEY_ALBUM_BANNER_BG]}
            onValueChange={v => onChange(KEY_ALBUM_BANNER_BG, v)}
            placeholder="横幅背景图 URL"
          />
          <SettingsFieldGroup cols={2}>
            <FormInput
              label="标题"
              placeholder="相册"
              value={values[KEY_ALBUM_BANNER_TITLE]}
              onValueChange={v => onChange(KEY_ALBUM_BANNER_TITLE, v)}
            />
            <FormInput
              label="描述"
              placeholder="记录生活的美好瞬间"
              value={values[KEY_ALBUM_BANNER_DESC]}
              onValueChange={v => onChange(KEY_ALBUM_BANNER_DESC, v)}
            />
            <FormInput
              label="提示"
              placeholder="分享精彩图片"
              value={values[KEY_ALBUM_BANNER_TIP]}
              onValueChange={v => onChange(KEY_ALBUM_BANNER_TIP, v)}
            />
          </SettingsFieldGroup>
        </div>
      </SettingsSection>

      {/* 布局配置 */}
      <SettingsSection title="布局" description="网格等高排列；瀑布流按原始比例参差错落">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.04)]">
          <FormSelect
            label="布局模式"
            placeholder="请选择"
            value={layoutMode}
            onValueChange={v => onChange(KEY_ALBUM_LAYOUT_MODE, v)}
          >
            <FormSelectItem key="grid">网格布局</FormSelectItem>
            <FormSelectItem key="waterfall">瀑布流布局</FormSelectItem>
          </FormSelect>

          <SettingsFieldGroup cols={2} className="mt-4">
            <FormInput
              label="每页数量"
              placeholder="24"
              type="number"
              value={values[KEY_ALBUM_PAGE_SIZE]}
              onValueChange={v => onChange(KEY_ALBUM_PAGE_SIZE, v)}
              description="每页展示图片数量"
            />
            <FormSwitch
              label="启用评论"
              description="相册详情页显示评论区"
              checked={values[KEY_ALBUM_ENABLE_COMMENT] === "true"}
              onCheckedChange={v => onChange(KEY_ALBUM_ENABLE_COMMENT, String(v))}
            />
          </SettingsFieldGroup>

          {/* 瀑布流专属配置 - 仅选择瀑布流时显示 */}
          {isWaterfall && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-4">
              <p className="text-xs font-medium text-muted-foreground">瀑布流列数</p>
              <SettingsFieldGroup cols={3}>
                <FormSelect
                  label="大屏 (≥1200px)"
                  placeholder="列数"
                  value={String(waterfallColumns.large)}
                  onValueChange={v => updateColumn("large", Number(v))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <FormSelectItem key={String(n)}>{n} 列</FormSelectItem>
                  ))}
                </FormSelect>
                <FormSelect
                  label="中屏 (768–1199px)"
                  placeholder="列数"
                  value={String(waterfallColumns.medium)}
                  onValueChange={v => updateColumn("medium", Number(v))}
                >
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <FormSelectItem key={String(n)}>{n} 列</FormSelectItem>
                  ))}
                </FormSelect>
                <FormSelect
                  label="小屏 (<768px)"
                  placeholder="列数"
                  value={String(waterfallColumns.small)}
                  onValueChange={v => updateColumn("small", Number(v))}
                >
                  {[1, 2, 3, 4].map(n => (
                    <FormSelectItem key={String(n)}>{n} 列</FormSelectItem>
                  ))}
                </FormSelect>
              </SettingsFieldGroup>
              <FormInput
                label="图片间距 (px)"
                placeholder="16"
                type="number"
                value={values[KEY_ALBUM_WATERFALL_GAP]}
                onValueChange={v => onChange(KEY_ALBUM_WATERFALL_GAP, v)}
                description="瀑布流图片之间的间距"
              />
            </div>
          )}
        </div>
      </SettingsSection>

      {/* API 配置 */}
      <SettingsSection title="数据源" description="相册 API 与图片处理参数">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.04)]">
          <FormInput
            label="API 地址"
            placeholder="https://album.anheyu.com/"
            value={values[KEY_ALBUM_API_URL]}
            onValueChange={v => onChange(KEY_ALBUM_API_URL, v)}
            description="相册页面请求后端 URL，需以 / 结尾"
          />
          <FormInput
            label="关于链接"
            placeholder="https://example.com/about"
            value={values[KEY_ALBUM_ABOUT_LINK]}
            onValueChange={v => onChange(KEY_ALBUM_ABOUT_LINK, v)}
            description="相册页面头部关于按钮跳转链接，留空则使用全局关于链接"
            className="mt-4"
          />
          <SettingsFieldGroup cols={2} className="mt-4">
            <FormInput
              label="缩略图参数"
              placeholder="如 size=small (无需 ? 前缀)"
              value={values[KEY_ALBUM_DEFAULT_THUMB_PARAM]}
              onValueChange={v => onChange(KEY_ALBUM_DEFAULT_THUMB_PARAM, v)}
            />
            <FormInput
              label="大图参数"
              placeholder="如 size=large (无需 ? 前缀)"
              value={values[KEY_ALBUM_DEFAULT_BIG_PARAM]}
              onValueChange={v => onChange(KEY_ALBUM_DEFAULT_BIG_PARAM, v)}
            />
          </SettingsFieldGroup>
        </div>
      </SettingsSection>
    </div>
  );
}
