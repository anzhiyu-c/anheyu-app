/**
 * marked 自定义扩展
 * 处理自定义 Markdown 语法 → HTML 转换
 * 块级：:::tagName params ... :::
 * 行内：{tagName params}content{/tagName}
 */
import type { marked as Marked, Tokens } from "marked";

// ---------- 工具函数 ----------

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function extractAttr(str: string, name: string): string {
  const m = str.match(new RegExp(`${name}\\s*=\\s*["']([^"']*?)["']`));
  if (m) return m[1];
  const m2 = str.match(new RegExp(`${name}\\s*=\\s*(\\S+)`));
  return m2 ? m2[1] : "";
}

/**
 * 从 src 开头匹配 :::tagName ... ::: 块（支持嵌套和代码块跳过）
 * 返回 { raw, tagName, params, body } 或 null
 */
function matchContainerBlock(src: string): { raw: string; tagName: string; params: string; body: string } | null {
  const openMatch = src.match(/^:::(\w[\w-]*)\s*(.*)\n/);
  if (!openMatch) return null;

  const tagName = openMatch[1];
  const params = openMatch[2].trim();
  let pos = openMatch[0].length;
  let depth = 1;
  let inCode = false;
  let codeMark = "";

  while (pos < src.length && depth > 0) {
    const lineEnd = src.indexOf("\n", pos);
    if (lineEnd === -1) break;
    const line = src.slice(pos, lineEnd).trim();

    const cm = line.match(/^(`{3,}|~{3,})/);
    if (cm) {
      if (!inCode) {
        inCode = true;
        codeMark = cm[1];
      } else if (line === codeMark) {
        inCode = false;
        codeMark = "";
      }
    }

    if (!inCode) {
      if (/^:::\w/.test(line)) depth++;
      else if (line === ":::") depth--;
    }

    pos = lineEnd + 1;
  }

  if (depth !== 0) return null;

  const bodyEnd = src.lastIndexOf(":::", pos - 1);
  const body = src.slice(openMatch[0].length, bodyEnd).replace(/\n$/, "");
  return { raw: src.slice(0, pos), tagName, params, body };
}

// ---------- 块级渲染器 ----------

type BlockRenderer = (body: string, params: string, parse: (md: string) => string) => string;

function renderTabs(body: string, params: string, parse: (md: string) => string): string {
  const activeMatch = params.match(/active=(\d+)/);
  const activeIdx = activeMatch ? parseInt(activeMatch[1], 10) - 1 : 0;

  const lines = body.split("\n");
  const tabs: { caption: string; content: string }[] = [];
  let current: { caption: string; content: string } | null = null;
  let inCode = false;
  let codeMark = "";

  for (const line of lines) {
    const trimmed = line.trim();
    const cm = trimmed.match(/^(`{3,}|~{3,})/);
    if (cm) {
      if (!inCode) { inCode = true; codeMark = cm[1]; }
      else if (trimmed === codeMark) { inCode = false; codeMark = ""; }
    }

    const tabMatch = !inCode ? trimmed.match(/^==\s+tab\s+(.*)/) : null;
    if (tabMatch) {
      if (current) tabs.push(current);
      current = { caption: tabMatch[1].trim(), content: "" };
    } else if (current) {
      current.content += line + "\n";
    }
  }
  if (current) tabs.push(current);
  if (tabs.length === 0) return `<div class="tabs">${parse(body)}</div>`;

  const id = `tabs-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let nav = `<ul class="nav-tabs">`;
  let contents = `<div class="tab-contents">`;

  tabs.forEach((tab, i) => {
    const active = i === activeIdx ? " active" : "";
    const tabId = `${id}-${i + 1}`;
    nav += `<button type="button" class="tab${active}" data-href="${tabId}">${escapeHtml(tab.caption)}</button>`;
    contents += `<div class="tab-item-content${active}" id="${tabId}" data-title="${escapeHtml(tab.caption)}">${parse(tab.content.trim())}</div>`;
  });

  nav += "</ul>";
  contents += "</div>";
  return `<div class="tabs" id="${id}">${nav}${contents}<div class="tab-to-top"><button type="button" aria-label="scroll to top"><i class="anzhiyufont anzhiyu-icon-arrow-up"></i></button></div></div>`;
}

function renderPasswordContent(body: string, params: string, parse: (md: string) => string): string {
  const password = extractAttr(params, "password");
  const id = extractAttr(params, "id") || `password-${Date.now()}`;
  const title = extractAttr(params, "title") || "密码保护内容";
  const hint = extractAttr(params, "hint");
  const placeholder = extractAttr(params, "placeholder") || "请输入密码";
  const len = body.trim().length;
  const inner = parse(body.trim());

  return `<div class="password-content-editor-preview" data-section-id="${id}" data-content-id="${id}" data-content-length="${len}" data-password="${escapeHtml(password)}" data-title="${escapeHtml(title)}" data-hint="${escapeHtml(hint)}" data-placeholder="${escapeHtml(placeholder)}"><div class="password-content-header"><span class="password-icon"><svg class="md-editor-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M832 464h-68V240c0-70.7-57.3-128-128-128H388c-70.7 0-128 57.3-128 128v224h-68c-17.7 0-32 14.3-32 32v384c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V496c0-17.7-14.3-32-32-32zM332 240c0-30.9 25.1-56 56-56h248c30.9 0 56 25.1 56 56v224H332V240z m460 600H232V536h560v304z" fill="#5470C6"/><path d="M484 701v53c0 4.4 3.6 8 8 8h40c4.4 0 8-3.6 8-8v-53c12.1-8.7 20-22.9 20-39 0-26.5-21.5-48-48-48s-48 21.5-48 48c0 16.1 7.9 30.3 20 39z" fill="#5470C6"/></svg></span><span class="password-title">${escapeHtml(title)}</span><span class="password-pro-badge">密码保护内容</span></div><div class="password-content-body"><div class="password-content-preview">${inner}</div><div class="password-content-meta"><span class="content-length">约 ${len} 字</span><span class="password-protection-info">• 此内容受密码保护</span></div></div></div>`;
}

function renderPaidContent(body: string, params: string, parse: (md: string) => string): string {
  const title = extractAttr(params, "title") || "付费内容";
  const price = extractAttr(params, "price") || "0";
  const originalPrice = extractAttr(params, "original-price");
  const currency = extractAttr(params, "currency") || "¥";
  const len = body.trim().length;
  const inner = parse(body.trim());

  let opAttr = "";
  if (originalPrice) opAttr = ` data-original-price="${escapeHtml(originalPrice)}"`;

  return `<div class="paid-content-editor-preview" data-title="${escapeHtml(title)}" data-price="${escapeHtml(price)}"${opAttr} data-currency="${escapeHtml(currency)}" data-content-length="${len}"><div class="paid-content-header"><span class="paid-content-title">${escapeHtml(title)}</span><span class="paid-content-badge">付费内容</span></div><div class="paid-content-body"><div class="paid-content-preview">${inner}</div></div></div>`;
}

function renderLoginRequired(body: string, params: string, parse: (md: string) => string): string {
  const id = extractAttr(params, "id") || `login-${Date.now()}`;
  const title = extractAttr(params, "title") || "登录后可查看";
  const hint = extractAttr(params, "hint") || "此内容需要登录后才能查看";
  const len = body.trim().length;
  const inner = parse(body.trim());

  return `<div class="login-required-content-editor-preview" data-content-id="${id}" data-title="${escapeHtml(title)}" data-hint="${escapeHtml(hint)}" data-content-length="${len}"><div class="login-required-content-header"><span class="login-required-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><span class="login-required-title">${escapeHtml(title)}</span><span class="login-required-badge">登录后可查看</span></div><div class="login-required-content-body"><div class="login-required-content-preview">${inner}</div></div></div>`;
}

