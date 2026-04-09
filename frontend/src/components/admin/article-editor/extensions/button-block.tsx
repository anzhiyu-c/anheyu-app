/**
 * ButtonBlock 扩展
 * 按钮和按钮组节点
 * 图标使用 Iconify 格式存储，编辑器中用 <Icon> 渲染
 * 输出 HTML 中 FA 图标转为 <i class="fa-solid fa-xx">
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";
import { Pencil } from "lucide-react";

// ---- 类型 ----
interface ButtonGroupItem {
  icon?: string;
  title: string;
  url: string;
  desc?: string;
  color?: string;
}

// ---- 图标格式转换 ----

/** FA class → Iconify：`fa-solid fa-plus` → `fa6-solid:plus` */
function faClassToIconify(fa: string): string {
  if (!fa) return "";
  if (fa.includes(":")) return fa; // 已经是 Iconify 格式
  const parts = fa.trim().split(/\s+/);
  if (parts.length < 2) return fa;
  const prefix = parts[0].replace("fa-", "fa6-");
  const name = parts
    .slice(1)
    .map(p => p.replace(/^fa-/, ""))
    .join("-");
  return `${prefix}:${name}`;
}

/** Iconify → FA class：`fa6-solid:plus` → `fa-solid fa-plus` */
function iconifyToFaClass(iconify: string): string {
  if (!iconify) return "";
  if (!iconify.startsWith("fa6-")) return ""; // 非 FA 图标
  const [prefix, name] = iconify.split(":");
  if (!name) return "";
  return `${prefix.replace("fa6-", "fa-")} fa-${name}`;
}

/** 判断是否为 FA 图标 */
function isFaIcon(icon: string): boolean {
  return icon.startsWith("fa6-") || icon.startsWith("fa-");
}

// ---- 颜色 ----
const COLORS = [
  { key: "", label: "主题色", hex: "var(--anzhiyu-theme, #4259ef)" },
  { key: "blue", label: "蓝色", hex: "#409eff" },
  { key: "pink", label: "粉色", hex: "#ff69b4" },
  { key: "red", label: "红色", hex: "#f56c6c" },
  { key: "purple", label: "紫色", hex: "#9d5cff" },
  { key: "orange", label: "橙色", hex: "#ff9800" },
  { key: "green", label: "绿色", hex: "#67c23a" },
];

// ---- 图标选择器 ----

