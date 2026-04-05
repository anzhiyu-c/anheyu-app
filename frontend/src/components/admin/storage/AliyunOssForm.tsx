"use client";

import { Input, Switch } from "@heroui/react";
import { StorageSecretField } from "@/components/admin/storage/StorageSecretField";
import type { StoragePolicy } from "@/types/storage-policy";

interface AliyunOssFormProps {
  form: Partial<StoragePolicy>;
  onChange: (form: Partial<StoragePolicy>) => void;
}

export function AliyunOssForm({ form, onChange }: AliyunOssFormProps) {
  const settings = form.settings ?? {};
  const updateSettings = (patch: Record<string, unknown>) => {
    onChange({ ...form, settings: { ...settings, ...patch } });
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2">阿里云 OSS 配置</div>

      <Input
        label="存储桶名称"
        labelPlacement="outside"
        placeholder="例如 my-bucket"
        size="sm"
        isRequired
        value={form.bucket_name ?? ""}
        onValueChange={v => onChange({ ...form, bucket_name: v })}
        description="在阿里云 OSS 控制台创建的存储桶名称"
      />

      <Input
        label="访问域名"
        labelPlacement="outside"
        placeholder="https://bucket.oss-region.aliyuncs.com"
        size="sm"
        isRequired
        value={form.server ?? ""}
        onValueChange={v => onChange({ ...form, server: v })}
        description="OSS 访问域名，包含协议（https://）"
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">路径设置</div>

      <Input
        label="云端存储根目录"
        labelPlacement="outside"
        placeholder="例如 /images 或留空"
        size="sm"
        value={form.base_path ?? ""}
        onValueChange={v => onChange({ ...form, base_path: v })}
        description="文件在 OSS 存储桶中的根目录，以 / 开头"
      />

      <Input
        label="应用内挂载路径"
        labelPlacement="outside"
        placeholder="例如 /aliyun-oss"
        size="sm"
        isRequired
        value={form.virtual_path ?? ""}
        onValueChange={v => onChange({ ...form, virtual_path: v })}
        description="此策略在应用内部的访问路径，需唯一"
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">API 密钥</div>

      <Input
        label="AccessKey ID"
        labelPlacement="outside"
        size="sm"
        isRequired
        value={form.access_key ?? ""}
        onValueChange={v => onChange({ ...form, access_key: v })}
      />

      <StorageSecretField
        label="AccessKey Secret"
        isRequired
        value={form.secret_key ?? ""}
        onValueChange={v => onChange({ ...form, secret_key: v })}
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">访问权限</div>

      <Switch size="sm" isSelected={form.is_private ?? false} onValueChange={v => onChange({ ...form, is_private: v })}>
        <span className="text-sm">私有读写</span>
      </Switch>
      <p className="text-xs text-muted-foreground -mt-2">关闭时为公用读私有写，开启后读写都需要授权</p>

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">下载设置</div>

      <Input
        label="CDN 加速域名（可选）"
        labelPlacement="outside"
        placeholder="https://cdn.example.com"
        size="sm"
        value={settings.cdn_domain ?? ""}
        onValueChange={v => updateSettings({ cdn_domain: v })}
        description="填写完整的 CDN 访问地址，用于替换文件 URL 中的主机名"
      />

      <Switch
        size="sm"
        isSelected={settings.source_auth ?? false}
        onValueChange={v => updateSettings({ source_auth: v })}
      >
        <span className="text-sm">不为 CDN 签名文件 URL</span>
      </Switch>
      <p className="text-xs text-muted-foreground -mt-2">如果在 OSS 域名设置中开启了「回源鉴权」，请开启此项</p>

      <Switch
        size="sm"
        isSelected={settings.custom_proxy ?? false}
        onValueChange={v => updateSettings({ custom_proxy: v })}
      >
        <span className="text-sm">开启下载中转</span>
      </Switch>
      <p className="text-xs text-muted-foreground -mt-2">开启后下载文件时会通过服务端代理</p>

      <Input
        label="样式分隔符（可选）"
        labelPlacement="outside"
        placeholder="/ArticleImage"
        size="sm"
        value={settings.style_separator ?? ""}
        onValueChange={v => updateSettings({ style_separator: v })}
        description="用于 OSS 图片处理样式，如 /ArticleImage"
      />
    </div>
  );
}