function renderFolding(body: string, params: string, parse: (md: string) => string): string {
  const titleStr = extractAttr(params, "title") || params.replace(/^folding\s*/, "").replace(/\s*open\s*$/, "").trim() || "折叠内容";
  const isOpen = /\bopen\b/.test(params);
  const colorMatch = params.match(/#[\da-fA-F]{3,8}/);
  const style = colorMatch ? ` style="border-color: ${colorMatch[0]}"` : "";
  const inner = parse(body.trim());

  return `<details class="folding-tag"${isOpen ? " open" : ""}${style}><summary>${escapeHtml(titleStr)}</summary><div class="content">${inner}</div></details>`;
}

function renderHidden(body: string, params: string, parse: (md: string) => string): string {
  const display = extractAttr(params, "display") || "查看隐藏内容";
  const bg = extractAttr(params, "bg");
  const color = extractAttr(params, "color");
  const inner = parse(body.trim());

  let btnStyle = "";
  if (bg) btnStyle += `background-color:${bg};`;
  if (color) btnStyle += `color:${color};`;
  const styleAttr = btnStyle ? ` style="${btnStyle}"` : "";

  return `<div class="hide-block"><button class="hide-button"${styleAttr}>${escapeHtml(display)}</button><div class="hide-content">${inner}</div></div>`;
}

function renderBtns(body: string, params: string): string {
  const cols = extractAttr(params, "cols") || "3";
  const lines = body.trim().split("\n");

  let items = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-")) continue;
    const itemStr = trimmed.slice(1).trim();
    const title = extractAttr(itemStr, "title");
    const url = extractAttr(itemStr, "url") || "#";
    const icon = extractAttr(itemStr, "icon");
    const desc = extractAttr(itemStr, "desc");
    const color = extractAttr(itemStr, "color");

    let iconHtml = "";
    if (icon) iconHtml = `<span class="btn-icon"><i class="${escapeHtml(icon)}"></i></span>`;
    let descHtml = "";
    if (desc) descHtml = `<span class="btn-desc">${escapeHtml(desc)}</span>`;

    items += `<a class="btn-item${color ? ` btn-color-${color}` : ""}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${iconHtml}<span class="btn-title">${escapeHtml(title)}</span>${descHtml}</a>`;
  }

  return `<div class="btns-container btns-cols-${cols}">${items}</div>`;
}

