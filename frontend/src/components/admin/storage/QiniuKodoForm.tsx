"use client";

import { Input, Select, SelectItem, Switch } from "@heroui/react";
import { StorageSecretField } from "@/components/admin/storage/StorageSecretField";
import type { StoragePolicy } from "@/types/storage-policy";

interface QiniuKodoFormProps {
  form: Partial<StoragePolicy>;
  onChange: (form: Partial<StoragePolicy>) => void;
}

/** 七牛云存储区域列表 */
const QINIU_REGIONS = [
  { key: "https://up-z0.qiniup.com", label: "华东-浙江" },
  { key: "https://up-cn-east-2.qiniup.com", label: "华东-浙江2" },
  { key: "https://up-z1.qiniup.com", label: "华北-河北" },
  { key: "https://up-z2.qiniup.com", label: "华南-广东" },
  { key: "https://up-na0.qiniup.com", label: "北美-洛杉矶" },
  { key: "https://up-as0.qiniup.com", label: "亚太-新加坡" },
];

export function QiniuKodoForm({ form, onChange }: QiniuKodoFormProps) {
  const settings = form.settings ?? {};
  const updateSettings = (patch: Record<string, unknown>) => {
    onChange({ ...form, settings: { ...settings, ...patch } });
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2">七牛云配置</div>

      <Input
        label="存储空间"
        labelPlacement="outside"
        placeholder="例如 my-kodo-bucket"
        size="sm"
        isRequired
        value={form.bucket_name ?? ""}
        onValueChange={v => onChange({ ...form, bucket_name: v })}
        description="在七牛云控制台创建的存储空间名称"
      />

      <Select
        label="存储区域"
        labelPlacement="outside"
        placeholder="请选择存储区域"
        size="sm"
        isRequired
        selectedKeys={form.server ? [form.server] : []}
        onSelectionChange={keys => {
          const v = Array.from(keys)[0] as string;
          if (v) onChange({ ...form, server: v });
        }}
        description="选择七牛云存储空间所在的区域"
      >
        {QINIU_REGIONS.map(r => (
          <SelectItem key={r.key}>{r.label}</SelectItem>
        ))}
      </Select>

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">路径设置</div>

      <Input
        label="存储根目录"
        labelPlacement="outside"
        placeholder="例如 /images 或留空"
        size="sm"
        value={form.base_path ?? ""}
        onValueChange={v => onChange({ ...form, base_path: v })}
      />

      <Input
        label="应用内挂载路径"
        labelPlacement="outside"
        placeholder="例如 /qiniu"
        size="sm"
        isRequired
        value={form.virtual_path ?? ""}
        onValueChange={v => onChange({ ...form, virtual_path: v })}
        description="此策略在应用内部的访问路径，需唯一"
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">API 密钥</div>

      <Input
        label="AccessKey"
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
        <span className="text-sm">私有空间</span>
      </Switch>
      <p className="text-xs text-muted-foreground -mt-2">关闭时为公开空间，开启后访问需要签名</p>

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">下载设置</div>

      <Input
        label="访问域名"
        labelPlacement="outside"
        placeholder="https://cdn.example.com"
        size="sm"
        isRequired
        value={settings.cdn_domain ?? ""}
        onValueChange={v => updateSettings({ cdn_domain: v })}
        description="七牛云绑定的访问域名（必填）"
      />

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
        placeholder="例如 - 或 /"
        size="sm"
        value={settings.style_separator ?? ""}
        onValueChange={v => updateSettings({ style_separator: v })}
        description="用于七牛云图片处理样式"
      />
    </div>
  );
}
