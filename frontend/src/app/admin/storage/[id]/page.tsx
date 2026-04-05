"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Input, Select, SelectItem, Divider, Spinner, addToast } from "@heroui/react";
import { ArrowLeft, Save } from "lucide-react";
import { AdminPageHeader } from "@/components/admin";
import { useStoragePolicy, useUpdateStoragePolicy } from "@/hooks/queries/use-storage-policy";
import { storagePolicyApi } from "@/lib/api/storage-policy";
import { getErrorMessage } from "@/lib/api/client";
import type { StoragePolicy, StoragePolicyType } from "@/types/storage-policy";
import { LocalForm } from "@/components/admin/storage/LocalForm";
import { OneDriveForm } from "@/components/admin/storage/OneDriveForm";
import { TencentCosForm } from "@/components/admin/storage/TencentCosForm";
import { AliyunOssForm } from "@/components/admin/storage/AliyunOssForm";
import { AwsS3Form } from "@/components/admin/storage/AwsS3Form";
import { QiniuKodoForm } from "@/components/admin/storage/QiniuKodoForm";

// ===================================
// 大小单位换算
// ===================================

const SIZE_UNITS = [
  { label: "B", value: 1 },
  { label: "KB", value: 1024 },
  { label: "MB", value: 1024 * 1024 },
  { label: "GB", value: 1024 * 1024 * 1024 },
];

function bytesToHuman(bytes: number, defaultUnit = 1024 * 1024): { value: number; unit: number } {
  if (!bytes) return { value: 0, unit: defaultUnit };
  for (let i = SIZE_UNITS.length - 1; i >= 0; i--) {
    if (bytes >= SIZE_UNITS[i].value && bytes % SIZE_UNITS[i].value === 0) {
      return { value: bytes / SIZE_UNITS[i].value, unit: SIZE_UNITS[i].value };
    }
  }
  return { value: parseFloat((bytes / defaultUnit).toFixed(2)), unit: defaultUnit };
}

// ===================================
// 策略标志选项
// ===================================

const FLAG_OPTIONS = [
  { key: "", label: "无 (普通策略)" },
  { key: "article_image", label: "文章图片默认" },
  { key: "comment_image", label: "评论图片默认" },
  { key: "user_avatar", label: "用户头像默认" },
];

// ===================================
// 存储类型选项
// ===================================

const STORAGE_TYPE_OPTIONS = [
  { key: "local", label: "本机存储" },
  { key: "onedrive", label: "OneDrive" },
  { key: "tencent_cos", label: "腾讯云COS" },
  { key: "aliyun_oss", label: "阿里云OSS" },
  { key: "aws_s3", label: "AWS S3" },
  { key: "qiniu_kodo", label: "七牛云存储" },
];

// ===================================
// 动态子表单映射
// ===================================

const PROVIDER_FORMS: Record<StoragePolicyType, typeof LocalForm> = {
  local: LocalForm,
  onedrive: OneDriveForm,
  tencent_cos: TencentCosForm,
  aliyun_oss: AliyunOssForm,
  aws_s3: AwsS3Form,
  qiniu_kodo: QiniuKodoForm,
};

// ===================================
// OneDrive 授权组件
// ===================================

