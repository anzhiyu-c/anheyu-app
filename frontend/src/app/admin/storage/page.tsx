"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Pagination,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import {
  Plus,
  Pencil,
  Trash2,
  Server,
  Database,
  ShieldAlert,
  RotateCw,
  HardDrive,
  CloudCog,
  Globe,
  CloudUpload,
  Warehouse,
  Layers,
  CheckCircle2,
  Star,
  AlertCircle,
  CircleCheckBig,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { adminContainerVariants, adminItemVariants } from "@/lib/motion";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { StorageTypeSelector } from "@/components/admin/storage/StorageTypeSelector";
import { useStoragePage } from "./_hooks/use-storage-page";
import {
  POLICY_FLAG_LABELS,
  STORAGE_TYPE_LABELS,
  type StoragePolicy,
  type StoragePolicyType,
} from "@/types/storage-policy";
import { LocalForm } from "@/components/admin/storage/LocalForm";
import { OneDriveForm } from "@/components/admin/storage/OneDriveForm";
import { TencentCosForm } from "@/components/admin/storage/TencentCosForm";
import { AliyunOssForm } from "@/components/admin/storage/AliyunOssForm";
import { AwsS3Form } from "@/components/admin/storage/AwsS3Form";
import { QiniuKodoForm } from "@/components/admin/storage/QiniuKodoForm";

// ===================================
// 存储类型图标 & 配色
// ===================================

const TYPE_ICONS: Record<StoragePolicyType, typeof Server> = {
  local: HardDrive,
  onedrive: CloudCog,
  tencent_cos: Globe,
  aliyun_oss: CloudUpload,
  aws_s3: Server,
  qiniu_kodo: Warehouse,
};

const TYPE_ICON_COLORS: Record<StoragePolicyType, string> = {
  local: "text-blue-500 bg-blue-500/10",
  onedrive: "text-sky-500 bg-sky-500/10",
  tencent_cos: "text-indigo-500 bg-indigo-500/10",
  aliyun_oss: "text-orange-500 bg-orange-500/10",
  aws_s3: "text-amber-600 bg-amber-500/10",
  qiniu_kodo: "text-cyan-600 bg-cyan-500/10",
};

// ===================================
// 策略卡片 (Apple-style)
// ===================================