function renderGallery(body: string, params: string): string {
  const cols = extractAttr(params, "cols") || "3";
  const gap = extractAttr(params, "gap");
  const ratio = extractAttr(params, "ratio");
  const lines = body.trim().split("\n");

  let style = "";
  if (gap) style += `gap:${gap};`;
  if (ratio) style += `--gallery-ratio:${ratio};`;
  const styleAttr = style ? ` style="${style}"` : "";

  let items = "";
  for (const line of lines) {
    const m = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/);
    if (!m) continue;
    const [, alt, src, title] = m;
    let titleHtml = "";
    if (title) titleHtml = `<span class="gallery-title">${escapeHtml(title)}</span>`;
    items += `<div class="gallery-item"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />${titleHtml}</div>`;
  }

  return `<div class="gallery-container gallery-cols-${cols}"${styleAttr}>${items}</div>`;
}

function renderVideoGallery(body: string, params: string): string {
  const cols = extractAttr(params, "cols") || "2";
  const gap = extractAttr(params, "gap");
  const ratio = extractAttr(params, "ratio");
  const lines = body.trim().split("\n");

  let style = "";
  if (gap) style += `gap:${gap};`;
  if (ratio) style += `--video-gallery-ratio:${ratio};`;
  const styleAttr = style ? ` style="${style}"` : "";

  let items = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const url = extractAttr(trimmed, "url");
    if (!url) continue;
    const type = extractAttr(trimmed, "type") || "video/mp4";
    const poster = extractAttr(trimmed, "poster");
    const title = extractAttr(trimmed, "title");
    const desc = extractAttr(trimmed, "desc");

    let meta = "";
    if (title) meta += `<span class="video-gallery-title">${escapeHtml(title)}</span>`;
    if (desc) meta += `<span class="video-gallery-desc">${escapeHtml(desc)}</span>`;
    const posterAttr = poster ? ` poster="${escapeHtml(poster)}"` : "";

    items += `<div class="video-gallery-item"><video controls${posterAttr}><source src="${escapeHtml(url)}" type="${escapeHtml(type)}" /></video>${meta}</div>`;
  }

  return `<div class="video-gallery-container video-gallery-cols-${cols}"${styleAttr}>${items}</div>`;
}

