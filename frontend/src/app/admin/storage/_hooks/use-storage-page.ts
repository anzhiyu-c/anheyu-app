"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { addToast } from "@heroui/react";
import { useStoragePolicies, useCreateStoragePolicy, useDeleteStoragePolicy } from "@/hooks/queries/use-storage-policy";
import type { StoragePolicy, StoragePolicyType } from "@/types/storage-policy";
import { getErrorMessage } from "@/lib/api/client";

// ===================================
// 存储类型配置（对齐 anheyu-app）
// ===================================

export interface StorageTypeConfig {
  type: StoragePolicyType;
  name: string;
  dialogTitle: string;
}

export const STORAGE_TYPE_CONFIGS: StorageTypeConfig[] = [
  { type: "local", name: "本机存储", dialogTitle: "添加本地存储策略" },
  { type: "onedrive", name: "OneDrive", dialogTitle: "添加 OneDrive 存储策略" },
  { type: "tencent_cos", name: "腾讯云COS", dialogTitle: "添加腾讯云COS存储策略" },
  { type: "aliyun_oss", name: "阿里云OSS", dialogTitle: "添加阿里云OSS存储策略" },
  { type: "aws_s3", name: "AWS S3", dialogTitle: "添加AWS S3存储策略" },
  { type: "qiniu_kodo", name: "七牛云存储", dialogTitle: "添加七牛云存储策略" },
];

/** 云存储类型（创建后显示 CORS 成功弹窗） */
const CLOUD_STORAGE_TYPES: StoragePolicyType[] = ["tencent_cos", "aliyun_oss", "aws_s3", "qiniu_kodo"];

export function useStoragePage() {
  const router = useRouter();

  // ---- 分页（前端分页，后端返回全量） ----
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---- 数据 ----
  const { data, isLoading, refetch } = useStoragePolicies();
  const allPolicies = useMemo(() => data?.list ?? [], [data?.list]);
  const total = allPolicies.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /** 前端分页 */
  const policies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return allPolicies.slice(start, start + pageSize);
  }, [allPolicies, page, pageSize]);

  // ---- Mutations ----
  const createMutation = useCreateStoragePolicy();
  const deleteMutation = useDeleteStoragePolicy();

  // ---- 模态框状态 ----
  const [typeSelectorOpen, setTypeSelectorOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoragePolicy | null>(null);

  // ---- CORS 成功弹窗 ----
  const [corsSuccessOpen, setCorsSuccessOpen] = useState(false);
  const [createdPolicyName, setCreatedPolicyName] = useState("");
  const [createdPolicyType, setCreatedPolicyType] = useState("");

  // ---- 创建流程 ----
  const [currentStorageType, setCurrentStorageType] = useState<StoragePolicyType | null>(null);

  const currentStorageConfig = useMemo(
    () => STORAGE_TYPE_CONFIGS.find(c => c.type === currentStorageType) ?? null,
    [currentStorageType]
  );

  /** 选择类型后打开创建弹窗 */
  const triggerCreateFlow = useCallback((type: StoragePolicyType) => {
    setTypeSelectorOpen(false);
    setCurrentStorageType(type);
    setCreateDialogOpen(true);
  }, []);

  /** 处理创建表单提交（对齐 anheyu-app handleCreateSubmit） */
  const handleCreateSubmit = useCallback(
    async (payload: Partial<StoragePolicy>) => {
      try {
        await createMutation.mutateAsync(payload);

        setCreateDialogOpen(false);
        const storageTypeName = currentStorageConfig?.name ?? "存储策略";

        if (currentStorageType === "onedrive") {
          addToast({ title: `策略 ${payload.name} 创建成功，请继续配置。`, color: "success" });
          // OneDrive 创建后需要跳转编辑页进行授权
          // 需要 refetch 获取新策略 ID
          const freshData = await refetch();
          const newPolicy = freshData.data?.list?.find(p => p.name === payload.name);
          if (newPolicy) {
            router.push(`/admin/storage/${newPolicy.id}`);
          }
        } else if (CLOUD_STORAGE_TYPES.includes(currentStorageType!)) {
          // 云存储显示 CORS 成功弹窗
          setCreatedPolicyName(payload.name ?? storageTypeName);
          setCreatedPolicyType(storageTypeName);
          setCorsSuccessOpen(true);
        } else {
          // 本地存储直接刷新列表
          addToast({ title: `策略 ${payload.name} 创建成功！`, color: "success" });
        }
      } catch (e: unknown) {
        addToast({ title: getErrorMessage(e), color: "danger" });
      }
    },
    [createMutation, currentStorageConfig, currentStorageType, refetch, router]
  );

  /** 跳转编辑页 */
  const handleEdit = useCallback(
    (policy: StoragePolicy) => {
      router.push(`/admin/storage/${policy.id}`);
    },
    [router]
  );

  /** 确认删除 */
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      addToast({ title: "删除成功", color: "success" });
      setDeleteTarget(null);
    } catch (e: unknown) {
      addToast({ title: getErrorMessage(e), color: "danger" });
    }
  }, [deleteTarget, deleteMutation]);

  /** 刷新 */
  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    // 数据
    policies,
    allPolicies,
    total,
    isLoading,
    // 分页
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    // 模态框
    typeSelectorOpen,
    setTypeSelectorOpen,
    createDialogOpen,
    setCreateDialogOpen,
    deleteTarget,
    setDeleteTarget,
    // CORS 成功弹窗
    corsSuccessOpen,
    setCorsSuccessOpen,
    createdPolicyName,
    createdPolicyType,
    // 创建流程
    currentStorageType,
    currentStorageConfig,
    triggerCreateFlow,
    handleCreateSubmit,
    isCreating: createMutation.isPending,
    // 操作
    handleEdit,
    confirmDelete,
    isDeleting: deleteMutation.isPending,
    onRefresh,
    // 导航
    router,
  };
}
