"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiGridLine,
  RiListCheck,
  RiRefreshLine,
  RiSortAsc,
  RiSettings4Line,
  RiMagicLine,
  RiFullscreenLine,
  RiAddLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiCloseLine,
} from "react-icons/ri";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react";
import type { ColumnConfig } from "@/types/file-manager";
import type { SortKey } from "@/hooks/file-manager/use-file-manager";
import { Tooltip } from "@/components/ui/tooltip";
import { modalVariants, overlayVariants, springTransition, normalTransition } from "@/lib/motion";
import styles from "./FileToolbar.module.css";

enum ColumnType {
  Name = 0,
  Size = 1,
  UpdatedAt = 2,
  CreatedAt = 3,
}

const columnTypeMap = new Map<ColumnType, { name: string }>([
  [ColumnType.Name, { name: "文件名" }],
  [ColumnType.Size, { name: "大小" }],
  [ColumnType.UpdatedAt, { name: "修改日期" }],
  [ColumnType.CreatedAt, { name: "创建日期" }],
]);

interface FileToolbarProps {
  viewMode: "list" | "grid";
  sortKey: SortKey;
  pageSize: number;
  columns: ColumnConfig[];
  hasSelection: boolean;
  isSimplified?: boolean;
  onRefresh: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onInvertSelection: () => void;
  onSetViewMode: (mode: "list" | "grid") => void;
  onSetPageSize: (size: number) => void;
  onSetSortKey: (key: SortKey) => void;
  onSetColumns: (columns: ColumnConfig[]) => void;
  onRegenerateThumbnails: () => void;
}

export interface FileToolbarRef {
  openDialog: () => void;
}

const sortOptions: { key: SortKey; label: string; divider?: boolean }[] = [
  { key: "name_asc", label: "A-Z" },
  { key: "name_desc", label: "Z-A" },
  { key: "size_asc", label: "最小", divider: true },
  { key: "size_desc", label: "最大" },
  { key: "updated_at_desc", label: "最新修改", divider: true },
  { key: "updated_at_asc", label: "最早修改" },
  { key: "created_at_desc", label: "最新上传", divider: true },
  { key: "created_at_asc", label: "最早上传" },
];