const blockRenderers: Record<string, BlockRenderer> = {
  tabs: renderTabs,
  "password-content": renderPasswordContent,
  "paid-content": renderPaidContent,
  "login-required": renderLoginRequired,
  folding: renderFolding,
  hidden: renderHidden,
  btns: renderBtns,
  gallery: renderGallery,
  "video-gallery": renderVideoGallery,
};

// ---------- 行内渲染器 ----------

function renderInlineLinkcard(params: string): string {
  const url = extractAttr(params, "url") || "#";
  const title = extractAttr(params, "title");
  const sitename = extractAttr(params, "sitename");
  const icon = extractAttr(params, "icon") || "rivet-icons:link";
  const tips = extractAttr(params, "tips") || "引用站外地址";

  return `<div class="anzhiyu-tag-link"><a class="tag-Link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><div class="tag-link-left"><img src="https://api.iconify.design/${escapeHtml(icon)}.svg" data-iconify="${escapeHtml(icon)}" alt="icon" /></div><div class="tag-link-right"><div class="tag-link-title">${escapeHtml(title)}</div><div class="tag-link-sitename">${escapeHtml(sitename)}</div></div><div class="tag-link-tips">${escapeHtml(tips)}</div></a></div>`;
}

function renderInlineBtn(params: string): string {
  const url = extractAttr(params, "url") || "#";
  const text = extractAttr(params, "text") || "按钮";
  const icon = extractAttr(params, "icon") || "anzhiyu-icon-circle-arrow-right";
  const style = extractAttr(params, "style");
  const size = extractAttr(params, "size");
  const color = extractAttr(params, "color");

  let cls = "btn-anzhiyu";
  if (style === "outline") cls += " btn-outline";
  if (size === "larger") cls += " btn-larger";
  if (color) cls += ` btn-${color}`;

  return `<a class="${cls}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><i class="${escapeHtml(icon)}"></i><span>${escapeHtml(text)}</span></a>`;
}

function renderInlineTip(params: string): string {
  const text = extractAttr(params, "text");
  const content = extractAttr(params, "content");
  const position = extractAttr(params, "position") || "top";
  const theme = extractAttr(params, "theme") || "dark";
  const trigger = extractAttr(params, "trigger") || "hover";

  const posClass = position === "bottom" ? " tip-bottom" : "";
  const themeClass = theme === "light" ? " tip-light" : "";
  const triggerAttr = trigger === "click" ? ' data-trigger="click"' : "";
  const triggerClass = trigger === "click" ? " tip-click" : "";

  return `<span class="anzhiyu-tip-wrapper${triggerClass}"${triggerAttr}><span class="anzhiyu-tip-text">${escapeHtml(text)}</span><span class="anzhiyu-tip${posClass}${themeClass}">${escapeHtml(content)}</span></span>`;
}

function renderInlineMusic(params: string): string {
  const neteaseId = extractAttr(params, "neteaseId") || extractAttr(params, "id");
  const name = extractAttr(params, "name");
  const artist = extractAttr(params, "artist");
  const pic = extractAttr(params, "pic");
  const color = extractAttr(params, "color");

  const dataObj: Record<string, string> = {};
  if (neteaseId) dataObj.neteaseId = neteaseId;
  if (name) dataObj.name = name;
  if (artist) dataObj.artist = artist;
  if (pic) dataObj.pic = pic;
  if (color) dataObj.color = color;

  return `<div class="markdown-music-player" data-music-id="${escapeHtml(neteaseId)}" data-music-data="${escapeHtml(JSON.stringify(dataObj))}"><div class="music-placeholder">🎵 音乐播放器</div></div>`;
}

