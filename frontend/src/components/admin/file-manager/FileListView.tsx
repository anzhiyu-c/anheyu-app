"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { addToast } from "@heroui/react";
import { RiAddLine, RiArrowDownSLine, RiArrowUpSLine, RiCheckboxCircleFill, RiLoader4Line } from "react-icons/ri";
import type { ColumnConfig, FileItem } from "@/types/file-manager";
import { FileType } from "@/types/file-manager";
import type { SortKey } from "@/hooks/file-manager/use-file-manager";
import { extractLogicalPathFromUri } from "@/utils/file-manager";
import { formatBytes } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { getFileIcon } from "./file-icons";
import styles from "./FileListView.module.css";

const columnTypeMap: Record<number, { key: string; name: string }> = {
  0: { key: "name", name: "文件名" },
  1: { key: "size", name: "大小" },
  2: { key: "updated_at", name: "修改日期" },
  3: { key: "created_at", name: "创建日期" },
};

interface FileListViewProps {
  files: FileItem[];
  loading: boolean;
  selectedFileIds: Set<string>;
  disabledFileIds?: Set<string>;
  isMoreLoading: boolean;
  hasMore: boolean;
  columns: ColumnConfig[];
  sortKey: SortKey;
  showColumnSettings?: boolean;
  onSelectSingle: (fileId: string) => void;
  onSelectRange: (fileId: string) => void;
  onToggleSelection: (fileId: string) => void;
  onSelectAll: () => void;
  onNavigateTo: (path: string) => void;
  onScrollToLoad: () => void;
  onPreviewFile: (item: FileItem) => void;
  onContextMenu: (event: MouseEvent, file: FileItem) => void;
  onSetSortKey: (key: SortKey) => void;
  onSetColumns: (columns: ColumnConfig[]) => void;
  onOpenColumnSettings: () => void;
  formatRelativeTime: (value: string) => string;
}

