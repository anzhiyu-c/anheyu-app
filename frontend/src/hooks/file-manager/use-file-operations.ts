"use client";

import { useRef, useState } from "react";
import type { FileItem, FileInfoResponse, ParentInfo } from "@/types/file-manager";
import { FileType } from "@/types/file-manager";
import {
  createDirectLinksApi,
  createItemApi,
  createShareLinkApi,
  deleteFilesApi,
  downloadFileApi,
  fetchBlobFromUrl,
  fetchFilesByPathApi,
  getFileDetailsApi,
  getFilePreviewUrlsApi,
  getFolderTreeApi,
  regenerateDirectoryThumbnailsApi,
  regenerateThumbnailApi,
  renameFileApi,
  updateFileContentByPublicIdApi,
} from "@/lib/api/file-manager";
import { extractLogicalPathFromUri, joinPath } from "@/utils/file-manager";
import type {
  ConfirmDialogState,
  ImagePreviewHandle,
  PromptDialogState,
  TextPreviewHandle,
  VideoPreviewHandle,
} from "./types";
import { getErrorMessage, toast } from "./types";

interface UseFileOperationsOptions {
  path: string;
  parentInfo: ParentInfo | null;
  getSelectedFileItems: () => FileItem[];
  isSingleSelection: boolean;
  clearSelection: () => void;
  handleRefresh: () => void;
  updateFileInState: (fileId: string, updates: Partial<FileItem>) => void;
  removeFilesFromState: (fileIds: string[]) => void;
  openPrompt: (options: Omit<PromptDialogState, "onConfirm" | "onCancel" | "id">) => Promise<string | null>;
  openConfirm: (options: Omit<ConfirmDialogState, "onConfirm" | "onCancel">) => Promise<boolean>;
}

