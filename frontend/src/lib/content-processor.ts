/**
 * 内容处理器
 * 保存文章时对 HTML 进行后处理，确保输出与 anheyu-pro 后端兼容
 * 参考 anheyu-pro useContentProcessor.ts
 */

/**
 * 处理保存时的 HTML
 * @param html 编辑器输出的原始 HTML
 * @returns 处理后的 HTML
 */
export function processHtmlForSave(html: string): string {
  if (!html || typeof window === "undefined") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");

  // 1. 表格包裹 div.table-container
  doc.querySelectorAll("table").forEach(table => {
    if (table.parentElement?.classList.contains("table-container")) return;
    const container = document.createElement("div");
    container.className = "table-container";
    if (table.parentNode) {
      table.parentNode.insertBefore(container, table);
      container.appendChild(table);
    }
  });

  // 1.1 统一表头结构：当首行为 th 且缺少 thead 时，自动提升为 thead
  doc.querySelectorAll("table").forEach(table => {
    if (table.querySelector("thead")) return;

    const tbody = table.querySelector("tbody");
    const firstRow =
      tbody?.querySelector("tr") ?? Array.from(table.children).find(el => el.tagName.toLowerCase() === "tr");

    if (!firstRow) return;

    const cells = Array.from(firstRow.children);
    if (cells.length === 0) return;

    const isHeaderRow = cells.every(cell => cell.tagName.toLowerCase() === "th");
    if (!isHeaderRow) return;

    const thead = document.createElement("thead");
    thead.appendChild(firstRow);

    if (tbody && tbody.parentNode === table) {
      table.insertBefore(thead, tbody);
    } else {
      table.insertBefore(thead, table.firstChild);
    }
  });

  // 2. 图片懒加载：使用浏览器原生 loading="lazy"
  //    不再将 src 替换为占位图（旧方案依赖 IntersectionObserver 存在 SSR 水合时序问题）
  doc.querySelectorAll("img").forEach(img => {
    const src = img.getAttribute("src");
    if (src && !src.startsWith("data:")) {
      img.setAttribute("loading", "lazy");
    }
  });

  // 3. PreserveHTML 恢复：将 wrapper 还原为原始 HTML
  doc.querySelectorAll("div.preserve-html-wrapper[data-html]").forEach(wrapper => {
    const originalHtml = wrapper.getAttribute("data-html");
    if (originalHtml) {
      const temp = document.createElement("div");
      temp.innerHTML = originalHtml;
      // 用原始 HTML 替换 wrapper
      while (temp.firstChild) {
        wrapper.parentNode?.insertBefore(temp.firstChild, wrapper);
      }
      wrapper.remove();
    }
  });

  // 4. Mermaid 占位处理：保留源码
  doc.querySelectorAll("div[data-mermaid-code]").forEach(div => {
    const code = div.getAttribute("data-mermaid-code") || "";
    if (code) {
      // 保留 data-mermaid-code 属性以便重新渲染
      // 同时保留 pre > code.language-mermaid 作为回退
      const pre = div.querySelector("pre");
      if (!pre) {
        const newPre = document.createElement("pre");
        const newCode = document.createElement("code");
        newCode.className = "language-mermaid";
        newCode.textContent = code;
        newPre.appendChild(newCode);
        div.innerHTML = "";
        div.appendChild(newPre);
      }
    }
  });

  // 5. 代码块：将裸 <pre><code> 转换为 details.md-editor-code 结构
  doc.querySelectorAll("pre").forEach(pre => {
    if (pre.closest(".md-editor-code")) return;
    if (pre.closest("[data-mermaid-code]") || pre.closest(".mermaid-block")) return;

    const code = pre.querySelector("code");
    if (!code) return;

    const langMatch = code.className.match(/language-(\w+)/);
    const language = langMatch ? langMatch[1] : "";
    const title = pre.getAttribute("data-title") || "";
    const displayLabel = title || language || "plaintext";
    const codeText = code.textContent || "";
    const lines = codeText.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();

    const isOpen = pre.getAttribute("data-open") !== "false";
    const isCollapsed = pre.getAttribute("data-collapsed") === "true";

    const lineNumberSpans = lines.map(() => "<span></span>").join("");

    const details = doc.createElement("details");
    details.className = "md-editor-code";
    if (isOpen) {
      details.setAttribute("open", "");
    }
    if (isCollapsed) {
      details.setAttribute("data-collapsed", "true");
    }

    const summary = doc.createElement("summary");
    summary.className = "md-editor-code-head";
    summary.innerHTML = `<div class="code-lang">${displayLabel.toUpperCase()}</div>`;
    details.appendChild(summary);

    const newPre = doc.createElement("pre");
    const newCode = doc.createElement("code");
    if (language) {
      newCode.className = `language-${language}`;
      newCode.setAttribute("language", language);
    }
    const escapedText = codeText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    newCode.innerHTML =
      `<span class="md-editor-code-block">${escapedText}</span>` +
      `<span rn-wrapper="" aria-hidden="true">${lineNumberSpans}</span>`;
    newPre.appendChild(newCode);
    details.appendChild(newPre);

    pre.replaceWith(details);
  });

  // 6. KaTeX 公式：清理编辑器专用属性
  doc.querySelectorAll("[data-type='math-inline']").forEach(el => {
    el.removeAttribute("contenteditable");
  });

  return doc.body.innerHTML;
}