export function FileListView({
  files,
  loading,
  selectedFileIds,
  disabledFileIds = new Set(),
  isMoreLoading,
  hasMore,
  columns,
  sortKey,
  showColumnSettings = true,
  onSelectSingle,
  onSelectRange,
  onToggleSelection,
  onSelectAll,
  onNavigateTo,
  onScrollToLoad,
  onPreviewFile,
  onContextMenu,
  onSetSortKey,
  onSetColumns,
  onOpenColumnSettings,
  formatRelativeTime,
}: FileListViewProps) {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>([]);
  const resizeState = useRef({ isResizing: false, startClientX: 0, startWidth: 0, columnIndex: -1 });
  const [hoveredHeaderKey, setHoveredHeaderKey] = useState<string | null>(null);

  useEffect(() => {
    if (!resizeState.current.isResizing && Array.isArray(columns)) {
      setLocalColumns(JSON.parse(JSON.stringify(columns)));
    }
  }, [columns]);

  const currentSort = useMemo(() => {
    const parts = sortKey.split("_");
    const dir = parts.pop() as "asc" | "desc";
    const key = parts.join("_");
    return { key, dir };
  }, [sortKey]);

  const startResize = (event: React.MouseEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const currentColumn = localColumns[index];
    if (!currentColumn) return;
    const columnElement = (event.target as HTMLElement).closest<HTMLElement>(`.${styles.column}`);
    const startWidth = currentColumn.width || columnElement?.offsetWidth || 80;
    resizeState.current = {
      isResizing: true,
      startClientX: event.clientX,
      startWidth,
      columnIndex: index,
    };
    window.addEventListener("mousemove", handleResizing);
    window.addEventListener("mouseup", stopResizing);
  };

  const handleResizing = useCallback((event: MouseEvent) => {
    const state = resizeState.current;
    if (state.columnIndex === -1) return;
    const deltaX = event.clientX - state.startClientX;
    const newWidth = Math.max(state.startWidth + deltaX, 80);
    setLocalColumns(prev => {
      const next = [...prev];
      if (next[state.columnIndex]) {
        next[state.columnIndex].width = Math.round(newWidth);
      }
      return next;
    });
  }, []);

  const stopResizing = useCallback(() => {
    window.removeEventListener("mousemove", handleResizing);
    window.removeEventListener("mouseup", stopResizing);
    if (resizeState.current.isResizing) {
      onSetColumns(localColumns);
    }
    resizeState.current = { isResizing: false, startClientX: 0, startWidth: 0, columnIndex: -1 };
  }, [handleResizing, localColumns, onSetColumns]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleResizing);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [handleResizing, stopResizing]);

  const getColumnStyle = (col: ColumnConfig) => {
    if (col.width) {
      return { flex: "none", width: `${col.width}px` };
    }
    const key = columnTypeMap[col.type]?.key;
    switch (key) {
      case "name":
        return { flex: 5 };
      case "size":
        return { flex: 1.5 };
      case "updated_at":
      case "created_at":
        return { flex: 2.5 };
      default:
        return { flex: 1 };
    }
  };

  const handleHeaderClick = (key: string) => {
    if (currentSort.key === key) {
      const newDir = currentSort.dir === "asc" ? "desc" : "asc";
      onSetSortKey(`${key}_${newDir}` as SortKey);
    } else {
      const newDir = key === "name" ? "asc" : "desc";
      onSetSortKey(`${key}_${newDir}` as SortKey);
    }
  };

  // 用延时区分单击和双击，避免双击文件夹时先选中再进入的闪烁
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleItemClick = (item: FileItem, event: React.MouseEvent<HTMLLIElement>) => {
    if (disabledFileIds?.has(item.id)) return;
    if (item.metadata?.["sys:upload_session_id"]) return;

    // 如果是 Shift/Ctrl 修饰键，立即执行（不需要等双击判断）
    if (event.shiftKey) {
      onSelectRange(item.id);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      onToggleSelection(item.id);
      return;
    }

    // 已唯一选中时再次单击：立即取消选中，不参与延时（避免与双击冲突或闭包滞后）
    if (selectedFileIds.has(item.id) && selectedFileIds.size === 1) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      onToggleSelection(item.id);
      return;
    }

    // 普通单击：延迟执行选中，等待可能的双击
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      onSelectSingle(item.id);
      clickTimerRef.current = null;
    }, 150);
  };

  const handleItemDblClick = (item: FileItem) => {
    // 取消挂起的单击选中
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }

    if (disabledFileIds?.has(item.id)) {
      addToast({ title: "不能进入正在移动的文件夹。", color: "warning", timeout: 3000 });
      return;
    }
    if (item.metadata?.["sys:upload_session_id"]) return;
    if (item.type === FileType.Dir) {
      const logicalPath = extractLogicalPathFromUri(item.path);
      onNavigateTo(logicalPath);
    } else {
      onPreviewFile(item);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        onSelectAll();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectAll]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      onScrollToLoad();
    }
  };

  return (
    <div className={styles["file-list-view"]}>
      <div className={styles["list-header"]}>
        {localColumns.map((col, index) => {
          const columnKey = columnTypeMap[col.type]?.key;
          return (
            <div
              key={`${col.type}-${index}`}
              className={`${styles.column} ${styles.sortable}`}
              style={getColumnStyle(col)}
              onClick={() => columnKey && handleHeaderClick(columnKey)}
              onMouseEnter={() => columnKey && setHoveredHeaderKey(columnKey)}
              onMouseLeave={() => setHoveredHeaderKey(null)}
            >
              <span>{columnTypeMap[col.type]?.name}</span>
              {currentSort.key === columnKey ? (
                currentSort.dir === "asc" ? (
                  <RiArrowUpSLine />
                ) : (
                  <RiArrowDownSLine />
                )
              ) : hoveredHeaderKey === columnKey ? (
                <RiArrowDownSLine className={styles["sort-indicator"]} />
              ) : null}
              <div className={styles["column-resizer"]} onMouseDown={event => startResize(event, index)} />
            </div>
          );
        })}
        {showColumnSettings ? (
          <div className={styles["settings-container"]}>
            <Tooltip content="配置列" placement="top" showArrow={false}>
              <button className={styles["settings-button"]} onClick={onOpenColumnSettings} aria-label="配置列">
                <RiAddLine />
              </button>
            </Tooltip>
          </div>
        ) : null}
      </div>
      <div className={styles["list-body"]} onScroll={handleScroll}>
        <ul>
          {files.map(item => {
            const FileIcon = getFileIcon(item);
            return (
              <motion.li
                key={item.id}
                className={`${styles["list-item"]} ${selectedFileIds.has(item.id) ? styles.selected : ""} ${
                  disabledFileIds?.has(item.id) ? styles["is-disabled"] : ""
                }`}
                whileTap={{ scale: 0.997, transition: { duration: 0.1 } }}
                onClick={event => handleItemClick(item, event)}
                onDoubleClick={() => handleItemDblClick(item)}
                onContextMenu={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  onContextMenu(event.nativeEvent, item);
                }}
              >
                {localColumns.map((col, index) => {
                  const columnKey = columnTypeMap[col.type]?.key;
                  if (columnKey === "name") {
                    return (
                      <div key={`${item.id}-${index}`} className={styles.column} style={getColumnStyle(col)}>
                        <div className={styles["file-cell"]}>
                          {selectedFileIds.has(item.id) ? (
                            <RiCheckboxCircleFill
                              className={styles["file-icon"]}
                              onClick={event => {
                                event.stopPropagation();
                                onToggleSelection(item.id);
                              }}
                            />
                          ) : (
                            <FileIcon className={styles["file-icon"]} />
                          )}
                          <span className={styles["file-name"]}>{item.name}</span>
                          {item.metadata?.["sys:upload_session_id"] ? (
                            <Tooltip content="文件上传中..." placement="top" showArrow={false}>
                              <span className={styles["uploading-badge"]}>
                                <RiLoader4Line />
                              </span>
                            </Tooltip>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                  if (columnKey === "size") {
                    return (
                      <div key={`${item.id}-${index}`} className={styles.column} style={getColumnStyle(col)}>
                        {item.type === FileType.File ? formatBytes(item.size) : "--"}
                      </div>
                    );
                  }
                  if (columnKey === "updated_at") {
                    return (
                      <div key={`${item.id}-${index}`} className={styles.column} style={getColumnStyle(col)}>
                        {formatRelativeTime(item.updated_at)}
                      </div>
                    );
                  }
                  if (columnKey === "created_at") {
                    return (
                      <div key={`${item.id}-${index}`} className={styles.column} style={getColumnStyle(col)}>
                        {formatRelativeTime(item.created_at)}
                      </div>
                    );
                  }
                  return null;
                })}
              </motion.li>
            );
          })}
        </ul>
        {isMoreLoading ? (
          <div className={styles["list-footer"]}>
            <RiLoader4Line className={styles["loading-icon"]} />
            <span>加载中...</span>
          </div>
        ) : null}
        {!isMoreLoading && !hasMore && files.length > 0 ? (
          <div className={styles["list-footer"]}>— 没有更多了 —</div>
        ) : null}
        {files.length === 0 && !loading && !isMoreLoading ? (
          <div className={styles["list-footer"]}>这里什么都没有</div>
        ) : null}
      </div>
    </div>
  );
}
