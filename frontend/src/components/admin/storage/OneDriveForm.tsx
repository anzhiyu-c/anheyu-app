"use client";

import { Button, Input, Select, SelectItem, addToast } from "@heroui/react";
import { Copy } from "lucide-react";
import { StorageSecretField } from "@/components/admin/storage/StorageSecretField";
import { ONEDRIVE_OAUTH_CALLBACK_PATH, type StoragePolicy } from "@/types/storage-policy";

interface OneDriveFormProps {
  form: Partial<StoragePolicy>;
  onChange: (form: Partial<StoragePolicy>) => void;
}

const ENDPOINTS = [
  { key: "https://graph.microsoft.com/v1.0", label: "Microsoft Graph（国际版）" },
  { key: "https://microsoftgraph.chinacloudapi.cn/v1.0", label: "世纪互联（中国版）" },
];

const DRIVE_TYPES = [
  { key: "default", label: "默认 OneDrive" },
  { key: "sharepoint", label: "SharePoint 文档库" },
];

export function OneDriveForm({ form, onChange }: OneDriveFormProps) {
  const settings = form.settings ?? {};
  const updateSettings = (patch: Record<string, unknown>) => {
    onChange({ ...form, settings: { ...settings, ...patch } });
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fullRedirectUri = origin ? `${origin}${ONEDRIVE_OAUTH_CALLBACK_PATH}` : "";

  const copyRedirectUri = async () => {
    if (!fullRedirectUri) return;
    try {
      await navigator.clipboard.writeText(fullRedirectUri);
      addToast({ title: "已复制重定向 URI", color: "success" });
    } catch {
      addToast({ title: "复制失败，请手动复制", color: "danger" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2">OneDrive 配置</div>

      <div suppressHydrationWarning>
        <Input
          label="Azure 重定向 URI（固定）"
          labelPlacement="outside"
          size="sm"
          isReadOnly
          value={fullRedirectUri || "（加载当前站点地址后显示）"}
          description="在 Azure 门户 → 应用注册 → 身份验证 → 重定向 URI 中新增「Web」类型，并填入上述地址。请勿使用其它路径。"
          endContent={
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="复制重定向 URI"
              isDisabled={!fullRedirectUri}
              onPress={copyRedirectUri}
            >
              <Copy className="w-4 h-4" />
            </Button>
          }
        />
      </div>

      <Select
        label="Microsoft Graph 端点"
        labelPlacement="outside"
        placeholder="请选择端点"
        size="sm"
        isRequired
        selectedKeys={form.server ? [form.server] : []}
        onSelectionChange={keys => {
          const v = Array.from(keys)[0] as string;
          if (v) onChange({ ...form, server: v });
        }}
        description="国际版或世纪互联版"
      >
        {ENDPOINTS.map(ep => (
          <SelectItem key={ep.key}>{ep.label}</SelectItem>
        ))}
      </Select>

      <Input
        label="应用 (客户端) ID"
        labelPlacement="outside"
        placeholder="Azure AD 应用的 Client ID"
        size="sm"
        isRequired
        value={form.bucket_name ?? ""}
        onValueChange={v => onChange({ ...form, bucket_name: v })}
        description="在 Azure 门户注册的应用程序 ID"
      />

      <StorageSecretField
        label="客户端密码"
        isRequired
        value={form.secret_key ?? ""}
        onValueChange={v => onChange({ ...form, secret_key: v })}
        description="Azure AD 应用的客户端密码"
      />

      <Select
        label="OneDrive 类型"
        labelPlacement="outside"
        placeholder="请选择类型"
        size="sm"
        selectedKeys={settings.drive_type ? [settings.drive_type] : ["default"]}
        onSelectionChange={keys => {
          const v = Array.from(keys)[0] as string;
          if (v) updateSettings({ drive_type: v });
        }}
      >
        {DRIVE_TYPES.map(dt => (
          <SelectItem key={dt.key}>{dt.label}</SelectItem>
        ))}
      </Select>

      {settings.drive_type === "sharepoint" && (
        <Input
          label="SharePoint Drive ID"
          labelPlacement="outside"
          placeholder="SharePoint 文档库 Drive ID"
          size="sm"
          value={settings.drive_id ?? ""}
          onValueChange={v => updateSettings({ drive_id: v })}
          description="选择 SharePoint 类型时必填"
        />
      )}

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">路径设置</div>

      <Input
        label="云端存储根目录"
        labelPlacement="outside"
        placeholder="例如 /AnHeYu 或留空"
        size="sm"
        value={form.base_path ?? ""}
        onValueChange={v => onChange({ ...form, base_path: v })}
        description="文件在 OneDrive 中的存放根目录"
      />

      <Input
        label="应用内挂载路径"
        labelPlacement="outside"
        placeholder="例如 /onedrive"
        size="sm"
        isRequired
        value={form.virtual_path ?? ""}
        onValueChange={v => onChange({ ...form, virtual_path: v })}
        description="此策略在应用内部的访问路径，需唯一"
      />

      <div className="p-3 rounded-lg bg-warning-50 border border-warning-200 mt-4">
        <p className="text-xs text-warning-700">
          创建策略后需要在编辑页面完成 OAuth 授权，才能正常使用 OneDrive 存储。
        </p>
      </div>
    </div>
  );
}