/** 常用推荐图标（Iconify 格式） */
const PRESET_ICONS: { label: string; icons: string[] }[] = [
  {
    label: "常用",
    icons: [
      "fa6-solid:link",
      "fa6-solid:arrow-right",
      "fa6-solid:arrow-up-right-from-square",
      "fa6-solid:download",
      "fa6-solid:play",
      "fa6-solid:star",
      "fa6-solid:heart",
      "fa6-solid:bookmark",
      "fa6-solid:share-nodes",
      "fa6-solid:eye",
      "fa6-solid:pen",
      "fa6-solid:plus",
      "fa6-solid:circle-info",
      "fa6-solid:circle-check",
      "fa6-solid:triangle-exclamation",
      "fa6-solid:lightbulb",
      "fa6-solid:bell",
      "fa6-solid:lock",
      "fa6-solid:book",
      "fa6-solid:image",
      "fa6-solid:video",
      "fa6-solid:music",
      "fa6-solid:code",
      "fa6-solid:file",
    ],
  },
  {
    label: "社交",
    icons: [
      "fa6-brands:github",
      "fa6-brands:twitter",
      "fa6-brands:weixin",
      "fa6-brands:qq",
      "fa6-brands:bilibili",
      "fa6-brands:weibo",
      "fa6-brands:youtube",
      "fa6-brands:discord",
      "fa6-brands:telegram",
      "fa6-brands:tiktok",
      "fa6-brands:instagram",
      "fa6-brands:facebook",
    ],
  },
  {
    label: "装饰",
    icons: [
      "fa6-solid:bolt",
      "fa6-solid:fire",
      "fa6-solid:rocket",
      "fa6-solid:gift",
      "fa6-solid:crown",
      "fa6-solid:wand-magic-sparkles",
      "fa6-solid:globe",
      "fa6-solid:paper-plane",
      "fa6-solid:house",
      "fa6-solid:gear",
      "fa6-solid:user",
      "fa6-solid:envelope",
    ],
  },
];

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(0);
  const [apiResults, setApiResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as globalThis.Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Iconify API 搜索（防抖）
  const doSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setApiResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    fetch(`https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=60`)
      .then(r => r.json())
      .then(data => {
        setApiResults(data.icons || []);
        setSearching(false);
      })
      .catch(() => {
        setSearching(false);
      });
  }, []);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  // 清理防抖
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const isSearching = search.trim().length > 0;
  const presetCategory = PRESET_ICONS[tab];
  const displayIcons = isSearching ? apiResults : (presetCategory?.icons ?? []);

  const selectIcon = (icon: string) => {
    onChange(icon);
    setOpen(false);
    setSearch("");
    setApiResults([]);
  };

  return (
    <div className="editor-btn-field" ref={pickerRef}>
      <span className="editor-btn-label">图标</span>
      <button type="button" className="editor-icon-trigger" onClick={() => setOpen(!open)}>
        {value ? (
          <span className="editor-icon-trigger-preview">
            <Icon icon={value} width={16} height={16} />
            <span className="editor-icon-trigger-text">{value}</span>
          </span>
        ) : (
          <span className="editor-icon-trigger-placeholder">选择图标（可选）</span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="editor-icon-trigger-arrow">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="editor-icon-dropdown">
          {/* 搜索框 */}
          <div className="editor-icon-search-bar">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ flexShrink: 0, opacity: 0.4 }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="editor-icon-search-input"
              placeholder="搜索全部图标（支持英文，如 arrow, home, star ...）"
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="editor-icon-mode-btn"
                onClick={() => {
                  setSearch("");
                  setApiResults([]);
                }}
                title="清除搜索"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* 分类标签 - 仅在未搜索时显示 */}
          {!isSearching && (
            <div className="editor-icon-tabs">
              {PRESET_ICONS.map((cat, i) => (
                <button
                  key={cat.label}
                  type="button"
                  className={`editor-icon-tab ${tab === i ? "is-active" : ""}`}
                  onClick={() => setTab(i)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* 搜索提示 */}
          {isSearching && !searching && apiResults.length > 0 && (
            <div className="editor-icon-search-hint">找到 {apiResults.length} 个图标</div>
          )}

          {/* 图标网格 */}
          <div className="editor-icon-grid">
            {/* 无图标选项 */}
            <button
              type="button"
              className={`editor-icon-item ${!value ? "is-active" : ""}`}
              onClick={() => selectIcon("")}
              title="无图标"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                opacity={0.3}
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {displayIcons.map(ic => (
              <button
                key={ic}
                type="button"
                className={`editor-icon-item ${value === ic ? "is-active" : ""}`}
                onClick={() => selectIcon(ic)}
                title={ic}
              >
                <Icon icon={ic} width={18} height={18} />
              </button>
            ))}

            {/* 加载中 */}
            {searching && (
              <div className="editor-icon-empty">
                <span className="animate-pulse">搜索中...</span>
              </div>
            )}

            {/* 无结果 */}
            {isSearching && !searching && apiResults.length === 0 && (
              <div className="editor-icon-empty">未找到相关图标，试试其他英文关键词</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 在编辑器中渲染图标（统一用 Iconify <Icon> 组件） */
function RenderIcon({ icon, className }: { icon: string; className?: string }) {
  if (!icon) return null;
  return <Icon icon={icon} className={className} style={{ display: "inline-block", verticalAlign: "-0.125em" }} />;
}

// ---- 按钮 NodeView ----
function ButtonBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // 进入编辑模式时，释放编辑器焦点防止节点被全选
  const enterEditing = useCallback(() => {
    setEditing(true);
    editor.commands.blur();
  }, [editor]);

  const type = (node.attrs.type as string) || "single";
  const url = (node.attrs.url as string) || "";
  const text = (node.attrs.text as string) || "";
  const icon = (node.attrs.icon as string) || "";
  const color = (node.attrs.color as string) || "";
  const btnStyle = (node.attrs.style as string) || "default";
  const size = (node.attrs.size as string) || "default";
  const cols = parseInt((node.attrs.cols as string) || "3", 10);
  const groupStyle = (node.attrs.groupStyle as string) || "default";
  const itemsRaw = (node.attrs.items as string) || "[]";

  let items: ButtonGroupItem[] = [];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as globalThis.Node)) setEditing(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing]);

  const buildBtnClass = (c?: string, s?: string, sz?: string) => {
    const p = ["btn-anzhiyu"];
    if (c) p.push(`btn-${c}`);
    if (s === "outline") p.push("btn-outline");
    if (sz === "larger") p.push("btn-larger");
    return p.join("");
  };

  // ---- 编辑：单按钮 ----
  if (editing && type === "single") {
    return (
      <NodeViewWrapper className="button-block-wrapper my-3">
        <div ref={panelRef} className="editor-btn-edit-panel" contentEditable={false}>
          <div className="editor-btn-header">
            <span className="editor-btn-title">编辑按钮</span>
            <button type="button" className="editor-btn-done" onClick={() => setEditing(false)}>
              完成
            </button>
          </div>

          <div className="editor-btn-preview-area">
            <span className={buildBtnClass(color, btnStyle, size)}>
              <RenderIcon icon={icon} />
              {text || "按钮"}
            </span>
          </div>

          <div className="editor-btn-form">
            <div className="editor-btn-row">
              <label className="editor-btn-field">
                <span className="editor-btn-label">按钮文字</span>
                <input
                  value={text}
                  onChange={e => updateAttributes({ text: e.target.value })}
                  className="editor-btn-input"
                  placeholder="按钮"
                />
              </label>
              <label className="editor-btn-field">
                <span className="editor-btn-label">链接地址</span>
                <input
                  value={url}
                  onChange={e => updateAttributes({ url: e.target.value })}
                  className="editor-btn-input"
                  placeholder="https://..."
                />
              </label>
            </div>

            <IconPicker value={icon} onChange={v => updateAttributes({ icon: v })} />

            <div className="editor-btn-field">
              <span className="editor-btn-label">颜色</span>
              <div className="editor-btn-color-list">
                {COLORS.map(c => (
                  <button
                    key={c.key}
                    type="button"
                    className={`editor-btn-color-dot ${color === c.key ? "is-active" : ""}`}
                    style={{ background: c.hex }}
                    onClick={() => updateAttributes({ color: c.key })}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="editor-btn-row">
              <div className="editor-btn-field">
                <span className="editor-btn-label">样式</span>
                <div className="editor-btn-toggle-group">
                  <button
                    type="button"
                    className={`editor-btn-toggle ${btnStyle === "default" ? "is-active" : ""}`}
                    onClick={() => updateAttributes({ style: "default" })}
                  >
                    填充
                  </button>
                  <button
                    type="button"
                    className={`editor-btn-toggle ${btnStyle === "outline" ? "is-active" : ""}`}
                    onClick={() => updateAttributes({ style: "outline" })}
                  >
                    描边
                  </button>
                </div>
              </div>
              <div className="editor-btn-field">
                <span className="editor-btn-label">大小</span>
                <div className="editor-btn-toggle-group">
                  <button
                    type="button"
                    className={`editor-btn-toggle ${size === "default" ? "is-active" : ""}`}
                    onClick={() => updateAttributes({ size: "default" })}
                  >
                    默认
                  </button>
                  <button
                    type="button"
                    className={`editor-btn-toggle ${size === "larger" ? "is-active" : ""}`}
                    onClick={() => updateAttributes({ size: "larger" })}
                  >
                    大号
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  /** 更新按钮组中某一项 */
  const updateItem = (index: number, field: string, value: string) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    updateAttributes({ items: JSON.stringify(next) });
  };

  /** 添加一项 */
  const addItem = () => {
    const next = [...items, { icon: "", title: `按钮 ${items.length + 1}`, url: "#", desc: "", color: "" }];
    updateAttributes({ items: JSON.stringify(next) });
  };

  /** 删除一项 */
  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    updateAttributes({ items: JSON.stringify(next) });
  };

  // ---- 编辑：按钮组 ----
  if (editing && type === "group") {
    return (
      <NodeViewWrapper className="button-block-wrapper my-3">
        <div ref={panelRef} className="editor-btn-edit-panel" contentEditable={false}>
          <div className="editor-btn-header">
            <span className="editor-btn-title">编辑按钮组</span>
            <button type="button" className="editor-btn-done" onClick={() => setEditing(false)}>
              完成
            </button>
          </div>

          {/* 实时预览 */}
          <div className="editor-btn-preview-area">
            <div
              className={`btns-container btns-cols-${cols}${
                groupStyle !== "default" ? ` btns-style-${groupStyle}` : ""
              }`}
              style={{ width: "100%" }}
            >
              {items.map((item, i) => (
                <a key={i} className={`btn-item${item.color ? ` btn-color-${item.color}` : ""}`} href={item.url || "#"}>
                  {item.icon && (
                    <span className="btn-icon">
                      <RenderIcon icon={item.icon} />
                    </span>
                  )}
                  <span className="btn-title">{item.title || "按钮"}</span>
                  {item.desc && <span className="btn-desc">{item.desc}</span>}
                </a>
              ))}
            </div>
          </div>

          <div className="editor-btn-form">
            {/* 列数 + 组样式 */}
            <div className="editor-btn-row">
              <label className="editor-btn-field">
                <span className="editor-btn-label">列数</span>
                <select
                  value={cols}
                  onChange={e => updateAttributes({ cols: e.target.value })}
                  className="editor-btn-input"
                >
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>
                      {n} 列
                    </option>
                  ))}
                </select>
              </label>
              <label className="editor-btn-field">
                <span className="editor-btn-label">组样式</span>
                <select
                  value={groupStyle}
                  onChange={e => updateAttributes({ groupStyle: e.target.value })}
                  className="editor-btn-input"
                >
                  <option value="default">默认</option>
                  <option value="card">卡片</option>
                  <option value="simple">简洁</option>
                </select>
              </label>
            </div>

            {/* 逐项编辑 */}
            <div className="editor-btn-field">
              <span className="editor-btn-label">按钮项（{items.length} 个）</span>
              <div className="editor-btngroup-items">
                {items.map((item, i) => (
                  <div key={i} className="editor-btngroup-item">
                    <div className="editor-btngroup-item-header">
                      <span className="editor-btngroup-item-index">{i + 1}</span>
                      <button
                        type="button"
                        className="editor-btngroup-item-remove"
                        onClick={() => removeItem(i)}
                        title="删除此项"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <div className="editor-btngroup-item-fields">
                      <div className="editor-btn-row">
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">标题</span>
                          <input
                            value={item.title}
                            onChange={e => updateItem(i, "title", e.target.value)}
                            className="editor-btn-input"
                            placeholder="按钮标题"
                          />
                        </label>
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">链接</span>
                          <input
                            value={item.url}
                            onChange={e => updateItem(i, "url", e.target.value)}
                            className="editor-btn-input"
                            placeholder="https://..."
                          />
                        </label>
                      </div>
                      <div className="editor-btn-row">
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">图标（Iconify）</span>
                          <input
                            value={item.icon || ""}
                            onChange={e => updateItem(i, "icon", e.target.value)}
                            className="editor-btn-input"
                            placeholder="fa6-solid:link"
                          />
                        </label>
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">描述</span>
                          <input
                            value={item.desc || ""}
                            onChange={e => updateItem(i, "desc", e.target.value)}
                            className="editor-btn-input"
                            placeholder="简短描述（可选）"
                          />
                        </label>
                      </div>
                      {/* 颜色选择 */}
                      <div className="editor-btn-field">
                        <span className="editor-btn-label">颜色</span>
                        <div className="editor-btn-color-list">
                          {COLORS.map(c => (
                            <button
                              key={c.key}
                              type="button"
                              className={`editor-btn-color-dot editor-btn-color-dot-sm ${
                                (item.color || "") === c.key ? "is-active" : ""
                              }`}
                              style={{ background: c.hex }}
                              onClick={() => updateItem(i, "color", c.key)}
                              title={c.label}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* 添加按钮 */}
              <button type="button" className="editor-btngroup-add" onClick={addItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                添加按钮项
              </button>
            </div>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  // ---- 预览：单按钮 ----
  if (type === "single") {
    return (
      <NodeViewWrapper className="button-block-wrapper my-3" data-type="single">
        <div className="editor-node-hover-wrap" contentEditable={false}>
          <div
            className="editor-node-edit-btn"
            onClick={e => {
              e.stopPropagation();
              enterEditing();
            }}
            contentEditable={false}
          >
            <Pencil /> 编辑
          </div>
          <div className="editor-btn-preview-wrap">
            <span className={buildBtnClass(color, btnStyle, size)}>
              <RenderIcon icon={icon} />
              {text || "按钮"}
            </span>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  // ---- 预览：按钮组 ----
  return (
    <NodeViewWrapper className="button-block-wrapper my-3" data-type="group">
      <div className="editor-node-hover-wrap" contentEditable={false}>
        <div
          className="editor-node-edit-btn"
          onClick={e => {
            e.stopPropagation();
            enterEditing();
          }}
          contentEditable={false}
        >
          <Pencil /> 编辑
        </div>
        <div className="editor-btn-preview-wrap">
          <div
            className={`btns-container btns-cols-${cols}${groupStyle !== "default" ? ` btns-style-${groupStyle}` : ""}`}
          >
            {items.length > 0 ? (
              items.map((item, i) => (
                <a key={i} className={`btn-item${item.color ? ` btn-color-${item.color}` : ""}`} href={item.url || "#"}>
                  {item.icon && (
                    <span className="btn-icon">
                      <RenderIcon icon={item.icon} />
                    </span>
                  )}
                  <span className="btn-title">{item.title || "按钮"}</span>
                  {item.desc && <span className="btn-desc">{item.desc}</span>}
                </a>
              ))
            ) : (
              <div className="text-sm text-muted-foreground/40 col-span-full text-center py-4">空按钮组 - 点击编辑</div>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---- 命令类型 ----
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    buttonBlock: {
      insertButton: (attrs?: {
        url?: string;
        text?: string;
        icon?: string;
        color?: string;
        style?: string;
        size?: string;
      }) => ReturnType;
      insertButtonGroup: (attrs?: { cols?: number; groupStyle?: string; items?: string }) => ReturnType;
    };
  }
}

// ---- Tiptap 扩展 ----
export const ButtonBlock = Node.create({
  name: "buttonBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      type: { default: "single" },
      url: { default: "" },
      text: { default: "按钮" },
      icon: { default: "" }, // Iconify 格式，如 "fa6-solid:plus"
      color: { default: "blue" },
      style: { default: "default" },
      size: { default: "default" },
      cols: { default: "3" },
      groupStyle: { default: "default" },
      items: { default: "[]" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.btns-container",
        priority: 60,
        getAttrs: (el: HTMLElement) => {
          const links = el.querySelectorAll("a.btn-anzhiyu");
          const groupItems: ButtonGroupItem[] = [];
          links.forEach(a => {
            const anchor = a as HTMLAnchorElement;
            const faClass = anchor.querySelector("i")?.className || "";
            groupItems.push({
              icon: faClass ? faClassToIconify(faClass) : "",
              title: anchor.textContent?.trim() || "",
              url: anchor.getAttribute("href") || "",
              desc: anchor.getAttribute("data-desc") || "",
              color: anchor.getAttribute("data-color") || "",
            });
          });
          const classList = el.className || "";
          const colsMatch = classList.match(/btns-cols-(\d)/);
          const styleMatch = classList.match(/btns-style-(card|simple)/);
          return {
            type: "group",
            cols: colsMatch ? colsMatch[1] : "3",
            groupStyle: styleMatch ? styleMatch[1] : "default",
            items: JSON.stringify(groupItems),
          };
        },
      },
      {
        tag: "div.btn-container",
        priority: 51,
        getAttrs: (el: HTMLElement) => {
          const a = el.querySelector("a.btn-anzhiyu") as HTMLAnchorElement | null;
          if (!a) return false;
          const faClass = a.querySelector("i")?.className || "";
          return {
            type: "single",
            url: a.getAttribute("href") || "",
            text: a.textContent?.trim() || "",
            icon: faClass ? faClassToIconify(faClass) : "",
            color: a.getAttribute("data-color") || "blue",
            style: a.classList.contains("btn-outline") ? "outline" : "default",
            size: a.classList.contains("btn-larger") ? "larger" : "default",
          };
        },
      },
      {
        tag: "a.btn-anzhiyu",
        priority: 50,
        getAttrs: (el: HTMLElement) => {
          const a = el as HTMLAnchorElement;
          const faClass = a.querySelector("i")?.className || "";
          return {
            type: "single",
            url: a.getAttribute("href") || "",
            text: a.textContent?.trim() || "",
            icon: faClass ? faClassToIconify(faClass) : "",
            color: a.getAttribute("data-color") || "blue",
            style: a.classList.contains("btn-outline") ? "outline" : "default",
            size: a.classList.contains("btn-larger") ? "larger" : "default",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = (node.attrs.type as string) || "single";

    if (type === "group") {
      const cols = (node.attrs.cols as string) || "3";
      const gStyle = (node.attrs.groupStyle as string) || "default";
      let items: ButtonGroupItem[] = [];
      try {
        items = JSON.parse((node.attrs.items as string) || "[]");
      } catch {
        items = [];
      }
      const containerClass = ["btns-container", `btns-cols-${cols}`, gStyle !== "default" ? `btns-style-${gStyle}` : ""]
        .filter(Boolean)
        .join("");
      const children = items.map(item => {
        const la: Record<string, string> = { class: "btn-anzhiyu", href: item.url || "#" };
        if (item.color) la["data-color"] = item.color;
        if (item.desc) la["data-desc"] = item.desc;
        if (item.icon) {
          const faClass = isFaIcon(item.icon) ? iconifyToFaClass(item.icon) : item.icon;
          return ["a", la, ["i", { class: faClass }], ` ${item.title}`];
        }
        return ["a", la, item.title || "按钮"];
      });
      return ["div", mergeAttributes(HTMLAttributes, { class: containerClass }), ...children];
    }

    const urlVal = (node.attrs.url as string) || "#";
    const textVal = (node.attrs.text as string) || "按钮";
    const iconVal = (node.attrs.icon as string) || "";
    const colorVal = (node.attrs.color as string) || "blue";
    const styleVal = (node.attrs.style as string) || "default";
    const sizeVal = (node.attrs.size as string) || "default";

    const linkClass = [
      "btn-anzhiyu",
      styleVal === "outline" ? "btn-outline" : "",
      sizeVal === "larger" ? "btn-larger" : "",
    ]
      .filter(Boolean)
      .join("");
    const la: Record<string, string> = { class: linkClass, href: urlVal };
    if (colorVal) la["data-color"] = colorVal;

    if (iconVal) {
      const faClass = isFaIcon(iconVal) ? iconifyToFaClass(iconVal) : iconVal;
      return ["a", mergeAttributes(HTMLAttributes, la), ["i", { class: faClass }], ` ${textVal}`];
    }
    return ["a", mergeAttributes(HTMLAttributes, la), textVal];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ButtonBlockView);
  },

  addCommands() {
    return {
      insertButton:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              type: "single",
              url: attrs.url ?? "",
              text: attrs.text ?? "按钮",
              icon: attrs.icon ?? "",
              color: attrs.color ?? "blue",
              style: attrs.style ?? "default",
              size: attrs.size ?? "default",
            },
          }),
      insertButtonGroup:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              type: "group",
              cols: String(attrs?.cols ?? 3),
              groupStyle: attrs?.groupStyle ?? "default",
              items:
                attrs?.items ??
                JSON.stringify([
                  { icon: "", title: "按钮 1", url: "#" },
                  { icon: "", title: "按钮 2", url: "#" },
                ]),
            },
          }),
    };
  },
});
