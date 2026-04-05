"use client";

import { Input, Switch } from "@heroui/react";
import { StorageSecretField } from "@/components/admin/storage/StorageSecretField";
import type { StoragePolicy } from "@/types/storage-policy";

interface TencentCosFormProps {
  form: Partial<StoragePolicy>;
  onChange: (form: Partial<StoragePolicy>) => void;
}

export function TencentCosForm({ form, onChange }: TencentCosFormProps) {
  const settings = form.settings ?? {};
  const updateSettings = (patch: Record<string, unknown>) => {
    onChange({ ...form, settings: { ...settings, ...patch } });
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2">腾讯云 COS 配置</div>

      <Input
        label="存储桶名称"
        labelPlacement="outside"
        placeholder="例如 my-bucket-1250000000"
        size="sm"
        isRequired
        value={form.bucket_name ?? ""}
        onValueChange={v => onChange({ ...form, bucket_name: v })}
        description="在腾讯云 COS 控制台创建的存储桶名称"
      />

      <Input
        label="访问域名"
        labelPlacement="outside"
        placeholder="https://bucket.cos.ap-region.myqcloud.com"
        size="sm"
        isRequired
        value={form.server ?? ""}
        onValueChange={v => onChange({ ...form, server: v })}
        description="COS 访问域名，包含协议"
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">路径设置</div>

      <Input
        label="云端存储根目录"
        labelPlacement="outside"
        placeholder="例如 /images 或留空"
        size="sm"
        value={form.base_path ?? ""}
        onValueChange={v => onChange({ ...form, base_path: v })}
        description="文件在 COS 中的根目录，以 / 开头"
      />

      <Input
        label="应用内挂载路径"
        labelPlacement="outside"
        placeholder="例如 /tencent-cos"
        size="sm"
        isRequired
        value={form.virtual_path ?? ""}
        onValueChange={v => onChange({ ...form, virtual_path: v })}
        description="此策略在应用内部的访问路径，需唯一"
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">API 密钥</div>

      <Input
        label="SecretId"
        labelPlacement="outside"
        size="sm"
        isRequired
        value={form.access_key ?? ""}
        onValueChange={v => onChange({ ...form, access_key: v })}
      />

      <StorageSecretField
        label="SecretKey"
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
        description="填写完整的 CDN 访问地址"
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

      <Input
        label="样式分隔符（可选）"
        labelPlacement="outside"
        placeholder="/ArticleImage"
        size="sm"
        value={settings.style_separator ?? ""}
        onValueChange={v => updateSettings({ style_separator: v })}
        description="用于 COS 图片处理样式"
      />
    </div>
  );
}
