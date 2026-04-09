"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FileItem, StoragePolicy, UploadItem } from "@/types/file-manager";
import {
  createUploadSessionApi,
  deleteUploadSessionApi,
  finalizeClientUploadApi,
  validateUploadSessionApi,
} from "@/lib/api/file-manager";
import { extractLogicalPathFromUri, getFileFingerprint, getParentPath, joinPath } from "@/utils/file-manager";
import { uploadFileChunksWorker } from "@/lib/file-manager/upload-worker";
import type {
  ConfirmDialogState,
  PromptDialogState,
  UploadCandidate,
  UploadGlobalCommand,
  UploadGlobalCommandValue,
} from "./types";
import { createFileInput, DEFAULT_CHUNK_SIZE, getErrorMessage, processDragDropItems, toast } from "./types";

interface UseFileUploadOptions {
  path: string;
  storagePolicy: StoragePolicy | null;
  sortedFiles: FileItem[];
  handleRefresh: () => void;
  openPrompt: (options: Omit<PromptDialogState, "onConfirm" | "onCancel" | "id">) => Promise<string | null>;
  openConfirm: (options: Omit<ConfirmDialogState, "onConfirm" | "onCancel">) => Promise<boolean>;
}

export function useFileUpload({
  path,
  storagePolicy,
  sortedFiles,
  handleRefresh,
  openPrompt,
  openConfirm,
}: UseFileUploadOptions) {
  // ===== Upload Queue =====
  const uploadQueueRef = useRef<UploadItem[]>([]);
  const [, setUploadQueueVersion] = useState(0);
  const updateQueueView = useCallback(() => {
    setUploadQueueVersion(v => v + 1);
  }, []);

  const addTask = useCallback(
    (item: UploadItem) => {
      uploadQueueRef.current.push(item);
      updateQueueView();
    },
    [updateQueueView]
  );

  const removeTask = (itemId: string) => {
    const index = uploadQueueRef.current.findIndex(item => item.id === itemId);
    if (index > -1) {
      uploadQueueRef.current.splice(index, 1);
      updateQueueView();
      return true;
    }
    return false;
  };

  const findTask = (itemId: string) => uploadQueueRef.current.find(item => item.id === itemId);
  const findPendingTask = () => uploadQueueRef.current.find(item => item.status === "pending");

  const clearFinishedUploads = () => {
    uploadQueueRef.current = uploadQueueRef.current.filter(item => !["success", "canceled"].includes(item.status));
    updateQueueView();
  };

  const [concurrency, setConcurrency] = useState(4);
  const concurrencyRef = useRef(concurrency);
  const [globalOverwrite, setGlobalOverwrite] = useState(false);
  const globalOverwriteRef = useRef(globalOverwrite);
  const [speedDisplayMode, setSpeedDisplayMode] = useState<"instant" | "average">("instant");

  useEffect(() => {
    concurrencyRef.current = concurrency;
    globalOverwriteRef.current = globalOverwrite;
  }, [concurrency, globalOverwrite]);

  const isProcessingQueueRef = useRef(false);
  const pathCreationLockRef = useRef(new Map<string, Promise<void>>());
  const lastApiCallTimestampRef = useRef(0);

  // ===== Speed Calculation =====
  const calculateSpeed = useCallback(() => {
    const queue = uploadQueueRef.current;
    queue.forEach(item => {
      if (item.status === "uploading") {
        const now = Date.now();
        const currentSize = item.uploadedSize;
        const instantTimeDiff = (now - (item.lastTime || now)) / 1000;
        const instantSizeDiff = currentSize - (item.lastSize || 0);
        if (instantTimeDiff > 0) {
          item.instantSpeed = instantSizeDiff / instantTimeDiff;
        }
        const averageTimeDiff = (now - (item.startTime || now)) / 1000;
        if (averageTimeDiff > 0) {
          item.averageSpeed = currentSize / averageTimeDiff;
        }
        item.lastTime = now;
        item.lastSize = currentSize;
      } else {
        item.instantSpeed = 0;
      }
    });
    updateQueueView();
  }, [updateQueueView]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (uploadQueueRef.current.some(item => item.status === "uploading")) {
        calculateSpeed();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [calculateSpeed]);

  // ===== Session & Pipeline =====
  const createSessionWithLock = async (item: UploadItem): Promise<void> => {
    const parentPath = getParentPath(joinPath(item.targetPath, item.relativePath));
    while (pathCreationLockRef.current.has(parentPath)) {
      await pathCreationLockRef.current.get(parentPath);
    }
    const promise = (async () => {
      try {
        const now = Date.now();
        const timeSinceLastCall = now - lastApiCallTimestampRef.current;
        const API_CALL_INTERVAL = 20;
        if (timeSinceLastCall < API_CALL_INTERVAL) {
          const delay = API_CALL_INTERVAL - timeSinceLastCall;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        lastApiCallTimestampRef.current = Date.now();

        const sessionRes = await createUploadSessionApi(
          joinPath(item.targetPath, item.relativePath),
          item.size,
          storagePolicy?.id || "",
          item.overwrite || globalOverwriteRef.current
        );
        if (!sessionRes || sessionRes.code !== 200) {
          const message = sessionRes?.message || "创建上传会话失败";
          const error = new Error(message) as Error & { isConflict?: boolean };
          if (sessionRes?.code === 409 || message.includes("冲突")) {
            error.isConflict = true;
          }
          throw error;
        }

        const sessionData = sessionRes.data;
        const chunkSize = sessionData.chunk_size || DEFAULT_CHUNK_SIZE;
        item.chunkSize = chunkSize;
        item.totalChunks = Math.ceil(item.size / chunkSize);

        if (sessionData.upload_method === "client") {
          item.uploadMethod = "client";
          item.uploadUrl = sessionData.upload_url;
          item.contentType = sessionData.content_type;
          item.storageType = sessionData.storage_policy?.type as UploadItem["storageType"];
          item.policyId = storagePolicy?.id;
          item.sessionId = undefined;
        } else {
          item.uploadMethod = "server";
          item.sessionId = sessionData.session_id;
          item.uploadUrl = undefined;
        }
      } finally {
        pathCreationLockRef.current.delete(parentPath);
      }
    })();
    pathCreationLockRef.current.set(parentPath, promise);
    return promise;
  };

  const processFilePipeline = async (item: UploadItem): Promise<void> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      item.status = "uploading";
      item.startTime = Date.now();
      updateQueueView();

      await createSessionWithLock(item);
      await uploadFileChunksWorker(item);

      // 所有云端「客户端直传」完成后必须 finalize，才能在库中创建文件实体（含大小）；含 OneDrive、七牛等
      if (item.uploadMethod === "client") {
        if (!item.policyId) {
          throw new Error("缺少存储策略 ID，无法完成上传");
        }
        const fullPath = joinPath(item.targetPath, item.relativePath);
        const finalizeRes = await finalizeClientUploadApi(fullPath, item.policyId, item.size);
        if (!finalizeRes || finalizeRes.code !== 200) {
          throw new Error(finalizeRes?.message || "创建文件记录失败");
        }
      }

      item.status = "success";
    } catch (error) {
      if (item.status !== "canceled") {
        const err = error as Error & { isConflict?: boolean };
        item.status = err.isConflict ? "conflict" : "error";
        item.errorMessage = getErrorMessage(err, "未知错误");
      }
    } finally {
      updateQueueView();
    }
  };

  const processUploadQueue = async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;
    const workers = new Set<Promise<void>>();
    let hasSuccessfulUploads = false;

    const loop = () => {
      while (workers.size < concurrencyRef.current) {
        const item = findPendingTask();
        if (!item) break;
        item.status = "processing";
        updateQueueView();

        const promise = processFilePipeline(item).finally(() => {
          if (item.status === "success" && item.needsRefresh) {
            hasSuccessfulUploads = true;
          }
          workers.delete(promise);
          loop();
        });
        workers.add(promise);
      }
      if (workers.size === 0 && !findPendingTask()) {
        isProcessingQueueRef.current = false;
        if (hasSuccessfulUploads) {
          handleRefresh();
        }
      }
    };
    loop();
  };

  // ===== Queue Operations =====
  const addUploadsToQueue = async (uploads: UploadCandidate[]): Promise<boolean> => {
    if (!storagePolicy) {
      toast("没有可用的存储策略，无法上传文件。", "danger");
      return false;
    }
    if (uploads.length === 0) return false;

    const existingFileLogicalPaths = new Set(sortedFiles.map(f => extractLogicalPathFromUri(f.path)));

    let addedCount = 0;
    for (const u of uploads) {
      const uploadLogicalPath = joinPath(u.targetPath, u.relativePath);
      const isAlreadyInQueue = uploadQueueRef.current.some(
        item => joinPath(item.targetPath, item.relativePath) === uploadLogicalPath
      );
      if (isAlreadyInQueue) continue;

      const isConflictOnServer = existingFileLogicalPaths.has(uploadLogicalPath);
      const newItem: UploadItem = {
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: u.name,
        size: u.size,
        status: isConflictOnServer ? "conflict" : "pending",
        progress: 0,
        file: u.file,
        relativePath: u.relativePath,
        targetPath: u.targetPath,
        uploadedSize: 0,
        instantSpeed: 0,
        averageSpeed: 0,
        errorMessage: isConflictOnServer ? "目标位置已存在同名文件" : undefined,
        overwrite: false,
        needsRefresh: true,
        uploadedChunks: new Set(),
      };
      addTask(newItem);
      addedCount++;
    }

    const hasAddedTasks = addedCount > 0;
    if (hasAddedTasks && !isProcessingQueueRef.current) {
      processUploadQueue();
    }
    return hasAddedTasks;
  };

  const addResumableTaskFromFileItem = useCallback(
    async (fileItem: FileItem) => {
      const rawSessionId = fileItem.metadata?.["sys:upload_session_id"];
      const sessionId = typeof rawSessionId === "string" ? rawSessionId : "";
      if (!sessionId || uploadQueueRef.current.some(item => item.sessionId === sessionId)) return;
      try {
        const validationRes = await validateUploadSessionApi(sessionId);
        const resData = validationRes?.data;
        if (validationRes?.code === 200 && resData && "is_valid" in resData && resData.is_valid) {
          const uploadedSize = resData.uploaded_chunks.length * resData.chunk_size;
          const pseudoFile = new File([], fileItem.name, {
            type: "application/octet-stream",
            lastModified: new Date(fileItem.updated_at).getTime(),
          });
          const targetPath = extractLogicalPathFromUri(fileItem.path).replace(`/${fileItem.name}`, "") || "/";
          const resumableData: UploadItem = {
            id: `resumable-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: fileItem.name,
            size: fileItem.size,
            status: "resumable",
            progress: Math.round((uploadedSize / fileItem.size) * 100),
            file: pseudoFile,
            relativePath: fileItem.name,
            targetPath,
            sessionId,
            totalChunks: resData.total_chunks,
            chunkSize: resData.chunk_size,
            uploadedChunks: new Set(resData.uploaded_chunks),
            errorMessage: "这是一个未完成的上传任务",
            isResuming: true,
            uploadedSize,
            instantSpeed: 0,
            averageSpeed: 0,
            overwrite: false,
            needsRefresh: true,
          };
          addTask(resumableData);
        }
      } catch (error) {
        console.error(`验证会话 ${sessionId} 失败`, error);
      }
    },
    [addTask]
  );

  const removeItem = async (itemId: string) => {
    const itemToRemove = findTask(itemId);
    if (!itemToRemove) return;
    itemToRemove.status = "canceled";
    updateQueueView();
    if (itemToRemove.sessionId) {
      try {
        await deleteUploadSessionApi(
          itemToRemove.sessionId,
          joinPath(itemToRemove.targetPath, itemToRemove.relativePath)
        );
      } catch (err) {
        console.error(`删除会话 ${itemToRemove.sessionId} 失败:`, err);
      }
    }
    removeTask(itemId);
  };

  const retryItem = (itemId: string) => {
    const item = findTask(itemId);
    if (!item || !["error", "conflict", "resumable"].includes(item.status)) return;
    if (item.status === "resumable") {
      openConfirm({
        title: "继续上传",
        description: `系统检测到文件 "${item.name}" 上次未上传完成。请选择该文件以继续上传。`,
        confirmText: "选择文件",
        cancelText: "放弃",
      }).then(confirmed => {
        if (!confirmed) return;
        createFileInput(selectedFiles => {
          const userFile = selectedFiles[0];
          if (getFileFingerprint(userFile) === `file-${item.name}-${item.size}`) {
            item.file = userFile;
            item.status = "pending";
            item.errorMessage = undefined;
            item.isResuming = false;
            updateQueueView();
            if (!isProcessingQueueRef.current) processUploadQueue();
          } else {
            toast("选择的文件与待续传的文件不匹配。", "warning");
          }
        });
      });
      return;
    }

    item.status = "pending";
    item.errorMessage = undefined;
    item.progress = 0;
    item.uploadedChunks = new Set();
    item.uploadedSize = 0;
    item.sessionId = undefined;
    item.chunkSize = undefined;
    item.totalChunks = undefined;
    updateQueueView();
    if (!isProcessingQueueRef.current) processUploadQueue();
  };

  const retryAllFailed = () => {
    let hasFailedTasks = false;
    uploadQueueRef.current.forEach(item => {
      if (item.status === "error") {
        item.status = "pending";
        item.errorMessage = undefined;
        item.progress = 0;
        item.uploadedChunks = new Set();
        item.uploadedSize = 0;
        item.sessionId = undefined;
        item.chunkSize = undefined;
        item.totalChunks = undefined;
        hasFailedTasks = true;
      }
    });
    if (hasFailedTasks && !isProcessingQueueRef.current) {
      updateQueueView();
      processUploadQueue();
    }
  };

  const resolveConflict = (itemId: string, strategy: "overwrite" | "rename") => {
    const item = findTask(itemId);
    if (!item || item.status !== "conflict") return;
    if (strategy === "overwrite") {
      item.overwrite = true;
      item.status = "pending";
    } else {
      const extIndex = item.name.lastIndexOf(".");
      const baseName = extIndex > 0 ? item.name.slice(0, extIndex) : item.name;
      const ext = extIndex > 0 ? item.name.slice(extIndex) : "";
      item.name = `${baseName}-副本${ext}`;
      item.relativePath = `${baseName}-副本${ext}`;
      item.status = "pending";
    }
    item.errorMessage = undefined;
    updateQueueView();
    if (!isProcessingQueueRef.current) processUploadQueue();
  };

  const setGlobalOverwriteAndRetry = (value: boolean) => {
    setGlobalOverwrite(value);
    uploadQueueRef.current.forEach(item => {
      if (item.status === "conflict") {
        item.overwrite = value;
      }
    });
    updateQueueView();
  };

  const handleUploadGlobalCommand = (command: UploadGlobalCommand, value?: UploadGlobalCommandValue) => {
    switch (command) {
      case "set-overwrite-all":
        setGlobalOverwriteAndRetry(Boolean(value));
        break;
      case "retry-all":
        retryAllFailed();
        break;
      case "clear-finished":
        clearFinishedUploads();
        break;
      case "set-concurrency":
        openPrompt({
          title: "设置并发数",
          description: "请输入新的并行上传数 (1-10)",
          defaultValue: String(concurrencyRef.current),
          confirmText: "确定",
          cancelText: "取消",
          validator: v => (/^[1-9]$|^10$/.test(v) ? true : "请输入 1 到 10 之间的整数"),
        }).then(v => {
          if (!v) return;
          setConcurrency(Number(v));
        });
        break;
      case "set-speed-mode":
        if (value === "instant" || value === "average") {
          setSpeedDisplayMode(value);
        }
        break;
    }
  };

  const showUploadProgress = uploadQueueRef.current.length > 0;

  // ===== Drag & Drop =====
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDrop = async (dataTransfer: DataTransfer) => {
    const currentTargetPath = path;
    try {
      const allProcessedFiles = await processDragDropItems(dataTransfer);
      if (allProcessedFiles.length === 0) {
        toast("拖拽的项目中没有可上传的文件。", "warning");
        return;
      }
      const newUploads: UploadCandidate[] = allProcessedFiles.map(processedFile => ({
        name: processedFile.file.name,
        size: processedFile.file.size,
        file: processedFile.file,
        relativePath: processedFile.relativePath,
        targetPath: currentTargetPath,
      }));
      const hasAdded = await addUploadsToQueue(newUploads);
      if (hasAdded) {
        setPanelVisible(true);
        setPanelCollapsed(false);
      }
    } catch (error) {
      console.error("读取拖拽内容时出错:", error);
      toast("读取拖拽内容时出错，请重试。", "danger");
    }
  };

  const dragHandlers = {
    onDragEnter: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.dataTransfer?.types.includes("Files")) {
        dragCounterRef.current += 1;
        if (dragCounterRef.current > 0) {
          setIsDragging(true);
        }
      }
    },
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    },
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        setIsDragging(false);
        dragCounterRef.current = 0;
      }
    },
    onDrop: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      dragCounterRef.current = 0;
      handleDrop(event.dataTransfer);
    },
  };

  // ===== Upload Panel =====
  const [isPanelVisible, setPanelVisible] = useState(false);
  const [isPanelCollapsed, setPanelCollapsed] = useState(false);

  const handlePanelClose = () => {
    if (uploadQueueRef.current.some(item => ["uploading", "pending", "error", "conflict"].includes(item.status))) {
      openConfirm({
        title: "警告",
        description: "关闭面板会取消所有进行中和待处理的上传任务，确定吗？",
        confirmText: "确定",
        cancelText: "取消",
        tone: "danger",
      }).then(confirmed => {
        if (!confirmed) return;
        [...uploadQueueRef.current].forEach(item => {
          if (!["success", "canceled"].includes(item.status)) {
            removeItem(item.id);
          }
        });
        setPanelVisible(false);
      });
    } else {
      setPanelVisible(false);
    }
  };

  useEffect(() => {
    if (!showUploadProgress) {
      setPanelVisible(false);
    }
  }, [showUploadProgress]);

  // ===== File / Dir Upload =====
  const handleUploadFile = () => {
    createFileInput(
      async files => {
        const newUploads: UploadCandidate[] = Array.from(files).map(file => ({
          file,
          name: file.name,
          size: file.size,
          targetPath: path,
          relativePath: file.name,
        }));
        const hasAdded = await addUploadsToQueue(newUploads);
        if (hasAdded) {
          setPanelVisible(true);
          setPanelCollapsed(false);
        }
      },
      { multiple: true }
    );
  };

  const handleUploadDir = () => {
    const input = document.createElement("input") as HTMLInputElement & { webkitdirectory?: boolean };
    input.type = "file";
    input.multiple = true;
    input.webkitdirectory = true;
    input.onchange = async e => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const newUploads: UploadCandidate[] = Array.from(files).map(file => ({
          file,
          name: file.name,
          size: file.size,
          targetPath: path,
          relativePath: file.webkitRelativePath || file.name,
        }));
        const hasAdded = await addUploadsToQueue(newUploads);
        if (hasAdded) {
          setPanelVisible(true);
          setPanelCollapsed(false);
        }
      }
    };
    input.click();
  };

  return {
    uploadQueue: uploadQueueRef.current,
    isPanelVisible,
    isPanelCollapsed,
    speedDisplayMode,
    globalOverwrite,
    showUploadProgress,
    isDragging,
    dragHandlers,
    handleUploadFile,
    handleUploadDir,
    handlePanelClose,
    retryItem,
    removeItem,
    resolveConflict,
    handleUploadGlobalCommand,
    addUploadsToQueue,
    addResumableTaskFromFileItem,
    setPanelCollapsed,
    setPanelVisible,
  };
}
