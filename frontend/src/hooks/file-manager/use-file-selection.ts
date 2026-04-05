"use client";

import { useCallback, useRef, useState } from "react";
import type { FileItem } from "@/types/file-manager";

export function useFileSelection(sortedFiles: FileItem[]) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const lastSelectedIdRef = useRef<string | null>(null);

  const hasSelection = selectedFiles.size > 0;
  const isSingleSelection = selectedFiles.size === 1;
  const selectionCountLabel = `${selectedFiles.size} 个对象`;

  const selectSingle = (fileId: string) => {
    setSelectedFiles(new Set([fileId]));
    lastSelectedIdRef.current = fileId;
  };

  const toggleSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
        if (lastSelectedIdRef.current === fileId) {
          lastSelectedIdRef.current = null;
        }
      } else {
        next.add(fileId);
        lastSelectedIdRef.current = fileId;
      }
      return next;
    });
  };

  const selectRange = (endId: string) => {
    const anchorId = lastSelectedIdRef.current;
    if (!anchorId) {
      selectSingle(endId);
      return;
    }
    const anchorIndex = sortedFiles.findIndex(f => f.id === anchorId);
    const endIndex = sortedFiles.findIndex(f => f.id === endId);
    if (anchorIndex === -1 || endIndex === -1) return;
    const start = Math.min(anchorIndex, endIndex);
    const end = Math.max(anchorIndex, endIndex);
    const next = new Set(selectedFiles);
    for (let i = start; i <= end; i++) {
      next.add(sortedFiles[i].id);
    }
    setSelectedFiles(next);
  };

  const selectAll = () => {
    setSelectedFiles(new Set(sortedFiles.map(f => f.id)));
  };

  const clearSelection = useCallback(() => {
    setSelectedFiles(prev => (prev.size === 0 ? prev : new Set()));
    lastSelectedIdRef.current = null;
  }, []);

  const invertSelection = () => {
    const allIds = new Set(sortedFiles.map(f => f.id));
    const next = new Set<string>();
    allIds.forEach(id => {
      if (!selectedFiles.has(id)) next.add(id);
    });
    setSelectedFiles(next);
  };

  const getSelectedFileItems = () => sortedFiles.filter(f => selectedFiles.has(f.id));

  return {
    selectedFiles,
    selectSingle,
    toggleSelection,
    selectRange,
    selectAll,
    clearSelection,
    invertSelection,
    hasSelection,
    isSingleSelection,
    selectionCountLabel,
    getSelectedFileItems,
  };
}
