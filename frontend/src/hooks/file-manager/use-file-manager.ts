"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FileItem } from "@/types/file-manager";
import { buildFullUri, extractLogicalPathFromUri } from "@/utils/file-manager";
import { formatRelativeTime } from "@/utils/date";
import type { ConfirmDialogState, ContextMenuTrigger, PromptDialogState } from "./types";
import { toast } from "./types";
import { useFileNavigation } from "./use-file-navigation";
import { useFileSelection } from "./use-file-selection";
import { useFileUpload } from "./use-file-upload";
import { useFileOperations } from "./use-file-operations";
import { useFileSearch } from "./use-file-search";
import { useFileClipboard } from "./use-file-clipboard";

export type { SortKey, ContextMenuTrigger } from "./types";

export function useFileManager() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ===== Dialogs (shared infrastructure) =====
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const promptIdRef = useRef(0);

  const openPrompt = useCallback(
    (options: Omit<PromptDialogState, "onConfirm" | "onCancel" | "id">) =>
      new Promise<string | null>(resolve => {
        setPromptDialog({
          ...options,
          id: promptIdRef.current++,
          onConfirm: value => {
            setPromptDialog(null);
            resolve(value);
          },
          onCancel: () => {
            setPromptDialog(null);
            resolve(null);
          },
        });
      }),
    []
  );

  const openConfirm = useCallback(
    (options: Omit<ConfirmDialogState, "onConfirm" | "onCancel">) =>
      new Promise<boolean>(resolve => {
        setConfirmDialog({
          ...options,
          onConfirm: () => {
            setConfirmDialog(null);
            resolve(true);
          },
          onCancel: () => {
            setConfirmDialog(null);
            resolve(false);
          },
        });
      }),
    []
  );

  // ===== Compose sub-hooks =====
  const addResumableTaskFromFileItemRef = useRef<((fileItem: FileItem) => void) | null>(null);
  const navigation = useFileNavigation(addResumableTaskFromFileItemRef);
  const selection = useFileSelection(navigation.sortedFiles);
  const search = useFileSearch();

  const clipboard = useFileClipboard({
    getSelectedFileItems: selection.getSelectedFileItems,
    handleRefresh: navigation.handleRefresh,
    clearSelection: selection.clearSelection,
  });

  const upload = useFileUpload({
    path: navigation.path,
    storagePolicy: navigation.storagePolicy,
    sortedFiles: navigation.sortedFiles,
    handleRefresh: navigation.handleRefresh,
    openPrompt,
    openConfirm,
  });

  const operations = useFileOperations({
    path: navigation.path,
    parentInfo: navigation.parentInfo,
    getSelectedFileItems: selection.getSelectedFileItems,
    isSingleSelection: selection.isSingleSelection,
    clearSelection: selection.clearSelection,
    handleRefresh: navigation.handleRefresh,
    updateFileInState: navigation.updateFileInState,
    removeFilesFromState: navigation.removeFilesFromState,
    openPrompt,
    openConfirm,
  });

  // ===== Wire resumable upload detection =====
  useEffect(() => {
    addResumableTaskFromFileItemRef.current = upload.addResumableTaskFromFileItem;
  }, [upload.addResumableTaskFromFileItem]);

  // ===== URL sync =====
  const { clearSelection: clearSel } = selection;
  const { loadFiles } = navigation;
  useEffect(() => {
    const pathQuery = searchParams.get("path");
    const logicalPath = pathQuery ? extractLogicalPathFromUri(pathQuery) : "/";
    clearSel();
    loadFiles(logicalPath, true);
  }, [searchParams, clearSel, loadFiles]);

  // ===== Navigate =====
  const handleNavigate = (newLogicalPath: string) => {
    selection.clearSelection();
    navigation.loadFiles(newLogicalPath, true);
    const fullUri = buildFullUri(newLogicalPath);
    const params = new URLSearchParams(searchParams.toString());
    params.set("path", fullUri);
    router.push(`/admin/file-management?${params.toString()}`);
  };

  // ===== Container click =====
  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (operations.detailsPanelFile) return;
    if (!selection.hasSelection) return;
    const target = event.target as HTMLElement;
    const ignoredSelectors = [
      ".file-item",
      ".grid-item",
      ".context-menu",
      ".upload-progress-panel",
      "input",
      "button",
      "textarea",
      "[role='button']",
      "[role='menu']",
      "[role='listbox']",
    ];
    if (ignoredSelectors.some(selector => target.closest(selector))) return;
    selection.clearSelection();
  };

  // ===== Context menu =====
  const [contextMenuTrigger, setContextMenuTrigger] = useState<ContextMenuTrigger | null>(null);
  const contextMenuOpenSeqRef = useRef(0);

  const handleContextMenuTrigger = (event: MouseEvent, file?: FileItem) => {
    if (!file && selection.hasSelection) {
      selection.clearSelection();
    }
    if (file?.id && !selection.selectedFiles.has(file.id)) {
      selection.selectSingle(file.id);
    }
    contextMenuOpenSeqRef.current += 1;
    setContextMenuTrigger({ event, file, openSeq: contextMenuOpenSeqRef.current });
  };

  const handleContextMenuClosed = () => setContextMenuTrigger(null);
  const openBlankMenu = (event: MouseEvent) => {
    contextMenuOpenSeqRef.current += 1;
    setContextMenuTrigger({ event, openSeq: contextMenuOpenSeqRef.current });
  };

  const onMenuSelect = (action: string) => {
    const actionMap: Record<string, (() => void) | undefined> = {
      "upload-file": upload.handleUploadFile,
      "upload-dir": upload.handleUploadDir,
      "create-folder": operations.handleCreateFolder,
      "create-md": () => operations.handleCreateFile("md"),
      "create-txt": () => operations.handleCreateFile("txt"),
      refresh: navigation.handleRefresh,
      rename: operations.onActionRename,
      delete: operations.onActionDelete,
      download: operations.onActionDownload,
      copy: clipboard.onActionCopy,
      move: clipboard.onActionMove,
      share: operations.onActionShare,
      "get-link": operations.onActionGetDirectLink,
      info: () => {
        if (selection.isSingleSelection) {
          operations.handleShowDetailsForId(selection.getSelectedFileItems()[0].id);
        }
      },
      "regenerate-thumbnail": operations.onActionRegenerateThumbnail,
    };
    const handler = actionMap[action];
    if (handler) {
      handler();
    } else {
      toast(`功能 "${action}" 尚未实现`, "warning");
    }
  };

  // ===== Return full API (matching original interface exactly) =====
  return {
    containerRef: navigation.containerRef,
    fileToolbarRef: navigation.fileToolbarRef,
    imagePreviewRef: operations.imagePreviewRef,
    videoPreviewRef: operations.videoPreviewRef,
    textPreviewRef: operations.textPreviewRef,
    promptDialog,
    confirmDialog,

    path: navigation.path,
    parentInfo: navigation.parentInfo,
    sortedFiles: navigation.sortedFiles,
    loading: navigation.loading,
    isMoreLoading: navigation.isMoreLoading,
    hasMore: navigation.hasMore,
    viewMode: navigation.viewMode,
    sortKey: navigation.sortKey,
    pageSize: navigation.pageSize,
    columns: navigation.columns,

    selectedFiles: selection.selectedFiles,
    selectSingle: selection.selectSingle,
    selectRange: selection.selectRange,
    toggleSelection: selection.toggleSelection,
    selectAll: selection.selectAll,
    clearSelection: selection.clearSelection,
    invertSelection: selection.invertSelection,
    hasSelection: selection.hasSelection,
    isSingleSelection: selection.isSingleSelection,
    selectionCountLabel: selection.selectionCountLabel,

    isDragging: upload.isDragging,
    isDestinationModalVisible: clipboard.isDestinationModalVisible,
    itemsForAction: clipboard.itemsForAction,
    destinationModalMode: clipboard.destinationModalMode,
    isShareModalVisible: operations.isShareModalVisible,
    shareItems: operations.shareItems,
    detailsPanelFile: operations.detailsPanelFile,
    isSearchVisible: search.isSearchVisible,
    searchOrigin: search.searchOrigin,
    contextMenuTrigger,
    isPanelVisible: upload.isPanelVisible,
    isPanelCollapsed: upload.isPanelCollapsed,
    uploadQueue: upload.uploadQueue,
    speedDisplayMode: upload.speedDisplayMode,
    globalOverwrite: upload.globalOverwrite,
    directLinks: operations.directLinks,

    handleNavigate,
    handleLoadMore: navigation.handleLoadMore,
    handlePreviewFile: operations.handlePreviewFile,
    handleRefresh: navigation.handleRefresh,
    handleSetViewMode: navigation.handleSetViewMode,
    handleSetPageSize: navigation.handleSetPageSize,
    handleSetColumns: navigation.handleSetColumns,
    handleSetSortKey: navigation.handleSetSortKey,
    handleOpenColumnSettings: navigation.handleOpenColumnSettings,
    handleContainerClick,
    handleContextMenuTrigger,
    onMenuSelect,
    handleContextMenuClosed,
    openBlankMenu,
    dragHandlers: upload.dragHandlers,
    handleUploadFile: upload.handleUploadFile,
    onActionDownload: operations.onActionDownload,
    handleDownloadFolder: operations.handleDownloadFolder,
    onActionRename: operations.onActionRename,
    onActionDelete: operations.onActionDelete,
    onActionShare: operations.onActionShare,
    onActionGetDirectLink: operations.onActionGetDirectLink,
    onActionCopy: clipboard.onActionCopy,
    onActionMove: clipboard.onActionMove,
    handleActionSuccess: clipboard.handleActionSuccess,
    handleShareSuccess: operations.handleShareSuccess,
    closeDetailsPanel: operations.closeDetailsPanel,
    handleShowDetailsForId: operations.handleShowDetailsForId,
    openSearchFromElement: search.openSearchFromElement,
    handlePanelClose: upload.handlePanelClose,
    retryItem: upload.retryItem,
    removeItem: upload.removeItem,
    resolveConflict: upload.resolveConflict,
    handleUploadGlobalCommand: upload.handleUploadGlobalCommand,
    onActionRegenerateDirectoryThumbnails: operations.onActionRegenerateDirectoryThumbnails,

    setIsSearchVisible: search.setIsSearchVisible,
    setDestinationModalVisible: clipboard.setDestinationModalVisible,
    setShareModalVisible: operations.setShareModalVisible,
    setPanelCollapsed: upload.setPanelCollapsed,
    setDirectLinks: operations.setDirectLinks,
    handleCreateShare: operations.handleCreateShare,
    formatRelativeTime,
  };
}
