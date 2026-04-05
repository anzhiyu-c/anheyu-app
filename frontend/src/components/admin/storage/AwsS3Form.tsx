"use client";

import { Input, Switch } from "@heroui/react";
import { StorageSecretField } from "@/components/admin/storage/StorageSecretField";
import type { StoragePolicy } from "@/types/storage-policy";

interface AwsS3FormProps {
  form: Partial<StoragePolicy>;
  onChange: (form: Partial<StoragePolicy>) => void;
}

export function AwsS3Form({ form, onChange }: AwsS3FormProps) {
  const settings = form.settings ?? {};
  const updateSettings = (patch: Record<string, unknown>) => {
    onChange({ ...form, settings: { ...settings, ...patch } });
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2">AWS S3 配置</div>

      <Input
        label="存储桶名称"
        labelPlacement="outside"
        placeholder="例如 my-s3-bucket"
        size="sm"
        isRequired
        value={form.bucket_name ?? ""}
        onValueChange={v => onChange({ ...form, bucket_name: v })}
      />

      <Input
        label="Endpoint（可选）"
        labelPlacement="outside"
        placeholder="留空使用 AWS 默认端点"
        size="sm"
        value={form.server ?? ""}
        onValueChange={v => onChange({ ...form, server: v })}
        description="自定义端点 URL，适用于 S3 兼容服务（MinIO、Backblaze 等）"
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">路径设置</div>

      <Input
        label="云端存储根目录"
        labelPlacement="outside"
        placeholder="例如 /uploads 或留空"
        size="sm"
        value={form.base_path ?? ""}
        onValueChange={v => onChange({ ...form, base_path: v })}
      />

      <Input
        label="应用内挂载路径"
        labelPlacement="outside"
        placeholder="例如 /aws-s3"
        size="sm"
        isRequired
        value={form.virtual_path ?? ""}
        onValueChange={v => onChange({ ...form, virtual_path: v })}
        description="此策略在应用内部的访问路径，需唯一"
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">API 密钥</div>

      <Input
        label="Access Key ID"
        labelPlacement="outside"
        size="sm"
        isRequired
        value={form.access_key ?? ""}
        onValueChange={v => onChange({ ...form, access_key: v })}
      />

      <StorageSecretField
        label="Secret Access Key"
        isRequired
        value={form.secret_key ?? ""}
        onValueChange={v => onChange({ ...form, secret_key: v })}
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">访问权限</div>

      <Switch size="sm" isSelected={form.is_private ?? false} onValueChange={v => onChange({ ...form, is_private: v })}>
        <span className="text-sm">私有读写</span>
      </Switch>

      <Switch
        size="sm"
        isSelected={settings.force_path_style ?? false}
        onValueChange={v => updateSettings({ force_path_style: v })}
      >
        <span className="text-sm">强制路径格式 (Path Style)</span>
      </Switch>
      <p className="text-xs text-muted-foreground -mt-2">部分 S3 兼容服务（如 MinIO）需要开启此选项</p>

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">下载设置</div>

      <Input
        label="CDN 加速域名（可选）"
        labelPlacement="outside"
        placeholder="https://cdn.example.com"
        size="sm"
        value={settings.cdn_domain ?? ""}
        onValueChange={v => updateSettings({ cdn_domain: v })}
      />

      <Switch
        size="sm"
        isSelected={settings.source_auth ?? false}
        onValueChange={v => updateSettings({ source_auth: v })}
      >
        <span className="text-sm">不为 CDN 签名文件 URL</span>
      </Switch>

      <Switch
        size="sm"
        isSelected={settings.custom_proxy ?? false}
        onValueChange={v => updateSettings({ custom_proxy: v })}
      >
        <span className="text-sm">开启下载中转</span>
      </Switch>
    </div>
  );
}
