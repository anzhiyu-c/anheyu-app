"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { addToast, ModalBody, ModalFooter, Button, useDisclosure, Input, Chip, Tooltip, Spinner } from "@heroui/react";
import {
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  RotateCcw,
  RefreshCw,
  Info,
  FileJson,
  ArrowUpFromLine,
  ArrowDownToLine,
} from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { getErrorMessage } from "@/lib/api/client";
import { configApi, type BackupInfo } from "@/lib/api/config";

interface BackupImportFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

// ==================== 工具函数 ====================

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + "" + sizes[i];
}

/** 格式化时间 */
function formatTime(timeStr: string): string {
  const date = new Date(timeStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 从导出接口错误中解析 message（导出使用 responseType: blob，错误体可能是 Blob） */
async function getExportErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== "object" || !("response" in error)) return fallback;
  const axiosError = error as { response?: { data?: Blob | { message?: string } } };
  const data = axiosError.response?.data;
  if (data && typeof data === "object" && data !== null && "message" in data && typeof (data as { message?: string }).message === "string") {
    return (data as { message: string }).message;
  }
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text) as { message?: string };
      if (typeof parsed?.message === "string") return parsed.message;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

export function BackupImportForm({ loading: pageLoading }: BackupImportFormProps) {
  // ==================== 导入导出状态 ====================
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================== 备份管理状态 ====================
  const [backupList, setBackupList] = useState<BackupInfo[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [backupDescription, setBackupDescription] = useState("");
  const [keepCount, setKeepCount] = useState(5);

  // ==================== 确认弹窗 ====================
  const importConfirm = useDisclosure();
  const restoreConfirm = useDisclosure();
  const deleteConfirm = useDisclosure();
  const cleanConfirm = useDisclosure();

  // 用于存储待操作的目标
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupInfo | null>(null);

  // ==================== 获取备份列表 ====================
  const fetchBackups = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await configApi.listBackups();
      setBackupList(res.data || []);
    } catch (error) {
      console.error("获取备份列表失败:", error);
      addToast({ title: "获取备份列表失败", color: "danger", timeout: 3000 });
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  // ==================== 导出功能 ====================
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await configApi.exportConfig();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `anheyu-settings-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast({ title: "配置导出成功", color: "success", timeout: 3000 });
    } catch (error: unknown) {
      console.error("导出配置失败:", error);
      const message = await getExportErrorMessage(error, "导出配置失败，请稍后重试");
      addToast({ title: message, color: "danger", timeout: 4000 });
    } finally {
      setExporting(false);
    }
  }, []);

  // ==================== 导入功能 ====================
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      if (!file.name.endsWith(".json")) {
        addToast({ title: "请选择 .json 格式的配置文件", color: "warning", timeout: 4000 });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        addToast({ title: "文件大小不能超过 10MB", color: "warning", timeout: 4000 });
        return;
      }

      setPendingFile(file);
      importConfirm.onOpen();
    },
    [importConfirm]
  );

  const executeImport = useCallback(async () => {
    if (!pendingFile) return;
    importConfirm.onClose();
    setImporting(true);

    // 导入前自动备份（is_auto: true 以便在备份列表中显示「自动」标签）
    try {
      await configApi.createBackup("导入配置前自动备份", true);
    } catch (backupError) {
      console.warn("导入前自动备份失败:", backupError);
      addToast({ title: "自动备份失败，将继续导入配置", color: "warning", timeout: 3000 });
    }

    try {
      await configApi.importConfig(pendingFile);
      await fetchBackups();

      addToast({
        title: "配置导入成功！页面将在 2 秒后刷新...",
        color: "success",
        timeout: 2000,
      });

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("导入配置失败:", error);
      addToast({ title: getErrorMessage(error), color: "danger", timeout: 5000 });
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  }, [pendingFile, importConfirm, fetchBackups]);

  // ==================== 创建备份 ====================
  const handleCreateBackup = useCallback(async () => {
    setCreating(true);
    try {
      await configApi.createBackup(backupDescription || "手动备份");
      addToast({ title: "备份创建成功", color: "success", timeout: 3000 });
      setBackupDescription("");
      await fetchBackups();
    } catch (error) {
      console.error("创建备份失败:", error);
      addToast({ title: "创建备份失败，请稍后重试", color: "danger", timeout: 4000 });
    } finally {
      setCreating(false);
    }
  }, [backupDescription, fetchBackups]);

  // ==================== 恢复备份 ====================
  const handleRestoreClick = useCallback(
    (backup: BackupInfo) => {
      setPendingBackup(backup);
      restoreConfirm.onOpen();
    },
    [restoreConfirm]
  );

  const executeRestore = useCallback(async () => {
    if (!pendingBackup) return;
    restoreConfirm.onClose();
    setRestoring(true);

    try {
      await configApi.restoreBackup(pendingBackup.filename);

      addToast({
        title: "备份恢复成功！页面将在 2 秒后刷新...",
        color: "success",
        timeout: 2000,
      });

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("恢复备份失败:", error);
      addToast({ title: "恢复备份失败，请稍后重试", color: "danger", timeout: 4000 });
      setPendingBackup(null);
    } finally {
      setRestoring(false);
    }
  }, [pendingBackup, restoreConfirm]);

  // ==================== 删除备份 ====================
  const handleDeleteClick = useCallback(
    (backup: BackupInfo) => {
      setPendingBackup(backup);
      deleteConfirm.onOpen();
    },
    [deleteConfirm]
  );

  const executeDelete = useCallback(async () => {
    if (!pendingBackup) return;
    deleteConfirm.onClose();

    try {
      await configApi.deleteBackup(pendingBackup.filename);
      addToast({ title: "备份删除成功", color: "success", timeout: 3000 });
      await fetchBackups();
    } catch (error) {
      console.error("删除备份失败:", error);
      addToast({ title: "删除备份失败，请稍后重试", color: "danger", timeout: 4000 });
    } finally {
      setPendingBackup(null);
    }
  }, [pendingBackup, deleteConfirm, fetchBackups]);

  // ==================== 清理旧备份 ====================
  const handleCleanClick = useCallback(() => {
    if (backupList.length <= keepCount) {
      addToast({ title: "当前备份数量未超过保留限制，无需清理", color: "default", timeout: 3000 });
      return;
    }
    cleanConfirm.onOpen();
  }, [backupList.length, keepCount, cleanConfirm]);

  const executeClean = useCallback(async () => {
    cleanConfirm.onClose();
    setCleaning(true);
    try {
      await configApi.cleanOldBackups(keepCount);
      const deleteCount = backupList.length - keepCount;
      addToast({ title: `清理成功，已删除 ${deleteCount} 个旧备份`, color: "success", timeout: 3000 });
      await fetchBackups();
    } catch (error) {
      console.error("清理备份失败:", error);
      addToast({ title: "清理备份失败，请稍后重试", color: "danger", timeout: 4000 });
    } finally {
      setCleaning(false);
    }
  }, [keepCount, backupList.length, cleanConfirm, fetchBackups]);

  // ==================== 渲染 ====================
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  const deleteCount = backupList.length - keepCount;

  return (
    <div className="space-y-5">
      {/* 提示横幅 */}
      <div className="flex items-center gap-3 rounded-2xl bg-primary/6 px-5 py-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Info className="h-4 w-4 text-primary" />
        </div>
        <p className="text-[13px] leading-relaxed text-foreground/70">
          配置备份功能会保存数据库中的设置项。恢复或导入配置后，建议刷新页面以查看最新配置。
        </p>
      </div>

      {/* ==================== 导入 & 导出 ==================== */}
      <div className="rounded-2xl border border-border/60 bg-content1 shadow-sm p-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <FileJson className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-[15px] font-bold text-foreground">导入 & 导出</h3>
        </div>
        <p className="mb-5 text-[13px] text-muted-foreground leading-relaxed">
          导出当前系统配置为 JSON 文件，或导入配置文件恢复设置。
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            color="primary"
            startContent={!exporting ? <ArrowUpFromLine className="h-4 w-4" /> : undefined}
            isLoading={exporting}
            onPress={handleExport}
            radius="lg"
            size="md"
            className="text-white font-medium"
          >
            导出配置
          </Button>
          <Button
            color="success"
            startContent={!importing ? <ArrowDownToLine className="h-4 w-4" /> : undefined}
            isLoading={importing}
            onPress={handleImportClick}
            radius="lg"
            size="md"
            className="text-white font-medium"
          >
            导入配置
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
        </div>
      </div>

      {/* ==================== 备份管理 ==================== */}
      <div className="rounded-2xl border border-border/60 bg-content1 shadow-sm p-6">
        {/* 标题行 */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <FolderOpen className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-[15px] font-bold text-foreground">备份管理</h3>
              {backupList.length > 0 && (
                <Chip size="sm" variant="flat" color="default" className="ml-0.5 h-5">
                  {backupList.length} 个备份
                </Chip>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              管理系统配置备份，支持手动创建备份、恢复备份和清理旧备份。
            </p>
          </div>
          <Tooltip content="刷新备份列表">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              isLoading={listLoading}
              onPress={fetchBackups}
              radius="lg"
              className="min-w-8 h-8"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>

        {/* 创建备份 */}
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <Input
            value={backupDescription}
            onValueChange={setBackupDescription}
            placeholder="备份描述（可选，例如：升级前备份）"
            size="sm"
            radius="lg"
            variant="bordered"
            className="flex-1 min-w-[200px] max-w-sm"
            classNames={{ inputWrapper: "border-border/60 data-[hover=true]:border-border-hover/40" }}
            onKeyDown={e => {
              if (e.key === "Enter") handleCreateBackup();
            }}
          />
          <Button
            color="primary"
            size="sm"
            startContent={!creating ? <Plus className="h-4 w-4" /> : undefined}
            isLoading={creating}
            onPress={handleCreateBackup}
            radius="lg"
            className="text-white font-medium"
          >
            创建备份
          </Button>
        </div>

        {/* 备份列表 — 卡片形式 */}
        {listLoading && backupList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2.5">
            <Spinner size="sm" />
            <span className="text-xs text-muted-foreground">加载备份列表...</span>
          </div>
        ) : backupList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
            <span className="text-sm text-muted-foreground">暂无备份记录</span>
            <span className="text-xs text-muted-foreground/40">点击上方「创建备份」开始</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {backupList.map(backup => (
              <div
                key={backup.filename}
                className="group flex items-center gap-4 rounded-xl border border-border/30 bg-muted/30 px-4 py-3 transition-all hover:border-border/60 hover:bg-muted/30 hover:shadow-sm"
              >
                {/* 文件图标 */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8">
                  <FileText className="h-4 w-4 text-primary" />
                </div>

                {/* 信息区 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="truncate text-[13px] font-medium text-foreground">{backup.filename}</span>
                    {backup.is_auto && (
                      <Chip size="sm" color="warning" variant="flat" className="shrink-0 h-[18px] text-[10px] px-1.5">
                        自动
                      </Chip>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {backup.description && (
                      <>
                        <span className="truncate max-w-[200px]">{backup.description}</span>
                        <span className="text-muted-foreground/30">|</span>
                      </>
                    )}
                    <span className="tabular-nums whitespace-nowrap">{formatFileSize(backup.size)}</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span className="tabular-nums whitespace-nowrap">{formatTime(backup.created_at)}</span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip content="恢复此备份">
                    <Button
                      size="sm"
                      variant="light"
                      color="primary"
                      className="h-7 min-w-0 px-2.5 text-xs gap-1"
                      startContent={<RotateCcw className="h-3 w-3" />}
                      onPress={() => handleRestoreClick(backup)}
                    >
                      恢复
                    </Button>
                  </Tooltip>
                  <Tooltip content="删除此备份">
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      className="h-7 min-w-0 px-2.5 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      startContent={<Trash2 className="h-3 w-3" />}
                      onPress={() => handleDeleteClick(backup)}
                    >
                      删除
                    </Button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 清理旧备份 */}
        {backupList.length > 0 && (
          <div className="flex items-center gap-2.5 flex-wrap mt-5 pt-4 border-t border-border/30">
            <span className="text-[13px] text-muted-foreground">清理旧备份，保留最近</span>
            <Input
              type="number"
              value={String(keepCount)}
              onValueChange={v => {
                const num = parseInt(v, 10);
                if (!isNaN(num) && num >= 1 && num <= 100) setKeepCount(num);
              }}
              size="sm"
              radius="lg"
              variant="bordered"
              className="w-[72px]"
              classNames={{
                input: "text-center",
                inputWrapper: "h-8 min-h-8 border-border/60",
              }}
              min={1}
              max={100}
            />
            <span className="text-[13px] text-muted-foreground">份</span>
            <Tooltip
              content={
                backupList.length <= keepCount
                  ? `当前只有 ${backupList.length} 个备份，无需清理`
                  : `将删除 ${deleteCount} 个旧备份`
              }
            >
              <Button
                size="sm"
                color="warning"
                variant="flat"
                startContent={!cleaning ? <Trash2 className="h-3.5 w-3.5" /> : undefined}
                isLoading={cleaning}
                isDisabled={backupList.length <= keepCount}
                onPress={handleCleanClick}
                radius="lg"
                className="h-8"
              >
                执行清理
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* ==================== 确认弹窗 ==================== */}

      {/* 导入确认 */}
      <AdminDialog
        isOpen={importConfirm.isOpen}
        onOpenChange={importConfirm.onOpenChange}
        size="sm"
        radius="lg"
        header={{ title: "确认导入配置", description: "导入后将覆盖当前系统配置", icon: ArrowUpFromLine }}
      >
        <ModalBody className="pb-1 pt-2">
          <div className="space-y-3 text-[13px] text-foreground/70">
            <p>导入配置将覆盖数据库中的系统设置。</p>
            <p>
              系统会在导入前<strong className="text-foreground">自动备份</strong>当前配置。
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <p className="text-warning-700 text-xs">导入成功后页面将自动刷新以应用新配置。</p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="pt-2">
          <Button variant="flat" size="sm" onPress={importConfirm.onClose} radius="lg">
            取消
          </Button>
          <Button color="primary" size="sm" onPress={executeImport} radius="lg">
            确定导入
          </Button>
        </ModalFooter>
      </AdminDialog>

      {/* 恢复确认 */}
      <AdminDialog
        isOpen={restoreConfirm.isOpen}
        onOpenChange={restoreConfirm.onOpenChange}
        size="sm"
        radius="lg"
        header={{ title: "确认恢复备份", description: "将使用该备份覆盖当前配置", icon: RotateCcw }}
      >
        <ModalBody className="pb-1 pt-2">
          <div className="space-y-3 text-[13px] text-foreground/70">
            <p>
              确定要恢复备份{""}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                {pendingBackup?.filename}
              </code>
              {""}
              吗？
            </p>
            <p>系统会在恢复前自动创建当前配置的备份。</p>
            <div className="flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <p className="text-warning-700 text-xs">恢复成功后页面将自动刷新以应用配置。</p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="pt-2">
          <Button variant="flat" size="sm" onPress={restoreConfirm.onClose} radius="lg" isDisabled={restoring}>
            取消
          </Button>
          <Button color="primary" size="sm" onPress={executeRestore} radius="lg" isLoading={restoring} isDisabled={restoring}>
            确定恢复
          </Button>
        </ModalFooter>
      </AdminDialog>

      {/* 删除确认 */}
      <AdminDialog
        isOpen={deleteConfirm.isOpen}
        onOpenChange={deleteConfirm.onOpenChange}
        size="sm"
        radius="lg"
        header={{
          title: "确认删除备份",
          description: "删除后无法恢复，请谨慎操作",
          icon: Trash2,
          tone: "danger",
        }}
      >
        <ModalBody className="pb-1 pt-2">
          <div className="space-y-3 text-[13px] text-foreground/70">
            <p>
              确定要删除备份{""}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                {pendingBackup?.filename}
              </code>
              {""}
              吗？
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
              <p className="text-danger-700 text-xs">此操作不可恢复，请谨慎操作。</p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="pt-2">
          <Button variant="flat" size="sm" onPress={deleteConfirm.onClose} radius="lg">
            取消
          </Button>
          <Button color="danger" size="sm" onPress={executeDelete} radius="lg">
            确定删除
          </Button>
        </ModalFooter>
      </AdminDialog>

      {/* 清理确认 */}
      <AdminDialog
        isOpen={cleanConfirm.isOpen}
        onOpenChange={cleanConfirm.onOpenChange}
        size="sm"
        radius="lg"
        header={{
          title: "确认清理旧备份",
          description: "仅保留最近备份，超出部分将被删除",
          icon: RefreshCw,
          tone: "warning",
        }}
      >
        <ModalBody className="pb-1 pt-2">
          <div className="space-y-3 text-[13px] text-foreground/70">
            <p>
              将删除 <strong className="text-foreground">{deleteCount}</strong> 个旧备份，只保留最近{""}
              <strong className="text-foreground">{keepCount}</strong> 份。
            </p>
          </div>
        </ModalBody>
        <ModalFooter className="pt-2">
          <Button variant="flat" size="sm" onPress={cleanConfirm.onClose} radius="lg">
            取消
          </Button>
          <Button color="warning" size="sm" onPress={executeClean} radius="lg">
            确定清理
          </Button>
        </ModalFooter>
      </AdminDialog>
    </div>
  );
}
