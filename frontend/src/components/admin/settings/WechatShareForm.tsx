/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-07 22:05:29
 * @LastEditTime: 2026-02-09 18:02:25
 * @LastEditors: 安知鱼
 */
"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { SettingsSection } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_WECHAT_SHARE_ENABLE,
  KEY_WECHAT_SHARE_APP_ID,
  KEY_WECHAT_SHARE_APP_SECRET,
} from "@/lib/settings/setting-keys";

interface WechatShareFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function WechatShareForm({ values, onChange, loading }: WechatShareFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 微信分享配置 */}
      <SettingsSection title="微信分享配置">
        <FormSwitch
          label="启用微信分享"
          description="开启后文章页将显示微信分享功能"
          checked={values[KEY_WECHAT_SHARE_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_WECHAT_SHARE_ENABLE, String(v))}
        />

        <FormInput
          label="App ID"
          placeholder="请输入微信公众号 App ID"
          value={values[KEY_WECHAT_SHARE_APP_ID]}
          onValueChange={v => onChange(KEY_WECHAT_SHARE_APP_ID, v)}
          autoComplete="off"
        />

        <FormInput
          label="App Secret"
          placeholder="请输入微信公众号 App Secret"
          type="password"
          value={values[KEY_WECHAT_SHARE_APP_SECRET]}
          onValueChange={v => onChange(KEY_WECHAT_SHARE_APP_SECRET, v)}
        />
      </SettingsSection>
    </div>
  );
}
