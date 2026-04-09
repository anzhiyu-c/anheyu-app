/**
 * 文章摘要：从正文提取纯文本前 N 字（字符数，非字节）
 */

const DEFAULT_MAX = 300;

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function plainTextFromHtmlSource(html: string): string {
  const t = html?.trim() ?? "";
  if (!t) return "";
  if (typeof document !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(t, "text/html");
      return normalizeWhitespace(doc.body.textContent || "");
    } catch {
      /* fall through */
    }
  }
  return normalizeWhitespace(t.replace(/<[^>]+>/g, " "));
}

export function roughPlainTextFromMarkdown(md: string): string {
  let s = md ?? "";
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]+`/g, " ");
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1 ");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1 ");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/^\s*([-*+]|\d+\.)\s+/gm, "");
  s = s.replace(/[*_~`>#|]/g, "");
  return normalizeWhitespace(s);
}

export function clipSummaryPlainText(plain: string, maxChars: number = DEFAULT_MAX): string {
  const n = normalizeWhitespace(plain);
  if (!n) return "";
  const chars = Array.from(n);
  if (chars.length <= maxChars) return n;
  return chars.slice(0, maxChars).join("");
}

export const SUMMARY_AUTO_MAX_CHARS = DEFAULT_MAX;
