"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormImageUpload } from "@/components/ui/form-image-upload";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_LOGO_HORIZONTAL_DAY,
  KEY_LOGO_HORIZONTAL_NIGHT,
  KEY_ICON_URL,
  KEY_LOGO_URL,
  KEY_LOGO_URL_192,
  KEY_LOGO_URL_512,
  KEY_USER_AVATAR,
  KEY_GRAVATAR_URL,
  KEY_DEFAULT_GRAVATAR_TYPE,
} from "@/lib/settings/setting-keys";

interface SiteIconFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function SiteIconForm({ values, onChange, loading }: SiteIconFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* LOGO */}
      <SettingsSection title="LOGO">
        <div className="space-y-3">
          <FormImageUpload
            inlineLabel="日间模式"
            value={values[KEY_LOGO_HORIZONTAL_DAY]}
            onValueChange={v => onChange(KEY_LOGO_HORIZONTAL_DAY, v)}
            placeholder="日间横向 Logo 地址"
            hidePreview
          />
          <FormImageUpload
            inlineLabel="黑暗模式"
            value={values[KEY_LOGO_HORIZONTAL_NIGHT]}
            onValueChange={v => onChange(KEY_LOGO_HORIZONTAL_NIGHT, v)}
            placeholder="夜间横向 Logo 地址"
            hidePreview
          />
          <p className="text-xs text-muted-foreground">
            LOGO 图像的地址，用于在左上角展示；请分别提供黑暗模式和日间模式下不同的 LOGO。
          </p>
          {/* 双 Logo 预览 */}
          {(values[KEY_LOGO_HORIZONTAL_DAY] || values[KEY_LOGO_HORIZONTAL_NIGHT]) && (
            <div className="flex items-center gap-4 flex-wrap">
              {values[KEY_LOGO_HORIZONTAL_DAY] && (
                <div className="rounded-xl border border-border/60 bg-white p-3 flex items-center justify-center h-16 max-w-[200px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={values[KEY_LOGO_HORIZONTAL_DAY]}
                    alt="日间 Logo 预览"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
              {values[KEY_LOGO_HORIZONTAL_NIGHT] && (
                <div className="rounded-xl border border-border/60 bg-[#1a1a2e] p-3 flex items-center justify-center h-16 max-w-[200px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={values[KEY_LOGO_HORIZONTAL_NIGHT]}
                    alt="夜间 Logo 预览"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* 小图标 (Favicon) */}
      <SettingsSection title="小图标 (Favicon)">
        <FormImageUpload
          value={values[KEY_ICON_URL]}
          onValueChange={v => onChange(KEY_ICON_URL, v)}
          placeholder="favicon.ico 地址"
          description="扩展名为 ico 的小图标地址。"
          previewSize="sm"
        />
      </SettingsSection>

      {/* 中图标 (PWA) */}
      <SettingsSection title="PWA 图标">
        <SettingsFieldGroup cols={2}>
          <FormImageUpload
            label="中图标 (192x192)"
            value={values[KEY_LOGO_URL_192]}
            onValueChange={v => onChange(KEY_LOGO_URL_192, v)}
            placeholder="192x192 图标地址"
            description="192x192 的中等图标地址，png 格式。"
            previewSize="md"
            previewMaxWidth={120}
            previewMaxHeight={120}
          />
          <FormImageUpload
            label="大图标 (512x512)"
            value={values[KEY_LOGO_URL_512]}
            onValueChange={v => onChange(KEY_LOGO_URL_512, v)}
            placeholder="512x512 图标地址"
            description="512x512 的高分辨率图标地址，png 格式。"
            previewSize="md"
            previewMaxWidth={120}
            previewMaxHeight={120}
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* 通用 Logo */}
      <SettingsSection title="通用 Logo">
        <FormImageUpload
          label="站点 Logo"
          value={values[KEY_LOGO_URL]}
          onValueChange={v => onChange(KEY_LOGO_URL, v)}
          placeholder="站点通用 Logo 地址"
          description="通用站点 Logo，用于 SEO 分享、Open Graph 等场景。"
          previewSize="md"
          previewMaxWidth={160}
          previewMaxHeight={80}
        />
      </SettingsSection>

      {/* 头像配置 */}
      <SettingsSection title="头像配置">
        <FormImageUpload
          label="站长头像"
          value={values[KEY_USER_AVATAR]}
          onValueChange={v => onChange(KEY_USER_AVATAR, v)}
          placeholder="头像图片地址"
          rounded
          previewSize="md"
          previewMaxWidth={80}
          previewMaxHeight={80}
          description="站长的头像图片，显示在侧边栏等位置。"
        />

        <FormInput
          label="Gravatar 地址"
          placeholder="https://gravatar.com/avatar/"
          value={values[KEY_GRAVATAR_URL]}
          onValueChange={v => onChange(KEY_GRAVATAR_URL, v)}
          description="Gravatar 头像服务地址，可使用镜像源加速"
        />

        <FormSelect
          label="默认 Gravatar 类型"
          value={values[KEY_DEFAULT_GRAVATAR_TYPE]}
          onValueChange={v => onChange(KEY_DEFAULT_GRAVATAR_TYPE, v)}
          placeholder="请选择默认头像类型"
          description="用户未设置头像时显示的默认样式"
        >
          <FormSelectItem key="mp">MP（默认灰色头像）</FormSelectItem>
          <FormSelectItem key="identicon">Identicon（几何图案）</FormSelectItem>
          <FormSelectItem key="monsterid">MonsterID（怪物头像）</FormSelectItem>
          <FormSelectItem key="wavatar">Wavatar（卡通面孔）</FormSelectItem>
          <FormSelectItem key="retro">Retro（像素风格）</FormSelectItem>
          <FormSelectItem key="robohash">RoboHash（机器人）</FormSelectItem>
          <FormSelectItem key="blank">Blank（空白）</FormSelectItem>
        </FormSelect>
      </SettingsSection>
    </div>
  );
}
