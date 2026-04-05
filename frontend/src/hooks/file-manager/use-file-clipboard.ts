"use client";

import { useState } from "react";
import type { FileItem } from "@/types/file-manager";
import { toast } from "./types";

interface UseFileClipboardOptions {
  getSelectedFileItems: () => FileItem[];
  handleRefresh: () => void;
  clearSelection: () => void;
}

export function useFileClipboard({ getSelectedFileItems, handleRefresh, clearSelection }: UseFileClipboardOptions) {
  const [isDestinationModalVisible, setDestinationModalVisible] = useState(false);
  const [itemsForAction, setItemsForAction] = useState<FileItem[]>([]);
  const [destinationModalMode, setDestinationModalMode] = useState<"move" | "copy">("move");

  const onActionMove = () => {
    const selectedItems = getSelectedFileItems();
    if (selectedItems.length === 0) return toast("请至少选择一个要移动的项目。", "warning");
    setItemsForAction(selectedItems);
    setDestinationModalMode("move");
    setDestinationModalVisible(true);
  };

  const onActionCopy = () => {
    const selectedItems = getSelectedFileItems();
    if (selectedItems.length === 0) return toast("请至少选择一个要复制的项目。", "warning");
    setItemsForAction(selectedItems);
    setDestinationModalMode("copy");
    setDestinationModalVisible(true);
  };

  const handleActionSuccess = (payload: { mode: "move" | "copy" }) => {
    setDestinationModalVisible(false);
    handleRefresh();
    clearSelection();
    toast(payload.mode === "move" ? "移动成功" : "复制成功", "success");
  };

  return {
    isDestinationModalVisible,
    itemsForAction,
    destinationModalMode,
    onActionMove,
    onActionCopy,
    handleActionSuccess,
    setDestinationModalVisible,
  };
}
