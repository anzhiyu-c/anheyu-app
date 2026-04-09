"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormImageUpload } from "@/components/ui/form-image-upload";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_MUSIC_PLAYER_ENABLE,
  KEY_MUSIC_PLAYER_PLAYLIST_ID,
  KEY_MUSIC_PLAYER_CUSTOM_PLAYLIST,
  KEY_MUSIC_CAPSULE_CUSTOM_PLAYLIST,
  KEY_MUSIC_API_BASE_URL,
  KEY_MUSIC_VINYL_BACKGROUND,
  KEY_MUSIC_VINYL_OUTER,
  KEY_MUSIC_VINYL_INNER,
  KEY_MUSIC_VINYL_NEEDLE,
  KEY_MUSIC_VINYL_GROOVE,
} from "@/lib/settings/setting-keys";

interface MusicPageFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

function CollapsibleSection({
  title,
  description,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        expanded ? "border-border/60 bg-muted/30" : "border-border/60 bg-transparent"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted rounded-xl transition-colors"
      >
        <div>
          <span className="text-sm font-medium text-foreground">{title}</span>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && <div className="border-t border-border/60 px-4 pb-4 pt-4 space-y-4">{children}</div>}
    </div>
  );
}

export function MusicPageForm({ values, onChange, loading }: MusicPageFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showVinyl, setShowVinyl] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 基础配置 - 简约核心 */}
      <SettingsSection title="基础配置" description="播放器与歌单来源">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.04)]">
          <FormSwitch
            label="启用音乐播放器"
            description="在站点中显示音乐播放器"
            checked={values[KEY_MUSIC_PLAYER_ENABLE] === "true"}
            onCheckedChange={v => onChange(KEY_MUSIC_PLAYER_ENABLE, String(v))}
          />
          <div className="mt-4 space-y-4">
            <FormInput
              label="API 地址"
              placeholder="音乐解析 API 基础 URL"
              value={values[KEY_MUSIC_API_BASE_URL]}
              onValueChange={v => onChange(KEY_MUSIC_API_BASE_URL, v)}
              description="解析网易云歌单等"
            />
            <FormInput
              label="歌单 ID"
              placeholder="网易云歌单 ID，例如 8152976493"
              value={values[KEY_MUSIC_PLAYER_PLAYLIST_ID]}
              onValueChange={v => onChange(KEY_MUSIC_PLAYER_PLAYLIST_ID, v)}
              description="网易云音乐歌单 ID，用于全局播放器获取歌曲列表"
            />
          </div>
        </div>
      </SettingsSection>

      {/* 高级配置 - 折叠展示 */}
      <SettingsSection title="高级配置" description="自定义歌单链接、唱片机样式">
        <CollapsibleSection
          title="自定义歌单"
          description="指向歌单 JSON 文件的链接，配置后优先于上方歌单 ID"
          expanded={showAdvanced}
          onToggle={() => setShowAdvanced(!showAdvanced)}
        >
          <div className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground leading-relaxed space-y-2">
            <p>JSON 文件格式示例：</p>
            <pre className="rounded-md bg-secondary dark:bg-muted px-3 py-2 text-xs font-mono text-foreground/70 overflow-x-auto whitespace-pre">{`[
 {
 "name": "歌曲名称",
 "artist": "歌手名",
 "url": "https://example.com/song.mp3",
 "cover": "https://example.com/cover.jpg",
 "lrc": "https://example.com/lyric.lrc"
 }
]`}</pre>
            <p>其中 name、artist、url 为必填，cover、lrc 为可选</p>
          </div>
          <FormInput
            label="全局播放器"
            placeholder="https://example.com/playlist.json"
            value={values[KEY_MUSIC_PLAYER_CUSTOM_PLAYLIST]}
            onValueChange={v => onChange(KEY_MUSIC_PLAYER_CUSTOM_PLAYLIST, v)}
            description="音乐馆页面使用。配置后将优先使用此 JSON，不再使用歌单 ID"
          />
          <FormInput
            label="胶囊播放器"
            placeholder="https://example.com/capsule-playlist.json"
            value={values[KEY_MUSIC_CAPSULE_CUSTOM_PLAYLIST]}
            onValueChange={v => onChange(KEY_MUSIC_CAPSULE_CUSTOM_PLAYLIST, v)}
            description="胶囊播放器专用，独立于全局播放器配置。配置后将优先使用此 JSON，不再使用歌单 ID"
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="唱片机样式"
          description="自定义唱片机各部位图片"
          expanded={showVinyl}
          onToggle={() => setShowVinyl(!showVinyl)}
        >
          <FormImageUpload
            label="背景图"
            value={values[KEY_MUSIC_VINYL_BACKGROUND]}
            onValueChange={v => onChange(KEY_MUSIC_VINYL_BACKGROUND, v)}
            placeholder="唱片机背景图 URL"
          />
          <SettingsFieldGroup cols={2}>
            <FormImageUpload
              label="外圈"
              value={values[KEY_MUSIC_VINYL_OUTER]}
              onValueChange={v => onChange(KEY_MUSIC_VINYL_OUTER, v)}
              placeholder="唱片外圈"
              previewSize="sm"
            />
            <FormImageUpload
              label="内圈"
              value={values[KEY_MUSIC_VINYL_INNER]}
              onValueChange={v => onChange(KEY_MUSIC_VINYL_INNER, v)}
              placeholder="唱片内圈"
              previewSize="sm"
            />
            <FormImageUpload
              label="唱针"
              value={values[KEY_MUSIC_VINYL_NEEDLE]}
              onValueChange={v => onChange(KEY_MUSIC_VINYL_NEEDLE, v)}
              placeholder="唱针图片"
              previewSize="sm"
            />
            <FormImageUpload
              label="纹路"
              value={values[KEY_MUSIC_VINYL_GROOVE]}
              onValueChange={v => onChange(KEY_MUSIC_VINYL_GROOVE, v)}
              placeholder="唱片纹路"
              previewSize="sm"
            />
          </SettingsFieldGroup>
        </CollapsibleSection>
      </SettingsSection>
    </div>
  );
}
