"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiDeleteBin6Line,
  RiDownload2Line,
  RiEdit2Line,
  RiFileCopyLine,
  RiFolderOpenLine,
  RiFolderSettingsLine,
  RiHome2Line,
  RiInformationLine,
  RiLinkM,
  RiMore2Line,
  RiPriceTag3Line,
  RiShareLine,
} from "react-icons/ri";
import { addToast } from "@heroui/react";
import { extractLogicalPathFromUri } from "@/utils/file-manager";
import { Tooltip } from "@/components/ui/tooltip";
import { useRovingMenuNavigation } from "@/hooks/file-manager/use-roving-menu-navigation";
import { springTransition, contextMenuVariants, menuItemVariants } from "@/lib/motion";
import styles from "./FileBreadcrumb.module.css";

const BREADCRUMB_DROPDOWN_ACTION_LABELS = new Map([
  ["share", "分享"],
  ["rename", "重命名"],
  ["copy", "复制"],
  ["link", "获取直链"],
  ["tags", "标签"],
  ["organize", "整理"],
  ["more", "更多操作"],
]);

interface BreadcrumbDropdownRow {
  key: string;
  label: string;
  icon: React.ReactNode;
  divider?: boolean;
  danger?: boolean;
}

interface FileBreadcrumbDropdownMenuProps {
  menuId: string;
  items: BreadcrumbDropdownRow[];
  onItemSelect: (key: string) => void;
  onClose: () => void;
}