export function useFileOperations({
  path,
  parentInfo,
  getSelectedFileItems,
  isSingleSelection,
  clearSelection,
  handleRefresh,
  updateFileInState,
  removeFilesFromState,
  openPrompt,
  openConfirm,
}: UseFileOperationsOptions) {
  // ===== Preview Refs =====
  const imagePreviewRef = useRef<ImagePreviewHandle | null>(null);
  const videoPreviewRef = useRef<VideoPreviewHandle | null>(null);
  const textPreviewRef = useRef<TextPreviewHandle | null>(null);

  // ===== Modal State =====
  const [detailsPanelFile, setDetailsPanelFile] = useState<FileInfoResponse | null>(null);
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  const [shareItems, setShareItems] = useState<FileItem[]>([]);
  const [directLinks, setDirectLinks] = useState<{ name: string; link: string }[] | null>(null);

  // ===== Create =====
  const handleCreateItem = async (type: "file" | "folder", defaultName: string) => {
    const value = await openPrompt({
      title: `创建${type === "folder" ? "文件夹" : "文件"}`,
      description: `请输入${type === "folder" ? "文件夹" : "文件"}名称`,
      defaultValue: defaultName,
      confirmText: "确定",
      cancelText: "取消",
      validator: val => (val && !/[\s\\/:*?"<>|]/.test(val) ? true : "名称不能为空且不能包含特殊字符"),
    });
    if (!value) return;
    try {
      const itemType = type === "folder" ? FileType.Dir : FileType.File;
      const response = await createItemApi(itemType, joinPath(path, value));
      if (response.code === 200) {
        toast("创建成功", "success");
        handleRefresh();
      } else {
        toast(response.message || "创建失败", "danger");
      }
    } catch (error) {
      toast(getErrorMessage(error, "创建时发生错误"), "danger");
    }
  };

  const handleCreateFile = (ext: "md" | "txt") => handleCreateItem("file", `新文件.${ext}`);
  const handleCreateFolder = () => handleCreateItem("folder", "新建文件夹");

  // ===== Rename =====
  const handleRename = async (item: FileItem) => {
    const value = await openPrompt({
      title: "重命名",
      description: "请输入新名称",
      defaultValue: item.name,
      confirmText: "确定",
      cancelText: "取消",
      validator: val => (val && !/[\\/:*?"<>|]/.test(val) ? true : "文件名不能为空且不能包含特殊字符"),
    });
    if (!value || value === item.name) return;
    try {
      const response = await renameFileApi(item.id, value);
      if (response.code === 200) {
        updateFileInState(item.id, { name: value, updated_at: new Date().toISOString() });
        toast("重命名成功", "success");
      } else {
        toast(response.message || "重命名失败", "danger");
      }
    } catch (error) {
      toast(getErrorMessage(error, "重命名时发生错误"), "danger");
    }
  };

  const onActionRename = () => {
    if (!isSingleSelection) return;
    handleRename(getSelectedFileItems()[0]);
  };

  // ===== Delete =====
  const onActionDelete = async () => {
    const selectedItems = getSelectedFileItems();
    if (selectedItems.length === 0) {
      toast("请先选择要删除的项目。", "warning");
      return;
    }

    const names = selectedItems.map(f => `"${f.name}"`).join("、");
    const confirmed = await openConfirm({
      title: "删除确认",
      description: `确定要删除以下项目吗？${names}`,
      confirmText: "确定删除",
      cancelText: "取消",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const res = await deleteFilesApi(selectedItems.map(item => item.id));
      if (res.code === 200) {
        removeFilesFromState(selectedItems.map(item => item.id));
        clearSelection();
        toast("删除成功", "success");
      } else {
        toast(res.message || "删除失败", "danger");
      }
    } catch (error) {
      toast(getErrorMessage(error, "删除时发生错误"), "danger");
    }
  };

  // ===== Download =====
  const handlePackageDownload = async (itemsToDownload: FileItem[], zipName: string) => {
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const filesToFetch: { url: string; relative_path: string; size: number }[] = [];

      for (const item of itemsToDownload) {
        if (item.type === FileType.Dir) {
          const treeResponse = await getFolderTreeApi(item.id);
          if (treeResponse.code === 200 && treeResponse.data?.files) {
            const filesInFolder = treeResponse.data.files.map(file => ({
              ...file,
              relative_path: `${item.name}/${file.relative_path}`,
            }));
            filesToFetch.push(...filesInFolder);
          }
        } else {
          const detailResponse = await getFileDetailsApi(item.id);
          const detailData = detailResponse.data;
          const directUrl =
            detailData?.file?.url ||
            (detailData && "url" in detailData ? (detailData as { url?: string }).url : undefined);
          if (detailResponse.code === 200 && directUrl) {
            filesToFetch.push({
              url: directUrl,
              relative_path: item.name,
              size: item.size,
            });
          }
        }
      }

      if (filesToFetch.length === 0) {
        toast("所选项目中没有可下载的文件。", "warning");
        return;
      }

      for (const currentFile of filesToFetch) {
        try {
          const blob = await fetchBlobFromUrl(currentFile.url);
          zip.file(currentFile.relative_path, blob);
        } catch (error) {
          zip.file(`${currentFile.relative_path}.error.txt`, `下载此文件失败: ${getErrorMessage(error, "未知错误")}`);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${zipName}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast("打包下载完成", "success");
    } catch (error) {
      toast(getErrorMessage(error, "打包下载失败"), "danger");
    }
  };

  const onActionDownload = async () => {
    const selectedItems = getSelectedFileItems();
    if (selectedItems.length === 0) {
      toast("请选择要下载的项目", "warning");
      return;
    }
    if (selectedItems.length === 1 && selectedItems[0].type === FileType.File) {
      await downloadFileApi(selectedItems[0].id, selectedItems[0].name);
      return;
    }

    const zipName =
      selectedItems.length === 1 && selectedItems[0].type === FileType.Dir ? selectedItems[0].name : "打包下载";
    await handlePackageDownload(selectedItems, zipName);
  };

  const handleDownloadFolder = async (folderId: string) => {
    try {
      const res = await getFileDetailsApi(folderId);
      if (res.code === 200 && res.data?.file) {
        await handlePackageDownload([res.data.file], res.data.file.name);
      } else {
        toast(res.message || "无法获取文件夹信息以下载", "danger");
      }
    } catch (error) {
      toast(getErrorMessage(error, "请求文件夹信息失败"), "danger");
    }
  };

  // ===== Direct Links =====
  const recursivelyFetchAllFileIds = async (initialUri: string): Promise<string[]> => {
    const MAX_CONCURRENT_REQUESTS = 5;
    const RATE_LIMIT_COUNT = 5;
    const RATE_LIMIT_WINDOW_MS = 50;
    const allFileIds: string[] = [];
    const initialLogicalPath = extractLogicalPathFromUri(initialUri);
    const taskQueue: string[] = [initialLogicalPath];
    let activeRequests = 0;
    let requestsInCurrentWindow = 0;
    let windowStartTime = Date.now();

    return new Promise(resolve => {
      const processQueue = async () => {
        if (taskQueue.length === 0 && activeRequests === 0) {
          resolve(allFileIds);
          return;
        }

        while (taskQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
          const now = Date.now();
          if (now - windowStartTime > RATE_LIMIT_WINDOW_MS) {
            windowStartTime = now;
            requestsInCurrentWindow = 0;
          }
          if (requestsInCurrentWindow >= RATE_LIMIT_COUNT) {
            const waitTime = RATE_LIMIT_WINDOW_MS - (now - windowStartTime);
            await new Promise(r => setTimeout(r, waitTime > 0 ? waitTime : 0));
            continue;
          }
          requestsInCurrentWindow++;
          activeRequests++;
          const currentPath = taskQueue.shift()!;

          const worker = async (pathToFetch: string) => {
            let next: string | null | undefined = null;
            try {
              do {
                const res = await fetchFilesByPathApi(pathToFetch, next);
                if (res.code === 200 && res.data) {
                  const { files: list, pagination } = res.data;
                  list.forEach(item => {
                    if (item.type === FileType.File) {
                      allFileIds.push(item.id);
                    } else if (item.type === FileType.Dir) {
                      taskQueue.push(extractLogicalPathFromUri(item.path));
                    }
                  });
                  next = pagination?.next_token;
                } else {
                  next = null;
                }
              } while (next);
            } finally {
              activeRequests--;
              processQueue();
            }
          };

          worker(currentPath);
        }
      };
      processQueue();
    });
  };

  const onActionGetDirectLink = async () => {
    const selectedItems = getSelectedFileItems();
    if (selectedItems.length === 0) {
      toast("请至少选择一个项目。", "warning");
      return;
    }

    const initialFileIds = selectedItems.filter(item => item.type === FileType.File).map(item => item.id);
    const foldersToProcess = selectedItems.filter(item => item.type === FileType.Dir);
    const folderFileIds: string[] = [];
    if (foldersToProcess.length > 0) {
      for (const folder of foldersToProcess) {
        const ids = await recursivelyFetchAllFileIds(folder.path);
        folderFileIds.push(...ids);
      }
    }
    const allFileIds = [...new Set([...initialFileIds, ...folderFileIds])];
    if (allFileIds.length === 0) {
      toast("未找到可生成直链的文件。", "warning");
      return;
    }

    try {
      const res = await createDirectLinksApi(allFileIds);
      if (res && res.code === 200 && res.data && res.data.length > 0) {
        const links = res.data.map(item => ({
          name: item.file_url.substring(item.file_url.lastIndexOf("/") + 1),
          link: item.link,
        }));
        setDirectLinks(links);
      } else {
        throw new Error(res?.message || "获取直链失败");
      }
    } catch (error) {
      toast(getErrorMessage(error, "操作失败，请重试。"), "danger");
    }
  };

  // ===== Preview =====
  const isImageFile = (fileName: string): boolean => /\.(jpg|jpeg|png|gif|bmp|webp|svg|avif)$/i.test(fileName);
  const isVideoFile = (fileName: string): boolean => /\.(mp4|webm|ogg|mov|avi|flv)$/i.test(fileName);
  const isTextFile = (fileName: string): boolean => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    return new Set([
      "txt",
      "md",
      "markdown",
      "json",
      "xml",
      "yaml",
      "yml",
      "csv",
      "html",
      "css",
      "js",
      "ts",
      "jsx",
      "tsx",
      "vue",
      "go",
      "py",
      "java",
      "c",
      "cpp",
      "h",
      "cs",
      "sh",
      "rb",
      "rs",
    ]).has(ext);
  };

  const onActionSave = async (
    file: FileItem,
    content: string
  ): Promise<boolean | { size: number; updated: string }> => {
    if (!file.id) {
      toast("文件缺少唯一标识，无法保存。", "danger");
      return false;
    }
    try {
      const res = await updateFileContentByPublicIdApi(file.id, file.path, content);
      if (res.code === 200 && res.data) {
        updateFileInState(file.id, { size: res.data.size, updated_at: res.data.updated });
        return res.data;
      }
      toast(res.message || "保存失败", "danger");
      return false;
    } catch (error) {
      toast(getErrorMessage(error, "保存时发生网络错误"), "danger");
      throw error;
    }
  };

  const handlePreviewFile = async (item: FileItem) => {
    if (isImageFile(item.name)) {
      if (!imagePreviewRef.current) return;
      const res = await getFilePreviewUrlsApi(item.id);
      if (res.code === 200 && res.data?.urls) {
        const imageList = res.data.urls.map(urlItem => ({
          imageUrl: urlItem.url,
          downloadUrl: urlItem.url,
          fileSize: urlItem.file_size,
          createTime: new Date(),
        }));
        imagePreviewRef.current.open(imageList, res.data.initialIndex || 0);
      } else {
        toast(res.message || "获取图片预览链接失败", "danger");
      }
      return;
    }
    if (isVideoFile(item.name)) {
      if (!videoPreviewRef.current) return;
      const res = await getFilePreviewUrlsApi(item.id);
      if (res.code === 200 && res.data?.urls?.length > 0) {
        const videoUrl = res.data.urls[res.data.initialIndex].url;
        videoPreviewRef.current.open(videoUrl);
      } else {
        toast(res.message || "获取视频预览链接失败", "danger");
      }
      return;
    }
    if (isTextFile(item.name)) {
      if (!textPreviewRef.current) return;
      const res = await getFilePreviewUrlsApi(item.id);
      if (res.code === 200 && res.data?.urls?.length > 0) {
        const textUrl = res.data.urls[res.data.initialIndex].url;
        textPreviewRef.current.open(item, textUrl, onActionSave);
      } else {
        toast(res.message || "获取文本预览链接失败", "danger");
      }
      return;
    }
    toast("暂不支持预览此类型的文件。", "warning");
  };

  // ===== Details Panel =====
  const handleShowDetailsForId = async (id: string) => {
    try {
      const response = await getFileDetailsApi(id);
      if (response.code === 200 && response.data) {
        setDetailsPanelFile({
          file: response.data.file,
          storagePolicy: response.data.storagePolicy,
        });
      } else {
        toast(response.message || "获取文件详情失败", "danger");
      }
    } catch (error) {
      toast(getErrorMessage(error, "请求文件详情时发生错误"), "danger");
    }
  };

  const closeDetailsPanel = () => {
    setDetailsPanelFile(null);
  };

  // ===== Share =====
  const onActionShare = () => {
    const selectedItems = getSelectedFileItems();
    if (selectedItems.length === 0) return toast("请至少选择一个要分享的项目。", "warning");
    setShareItems(selectedItems);
    setShareModalVisible(true);
  };

  const handleShareSuccess = () => {
    setShareModalVisible(false);
    clearSelection();
  };

  const handleCreateShare = async (payload: {
    fileIds: string[];
    expirationDays?: number;
    paymentAmount?: number;
    password?: string;
    showReadme?: boolean;
    downloadLimit?: number;
    allowedUserGroups?: number[];
  }) => {
    return createShareLinkApi({
      file_ids: payload.fileIds,
      expiration_days: payload.expirationDays,
      payment_amount: payload.paymentAmount,
      password: payload.password,
      show_readme: payload.showReadme,
      download_limit: payload.downloadLimit,
      allowed_user_groups: payload.allowedUserGroups,
    });
  };

  // ===== Thumbnails =====
  const onActionRegenerateDirectoryThumbnails = async () => {
    const directoryId = parentInfo?.id;
    if (!directoryId) {
      toast("无法确定当前目录，无法执行该操作。", "warning");
      return;
    }
    const confirmed = await openConfirm({
      title: "确认操作",
      description:
        "此操作将为当前目录下的所有文件重新派发缩略图生成任务。这是后台异步操作，请稍后刷新查看结果。是否继续？",
      confirmText: "确定",
      cancelText: "取消",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await regenerateDirectoryThumbnailsApi(directoryId);
      if (res.code === 202 && res.data) {
        toast(res.message || "后台任务已启动，请稍后刷新。", "success");
      } else {
        toast(res.message || "请求失败", "danger");
      }
    } catch (error) {
      toast(getErrorMessage(error, "操作失败或已取消。"), "danger");
    }
  };

  const onActionRegenerateThumbnail = async () => {
    const selectedItems = getSelectedFileItems();
    if (selectedItems.length !== 1) {
      toast("请选择一个文件进行操作。", "warning");
      return;
    }
    try {
      const res = await regenerateThumbnailApi(selectedItems[0].id);
      if (res.code === 202) {
        toast("重新生成请求已提交，请稍后刷新。", "success");
        handleRefresh();
      } else {
        toast(res.message || "请求失败", "danger");
      }
    } catch {
      toast("操作失败。", "danger");
    }
  };

  return {
    imagePreviewRef,
    videoPreviewRef,
    textPreviewRef,
    detailsPanelFile,
    isShareModalVisible,
    shareItems,
    directLinks,
    handleCreateFile,
    handleCreateFolder,
    handleRename,
    onActionRename,
    onActionDelete,
    onActionDownload,
    handleDownloadFolder,
    handlePreviewFile,
    handleShowDetailsForId,
    closeDetailsPanel,
    onActionShare,
    handleShareSuccess,
    onActionGetDirectLink,
    onActionRegenerateDirectoryThumbnails,
    onActionRegenerateThumbnail,
    handleCreateShare,
    setShareModalVisible,
    setDirectLinks,
  };
}
