"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RiFolderLine } from "react-icons/ri";
import { addToast } from "@heroui/react";
import type { ColumnConfig, FileItem } from "@/types/file-manager";
import { FileType } from "@/types/file-manager";
import type { SortKey } from "@/hooks/file-manager/use-file-manager";
import { extractLogicalPathFromUri } from "@/utils/file-manager";
import { fetchFilesByPathApi, moveFilesApi, copyFilesApi } from "@/lib/api/file-manager";
import { formatRelativeTime } from "@/utils/date";
import { overlayVariants, modalVariants, springTransition, normalTransition } from "@/lib/motion";
import { FileBreadcrumb } from "../FileBreadcrumb";
import { FileToolbar } from "../FileToolbar";
import { FileListView } from "../FileListView";
import { FileGridView } from "../FileGridView";
import styles from "./MoveModal.module.css";

interface MoveModalProps {
  open: boolean;
  itemsForAction: FileItem[];
  mode: "move" | "copy";
  onSuccess: (payload: { mode: "move" | "copy" }) => void;
  onClose: () => void;
}

interface TreeNode {
  id: string;
  name: string;
  path: string;
  children?: TreeNode[];
  isLoaded?: boolean;
  isLoading?: boolean;
}

interface TargetFolderInfo {
  id: string;
  name: string;
  path: string;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [{ type: 0 }, { type: 1 }, { type: 2 }];

export function MoveModal({ open, itemsForAction, mode, onSuccess, onClose }: MoveModalProps) {
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at_desc");
  const [pageSize, setPageSize] = useState(50);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["/"]));
  const [currentTargetFolder, setCurrentTargetFolder] = useState<TargetFolderInfo | null>(null);

  const disabledPaths = useMemo(() => {
    return new Set(
      itemsForAction.filter(item => item.type === FileType.Dir).map(item => extractLogicalPathFromUri(item.path))
    );
  }, [itemsForAction]);

  const disabledFileIds = useMemo(() => {
    const ids = new Set<string>();
    files.forEach(item => {
      const logicalPath = extractLogicalPathFromUri(item.path);
      if ([...disabledPaths].some(path => logicalPath.startsWith(path))) {
        ids.add(item.id);
      }
    });
    return ids;
  }, [files, disabledPaths]);

  const loadFiles = useCallback(
    async (pathToLoad: string, refresh = false) => {
      if (refresh) {
        setLoading(true);
        setCurrentPath(pathToLoad);
        setNextToken(null);
        setFiles([]);
      }
      if (!refresh && isMoreLoading) return;
      if (!refresh) setIsMoreLoading(true);
      try {
        const res = await fetchFilesByPathApi(pathToLoad, refresh ? null : nextToken);
        if (res.code === 200 && res.data) {
          const { files: newFiles, parent, pagination, view } = res.data;
          setFiles(prev => (refresh ? newFiles : [...prev, ...newFiles]));
          if (pagination?.next_token) {
            setNextToken(pagination.next_token);
            setHasMore(true);
          } else {
            setNextToken(null);
            setHasMore(false);
          }
          if (refresh && view) {
            setViewMode(view.view);
            setPageSize(view.page_size);
            setSortKey(`${view.order}_${view.order_direction}` as SortKey);
            setColumns(view.columns?.length ? view.columns : DEFAULT_COLUMNS);
          }
          if (refresh && parent) {
            setCurrentTargetFolder({
              id: parent.id,
              name: parent.name,
              path: extractLogicalPathFromUri(parent.path),
            });
          }
        }
      } finally {
        setLoading(false);
        setIsMoreLoading(false);
      }
    },
    [isMoreLoading, nextToken]
  );

  const loadTreeRoot = useCallback(async () => {
    const res = await fetchFilesByPathApi("/");
    if (res.code === 200 && res.data) {
      const dirs = res.data.files.filter(item => item.type === FileType.Dir);
      const rootNode: TreeNode = {
        id: "root",
        name: "我的文件",
        path: "/",
        children: dirs.map(item => ({ id: item.id, name: item.name, path: extractLogicalPathFromUri(item.path) })),
        isLoaded: true,
      };
      setTreeData([rootNode]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadFiles("/", true);
    loadTreeRoot();
  }, [open, loadFiles, loadTreeRoot]);

  // 递归更新树节点的不可变更新函数
  const updateTreeNode = useCallback(
    (nodes: TreeNode[], targetPath: string, updates: Partial<TreeNode>): TreeNode[] => {
      return nodes.map(node => {
        if (node.path === targetPath) {
          return { ...node, ...updates };
        }
        if (node.children) {
          return { ...node, children: updateTreeNode(node.children, targetPath, updates) };
        }
        return node;
      });
    },
    []
  );

  // 使用不可变更新方式加载子节点
  const loadTreeChildren = useCallback(
    async (node: TreeNode) => {
      if (node.isLoaded || node.isLoading) return;

      // 设置 loading 状态（不可变更新）
      setTreeData(prev => updateTreeNode(prev, node.path, { isLoading: true }));

      const res = await fetchFilesByPathApi(node.path);
      if (res.code === 200 && res.data) {
        const dirs = res.data.files.filter(item => item.type === FileType.Dir);
        const children = dirs.map(item => ({
          id: item.id,
          name: item.name,
          path: extractLogicalPathFromUri(item.path),
        }));
        // 设置 children 和完成状态（不可变更新）
        setTreeData(prev => updateTreeNode(prev, node.path, { children, isLoaded: true, isLoading: false }));
      } else {
        // 加载失败，重置 loading 状态
        setTreeData(prev => updateTreeNode(prev, node.path, { isLoading: false }));
      }
    },
    [updateTreeNode]
  );

  const toggleExpand = useCallback(
    (node: TreeNode) => {
      setExpandedPaths(prev => {
        const next = new Set(prev);
        if (next.has(node.path)) {
          next.delete(node.path);
        } else {
          next.add(node.path);
          loadTreeChildren(node);
        }
        return next;
      });
    },
    [loadTreeChildren]
  );

  const handleNavigate = useCallback(
    (newPath: string) => {
      loadFiles(newPath, true);
    },
    [loadFiles]
  );

  const handleConfirm = useCallback(async () => {
    if (!currentTargetFolder) {
      addToast({ title: "请选择目标文件夹", color: "warning", timeout: 3000 });
      return;
    }
    const sourceIDs = itemsForAction.map(item => item.id);
    const destinationID = currentTargetFolder.id;
    try {
      if (mode === "move") {
        await moveFilesApi(sourceIDs, destinationID);
      } else {
        await copyFilesApi(sourceIDs, destinationID);
      }
      onSuccess({ mode });
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失败";
      addToast({ title: message, color: "danger", timeout: 3000 });
    }
  }, [currentTargetFolder, itemsForAction, mode, onSuccess]);

  const handleTreeNodeClick = useCallback(
    (node: TreeNode, isDisabled: boolean) => {
      if (isDisabled) return;
      setCurrentTargetFolder({ id: node.id, name: node.name, path: node.path });
      handleNavigate(node.path);
    },
    [handleNavigate]
  );

  const renderTree = useCallback(
    (nodes: TreeNode[], depth = 0) =>
      nodes.map(node => {
        const logicalPath = extractLogicalPathFromUri(node.path);
        const isDisabled = [...disabledPaths].some(path => logicalPath.startsWith(path));
        return (
          <div key={node.path}>
            <div
              className={`${styles["tree-node"]} ${isDisabled ? styles.disabled : ""}`}
              style={{ paddingLeft: `${depth * 12}px` }}
              onClick={() => handleTreeNodeClick(node, isDisabled)}
              onDoubleClick={() => toggleExpand(node)}
            >
              <RiFolderLine />
              <span>{node.name}</span>
            </div>
            {node.children && expandedPaths.has(node.path) ? (
              <div className={styles["tree-children"]}>{renderTree(node.children, depth + 1)}</div>
            ) : null}
          </div>
        );
      }),
    [disabledPaths, expandedPaths, handleTreeNodeClick, toggleExpand]
  );

  const handleRefresh = useCallback(() => loadFiles(currentPath, true), [loadFiles, currentPath]);
  const handleScrollToLoad = useCallback(() => loadFiles(currentPath), [loadFiles, currentPath]);
  // 空操作回调
  const noop = useCallback(() => undefined, []);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={styles.overlay}
          onClick={onClose}
          aria-hidden="true"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={normalTransition}
        >
          <motion.div
            className={styles.modal}
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-modal-title"
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springTransition}
          >
            <h2 id="move-modal-title" className="sr-only">
              {mode === "move" ? "移动文件" : "复制文件"}
            </h2>
            <div className={styles["modal-body"]}>
              <aside className={styles["tree-aside"]} aria-label="文件夹树">
                {renderTree(treeData)}
              </aside>
              <div className={styles["main-panel"]}>
                <div className="flex w-full">
                  <FileBreadcrumb
                    path={currentPath}
                    onNavigate={handleNavigate}
                    onShowDetails={noop}
                    onDownloadFolder={noop}
                    showDropdown={false}
                  />
                  <div className="ml-2">
                    <FileToolbar
                      viewMode={viewMode}
                      sortKey={sortKey}
                      pageSize={pageSize}
                      columns={columns}
                      hasSelection={false}
                      isSimplified
                      onRefresh={handleRefresh}
                      onSelectAll={noop}
                      onClearSelection={noop}
                      onInvertSelection={noop}
                      onSetViewMode={setViewMode}
                      onSetPageSize={setPageSize}
                      onSetSortKey={setSortKey}
                      onSetColumns={setColumns}
                      onRegenerateThumbnails={noop}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {viewMode === "list" ? (
                    <FileListView
                      files={files}
                      loading={loading}
                      selectedFileIds={new Set()}
                      disabledFileIds={disabledFileIds}
                      isMoreLoading={isMoreLoading}
                      hasMore={hasMore}
                      columns={columns}
                      sortKey={sortKey}
                      showColumnSettings={false}
                      onSelectSingle={noop}
                      onSelectRange={noop}
                      onToggleSelection={noop}
                      onSelectAll={noop}
                      onNavigateTo={handleNavigate}
                      onScrollToLoad={handleScrollToLoad}
                      onPreviewFile={noop}
                      onContextMenu={noop}
                      onSetSortKey={setSortKey}
                      onSetColumns={setColumns}
                      onOpenColumnSettings={noop}
                      formatRelativeTime={formatRelativeTime}
                    />
                  ) : (
                    <FileGridView
                      files={files}
                      loading={loading}
                      selectedFileIds={new Set()}
                      disabledFileIds={disabledFileIds}
                      isMoreLoading={isMoreLoading}
                      hasMore={hasMore}
                      onSelectSingle={noop}
                      onSelectRange={noop}
                      onToggleSelection={noop}
                      onSelectAll={noop}
                      onNavigateTo={handleNavigate}
                      onScrollToLoad={handleScrollToLoad}
                      onPreviewFile={noop}
                      onContextMenu={noop}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className={styles["modal-footer"]}>
              <div className={styles["target-info"]}>
                {currentTargetFolder ? (
                  <>
                    {mode === "move" ? "移动到:" : "复制到:"}
                    {""}
                    <span className={styles["target-path"]}>{currentTargetFolder.name}</span>
                  </>
                ) : (
                  "请选择一个目标文件夹"
                )}
              </div>
              <div className={styles["footer-actions"]}>
                <button onClick={onClose} type="button">
                  取消
                </button>
                <button
                  className={styles.primary}
                  onClick={handleConfirm}
                  disabled={!currentTargetFolder}
                  type="button"
                >
                  {mode === "move" ? "确定移动" : "确定复制"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
