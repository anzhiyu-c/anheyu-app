/**
 * TurndownService 自定义规则
 * 将自定义 HTML 组件转换为对应的 Markdown 语法
 * 语法规范：块级 :::tagName params ... ::: ，行内 {tagName params}content{/tagName}
 */
import type TurndownService from "turndown";

export function registerCustomRules(td: TurndownService) {
  // --- GFM 表格 ---
  // 跳过 table 内部元素的默认处理，让 table 规则统一处理
  td.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: (content) => content,
  });
  td.addRule("tableRow", {
    filter: "tr",
    replacement: (content) => content,
  });
  td.addRule("tableSection", {
    filter: ["thead", "tbody", "tfoot"],
    replacement: (content) => content,
  });

  td.addRule("table", {
    filter: "table",
    replacement: (_content, node) => {
      const table = node as HTMLElement;
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length === 0) return _content;

      const matrix: { text: string; isHeader: boolean; align: string }[][] = [];

      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll("th, td"));
        const rowData = cells.map(cell => {
          const el = cell as HTMLElement;
          const isHeader = cell.nodeName === "TH";
          const align = el.style.textAlign || el.getAttribute("align") || "";
          const text = (el.textContent || "").trim().replace(/\|/g, "\\|").replace(/\n/g, " ");
          return { text, isHeader, align };
        });
        matrix.push(rowData);
      });

      if (matrix.length === 0) return _content;

      const colCount = Math.max(...matrix.map(r => r.length));
      const colWidths: number[] = Array(colCount).fill(3);

      matrix.forEach(row => {
        row.forEach((cell, i) => {
          colWidths[i] = Math.max(colWidths[i], cell.text.length);
        });
      });

      const pad = (text: string, width: number) => text + " ".repeat(Math.max(0, width - text.length));

      const formatRow = (row: { text: string }[]) => {
        const cells = [];
        for (let i = 0; i < colCount; i++) {
          cells.push(pad(row[i]?.text || "", colWidths[i]));
        }
        return `| ${cells.join(" | ")} |`;
      };

      // Determine if first row is the header
      const firstRow = matrix[0];
      const hasHeader = firstRow.some(c => c.isHeader) || table.querySelector("thead") !== null;

      let headerRow: typeof firstRow;
      let bodyRows: typeof matrix;

      if (hasHeader) {
        headerRow = firstRow;
        bodyRows = matrix.slice(1);
      } else {
        headerRow = Array(colCount).fill(null).map(() => ({ text: "", isHeader: true, align: "" }));
        bodyRows = matrix;
      }

      const headerLine = formatRow(headerRow);

      const separatorCells: string[] = [];
      for (let i = 0; i < colCount; i++) {
        const align = headerRow[i]?.align || "";
        const w = colWidths[i];
        if (align === "center") {
          separatorCells.push(":" + "-".repeat(Math.max(1, w - 2)) + ":");
        } else if (align === "right") {
          separatorCells.push("-".repeat(Math.max(1, w - 1)) + ":");
        } else {
          separatorCells.push("-".repeat(w));
        }
      }
      const separatorLine = `| ${separatorCells.join(" | ")} |`;

      const lines = [headerLine, separatorLine];
      bodyRows.forEach(row => lines.push(formatRow(row)));

      return `\n\n${lines.join("\n")}\n\n`;
    },
  });

  // 如果表格被 div.table-container 包裹，跳过包装层
  td.addRule("tableContainer", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("table-container"),
    replacement: (content) => content,
  });

  // --- 付费内容 ---
  td.addRule("paidContent", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("paid-content-editor-preview"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const title = el.getAttribute("data-title") || "付费内容";
      const price = el.getAttribute("data-price") || "0";
      const originalPrice = el.getAttribute("data-original-price") || "";
      const currency = el.getAttribute("data-currency") || "¥";

      let attrs = `title="${title}" price="${price}"`;
      if (originalPrice) attrs += ` original-price="${originalPrice}"`;
      if (currency !== "¥") attrs += ` currency="${currency}"`;

      const body = el.querySelector(".paid-content-preview, .paid-content-body");
      const inner = body ? body.innerHTML.trim() : "";

      return `\n:::paid-content ${attrs}\n${inner}\n:::\n\n`;
    },
  });

  // --- 密码保护内容 ---
  td.addRule("passwordContent", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("password-content-editor-preview"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const id = el.getAttribute("data-content-id") || "";
      const title = el.getAttribute("data-title") || "密码保护内容";
      const password = el.getAttribute("data-password") || "";
      const hint = el.getAttribute("data-hint") || "";
      const placeholder = el.getAttribute("data-placeholder") || "";

      let attrs = `password="${password}" id="${id}" title="${title}"`;
      if (hint) attrs += ` hint="${hint}"`;
      if (placeholder) attrs += ` placeholder="${placeholder}"`;

      const body = el.querySelector(".password-content-preview, .password-content-body");
      const inner = body ? body.innerHTML.trim() : "";

      return `\n:::password-content ${attrs}\n${inner || "这里是密码保护的内容。"}\n:::\n\n`;
    },
  });

  // --- 登录后可见 ---
  td.addRule("loginRequiredContent", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("login-required-content-editor-preview"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const id = el.getAttribute("data-content-id") || "";
      const title = el.getAttribute("data-title") || "登录后可查看";
      const hint = el.getAttribute("data-hint") || "";

      let attrs = `id="${id}" title="${title}"`;
      if (hint) attrs += ` hint="${hint}"`;

      const body = el.querySelector(".login-required-content-preview, .login-required-content-body");
      const inner = body ? body.innerHTML.trim() : "";

      return `\n:::login-required ${attrs}\n${inner || "<p>这里是登录后可查看的内容。</p>"}\n:::\n\n`;
    },
  });

  // --- 代码块 (details.md-editor-code) ---
  td.addRule("codeBlock", {
    filter: (node) =>
      node.nodeName === "DETAILS" && (node as HTMLElement).classList.contains("md-editor-code"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const langEl = el.querySelector(".code-lang");
      const language = langEl?.textContent?.trim().toLowerCase() || "";

      const codeBlock = el.querySelector(".md-editor-code-block");
      let code = "";
      if (codeBlock) {
        code = codeBlock.textContent || "";
      } else {
        const codeEl = el.querySelector("code");
        code = codeEl?.textContent || "";
      }

      if (code.endsWith("\n")) code = code.slice(0, -1);

      return `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    },
  });

  // --- 标签页 (Tabs) ---
  td.addRule("tabs", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("tabs"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const navTabs = el.querySelector(".nav-tabs");
      const tabContents = el.querySelector(".tab-contents");
      if (!navTabs || !tabContents) return _content;

      const buttons = navTabs.querySelectorAll(".tab");
      const items = tabContents.querySelectorAll(".tab-item-content");
      const activeIndex = Array.from(buttons).findIndex((b) => b.classList.contains("active"));

      let md = `\n:::tabs active=${activeIndex >= 0 ? activeIndex + 1 : 1}\n`;

      buttons.forEach((btn, i) => {
        const caption = btn.textContent?.trim() || `Tab ${i + 1}`;
        const content = items[i]?.innerHTML?.trim() || "";
        md += `== tab ${caption}\n${content}\n\n`;
      });

      md += ":::\n\n";
      return md;
    },
  });

  // --- 折叠块 ---
  td.addRule("folding", {
    filter: (node) =>
      node.nodeName === "DETAILS" && (node as HTMLElement).classList.contains("folding-tag"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const summary = el.querySelector("summary");
      const contentDiv = el.querySelector(".content");

      const title = summary?.textContent?.trim() || "折叠内容";
      const isOpen = el.hasAttribute("open");
      let params = `folding title="${title}"`;
      if (isOpen) params += " open";

      if (el.classList.contains("custom-color")) {
        const borderColor = el.style.borderColor;
        if (borderColor) params += ` ${borderColor}`;
      }

      const inner = contentDiv ? contentDiv.innerHTML.trim() : "";

      return `\n:::${params}\n${inner}\n:::\n\n`;
    },
  });

  // --- 隐藏内容（块级） ---
  td.addRule("hiddenBlock", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("hide-block"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const button = el.querySelector(".hide-button") as HTMLElement | null;
      const hideContent = el.querySelector(".hide-content") as HTMLElement | null;
      if (!button || !hideContent) return _content;

      const displayText = button.textContent?.trim() || "查看隐藏内容";
      const bgColor = button.style.backgroundColor || "";
      const textColor = button.style.color || "";
      const inner = hideContent.innerHTML.trim();

      let params = "hidden";
      if (displayText !== "查看隐藏内容") params += ` display=${displayText}`;
      if (bgColor) params += ` bg=${bgColor}`;
      if (textColor) params += ` color=${textColor}`;

      return `\n:::${params}\n${inner}\n:::\n\n`;
    },
  });

  // --- 行内隐藏 ---
  td.addRule("hiddenInline", {
    filter: (node) =>
      node.nodeName === "SPAN" && (node as HTMLElement).classList.contains("hide-inline"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const button = el.querySelector(".hide-button") as HTMLElement | null;
      const hideContent = el.querySelector(".hide-content") as HTMLElement | null;
      if (!button || !hideContent) return _content;

      const displayText = button.textContent?.trim() || "查看";
      const bgColor = (button as HTMLElement).style.backgroundColor || "";
      const textColor = (button as HTMLElement).style.color || "";
      const inner = hideContent.textContent?.trim() || "";

      let params = `display=${displayText}`;
      if (bgColor) params += ` bg=${bgColor}`;
      if (textColor) params += ` color=${textColor}`;

      return `{hide ${params}}${inner}{/hide}`;
    },
  });

  // --- 按钮组 ---
  td.addRule("btns", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("btns-container"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;

      let cols = 3;
      const colsMatch = el.className.match(/btns-cols-(\d+)/);
      if (colsMatch) cols = parseInt(colsMatch[1], 10);

      let md = `\n:::btns cols=${cols}\n`;

      el.querySelectorAll(".btn-item").forEach((item) => {
        const link = item as HTMLElement;
        const url = link.getAttribute("href") || "#";
        const titleEl = link.querySelector(".btn-title");
        const descEl = link.querySelector(".btn-desc");
        const iconEl = link.querySelector(".btn-icon i, .btn-icon .iconify-img");
        const title = titleEl?.textContent?.trim() || "";
        const desc = descEl?.textContent?.trim() || "";

        let icon = "";
        if (iconEl) {
          icon = (iconEl as HTMLElement).getAttribute("data-icon") || iconEl.className || "";
        }

        let itemLine = `- title=${title} url=${url}`;
        if (icon) itemLine += ` icon=${icon}`;
        if (desc) itemLine += ` desc=${desc}`;

        const colorMatch = link.className.match(/btn-color-(\w+)/);
        if (colorMatch) itemLine += ` color=${colorMatch[1]}`;

        md += itemLine + "\n";
      });

      md += ":::\n\n";
      return md;
    },
  });

  // --- 单个按钮 ---
  td.addRule("button", {
    filter: (node) =>
      node.nodeName === "A" && (node as HTMLElement).classList.contains("btn-anzhiyu"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const url = el.getAttribute("href") || "#";
      const textEl = el.querySelector("span") || el.querySelector(".btn-text");
      const text = textEl?.textContent?.trim() || el.textContent?.trim() || "按钮";
      const iconEl = el.querySelector("i");
      const icon = iconEl?.className || "anzhiyu-icon-circle-arrow-right";

      let params = `url=${url} text=${text} icon=${icon}`;
      if (el.classList.contains("btn-outline")) params += " style=outline";
      if (el.classList.contains("btn-larger")) params += " size=larger";

      const colors = ["blue", "pink", "red", "purple", "orange", "green"];
      for (const c of colors) {
        if (el.classList.contains(`btn-${c}`)) {
          params += ` color=${c}`;
          break;
        }
      }

      return `{btn ${params}}{/btn}`;
    },
  });

  // --- 图片画廊 ---
  td.addRule("gallery", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("gallery-container"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;

      let cols = 3;
      const colsMatch = el.className.match(/gallery-cols-(\d+)/);
      if (colsMatch) cols = parseInt(colsMatch[1], 10);

      const gap = el.style.gap || "";
      const ratio = el.style.getPropertyValue("--gallery-ratio") || "";

      let params = `gallery cols=${cols}`;
      if (gap) params += ` gap=${gap}`;
      if (ratio) params += ` ratio=${ratio}`;

      let md = `\n:::${params}\n`;

      el.querySelectorAll(".gallery-item").forEach((item) => {
        const img = item.querySelector("img");
        if (!img) return;
        const url = img.getAttribute("src") || "";
        const alt = img.getAttribute("alt") || "";
        const title = item.querySelector(".gallery-title")?.textContent?.trim() || "";
        md += `![${alt}](${url}${title ? ` "${title}"` : ""})\n`;
      });

      md += ":::\n\n";
      return md;
    },
  });

  // --- 视频画廊 ---
  td.addRule("videoGallery", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("video-gallery-container"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;

      let cols = 2;
      const colsMatch = el.className.match(/video-gallery-cols-(\d+)/);
      if (colsMatch) cols = parseInt(colsMatch[1], 10);

      const gap = el.style.gap || "";
      const ratio = el.style.getPropertyValue("--video-gallery-ratio") || "";

      let params = `video-gallery cols=${cols}`;
      if (gap) params += ` gap=${gap}`;
      if (ratio) params += ` ratio=${ratio}`;

      let md = `\n:::${params}\n`;

      el.querySelectorAll(".video-gallery-item").forEach((item) => {
        const source = item.querySelector("source");
        const video = item.querySelector("video");
        if (!source) return;
        const url = source.getAttribute("src") || "";
        const type = source.getAttribute("type") || "";
        const poster = video?.getAttribute("poster") || "";
        const title = item.querySelector(".video-gallery-title")?.textContent?.trim() || "";
        const desc = item.querySelector(".video-gallery-desc")?.textContent?.trim() || "";

        let line = `url=${url}`;
        if (type) line += ` type=${type}`;
        if (poster) line += ` poster=${poster}`;
        if (title) line += ` title=${title}`;
        if (desc) line += ` desc=${desc}`;
        md += line + "\n";
      });

      md += ":::\n\n";
      return md;
    },
  });

  // --- 链接卡片 ---
  td.addRule("linkcard", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("anzhiyu-tag-link"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const link = el.querySelector("a.tag-Link") as HTMLAnchorElement | null;
      if (!link) return _content;

      const url = link.getAttribute("href") || "";
      const title = el.querySelector(".tag-link-title")?.textContent?.trim() || "";
      const sitename = el.querySelector(".tag-link-sitename")?.textContent?.trim() || "";
      const tips = el.querySelector(".tag-link-tips")?.textContent?.trim() || "引用站外地址";

      const iconImg = el.querySelector(".tag-link-left img") as HTMLImageElement | null;
      const icon = iconImg?.getAttribute("data-iconify") || "rivet-icons:link";

      return `{linkcard url=${url} title="${title}" sitename="${sitename}" icon=${icon} tips="${tips}"}{/linkcard}`;
    },
  });

  // --- 提示 (Tip) ---
  td.addRule("tip", {
    filter: (node) =>
      node.nodeName === "SPAN" && (node as HTMLElement).classList.contains("anzhiyu-tip-wrapper"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const textEl = el.querySelector(".anzhiyu-tip-text");
      const tipEl = el.querySelector(".anzhiyu-tip");
      if (!textEl || !tipEl) return _content;

      const text = textEl.textContent?.trim() || "";
      const content = tipEl.textContent?.trim() || "";
      const position = tipEl.classList.contains("tip-bottom") ? "bottom" : "top";
      const theme = tipEl.classList.contains("tip-light") ? "light" : "dark";
      const trigger = el.getAttribute("data-trigger") === "click" ? "click" : "hover";

      let params = `text=${text} content=${content}`;
      if (position !== "top") params += ` position=${position}`;
      if (theme !== "dark") params += ` theme=${theme}`;
      if (trigger !== "hover") params += ` trigger=${trigger}`;

      return `{tip ${params}}{/tip}`;
    },
  });

  // --- 音乐播放器 ---
  td.addRule("musicPlayer", {
    filter: (node) =>
      node.nodeName === "DIV" && (node as HTMLElement).classList.contains("markdown-music-player"),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const neteaseId = el.getAttribute("data-music-id") || "";

      let dataStr = el.getAttribute("data-music-data") || "";
      if (dataStr) {
        try {
          dataStr = dataStr.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");
          const data = JSON.parse(dataStr);
          const name = data.name || "";
          const artist = data.artist || "";
          const pic = data.pic || "";
          const color = data.color || "";

          let params = `neteaseId=${neteaseId || data.neteaseId || ""}`;
          if (name) params += ` name=${name}`;
          if (artist) params += ` artist=${artist}`;
          if (pic) params += ` pic=${pic}`;
          if (color) params += ` color=${color}`;

          return `{music ${params}}{/music}`;
        } catch {
          // fall through
        }
      }

      return `{music id=${neteaseId}}{/music}`;
    },
  });

  // --- Mermaid 图表 ---
  td.addRule("mermaidBlock", {
    filter: (node) => {
      const el = node as HTMLElement;
      return (
        el.nodeName === "DIV" &&
        (el.hasAttribute("data-mermaid-code") || el.classList.contains("mermaid-block"))
      );
    },
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const code =
        el.getAttribute("data-mermaid-code") ||
        el.querySelector("code.language-mermaid")?.textContent ||
        el.querySelector("code")?.textContent ||
        "";
      if (!code.trim()) return "";
      return `\n\`\`\`mermaid\n${code}\n\`\`\`\n\n`;
    },
  });

  // --- 任务列表 ---
  td.addRule("taskList", {
    filter: (node) =>
      node.nodeName === "UL" && (node as HTMLElement).getAttribute("data-type") === "taskList",
    replacement: (content) => `\n${content}\n`,
  });

  td.addRule("taskItem", {
    filter: (node) =>
      node.nodeName === "LI" && (node as HTMLElement).getAttribute("data-type") === "taskItem",
    replacement: (content, node) => {
      const el = node as HTMLElement;
      const checked = el.getAttribute("data-checked") === "true";
      const text = content
        .replace(/^\s*\n+/, "")
        .replace(/\n+\s*$/, "")
        .replace(/\n/g, "\n  ");
      return `- [${checked ? "x" : " "}] ${text}\n`;
    },
  });

  // --- 高亮 ---
  td.addRule("highlight", {
    filter: (node) => node.nodeName === "MARK",
    replacement: (content) => `==${content}==`,
  });

  // --- 下标 ---
  td.addRule("subscript", {
    filter: ["sub"] as unknown as TurndownService.Filter,
    replacement: (content) => `~${content}~`,
  });

  // --- 上标 ---
  td.addRule("superscript", {
    filter: ["sup"] as unknown as TurndownService.Filter,
    replacement: (content) => `^${content}^`,
  });

  // --- 行内样式 ---
  td.addRule("inlineUnderline", {
    filter: (node) => node.nodeName === "SPAN" && (node as HTMLElement).classList.contains("inline-underline"),
    replacement: (content) => `{u}${content}{/u}`,
  });

  td.addRule("inlineEmphasis", {
    filter: (node) => node.nodeName === "SPAN" && (node as HTMLElement).classList.contains("inline-emphasis-mark"),
    replacement: (content) => `{emp}${content}{/emp}`,
  });

  td.addRule("inlineWavy", {
    filter: (node) => node.nodeName === "SPAN" && (node as HTMLElement).classList.contains("inline-wavy"),
    replacement: (content) => `{wavy}${content}{/wavy}`,
  });

  td.addRule("inlineDelete", {
    filter: (node) => node.nodeName === "SPAN" && (node as HTMLElement).classList.contains("inline-delete"),
    replacement: (content) => `{del}${content}{/del}`,
  });

  td.addRule("inlineKbd", {
    filter: (node) => node.nodeName === "SPAN" && (node as HTMLElement).classList.contains("inline-kbd"),
    replacement: (content) => `{kbd}${content}{/kbd}`,
  });

  td.addRule("inlinePassword", {
    filter: (node) => node.nodeName === "SPAN" && (node as HTMLElement).classList.contains("inline-password"),
    replacement: (content) => `{psw}${content}{/psw}`,
  });

  // --- 块级数学公式 (TipTap math-block) ---
  td.addRule("mathBlock", {
    filter: (node) => {
      const el = node as HTMLElement;
      return (
        (el.getAttribute?.("data-type") === "math-block") ||
        (el.classList?.contains("math-block") && el.hasAttribute?.("data-latex")) ||
        el.classList?.contains("katex-display")
      );
    },
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const latex =
        el.getAttribute("data-latex") ||
        el.querySelector('annotation[encoding="application/x-tex"]')?.textContent ||
        el.querySelector("annotation")?.textContent ||
        el.textContent?.trim() ||
        "";
      if (!latex) return _content;
      return `\n\n$$\n${latex}\n$$\n\n`;
    },
  });

  // --- 行内数学公式 (TipTap math-inline) ---
  td.addRule("mathInline", {
    filter: (node) => {
      const el = node as HTMLElement;
      return (
        (el.getAttribute?.("data-type") === "math-inline") ||
        (el.classList?.contains("math-inline") && el.hasAttribute?.("data-latex")) ||
        (el.classList?.contains("katex") && !el.closest?.(".katex-display"))
      );
    },
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const latex =
        el.getAttribute("data-latex") ||
        el.querySelector('annotation[encoding="application/x-tex"]')?.textContent ||
        el.querySelector("annotation")?.textContent ||
        el.textContent?.trim() ||
        "";
      if (!latex) return _content;
      return `$${latex}$`;
    },
  });
}