function OneDriveAuthorization({ policy }: { policy: Partial<StoragePolicy> }) {
  const [loading, setLoading] = useState(false);
  const isAuthorized = !!policy.access_key;

  const handleAuthorize = async () => {
    if (!policy.id) return;
    setLoading(true);
    try {
      const data = await storagePolicyApi.getOneDriveAuthUrl(policy.id);
      addToast({ title: "正在跳转到微软授权页面...", color: "primary" });
      window.location.href = data.url;
    } catch (e) {
      addToast({ title: getErrorMessage(e), color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  if (isAuthorized) {
    return (
      <div className="p-4 rounded-lg bg-success-50 border border-success-200 mb-6">
        <h4 className="text-sm font-semibold text-success mb-1">账号授权</h4>
        <p className="text-sm text-success-700">此策略已成功授权。</p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg bg-warning-50 border border-warning-200 mb-6">
      <h4 className="text-sm font-semibold text-warning mb-1">账号授权</h4>
      <p className="text-sm text-warning-700 mb-3">当前策略尚未授权，请保存配置后点击下方按钮授权。</p>
      <Button color="primary" size="sm" onPress={handleAuthorize} isLoading={loading}>
        立即授权
      </Button>
    </div>
  );
}

// ===================================
// 编辑表单（接收 initialData props，避免 setState-in-render）
// ===================================

function PolicyEditForm({ initialData }: { initialData: StoragePolicy }) {
  const router = useRouter();
  const updateMutation = useUpdateStoragePolicy();

  // 初始化表单数据（通过 useState 初始化器，只执行一次）
  const [formData, setFormData] = useState<Partial<StoragePolicy>>(() => ({ ...initialData }));

  const [maxSizeValue, setMaxSizeValue] = useState(() => bytesToHuman(initialData.max_size ?? 0).value);
  const [maxSizeUnit, setMaxSizeUnit] = useState(() => bytesToHuman(initialData.max_size ?? 0).unit);
  const [chunkSizeValue, setChunkSizeValue] = useState(() => bytesToHuman(initialData.settings?.chunk_size ?? 0).value);
  const [chunkSizeUnit, setChunkSizeUnit] = useState(() => bytesToHuman(initialData.settings?.chunk_size ?? 0).unit);

  const handleMaxSizeChange = useCallback((val: number, unit: number) => {
    setMaxSizeValue(val);
    setMaxSizeUnit(unit);
    setFormData(prev => ({ ...prev, max_size: Math.round(val * unit) }));
  }, []);

  const handleChunkSizeChange = useCallback((val: number, unit: number) => {
    setChunkSizeValue(val);
    setChunkSizeUnit(unit);
    setFormData(prev => ({
      ...prev,
      settings: { ...prev.settings, chunk_size: Math.round(val * unit) },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!initialData.id) return;
    try {
      // 后端 UpdatePolicyRequest 要求必填 type，提交时带上当前策略类型（与后端一致）
      const updateData: Record<string, unknown> = {
        name: formData.name,
        type: formData.type ?? initialData.type,
        virtual_path: formData.virtual_path,
        base_path: formData.base_path,
        flag: formData.flag ?? "",
        is_private: formData.is_private,
        max_size: formData.max_size,
        settings: formData.settings,
        server: formData.server,
        bucket_name: formData.bucket_name,
        access_key: formData.access_key,
        secret_key: formData.secret_key,
        oss_process_style: formData.oss_process_style ?? "",
      };
      await updateMutation.mutateAsync({
        id: initialData.id,
        data: updateData as Partial<StoragePolicy>,
      });
      addToast({ title: "保存成功", color: "success" });
    } catch (e) {
      addToast({ title: getErrorMessage(e), color: "danger" });
    }
  }, [initialData.id, initialData.type, formData, updateMutation]);

  const goBack = useCallback(() => {
    router.push("/admin/storage");
  }, [router]);

  const ProviderForm = formData.type ? PROVIDER_FORMS[formData.type] : null;

  return (
    <div className="-m-4 lg:-m-8">
      <div className="mx-6 mt-5 mb-2">
        <AdminPageHeader
          title={`编辑存储策略 - ${formData.name || ""}`}
          description="修改存储策略配置"
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="flat" startContent={<ArrowLeft className="w-3.5 h-3.5" />} onPress={goBack}>
                返回
              </Button>
              <Button
                size="sm"
                color="primary"
                startContent={<Save className="w-3.5 h-3.5" />}
                onPress={handleSave}
                isLoading={updateMutation.isPending}
              >
                保存
              </Button>
            </div>
          }
        />

        <div className="mt-4 bg-card border border-border/50 rounded-xl p-6 space-y-6">
          {formData.type === "onedrive" && formData.id && <OneDriveAuthorization policy={formData} />}

          {/* 基本信息 */}
          <div>
            <h2 className="text-base font-semibold mb-4">基本信息</h2>
            <div className="space-y-4 max-w-xl">
              <Input
                label="策略名称"
                labelPlacement="outside"
                placeholder="请输入策略名称"
                size="sm"
                isRequired
                value={formData.name ?? ""}
                onValueChange={v => setFormData(prev => ({ ...prev, name: v }))}
              />
              <Select
                label="策略标志"
                labelPlacement="outside"
                placeholder="请选择策略标志"
                size="sm"
                selectedKeys={[formData.flag ?? ""]}
                onSelectionChange={keys => {
                  const v = Array.from(keys)[0] as string;
                  setFormData(prev => ({ ...prev, flag: v || "" }));
                }}
                description="设置后，该策略将成为系统核心功能的默认存储位置。此标志在系统中具有唯一性。"
              >
                {FLAG_OPTIONS.map(opt => (
                  <SelectItem key={opt.key}>{opt.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="存储类型"
                labelPlacement="outside"
                size="sm"
                isDisabled={!!formData.id}
                selectedKeys={formData.type ? [formData.type] : []}
                onSelectionChange={keys => {
                  const v = Array.from(keys)[0] as string;
                  if (v) setFormData(prev => ({ ...prev, type: v as StoragePolicyType }));
                }}
              >
                {STORAGE_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.key}>{opt.label}</SelectItem>
                ))}
              </Select>
            </div>
          </div>

          {/* 动态子表单 */}
          {ProviderForm && (
            <div className="max-w-xl">
              <ProviderForm form={formData} onChange={setFormData} />
            </div>
          )}

          {/* 存储与上传 */}
          <Divider />
          <div>
            <h2 className="text-base font-semibold mb-4">存储与上传</h2>
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="text-sm font-medium mb-1.5 block">文件大小限制</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    size="sm"
                    className="w-[180px]"
                    value={String(maxSizeValue)}
                    onValueChange={v => handleMaxSizeChange(Number(v) || 0, maxSizeUnit)}
                    min={0}
                  />
                  <Select
                    size="sm"
                    className="w-[100px]"
                    selectedKeys={[String(maxSizeUnit)]}
                    onSelectionChange={keys => {
                      const u = Number(Array.from(keys)[0]);
                      if (u) handleMaxSizeChange(maxSizeValue, u);
                    }}
                  >
                    {SIZE_UNITS.map(u => (
                      <SelectItem key={String(u.value)}>{u.label}</SelectItem>
                    ))}
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  单个文件的最大大小，输入为 0 时表示不限制单文件大小。
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">上传分片大小</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    size="sm"
                    className="w-[180px]"
                    value={String(chunkSizeValue)}
                    onValueChange={v => handleChunkSizeChange(Number(v) || 0, chunkSizeUnit)}
                    min={0}
                  />
                  <Select
                    size="sm"
                    className="w-[100px]"
                    selectedKeys={[String(chunkSizeUnit)]}
                    onSelectionChange={keys => {
                      const u = Number(Array.from(keys)[0]);
                      if (u) handleChunkSizeChange(chunkSizeValue, u);
                    }}
                  >
                    {SIZE_UNITS.filter(u => u.label !== "B").map(u => (
                      <SelectItem key={String(u.value)}>{u.label}</SelectItem>
                    ))}
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground mt-1">分片上传时每个分片的大小，0 表示使用后端默认值。</p>
              </div>

              {formData.type && ["tencent_cos", "aliyun_oss", "qiniu_kodo"].includes(formData.type) && (
                <Input
                  label="OSS 图片处理样式"
                  labelPlacement="outside"
                  placeholder="例如 /ArticleImage 或 !webp"
                  size="sm"
                  value={formData.oss_process_style ?? ""}
                  onValueChange={v => setFormData(prev => ({ ...prev, oss_process_style: v }))}
                  description="图片处理样式后缀，会自动追加到图片URL后面（PRO 功能）"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================
// 页面入口（加载数据后渲染表单）
// ===================================

export default function StoragePolicyEditPage() {
  const params = useParams();
  const policyId = params.id as string;
  const { data: policyData, isLoading } = useStoragePolicy(policyId);

  if (isLoading || !policyData) {
    return (
      <div className="-m-4 lg:-m-8">
        <div className="mx-6 mt-5 mb-2 flex items-center justify-center py-20">
          <Spinner size="lg" label="加载中..." />
        </div>
      </div>
    );
  }

  return <PolicyEditForm key={policyData.id} initialData={policyData} />;
}
