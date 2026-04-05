"use client";

import { useMemo, useState, useCallback } from "react";
import { ModalBody, ModalFooter, Button, addToast } from "@heroui/react";
import { Download } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { useExportAlbums } from "@/hooks/queries/use-album";
import type { AlbumExportFormat } from "@/types/album";

interface AlbumExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: Set<string>;
  totalItems: number;
}

export default function AlbumExportDialog({ isOpen, onClose, selectedIds, totalItems }: AlbumExportDialogProps) {
  const [format, setFormat] = useState<AlbumExportFormat>("json");
  const exportAlbums = useExportAlbums();

  const selectedAlbumIds = useMemo(() => Array.from(selectedIds).map(Number), [selectedIds]);
  const hasSelection = selectedAlbumIds.length > 0;
  const exportCount = hasSelection ? selectedAlbumIds.length : totalItems;

  const handleClose = useCallback(() => {
    setFormat("json");
    onClose();
  }, [onClose]);

  const handleExport = useCallback(async () => {
    try {
      await exportAlbums.mutateAsync({ albumIds: hasSelection ? selectedAlbumIds : [], format });
      addToast({
        title: hasSelection ? `已导出 ${selectedAlbumIds.length} 个相册` : "已导出全部相册",
        color: "success",
        timeout: 2500,
      });
      handleClose();
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "导出失败",
        color: "danger",
        timeout: 3000,
      });
    }
  }, [exportAlbums, handleClose, hasSelection, selectedAlbumIds, format]);

  return (
    <AdminDialog
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      header={{ title: "导出相册", description: "选择导出范围与格式并下载数据", icon: Download }}
    >
      <ModalBody className="gap-4">
        <p className="text-sm text-foreground/70">
          {hasSelection
            ? `即将导出选中的 ${selectedAlbumIds.length} 个相册。`
            : `未选择具体项，将导出全部相册（共 ${totalItems} 个）。`}
        </p>

        <FormSelect
          label="导出格式"
          value={format}
          onValueChange={value => setFormat(value as AlbumExportFormat)}
          description={`本次导出数据量：${exportCount} 个相册`}
        >
          <FormSelectItem key="json">JSON（纯文本）</FormSelectItem>
          <FormSelectItem key="zip">ZIP（压缩包）</FormSelectItem>
        </FormSelect>
      </ModalBody>
      <ModalFooter>
        <Button variant="flat" onPress={handleClose}>
          取消
        </Button>
        <Button color="primary" onPress={handleExport} isLoading={exportAlbums.isPending}>
          导出
        </Button>
      </ModalFooter>
    </AdminDialog>
  );
}