function PolicyCard({
  policy,
  onEdit,
  onDelete,
}: {
  policy: StoragePolicy;
  onEdit: (p: StoragePolicy) => void;
  onDelete: (p: StoragePolicy) => void;
}) {
  const Icon = TYPE_ICONS[policy.type] ?? Database;
  const iconColor = TYPE_ICON_COLORS[policy.type] ?? "text-foreground/60 bg-foreground/5";
  const isCloud = policy.type !== "local";
  const isConfigured = isCloud
    ? policy.type === "onedrive"
      ? !!policy.access_key
      : !!(policy.access_key && policy.secret_key)
    : true;
  const canDelete = !policy.flag && !(policy.type === "local" && policy.virtual_path === "/");

  return (
    <div
      className={cn(
        "rounded-2xl",
        "bg-card text-card-foreground",
        "border border-border/60",
        "hover:border-border hover:shadow-md",
        "transition-all duration-200 ease-out",
        "flex items-center gap-3.5 px-4 py-3.5"
      )}
    >
      {/* 图标 */}
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconColor)}>
        <Icon className="w-[18px] h-[18px]" />
      </div>

      {/* 信息 */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="text-sm font-semibold leading-tight line-clamp-1 text-foreground">{policy.name}</h4>
          {policy.flag && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-px rounded-md bg-foreground/5 text-muted-foreground">
              {POLICY_FLAG_LABELS[policy.flag] ?? policy.flag}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground/70">{STORAGE_TYPE_LABELS[policy.type]}</span>
          {isCloud && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="flex items-center gap-1">
                <span className={cn("w-1.5 h-1.5 rounded-full", isConfigured ? "bg-emerald-500" : "bg-amber-400")} />
                <span
                  className={cn(
                    "text-[11px]",
                    isConfigured
                      ? "text-emerald-600/70 dark:text-emerald-400/70"
                      : "text-amber-600/70 dark:text-amber-400/70"
                  )}
                >
                  {policy.type === "onedrive"
                    ? isConfigured
                      ? "已授权"
                      : "未授权"
                    : isConfigured
                      ? "已配置"
                      : "未配置"}
                </span>
              </span>
            </>
          )}
        </div>
        {policy.virtual_path && (
          <p className="text-[11px] text-muted-foreground/40 font-mono truncate mt-0.5">{policy.virtual_path}</p>
        )}
      </div>

      {/* 操作按钮（常驻） */}
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip content="编辑" showArrow={false}>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="full"
            className="text-muted-foreground hover:text-foreground"
            onPress={() => onEdit(policy)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>
        {canDelete && (
          <Tooltip content="删除" showArrow={false}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="full"
              className="text-muted-foreground hover:text-danger"
              onPress={() => onDelete(policy)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// ===================================
// 添加卡片 (Apple-style)
// ===================================

function AddCard({ onPress }: { onPress: () => void }) {
  return (
    <div
      onClick={onPress}
      className={cn(
        "rounded-2xl flex items-center gap-3.5 px-4 py-4 cursor-pointer",
        "border border-dashed border-border/40",
        "transition-all duration-300 ease-out",
        "hover:border-primary/40 hover:bg-primary/3",
        "group"
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors duration-300">
        <Plus className="w-4.5 h-4.5 text-muted-foreground/50 group-hover:text-primary transition-colors duration-300" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground/60 group-hover:text-primary transition-colors duration-300">
          添加存储策略
        </p>
        <p className="text-[11px] text-muted-foreground/30 mt-0.5">支持本地、云存储等多种类型</p>
      </div>
    </div>
  );
}

// ===================================
// CORS 成功弹窗（对齐 anheyu-app）
// ===================================

function CorsSuccessDialog({
  isOpen,
  onClose,
  policyName,
  policyType,
}: {
  isOpen: boolean;
  onClose: () => void;
  policyName: string;
  policyType: string;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={open => !open && onClose()} size="lg">
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-1">
          <div className="flex items-center gap-3 w-full p-4 rounded-lg bg-success-50 border-l-4 border-success">
            <CircleCheckBig className="w-6 h-6 text-success shrink-0" />
            <h3 className="text-lg font-semibold m-0">{policyName} 已成功创建</h3>
          </div>
        </ModalHeader>
        <ModalBody className="pt-0">
          <h4 className="text-base font-semibold text-success m-0">✅ 跨域策略已自动配置</h4>
          <p className="text-sm text-foreground/80 leading-relaxed">
            系统已为您的{policyType}存储桶自动配置了以下跨域（CORS）策略：
          </p>
          <div className="p-4 rounded-lg bg-muted space-y-3">
            {[
              { label: "来源 (Origin):", value: "*", desc: "允许所有来源访问" },
              { label: "允许方法 (Methods):", value: "GET, POST, PUT, DELETE, HEAD", desc: "支持所有常用HTTP方法" },
              { label: "允许头部 (Headers):", value: "*", desc: "允许所有请求头" },
              { label: "暴露头部 (Expose Headers):", value: "ETag", desc: "允许客户端访问ETag响应头" },
              { label: "缓存时间 (Max-Age):", value: "3600秒", desc: "预检请求缓存1小时" },
            ].map((rule, i) => (
              <div key={i} className="flex flex-col pb-3 border-b border-border/50 last:border-b-0 last:pb-0">
                <span className="text-sm font-semibold mb-1">{rule.label}</span>
                <span className="inline-block px-2 py-1 mb-1 font-mono text-xs text-primary bg-primary/10 rounded w-fit">
                  {rule.value}
                </span>
                <span className="text-xs text-muted-foreground leading-relaxed">{rule.desc}</span>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm m-0 leading-relaxed">
              <strong>提示：</strong>您现在可以正常使用此存储策略，文件可以被跨域访问。
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onPress={onClose}>
            我知道了
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ===================================
// 创建表单弹窗（对齐 anheyu-app 统一创建弹窗）
// ===================================

/** 创建表单默认值 */
const CREATE_DEFAULTS: Record<StoragePolicyType, Partial<StoragePolicy>> = {
  local: { type: "local", name: "", virtual_path: "", max_size: 10485760 },
  onedrive: { type: "onedrive", name: "", virtual_path: "/onedrive", max_size: 10485760 },
  tencent_cos: {
    type: "tencent_cos",
    name: "",
    virtual_path: "/cos",
    max_size: 10485760,
    settings: { upload_method: "client" },
  },
  aliyun_oss: {
    type: "aliyun_oss",
    name: "",
    virtual_path: "/oss",
    max_size: 10485760,
    settings: { upload_method: "client" },
  },
  aws_s3: { type: "aws_s3", name: "", virtual_path: "/s3", max_size: 10485760, settings: { upload_method: "client" } },
  qiniu_kodo: {
    type: "qiniu_kodo",
    name: "",
    virtual_path: "/qiniu",
    max_size: 10485760,
    settings: { upload_method: "client" },
  },
};

/** 动态表单映射 */
const CREATE_FORM_MAP: Record<StoragePolicyType, typeof LocalForm> = {
  local: LocalForm,
  onedrive: OneDriveForm,
  tencent_cos: TencentCosForm,
  aliyun_oss: AliyunOssForm,
  aws_s3: AwsS3Form,
  qiniu_kodo: QiniuKodoForm,
};

/** 表单主体（通过 key 强制重新挂载，确保 useState 初始化器每次打开都执行） */
function CreateFormBody({
  storageType,
  isLoading,
  onSubmit,
  onCancel,
}: {
  storageType: StoragePolicyType;
  isLoading: boolean;
  onSubmit: (data: Partial<StoragePolicy>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<StoragePolicy>>(() => ({ ...CREATE_DEFAULTS[storageType] }));

  const handleConfirm = () => {
    const submitData = { ...formData };
    // 本地存储：从 virtual_path 自动生成 base_path（对齐 anheyu-app LocalCreateForm）
    if (storageType === "local" && submitData.virtual_path) {
      const safePath = submitData.virtual_path.replace(/^\/+/, "");
      submitData.base_path = `data/storage/${safePath}`;
    }
    onSubmit(submitData);
  };

  const FormComponent = CREATE_FORM_MAP[storageType];

  return (
    <>
      <ModalBody>
        {/* 策略名称（所有类型通用，对齐 anheyu-app CreateForm） */}
        <Input
          label="名称"
          labelPlacement="outside"
          placeholder="例如：评论图片、文章图片"
          size="sm"
          isRequired
          value={formData.name ?? ""}
          onValueChange={v => setFormData(prev => ({ ...prev, name: v }))}
          description="存储策略的展示名，也会用于向用户展示。"
        />
        {FormComponent && <FormComponent form={formData} onChange={setFormData} />}
      </ModalBody>
      <ModalFooter>
        <Button variant="flat" onPress={onCancel} isDisabled={isLoading}>
          取消
        </Button>
        <Button color="primary" onPress={handleConfirm} isLoading={isLoading}>
          创建
        </Button>
      </ModalFooter>
    </>
  );
}

function CreateFormModal({
  isOpen,
  onOpenChange,
  title,
  storageType,
  isLoading,
  onSubmit,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  storageType: StoragePolicyType | null;
  isLoading: boolean;
  onSubmit: (data: Partial<StoragePolicy>) => void;
}) {
  return (
    <AdminDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
      isDismissable={!isLoading}
      header={{
        title,
        description: storageType
          ? `配置 ${STORAGE_TYPE_LABELS[storageType]} 参数后即可创建`
          : "填写配置后即可创建存储策略",
        icon: Plus,
      }}
    >
      {storageType && (
        <CreateFormBody
          key={`${storageType}-${isOpen}`}
          storageType={storageType}
          isLoading={isLoading}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </AdminDialog>
  );
}

// ===================================
// 骨架屏
// ===================================

function StorageSkeleton() {
  return (
    <div className="relative h-full flex flex-col overflow-hidden -m-4 lg:-m-8">
      <div className="flex-1 min-h-0 flex flex-col mx-6 mt-5 mb-2 bg-card border border-border/60 rounded-xl overflow-hidden">
        {/* 头部骨架 */}
        <div className="shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-6 w-24 rounded-md bg-muted/40 animate-pulse" />
              <div className="h-3 w-48 rounded-md bg-muted/30 animate-pulse" />
            </div>
            <div className="flex gap-1.5">
              <div className="h-8 w-20 rounded-lg bg-muted/30 animate-pulse" />
              <div className="h-8 w-16 rounded-lg bg-muted/30 animate-pulse" />
            </div>
          </div>
        </div>
        {/* 统计条骨架 */}
        <div className="px-5 pb-3 border-b border-border/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted/30 animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-5 w-8 rounded bg-muted/40 animate-pulse" />
                  <div className="h-3 w-12 rounded bg-muted/30 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* 卡片网格骨架 */}
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3.5 px-4 py-4 rounded-2xl bg-muted/10 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-muted/30 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-muted/30" />
                  <div className="h-3 w-16 rounded bg-muted/20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================
// 主页面
// ===================================

export default function StoragePage() {
  const sp = useStoragePage();

  if (sp.isLoading) {
    return <StorageSkeleton />;
  }

  // 统计数据
  const configuredCount = sp.allPolicies.filter(p => {
    if (p.type === "local") return true;
    if (p.type === "onedrive") return !!p.access_key;
    return !!(p.access_key && p.secret_key);
  }).length;
  const flaggedCount = sp.allPolicies.filter(p => !!p.flag).length;
  const unconfiguredCount = Math.max(sp.total - configuredCount, 0);

  return (
    <motion.div
      className="relative h-full flex flex-col overflow-hidden -m-4 lg:-m-8"
      variants={adminContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={adminItemVariants}
        className="flex-1 min-h-0 flex flex-col mx-6 mt-5 mb-2 bg-card border border-border/60 rounded-xl overflow-hidden"
      >
        {/* 标题区 + 操作按钮 */}
        <div className="shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">存储策略</h1>
              <p className="text-xs text-muted-foreground mt-1">配置文件存储服务，支持本地存储和多种云存储</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                color="primary"
                startContent={<Plus className="w-3.5 h-3.5" />}
                onPress={() => sp.setTypeSelectorOpen(true)}
                className="font-medium shadow-sm"
              >
                添加策略
              </Button>
              <Button
                size="sm"
                variant="flat"
                startContent={<RotateCw className="w-3.5 h-3.5" />}
                onPress={sp.onRefresh}
                className="text-foreground/70"
              >
                刷新
              </Button>
            </div>
          </div>
        </div>

        {/* 紧凑统计条 */}
        <div className="px-5 pb-3 border-b border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">{sp.total}</p>
              <p className="text-xs text-muted-foreground">全部策略</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight text-emerald-500">{configuredCount}</p>
              <p className="text-xs text-muted-foreground">已配置</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight text-amber-500">{flaggedCount}</p>
              <p className="text-xs text-muted-foreground">默认策略</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight text-rose-500">{unconfiguredCount}</p>
              <p className="text-xs text-muted-foreground">未配置</p>
            </div>
          </div>
        </div>

        {/* 策略卡片网格 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 min-h-[100px]">
            {/* 添加卡片（始终显示为第一个） */}
            <AddCard onPress={() => sp.setTypeSelectorOpen(true)} />

            {/* 策略卡片 */}
            {sp.policies.map(policy => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                onEdit={sp.handleEdit}
                onDelete={p => sp.setDeleteTarget(p)}
              />
            ))}
          </div>
        </div>

        {/* 分页 */}
        {sp.totalPages > 1 && (
          <div className="px-5 pb-4 flex justify-center">
            <Pagination
              isCompact
              showControls
              showShadow
              color="primary"
              page={sp.page}
              total={sp.totalPages}
              onChange={sp.setPage}
            />
          </div>
        )}
      </motion.div>

      {/* 选择存储类型 Modal */}
      <StorageTypeSelector
        isOpen={sp.typeSelectorOpen}
        onOpenChange={sp.setTypeSelectorOpen}
        onSelect={sp.triggerCreateFlow}
      />

      {/* 创建表单 Modal */}
      <CreateFormModal
        isOpen={sp.createDialogOpen}
        onOpenChange={sp.setCreateDialogOpen}
        title={sp.currentStorageConfig?.dialogTitle ?? "添加存储策略"}
        storageType={sp.currentStorageType}
        isLoading={sp.isCreating}
        onSubmit={sp.handleCreateSubmit}
      />

      {/* CORS 成功弹窗 */}
      <CorsSuccessDialog
        isOpen={sp.corsSuccessOpen}
        onClose={() => sp.setCorsSuccessOpen(false)}
        policyName={sp.createdPolicyName}
        policyType={sp.createdPolicyType}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!sp.deleteTarget}
        onOpenChange={open => {
          if (!open) sp.setDeleteTarget(null);
        }}
        title="删除存储策略"
        description={`确认删除存储策略 ${sp.deleteTarget?.name} 吗？`}
        confirmText="删除"
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={sp.isDeleting}
        onConfirm={sp.confirmDelete}
      />
    </motion.div>
  );
}