const inlineSimpleTags: Record<string, (content: string) => string> = {
  u: (c) => `<span class="inline-underline">${c}</span>`,
  emp: (c) => `<span class="inline-emphasis-mark">${c}</span>`,
  wavy: (c) => `<span class="inline-wavy">${c}</span>`,
  del: (c) => `<span class="inline-delete">${c}</span>`,
  kbd: (c) => `<span class="inline-kbd">${c}</span>`,
  psw: (c) => `<span class="inline-password">${c}</span>`,
};

function renderInlineHide(params: string, content: string): string {
  const display = extractAttr(params, "display") || "查看";
  const bg = extractAttr(params, "bg");
  const color = extractAttr(params, "color");

  let btnStyle = "";
  if (bg) btnStyle += `background-color:${bg};`;
  if (color) btnStyle += `color:${color};`;
  const styleAttr = btnStyle ? ` style="${btnStyle}"` : "";

  return `<span class="hide-inline"><button type="button" class="hide-button"${styleAttr}>${escapeHtml(display)}</button><span class="hide-content" style="display: none;">${content}</span></span>`;
}

const inlineComplexTags: Record<string, (params: string) => string> = {
  linkcard: renderInlineLinkcard,
  btn: renderInlineBtn,
  tip: renderInlineTip,
  music: renderInlineMusic,
};

// ---------- 扩展注册 ----------

