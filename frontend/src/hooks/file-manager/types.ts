import { addToast } from "@heroui/react";
import type { ColumnConfig, FileItem, UploadItem } from "@/types/file-manager";
import type { FileSystemEntry, FileSystemFileEntry, FileSystemDirectoryEntry } from "@/types/file-system";
import { joinPath } from "@/utils/file-manager";

// ===== Exported Types =====

export type SortKey =
  | "name_asc"
  | "name_desc"
  | "size_asc"
  | "size_desc"
  | "updated_at_asc"
  | "updated_at_desc"
  | "created_at_asc"
  | "created_at_desc";

export type UploadGlobalCommand =
  | "set-speed-mode"
  | "set-concurrency"
  | "set-overwrite-all"
  | "retry-all"
  | "clear-finished";

export type UploadGlobalCommandValue = boolean | "instant" | "average" | undefined;

export type UploadCandidate = Pick<UploadItem, "name" | "size" | "file" | "relativePath" | "targetPath">;

export interface PromptDialogState {
  id: number;
  title: string;
  description?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  validator?: (value: string) => string | true;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export interface ConfirmDialogState {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export interface ContextMenuTrigger {
  event: MouseEvent;
  file?: FileItem;
  /** 每次打开右键菜单递增，保证 ContextMenu 子树 key 唯一、避免同毫秒重复打开时状态残留 */
  openSeq: number;
}

export type ImagePreviewItem = {
  imageUrl: string;
  downloadUrl: string;
  fileSize: number;
  createTime: Date;
};

export type ImagePreviewHandle = {
  open: (items: ImagePreviewItem[], index: number) => void;
};

export type VideoPreviewHandle = {
  open: (url: string) => void;
};

export type TextPreviewHandle = {
  open: (
    file: FileItem,
    url: string,
    onSave?: (file: FileItem, content: string) => Promise<boolean | { size: number; updated: string }>
  ) => void;
};

// ===== Constants =====

export const DEFAULT_COLUMNS: ColumnConfig[] = [{ type: 0 }, { type: 1 }, { type: 2 }];
export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_CHUNK_SIZE = 50 * 1024 * 1024;

// ===== Utility Functions =====

export const toast = (title: string, color: "success" | "warning" | "danger" | "default" = "default") =>
  addToast({ title, color, timeout: 3000 });

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const parseSortKey = (sortKey: SortKey): [string, "asc" | "desc"] => {
  const parts = sortKey.split("_");
  const direction = parts.pop() as "asc" | "desc";
  const order = parts.join("_");
  return [order, direction];
};

export const createFileInput = (
  callback: (files: FileList) => void,
  options: { multiple?: boolean; accept?: string } = {}
) => {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = options.multiple || false;
  if (options.accept) input.accept = options.accept;
  input.style.display = "none";
  input.onchange = event => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      callback(target.files);
    }
    document.body.removeChild(input);
  };
  document.body.appendChild(input);
  input.click();
};

/**
 * 处理拖拽的 DataTransfer，递归遍历目录，返回所有文件及其相对路径
 */
export async function processDragDropItems(
  dataTransfer: DataTransfer
): Promise<{ file: File; relativePath: string }[]> {
  const items = Array.from(dataTransfer.items);
  const promises: Promise<{ file: File; relativePath: string } | { file: File; relativePath: string }[]>[] = [];

  const getFileWithRelativePath = (fileEntry: FileSystemFileEntry, filePath: string) =>
    new Promise<{ file: File; relativePath: string }>((resolve, reject) => {
      fileEntry.file(file => resolve({ file, relativePath: filePath }), reject);
    });

  const traverseDirectory = async (
    directoryEntry: FileSystemDirectoryEntry,
    currentPath: string
  ): Promise<{ file: File; relativePath: string }[]> => {
    const reader = directoryEntry.createReader();
    return new Promise((resolve, reject) => {
      const allEntries: FileSystemEntry[] = [];
      const readEntries = () => {
        reader.readEntries(async entries => {
          if (entries.length === 0) {
            try {
              const nestedFiles = await Promise.all(
                allEntries.map(entry => {
                  const entryPath = joinPath(currentPath, entry.name);
                  if (entry.isFile) {
                    return getFileWithRelativePath(entry as unknown as FileSystemFileEntry, entryPath);
                  }
                  if (entry.isDirectory) {
                    return traverseDirectory(entry as unknown as FileSystemDirectoryEntry, entryPath);
                  }
                  return Promise.resolve([]);
                })
              );
              resolve(nestedFiles.flat(Infinity) as { file: File; relativePath: string }[]);
            } catch (e) {
              reject(e);
            }
          } else {
            allEntries.push(...entries);
            readEntries();
          }
        }, reject);
      };
      readEntries();
    });
  };

  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      if (entry.isFile) {
        promises.push(getFileWithRelativePath(entry as unknown as FileSystemFileEntry, entry.name));
      } else if (entry.isDirectory) {
        promises.push(traverseDirectory(entry as unknown as FileSystemDirectoryEntry, entry.name));
      }
    }
  }

  const nestedProcessedFiles = await Promise.all(promises);
  return nestedProcessedFiles.flat(Infinity) as { file: File; relativePath: string }[];
}
