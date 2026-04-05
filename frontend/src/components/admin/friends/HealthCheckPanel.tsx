"use client";

import { useState, useEffect, useCallback } from "react";
import { ModalBody, ModalFooter, Button, Progress, Spinner, addToast } from "@heroui/react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { HeartPulse, CheckCircle, XCircle, Activity } from "lucide-react";
import { useTriggerHealthCheck } from "@/hooks/queries/use-friends";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { friendsApi } from "@/lib/api/friends";
import { friendsKeys } from "@/hooks/queries/use-friends";

interface HealthCheckPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HealthCheckPanel({ isOpen, onClose }: HealthCheckPanelProps) {
  const [isPolling, setIsPolling] = useState(false);
  const queryClient = useQueryClient();

  const triggerHealthCheck = useTriggerHealthCheck();

  // 使用 refetchInterval 函数来自动管理轮询
  const { data: healthStatus, refetch } = useQuery({
    queryKey: friendsKeys.healthCheck(),
    queryFn: () => friendsApi.getHealthCheckStatus(),
    enabled: isPolling || isOpen,
    refetchInterval: query => {
      if (!isPolling) return false;
      const data = query.state.data;
      if (data && !data.is_running) {
        // 健康检查完成，停止轮询
        return false;
      }
      return 3000;
    },
  });

  // 当健康检查完成时停止轮询并刷新列表
  const handleCheckComplete = useCallback(() => {
    setIsPolling(false);
    queryClient.invalidateQueries({ queryKey: friendsKeys.lists() });
  }, [queryClient]);

  // 使用 refetchInterval 的函数形式来管理轮询停止
  // 当数据显示检查已完成且仍在轮询时，在下次用户交互时清理
  const isCheckDone = isPolling && healthStatus != null && !healthStatus.is_running;
  if (isCheckDone) {
    // 安排在微任务中更新状态，避免 render 中直接 setState
    queueMicrotask(() => handleCheckComplete());
  }

  const handleTrigger = useCallback(async () => {
    try {
      await triggerHealthCheck.mutateAsync();
      setIsPolling(true);
      addToast({ title: "健康检查已启动", color: "success", timeout: 3000 });
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "启动健康检查失败",
        color: "danger",
        timeout: 3000,
      });
    }
  }, [triggerHealthCheck]);

  const handleClose = useCallback(() => {
    setIsPolling(false);
    onClose();
  }, [onClose]);

  // 进入时获取一次当前状态
  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const result = healthStatus?.result;
  const isRunning = healthStatus?.is_running || isPolling;

  return (
    <AdminDialog
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      header={{
        title: "友链健康检查",
        description: "检测所有友链可访问性并自动标记失联项",
        icon: HeartPulse,
      }}
    >
      <ModalBody>
        {isRunning ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Spinner size="lg" color="primary" />
            <div className="text-center">
              <p className="font-medium">正在检查中...</p>
              <p className="text-sm text-muted-foreground mt-1">系统正在逐个检测友链的可访问性</p>
            </div>
            <Progress isIndeterminate color="primary" className="max-w-xs" aria-label="检查进度" />
            {healthStatus?.start_time && (
              <p className="text-xs text-muted-foreground">
                开始时间: {new Date(healthStatus.start_time).toLocaleString()}
              </p>
            )}
          </div>
        ) : result ? (
          <div className="space-y-4">
            {/* 结果概览 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-center">
                <Activity className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">总检查</p>
              </div>
              <div className="p-4 rounded-xl bg-success-50 border border-success-200 text-center">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-success" />
                <p className="text-2xl font-bold text-success">{result.healthy}</p>
                <p className="text-xs text-success-600">健康</p>
              </div>
              <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-center">
                <XCircle className="w-6 h-6 mx-auto mb-2 text-danger" />
                <p className="text-2xl font-bold text-danger">{result.unhealthy}</p>
                <p className="text-xs text-danger-600">失联</p>
              </div>
            </div>

            {/* 健康比例 */}
            {result.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">健康率</span>
                  <span className="font-medium">{Math.round((result.healthy / result.total) * 100)}%</span>
                </div>
                <Progress
                  value={(result.healthy / result.total) * 100}
                  color={result.unhealthy === 0 ? "success" : result.unhealthy > result.healthy ? "danger" : "warning"}
                  className="w-full"
                  aria-label="健康率"
                />
              </div>
            )}

            {/* 时间信息 */}
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/30">
              {healthStatus?.start_time && <p>开始: {new Date(healthStatus.start_time).toLocaleString()}</p>}
              {healthStatus?.end_time && <p>结束: {new Date(healthStatus.end_time).toLocaleString()}</p>}
            </div>

            {/* 失联提示 */}
            {result.unhealthy > 0 && (
              <div className="p-3 rounded-lg bg-warning-50 border border-warning-200">
                <p className="text-sm text-warning-700">
                  发现 {result.unhealthy} 个失联友链，已自动标记为失效状态。 请检查这些友链并决定是否保留。
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <HeartPulse className="w-12 h-12 text-muted-foreground/40" />
            <div className="text-center">
              <p className="font-medium">友链健康检查</p>
              <p className="text-sm text-muted-foreground mt-1">检测所有友链的可访问性，自动标记失联的友链</p>
            </div>
            {healthStatus?.error && (
              <div className="p-3 rounded-lg bg-danger-50 border border-danger-200 w-full">
                <p className="text-sm text-danger">{healthStatus.error}</p>
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="flat" onPress={handleClose}>
          关闭
        </Button>
        <Button
          color="primary"
          onPress={handleTrigger}
          isLoading={triggerHealthCheck.isPending}
          isDisabled={isRunning}
          startContent={!isRunning ? <HeartPulse className="w-4 h-4" /> : undefined}
        >
          {isRunning ? "检查中..." : result ? "重新检查" : "开始检查"}
        </Button>
      </ModalFooter>
    </AdminDialog>
  );
}
