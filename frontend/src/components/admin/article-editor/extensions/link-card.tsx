"use client";

/**
 * LinkCard 扩展
 * 链接卡片节点，样式与文章详情一致
 * 支持 Iconify 格式图标、图片 URL 图标、默认链接图标
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { Pencil } from "lucide-react";
import { FormIconSelector } from "@/components/ui/form-icon-selector";

const DEFAULT_LINK_ICON = "rivet-icons:link";
const FA6_ARROW_ICON = "fa6-solid:angle-right";

/** 判断是否为 Iconify 格式（包含 ":"） */
function isIconifyIcon(icon: string): boolean {
  return !!icon && icon.includes(":");
}

/** 判断是否为图片 URL */
function isImageUrl(icon: string): boolean {
  return !!icon && (icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/"));
}

/** 兼容旧 anzhiyufont 图标命名，统一映射到 fa6 图标 */
function normalizeLegacyIconName(icon: string): string {
  const value = icon.trim();
  if (!value) return DEFAULT_LINK_ICON;
  if (value === "anzhiyu-icon-angle-right") return FA6_ARROW_ICON;
  if (value.startsWith("anzhiyu-icon-")) return DEFAULT_LINK_ICON;
  return value;
}

/** 解析为可用的 Iconify 图标名（非 Iconify 时走 fallback） */
function resolveIconifyName(icon: string, fallback: string): string {
  const normalized = normalizeLegacyIconName(icon);
  return isIconifyIcon(normalized) ? normalized : fallback;
}

/** 将 Iconify 名称转换为可直出的 SVG URL */
function toIconifySvgUrl(iconifyName: string): string {
  const [prefix, name] = iconifyName.split(":");
  if (!prefix || !name) return "";
  return `https://api.iconify.design/${prefix}/${name}.svg?color=currentColor`;
}

/** 渲染图标：支持 Iconify、图片 URL、默认链接图标 */
function CardIcon({ icon }: { icon: string }) {
  if (icon && isImageUrl(icon)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt=""
        onError={e => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  const iconifyName = resolveIconifyName(icon, DEFAULT_LINK_ICON);
  return (
    <Icon
      icon={iconifyName}
      width={28}
      height={28}
      style={{ color: "var(--anzhiyu-fontcolor, var(--foreground))" }}
    />
  );
}

// ---- React NodeView 组件 ----
function LinkCardView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const url = (node.attrs.url as string) || "";
  const title = (node.attrs.title as string) || "";
  const sitename = (node.attrs.sitename as string) || "";
  const icon = (node.attrs.icon as string) || "";
  const tips = (node.attrs.tips as string) || "";

  const displayTips = tips || "引用站外地址";
  const displaySitename = sitename || "网站名称";
  const hasLink = Boolean(url?.trim());

  // 点击外部关闭编辑
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-form-icon-selector-popover="true"]')) {
        return;
      }
      if (panelRef.current && target && !panelRef.current.contains(target)) {
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing]);

  if (editing) {
    return (
      <NodeViewWrapper className="link-card-wrapper my-3">
        <div ref={panelRef} className="editor-linkcard-edit-panel" contentEditable={false}>
          <div className="editor-btn-header">
            <span className="editor-btn-title">编辑链接卡片</span>
            <button type="button" className="editor-btn-done" onClick={() => setEditing(false)}>
              完成
            </button>
          </div>

          {/* 实时预览 */}
          <div className="editor-linkcard-preview">
            <div className="anzhiyu-tag-link">
              <div className="tag-Link">
                <div className="tag-link-tips">{displayTips}</div>
                <div className="tag-link-bottom">
                  <div className="tag-link-left">
                    <CardIcon icon={icon} />
                  </div>
                <div className="tag-link-right">
                  <div className="tag-link-title">{title || url || "链接标题"}</div>
                  <div className="tag-link-sitename">{displaySitename}</div>
                </div>
                <Icon icon={FA6_ARROW_ICON} width={18} height={18} className="tag-link-arrow-icon" aria-hidden="true" />
              </div>
            </div>
          </div>
          </div>

          {/* 表单 */}
          <div className="editor-btn-form">
            <div className="editor-btn-row">
              <label className="editor-btn-field">
                <span className="editor-btn-label">链接地址</span>
                <input
                  value={url}
                  onChange={e => updateAttributes({ url: e.target.value })}
                  className="editor-btn-input"
                  placeholder="https://example.com"
                  autoFocus
                />
              </label>
              <label className="editor-btn-field">
                <span className="editor-btn-label">标题</span>
                <input
                  value={title}
                  onChange={e => updateAttributes({ title: e.target.value })}
                  className="editor-btn-input"
                  placeholder="网站标题"
                />
              </label>
            </div>
            <div className="editor-btn-row">
              <label className="editor-btn-field">
                <span className="editor-btn-label">站点名</span>
                <input
                  value={sitename}
                  onChange={e => updateAttributes({ sitename: e.target.value })}
                  className="editor-btn-input"
                  placeholder="站点名称"
                />
              </label>
              <label className="editor-btn-field">
                <span className="editor-btn-label">提示文字</span>
                <input
                  value={tips}
                  onChange={e => updateAttributes({ tips: e.target.value })}
                  className="editor-btn-input"
                  placeholder="引用站外地址"
                />
              </label>
            </div>
            <div className="editor-btn-field">
              <span className="editor-btn-label">图标（Iconify 格式或图片 URL）</span>
              <FormIconSelector
                value={icon}
                onValueChange={value => updateAttributes({ icon: value.trim() })}
                className="editor-btn-icon-selector"
                placeholder="搜索图标，或输入 rivet-icons:link / https://... / /icons/..."
                size="sm"
              />
              <span className="editor-btn-helper">支持 Iconify 全量搜索、URL 图标，或直接输入 prefix:name</span>
            </div>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  // ---- 预览模式 ----
  return (
    <NodeViewWrapper className="link-card-wrapper my-3">
      <div className="editor-node-hover-wrap" contentEditable={false}>
        <div
          className="editor-node-edit-btn"
          onClick={e => {
            e.stopPropagation();
            setEditing(true);
          }}
          contentEditable={false}
        >
          <Pencil /> 编辑
        </div>
        <div className="anzhiyu-tag-link" contentEditable={false}>
          {hasLink ? (
            <a
              className="tag-Link"
              href={url.trim()}
              target="_blank"
              rel="noopener noreferrer"
              contentEditable={false}
              onMouseDown={e => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="tag-link-tips">{displayTips}</div>
              <div className="tag-link-bottom">
                <div className="tag-link-left">
                  <CardIcon icon={icon} />
                </div>
                <div className="tag-link-right">
                  <div className="tag-link-title">{title || url || "链接卡片"}</div>
                  <div className="tag-link-sitename">{displaySitename}</div>
                </div>
                <Icon icon={FA6_ARROW_ICON} width={18} height={18} className="tag-link-arrow-icon" aria-hidden="true" />
              </div>
            </a>
          ) : (
            <div
              className="tag-Link tag-Link--no-link"
              contentEditable={false}
              onMouseDown={e => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <div className="tag-link-tips">{displayTips}</div>
              <div className="tag-link-bottom">
                <div className="tag-link-left">
                  <CardIcon icon={icon} />
                </div>
                <div className="tag-link-right">
                  <div className="tag-link-title">{title || url || "链接卡片"}</div>
                  <div className="tag-link-sitename">{displaySitename}</div>
                </div>
                <Icon icon={FA6_ARROW_ICON} width={18} height={18} className="tag-link-arrow-icon" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---- 命令类型声明 ----
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linkCard: {
      insertLinkCard: (attrs?: {
        url?: string;
        title?: string;
        sitename?: string;
        icon?: string;
        tips?: string;
      }) => ReturnType;
    };
  }
}

// ---- Tiptap 扩展 ----
export const LinkCard = Node.create({
  name: "linkCard",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      sitename: { default: "" },
      icon: { default: "" },
      tips: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.anzhiyu-tag-link",
        getAttrs: (el: HTMLElement) => {
          const link = el.querySelector("a.tag-Link") as HTMLAnchorElement | null;
          const tipsEl = el.querySelector(".tag-link-tips");
          const titleEl = el.querySelector(".tag-link-title");
          const sitenameEl = el.querySelector(".tag-link-sitename");
          const iconImg = el.querySelector(".tag-link-left img") as HTMLImageElement | null;
          const iconSpan = el.querySelector(".tag-link-left .iconify") as HTMLElement | null;
          const iconI = el.querySelector(".tag-link-left i") as HTMLElement | null;

          // 图标：图片 URL > Iconify data-icon
          let iconVal = "";
          if (iconImg) {
            iconVal =
              iconImg.getAttribute("data-iconify") ||
              iconImg.getAttribute("data-icon") ||
              iconImg.getAttribute("src") ||
              iconImg.getAttribute("data-src") ||
              "";
          } else if (iconSpan) {
            iconVal = iconSpan.getAttribute("data-icon") || "";
          } else if (iconI) {
            const classList = Array.from(iconI.classList);
            const legacyIcon = classList.find(className => className.startsWith("anzhiyu-icon-")) || "";
            iconVal = normalizeLegacyIconName(legacyIcon);
          }

          return {
            url: link?.getAttribute("href") || "",
            title: titleEl?.textContent || "",
            sitename: sitenameEl?.textContent || "",
            icon: iconVal,
            tips: tipsEl?.textContent || "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const url = (node.attrs.url as string) || "";
    const nodeTitle = (node.attrs.title as string) || "";
    const sitename = (node.attrs.sitename as string) || "";
    const nodeIcon = (node.attrs.icon as string) || "";
    const tips = (node.attrs.tips as string) || "";

    const linkChildren: unknown[] = [];

    // tips
    const displayTips = tips || "引用站外地址";
    linkChildren.push(["div", { class: "tag-link-tips" }, displayTips]);

    // icon
    const leftContent: unknown[] = [];
    if (nodeIcon && isImageUrl(nodeIcon)) {
      leftContent.push(["img", { src: nodeIcon, alt: "", loading: "lazy" }]);
    } else {
      const iconifyName = resolveIconifyName(nodeIcon, DEFAULT_LINK_ICON);
      const iconifyUrl = toIconifySvgUrl(iconifyName);
      leftContent.push(["img", { src: iconifyUrl, alt: iconifyName, loading: "lazy", "data-iconify": iconifyName }]);
    }

    // right
    const rightContent: unknown[] = [
      ["span", { class: "tag-link-title" }, nodeTitle || url || "链接卡片"],
      ["span", { class: "tag-link-sitename" }, sitename || "网站名称"],
    ];

    linkChildren.push([
      "div",
      { class: "tag-link-bottom" },
      ["div", { class: "tag-link-left" }, ...leftContent],
      ["div", { class: "tag-link-right" }, ...rightContent],
      [
        "img",
        {
          class: "tag-link-arrow-icon",
          src: toIconifySvgUrl(FA6_ARROW_ICON),
          alt: "",
          loading: "lazy",
          "aria-hidden": "true",
          "data-iconify": FA6_ARROW_ICON,
        },
      ],
    ]);

    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "anzhiyu-tag-link" }),
      [
        "a",
        { class: "tag-Link", href: url, target: "_blank", rel: "noopener noreferrer" },
        ...linkChildren,
      ] as unknown as string,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkCardView);
  },

  addCommands() {
    return {
      insertLinkCard:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              url: attrs.url || "",
              title: attrs.title || "",
              sitename: attrs.sitename || "",
              icon: attrs.icon || "",
              tips: attrs.tips || "",
            },
          });
        },
    };
  },
});
