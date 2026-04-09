"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormCodeEditor } from "@/components/ui/form-code-editor";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_SEO_AUTO_SUBMIT,
  KEY_SEO_BAIDU_ENABLE,
  KEY_SEO_BAIDU_SITE,
  KEY_SEO_BAIDU_TOKEN,
  KEY_SEO_BING_ENABLE,
  KEY_SEO_BING_API_KEY,
  KEY_SEO_BING_SITE_URL,
  KEY_SEO_GOOGLE_ENABLE,
  KEY_SEO_GOOGLE_CREDENTIAL,
  KEY_SEO_RETRY_TIMES,
  KEY_SEO_RETRY_INTERVAL,
} from "@/lib/settings/setting-keys";

interface SeoSettingsFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function SeoSettingsForm({ values, onChange, loading }: SeoSettingsFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const cardClass =
    "space-y-5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.3)]";

  return (
    <div className="space-y-8">
      {/* 通用配置 */}
      <SettingsSection title="通用配置">
        <FormSwitch
          label="自动提交"
          description="发布或更新文章时自动推送到搜索引擎"
          checked={values[KEY_SEO_AUTO_SUBMIT] === "true"}
          onCheckedChange={v => onChange(KEY_SEO_AUTO_SUBMIT, String(v))}
          isPro
        />
        {values[KEY_SEO_AUTO_SUBMIT] === "true" && (
          <div className={cardClass}>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="重试次数"
                placeholder="推送失败重试次数，如 3"
                value={values[KEY_SEO_RETRY_TIMES]}
                onValueChange={v => onChange(KEY_SEO_RETRY_TIMES, v)}
              />
              <FormInput
                label="重试间隔（秒）"
                placeholder="重试间隔时间，如 5"
                value={values[KEY_SEO_RETRY_INTERVAL]}
                onValueChange={v => onChange(KEY_SEO_RETRY_INTERVAL, v)}
              />
            </SettingsFieldGroup>
          </div>
        )}
      </SettingsSection>

      {/* 百度推送 */}
      <SettingsSection title="百度推送 (PRO)">
        <FormSwitch
          label="启用百度推送"
          description="自动将新文章推送到百度搜索"
          checked={values[KEY_SEO_BAIDU_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_SEO_BAIDU_ENABLE, String(v))}
          isPro
        />
        {values[KEY_SEO_BAIDU_ENABLE] === "true" && (
          <div className={cardClass}>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="站点地址"
                placeholder="https://example.com"
                value={values[KEY_SEO_BAIDU_SITE]}
                onValueChange={v => onChange(KEY_SEO_BAIDU_SITE, v)}
              />
              <FormInput
                label="推送 Token"
                placeholder="请输入百度推送 Token"
                type="password"
                value={values[KEY_SEO_BAIDU_TOKEN]}
                onValueChange={v => onChange(KEY_SEO_BAIDU_TOKEN, v)}
              />
            </SettingsFieldGroup>
          </div>
        )}
      </SettingsSection>

      {/* Bing 推送 */}
      <SettingsSection title="Bing 推送 (PRO)">
        <FormSwitch
          label="启用 Bing 推送"
          description="自动将新文章推送到 Bing 搜索"
          checked={values[KEY_SEO_BING_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_SEO_BING_ENABLE, String(v))}
          isPro
        />
        {values[KEY_SEO_BING_ENABLE] === "true" && (
          <div className={cardClass}>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="API Key"
                placeholder="请输入 Bing API Key"
                type="password"
                value={values[KEY_SEO_BING_API_KEY]}
                onValueChange={v => onChange(KEY_SEO_BING_API_KEY, v)}
              />
              <FormInput
                label="站点 URL"
                placeholder="https://example.com"
                value={values[KEY_SEO_BING_SITE_URL]}
                onValueChange={v => onChange(KEY_SEO_BING_SITE_URL, v)}
              />
            </SettingsFieldGroup>
          </div>
        )}
      </SettingsSection>

      {/* Google 推送 */}
      <SettingsSection title="Google 推送 (PRO)">
        <FormSwitch
          label="启用 Google 推送"
          description="自动将新文章推送到 Google 搜索"
          checked={values[KEY_SEO_GOOGLE_ENABLE] === "true"}
          onCheckedChange={v => onChange(KEY_SEO_GOOGLE_ENABLE, String(v))}
          isPro
        />
        {values[KEY_SEO_GOOGLE_ENABLE] === "true" && (
          <div className={cardClass}>
            <FormCodeEditor
              label="Google Credential"
              language="json"
              value={values[KEY_SEO_GOOGLE_CREDENTIAL]}
              onValueChange={v => onChange(KEY_SEO_GOOGLE_CREDENTIAL, v)}
              minRows={6}
              description="Google Service Account 的 JSON 凭证内容（敏感信息，请妥善保管）"
            />
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