function FileBreadcrumbDropdownMenu({ menuId, items, onItemSelect, onClose }: FileBreadcrumbDropdownMenuProps) {
  const itemsRef = useRef(items);
  const onItemSelectRef = useRef(onItemSelect);
  useLayoutEffect(() => {
    itemsRef.current = items;
    onItemSelectRef.current = onItemSelect;
  }, [items, onItemSelect]);

  const onCommitFlat = useCallback((flat: number) => {
    const row = itemsRef.current[flat];
    if (row) onItemSelectRef.current(row.key);
  }, []);

  const { itemRefs, focusedDomIndex, handleKeyDown, setNavToFlat } = useRovingMenuNavigation({
    length: items.length,
    onClose,
    flatToRefIndex: i => i,
    onCommitFlat,
    escapeStopPropagation: true,
  });

  return (
    <motion.div
      id={menuId}
      className={styles["dropdown-menu"]}
      variants={contextMenuVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={springTransition}
      role="menu"
      aria-label="当前路径操作"
      aria-orientation="vertical"
    >
      {items.map((item, itemIndex) => (
        <motion.div
          key={item.key}
          variants={menuItemVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ ...springTransition, delay: itemIndex * 0.02 }}
          className={`${styles["dropdown-item"]} ${item.divider ? styles.divider : ""} ${
            item.danger ? styles["dropdown-danger"] : ""
          }`}
          ref={el => {
            itemRefs.current[itemIndex] = el;
          }}
          role="menuitem"
          tabIndex={focusedDomIndex === itemIndex ? 0 : -1}
          onMouseEnter={() => setNavToFlat(itemIndex)}
          onKeyDown={handleKeyDown}
          onClick={() => onItemSelect(item.key)}
        >
          <span className={styles["dropdown-icon"]}>{item.icon}</span>
          <span>{item.label}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}

interface FileBreadcrumbProps {
  path: string;
  parentInfo?: { id: string; name: string } | null;
  showDropdown?: boolean;
  onNavigate: (path: string) => void;
  onShowDetails: (id: string) => void;
  onDownloadFolder: (id: string) => void;
  onDeleteFolder?: (id: string) => void;
}

export function FileBreadcrumb({
  path,
  parentInfo,
  showDropdown = true,
  onNavigate,
  onShowDetails,
  onDownloadFolder,
  onDeleteFolder,
}: FileBreadcrumbProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pathInput, setPathInput] = useState(path);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownOpenGeneration, setDropdownOpenGeneration] = useState(0);
  const pathDropdownMenuId = useId();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    setPathInput(path);
  }, [path]);

  useEffect(() => {
    if (!dropdownVisible) return;
    const onClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownVisible(false);
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [dropdownVisible]);

  const closeDropdown = useCallback(() => {
    setDropdownVisible(false);
  }, []);

  const pathSegments = useMemo(() => {
    const logicalPath = extractLogicalPathFromUri(path || "/");
    if (logicalPath === "/") {
      return [{ name: "我的文件", path: "/" }];
    }
    const segments = logicalPath.split("/").filter(Boolean);
    const result = [{ name: "我的文件", path: "/" }];
    let cumulativePath = "";
    for (const segment of segments) {
      cumulativePath += `/${segment}`;
      result.push({ name: segment, path: cumulativePath });
    }
    return result;
  }, [path]);

  const handleNavigate = useCallback(
    (target: string) => {
      const logicalPath = extractLogicalPathFromUri(target);
      if (logicalPath === path && logicalPath !== "/") return;
      onNavigate(logicalPath);
    },
    [path, onNavigate]
  );

  const handleSubmit = () => {
    let finalPath = pathInput.trim();
    finalPath = extractLogicalPathFromUri(finalPath);
    if (finalPath.length > 1 && finalPath.endsWith("/")) {
      finalPath = finalPath.slice(0, -1);
    }
    if (!finalPath.startsWith("/")) {
      finalPath = `/${finalPath}`;
    }
    setIsEditing(false);
    if (finalPath === path) return;
    handleNavigate(finalPath);
  };

  const handleSwitchToEditMode = () => {
    if (dropdownVisible) return;
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleDropdownAction = useCallback(
    (action: string) => {
      const parentId = parentInfo?.id;
      switch (action) {
        case "enter":
          handleNavigate(path);
          break;
        case "download":
          if (!parentId) {
            addToast({ title: "无法获取当前目录信息", color: "warning", timeout: 3000 });
            break;
          }
          onDownloadFolder(parentId);
          break;
        case "info":
          if (!parentId) {
            addToast({ title: "无法获取当前目录信息", color: "warning", timeout: 3000 });
            break;
          }
          onShowDetails(parentId);
          break;
        case "delete":
          if (!parentId) {
            addToast({ title: "无法获取当前目录信息", color: "warning", timeout: 3000 });
            break;
          }
          if (onDeleteFolder) {
            onDeleteFolder(parentId);
          } else {
            addToast({ title: "删除操作应由父组件处理", color: "warning", timeout: 3000 });
          }
          break;
        case "share":
        case "rename":
        case "copy":
        case "link":
        case "tags":
        case "organize":
        case "more":
          addToast({
            title: `功能「${BREADCRUMB_DROPDOWN_ACTION_LABELS.get(action) ?? action}」正在开发中`,
            color: "default",
            timeout: 3000,
          });
          break;
        default:
          break;
      }
      setDropdownVisible(false);
    },
    [handleNavigate, onDeleteFolder, onDownloadFolder, onShowDetails, parentInfo?.id, path]
  );

  const dropdownItems = useMemo<BreadcrumbDropdownRow[]>(
    () => [
      { key: "enter", label: "进入", icon: <RiFolderOpenLine /> },
      { key: "download", label: "下载", icon: <RiDownload2Line /> },
      { key: "share", label: "分享", icon: <RiShareLine /> },
      { key: "rename", label: "重命名", icon: <RiEdit2Line /> },
      { key: "copy", label: "复制", icon: <RiFileCopyLine /> },
      { key: "link", label: "获取直链", icon: <RiLinkM /> },
      { key: "tags", label: "标签", icon: <RiPriceTag3Line />, divider: true },
      { key: "organize", label: "整理", icon: <RiFolderSettingsLine /> },
      { key: "more", label: "更多操作", icon: <RiMore2Line /> },
      { key: "info", label: "详细信息", icon: <RiInformationLine />, divider: true },
      { key: "delete", label: "删除", icon: <RiDeleteBin6Line />, danger: true },
    ],
    []
  );

  return (
    <div className={styles["file-breadcrumb-wrapper"]} onClick={handleSwitchToEditMode}>
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="input-mode"
            className={styles["input-mode"]}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Tooltip content="返回根目录" placement="bottom" showArrow={false}>
              <RiHome2Line
                className={styles["home-icon"]}
                onClick={event => {
                  event.stopPropagation();
                  handleNavigate("/");
                }}
              />
            </Tooltip>
            <input
              ref={inputRef}
              className={styles["path-input"]}
              value={pathInput}
              onChange={event => setPathInput(event.target.value)}
              placeholder="请输入绝对路径后按 Enter"
              onBlur={handleSubmit}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="breadcrumb-mode"
            className={styles["file-breadcrumb"]}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Tooltip content="返回根目录" placement="bottom" showArrow={false}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <RiHome2Line
                  className={styles["home-icon"]}
                  onClick={event => {
                    event.stopPropagation();
                    handleNavigate("/");
                  }}
                />
              </motion.div>
            </Tooltip>
            <div className={styles["breadcrumb-list"]}>
              <AnimatePresence mode="popLayout">
                {pathSegments.map((segment, index) => {
                  const isLast = index === pathSegments.length - 1 && pathSegments.length > 1;
                  return (
                    <motion.div
                      key={segment.path}
                      className={styles["breadcrumb-item"]}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={springTransition}
                      layout
                    >
                      {isLast && showDropdown ? (
                        <div
                          className={styles["dropdown-trigger"]}
                          role="button"
                          tabIndex={0}
                          aria-haspopup="menu"
                          aria-expanded={dropdownVisible}
                          aria-controls={pathDropdownMenuId}
                          onClick={event => {
                            event.stopPropagation();
                            if (!dropdownVisible) {
                              setDropdownOpenGeneration(g => g + 1);
                            }
                            setDropdownVisible(v => !v);
                          }}
                          onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              if (!dropdownVisible) {
                                setDropdownOpenGeneration(g => g + 1);
                              }
                              setDropdownVisible(v => !v);
                            }
                          }}
                          ref={dropdownRef}
                        >
                          <span>{segment.name}</span>
                          <motion.span animate={{ rotate: dropdownVisible ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <RiArrowDownSLine />
                          </motion.span>
                          <AnimatePresence>
                            {dropdownVisible ? (
                              <FileBreadcrumbDropdownMenu
                                key={dropdownOpenGeneration}
                                menuId={pathDropdownMenuId}
                                items={dropdownItems}
                                onItemSelect={handleDropdownAction}
                                onClose={closeDropdown}
                              />
                            ) : null}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <span
                          className={styles["breadcrumb-link"]}
                          onClick={event => {
                            event.stopPropagation();
                            handleNavigate(segment.path);
                          }}
                        >
                          {segment.name}
                        </span>
                      )}
                      {index < pathSegments.length - 1 ? (
                        <RiArrowRightSLine className={styles["breadcrumb-separator"]} />
                      ) : null}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