export function registerMarkedExtensions(marked: typeof Marked) {
  const parseInline = (md: string) => marked.parse(md, { async: false }) as string;

  // 块级 ::: 容器扩展
  marked.use({
    extensions: [
      {
        name: "containerBlock",
        level: "block" as const,
        start(src: string) {
          return src.match(/^:::\w/m)?.index;
        },
        tokenizer(src: string) {
          const block = matchContainerBlock(src);
          if (!block) return undefined;
          return {
            type: "containerBlock",
            raw: block.raw,
            tagName: block.tagName,
            params: block.params,
            body: block.body,
          };
        },
        renderer(token: Tokens.Generic) {
          const { tagName, params, body } = token as Tokens.Generic & {
            tagName: string;
            params: string;
            body: string;
          };
          const renderer = blockRenderers[tagName];
          if (renderer) return renderer(body, params, parseInline);
          return `<div class="custom-block custom-block-${tagName}">${parseInline(body)}</div>`;
        },
      },
    ],
  });

  // 块级数学公式 $$..$$
  marked.use({
    extensions: [
      {
        name: "mathBlock",
        level: "block" as const,
        start(src: string) {
          return src.match(/^\$\$/m)?.index;
        },
        tokenizer(src: string) {
          const m = src.match(/^\$\$\n([\s\S]+?)\n\$\$(?:\n|$)/);
          if (m) return { type: "mathBlock", raw: m[0], latex: m[1].trim() };
          const m2 = src.match(/^\$\$([^\n]+?)\$\$(?:\n|$)/);
          if (m2) return { type: "mathBlock", raw: m2[0], latex: m2[1].trim() };
          return undefined;
        },
        renderer(token: Tokens.Generic) {
          const latex = (token as Tokens.Generic & { latex: string }).latex;
          return `<div data-latex="${escapeHtml(latex)}" data-type="math-block" class="math-block">${escapeHtml(latex)}</div>`;
        },
      },
    ],
  });

  // 行内 {tag params}content{/tag} 扩展
  marked.use({
    extensions: [
      {
        name: "inlineCustomTag",
        level: "inline" as const,
        start(src: string) {
          return src.match(/\{(?:linkcard|btn|tip|music|hide|u|emp|wavy|del|kbd|psw)\s/)?.index;
        },
        tokenizer(src: string) {
          const m = src.match(/^\{(\w+)\s([^}]*)\}([\s\S]*?)\{\/\1\}/);
          if (m) {
            const [raw, tag, params, content] = m;
            return { type: "inlineCustomTag", raw, tag, params, content };
          }
          return undefined;
        },
        renderer(token: Tokens.Generic) {
          const { tag, params, content } = token as Tokens.Generic & {
            tag: string;
            params: string;
            content: string;
          };
          if (inlineSimpleTags[tag]) return inlineSimpleTags[tag](content);
          if (tag === "hide") return renderInlineHide(params, content);
          if (inlineComplexTags[tag]) return inlineComplexTags[tag](params);
          return `{${tag} ${params}}${content}{/${tag}}`;
        },
      },
    ],
  });

  // 行内扩展：高亮 ==text==、下标 ~text~、上标 ^text^、行内数学 $latex$
  marked.use({
    extensions: [
      {
        name: "highlight",
        level: "inline" as const,
        start(src: string) { return src.match(/==/)?.index; },
        tokenizer(src: string) {
          const m = src.match(/^==([^=]+?)==/);
          if (m) return { type: "highlight", raw: m[0], text: m[1] };
          return undefined;
        },
        renderer(token: Tokens.Generic) {
          return `<mark>${(token as Tokens.Generic & { text: string }).text}</mark>`;
        },
      },
      {
        name: "subscript",
        level: "inline" as const,
        start(src: string) { return src.match(/~(?!~)/)?.index; },
        tokenizer(src: string) {
          const m = src.match(/^~([^~\n]+?)~/);
          if (m) return { type: "subscript", raw: m[0], text: m[1] };
          return undefined;
        },
        renderer(token: Tokens.Generic) {
          return `<sub>${(token as Tokens.Generic & { text: string }).text}</sub>`;
        },
      },
      {
        name: "superscript",
        level: "inline" as const,
        start(src: string) { return src.match(/\^(?!\^)/)?.index; },
        tokenizer(src: string) {
          const m = src.match(/^\^([^^\n]+?)\^/);
          if (m) return { type: "superscript", raw: m[0], text: m[1] };
          return undefined;
        },
        renderer(token: Tokens.Generic) {
          return `<sup>${(token as Tokens.Generic & { text: string }).text}</sup>`;
        },
      },
      {
        name: "mathInline",
        level: "inline" as const,
        start(src: string) { return src.match(/\$(?!\$)/)?.index; },
        tokenizer(src: string) {
          const m = src.match(/^\$([^\s$]([^$]*?[^\s$])?)\$(?!\$)/);
          if (m) return { type: "mathInline", raw: m[0], latex: m[1] };
          return undefined;
        },
        renderer(token: Tokens.Generic) {
          const latex = (token as Tokens.Generic & { latex: string }).latex;
          return `<span data-latex="${escapeHtml(latex)}" data-type="math-inline" class="math-inline">${escapeHtml(latex)}</span>`;
        },
      },
    ],
  });
}

/**
 * 修复 marked 输出的任务列表 HTML，使其与 TipTap TaskList/TaskItem 兼容
 * marked 输出: <li><input type="checkbox" checked disabled> text</li>
 * TipTap 需要: <li data-type="taskItem" data-checked="true">...</li>
 */
export function fixTaskListHtml(html: string): string {
  if (typeof window === "undefined" || !html.includes('type="checkbox"')) return html;

  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll("li").forEach(li => {
    const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (!checkbox) return;

    const checked = checkbox.checked || checkbox.hasAttribute("checked");
    li.setAttribute("data-type", "taskItem");
    li.setAttribute("data-checked", checked ? "true" : "false");

    checkbox.remove();
    const content = li.innerHTML.trim();
    li.innerHTML = `<label><input type="checkbox"${checked ? " checked" : ""}><span></span></label><div>${content || "<p></p>"}</div>`;
  });

  doc.querySelectorAll("ul").forEach(ul => {
    if (ul.querySelector(':scope > li[data-type="taskItem"]')) {
      ul.setAttribute("data-type", "taskList");
      ul.classList.add("not-prose", "pl-2");
    }
  });

  return doc.body.innerHTML;
}