export const FileToolbar = forwardRef<FileToolbarRef, FileToolbarProps>(
  (
    {
      viewMode,
      sortKey,
      pageSize,
      columns,
      hasSelection,
      isSimplified = false,
      onRefresh,
      onSelectAll,
      onClearSelection,
      onInvertSelection,
      onSetViewMode,
      onSetPageSize,
      onSetSortKey,
      onSetColumns,
      onRegenerateThumbnails,
    },
    ref
  ) => {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [localPageSize, setLocalPageSize] = useState(pageSize);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [editableColumns, setEditableColumns] = useState<ColumnConfig[]>([]);
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    useEffect(() => {
      setLocalPageSize(pageSize);
    }, [pageSize]);

    useImperativeHandle(ref, () => ({
      openDialog: () => {
        setEditableColumns(JSON.parse(JSON.stringify(columns)));
        setDialogVisible(true);
      },
    }));

    const availableColumnsToAdd = useMemo(() => {
      const all = Array.from(columnTypeMap.keys());
      const current = new Set(editableColumns.map(col => col.type));
      return all.filter(type => !current.has(type));
    }, [editableColumns]);

    const moveColumn = (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= editableColumns.length) return;
      const next = [...editableColumns];
      const temp = next[index];
      next[index] = next[newIndex];
      next[newIndex] = temp;
      setEditableColumns(next);
    };

    const removeColumn = (index: number) => {
      const next = [...editableColumns];
      next.splice(index, 1);
      setEditableColumns(next);
    };

    const addColumn = (type: ColumnType) => {
      setEditableColumns(prev => [...prev, { type }]);
      setAddMenuOpen(false);
    };

    const handleConfirm = () => {
      onSetColumns(editableColumns);
      setDialogVisible(false);
    };

    const handleViewChange = (mode: "list" | "grid") => {
      onSetViewMode(mode);
    };

    const handleOpenDialog = () => {
      setEditableColumns(JSON.parse(JSON.stringify(columns)));
      setDialogVisible(true);
      setSettingsOpen(false);
    };

    return (
      <div className={styles["file-toolbar"]}>
        <div className={styles["right-actions"]}>
          <Tooltip content="刷新" placement="bottom" showArrow={false}>
            <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
              <Button
                isIconOnly
                className={`${styles["circle-btn"]} ${styles["btn-primary"]}`}
                variant="solid"
                onPress={onRefresh}
                aria-label="刷新"
              >
                <RiRefreshLine />
              </Button>
            </motion.div>
          </Tooltip>

          {viewMode === "grid" && (
            <Tooltip content="重新生成缩略图" placement="bottom" showArrow={false}>
              <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
                <Button
                  isIconOnly
                  className={`${styles["circle-btn"]} ${styles["btn-orange"]}`}
                  variant="solid"
                  onPress={onRegenerateThumbnails}
                  aria-label="重新生成缩略图"
                >
                  <RiMagicLine />
                </Button>
              </motion.div>
            </Tooltip>
          )}

          {!isSimplified && (
            <Dropdown classNames={{ content: styles["dropdown-content"] }}>
              <DropdownTrigger>
                <Button
                  isIconOnly
                  className={`${styles["circle-btn"]} ${styles["btn-purple"]}`}
                  variant="solid"
                  aria-label="选择操作"
                >
                  <RiFullscreenLine />
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="选择操作"
                className={styles["dropdown-menu"]}
                onAction={key => {
                  if (key === "select-all") onSelectAll();
                  if (key === "clear-selection" && hasSelection) onClearSelection();
                  if (key === "invert-selection") onInvertSelection();
                }}
              >
                <DropdownItem key="select-all" className={styles["dropdown-item"]}>
                  全选
                </DropdownItem>
                <DropdownItem key="clear-selection" className={styles["dropdown-item"]} isDisabled={!hasSelection}>
                  取消选择
                </DropdownItem>
                <DropdownItem key="invert-selection" className={styles["dropdown-item"]}>
                  反选
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}

          {!isSimplified && (
            <Popover
              placement="bottom-end"
              offset={8}
              showArrow={false}
              isOpen={settingsOpen}
              onOpenChange={setSettingsOpen}
              classNames={{ content: styles["settings-popover"] }}
            >
              <PopoverTrigger>
                <Button
                  isIconOnly
                  className={`${styles["circle-btn"]} ${styles["btn-lightblue"]}`}
                  variant="solid"
                  aria-label="视图设置"
                >
                  <RiSettings4Line />
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <div className={styles["popover-inner"]}>
                  <div className={styles["popover-section"]}>
                    <h4 className={styles["popover-title"]}>布局</h4>
                    <div className={styles["view-switcher"]}>
                      <button
                        className={`${styles["view-btn"]} ${viewMode === "grid" ? styles.active : ""}`}
                        onClick={() => handleViewChange("grid")}
                      >
                        <RiGridLine /> 网格
                      </button>
                      <button
                        className={`${styles["view-btn"]} ${viewMode === "list" ? styles.active : ""}`}
                        onClick={() => handleViewChange("list")}
                      >
                        <RiListCheck /> 列表
                      </button>
                    </div>
                  </div>
                  <div className={styles["popover-divider"]} />
                  {viewMode === "list" && (
                    <>
                      <div className={styles["popover-section"]}>
                        <h4 className={styles["popover-title"]}>列设置</h4>
                        <button className={styles["full-width-btn"]} onClick={handleOpenDialog}>
                          <RiSettings4Line /> 自定义列表列
                        </button>
                      </div>
                      <div className={styles["popover-divider"]} />
                    </>
                  )}
                  <div className={styles["popover-section"]}>
                    <h4 className={styles["popover-title"]}>分页大小</h4>
                    <div className={styles["slider-wrapper"]}>
                      <input
                        type="range"
                        min={10}
                        max={200}
                        step={10}
                        value={localPageSize}
                        onChange={event => setLocalPageSize(Number(event.target.value))}
                        onMouseUp={() => onSetPageSize(localPageSize)}
                        onTouchEnd={() => onSetPageSize(localPageSize)}
                      />
                      <span className={styles["slider-value"]}>{localPageSize}</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Dropdown classNames={{ content: styles["dropdown-content"] }}>
            <DropdownTrigger>
              <Button
                isIconOnly
                className={`${styles["circle-btn"]} ${styles["btn-green"]}`}
                variant="solid"
                aria-label="排序"
              >
                <RiSortAsc />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="排序"
              className={styles["dropdown-menu"]}
              onAction={key => onSetSortKey(key as SortKey)}
            >
              {sortOptions.map(option => (
                <DropdownItem
                  key={option.key}
                  className={`${styles["dropdown-item"]} ${sortKey === option.key ? styles.active : ""} ${
                    option.divider ? styles.divider : ""
                  }`}
                >
                  {option.label}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>

        <AnimatePresence>
          {dialogVisible && (
            <motion.div
              className={styles["column-dialog"]}
              variants={overlayVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
              onClick={() => setDialogVisible(false)}
            >
              <motion.div
                className={styles["column-dialog-card"]}
                variants={modalVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={springTransition}
                onClick={event => event.stopPropagation()}
              >
                <h3>列设置</h3>
                <div className={styles["column-settings-body"]}>
                  <div className={styles["column-settings-header"]}>
                    <span>列</span>
                    <span>操作</span>
                  </div>
                  <div className={styles["column-list"]}>
                    <AnimatePresence>
                      {editableColumns.map((col, index) => (
                        <motion.div
                          key={`${col.type}-${index}`}
                          className={styles["column-item"]}
                          layout
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={springTransition}
                        >
                          <span className={styles["column-name"]}>
                            {columnTypeMap.get(col.type as ColumnType)?.name}
                          </span>
                          <div className={styles["column-actions"]}>
                            {index > 0 && (
                              <button className={styles["action-icon"]} onClick={() => moveColumn(index, -1)}>
                                <RiArrowUpSLine />
                              </button>
                            )}
                            {index < editableColumns.length - 1 && (
                              <button className={styles["action-icon"]} onClick={() => moveColumn(index, 1)}>
                                <RiArrowDownSLine />
                              </button>
                            )}
                            <button
                              className={`${styles["action-icon"]} ${styles.danger}`}
                              onClick={() => removeColumn(index)}
                            >
                              <RiCloseLine />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <div className={styles["dialog-footer"]}>
                  <div className={styles["add-column-menu"]}>
                    <button className={styles["add-btn"]} onClick={() => setAddMenuOpen(!addMenuOpen)}>
                      <RiAddLine /> 添加列
                    </button>
                    <AnimatePresence>
                      {addMenuOpen && (
                        <motion.div
                          className={styles["add-column-dropdown"]}
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={normalTransition}
                        >
                          {availableColumnsToAdd.length ? (
                            availableColumnsToAdd.map(colType => (
                              <div
                                key={colType}
                                className={styles["dropdown-item"]}
                                onClick={() => addColumn(colType as ColumnType)}
                              >
                                {columnTypeMap.get(colType as ColumnType)?.name}
                              </div>
                            ))
                          ) : (
                            <div className={`${styles["dropdown-item"]} ${styles.disabled}`}>已添加所有列</div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className={styles["dialog-buttons"]}>
                    <button className={styles["cancel-btn"]} onClick={() => setDialogVisible(false)}>
                      取消
                    </button>
                    <button className={styles["confirm-btn"]} onClick={handleConfirm}>
                      确定
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

FileToolbar.displayName = "FileToolbar";
