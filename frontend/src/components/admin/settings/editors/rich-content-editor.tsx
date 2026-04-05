"use client";

import * as React from "react";
import { marked } from "marked";
import { cn } from "@/lib/utils";
import { FormMonacoEditor } from "@/components/ui/form-monaco-editor";

interface RichContentEditorProps {
  label?: string;
  description?: string;
  markdownValue?: string;
  htmlValue?: string;
  onMarkdownChange?: (value: string) => void;
  onHtmlChange?: (value: string) => void;
  className?: string;
}

/**
 * 富内容编辑器：编辑 Markdown/HTML，自动同步输出 markdown + html 供后端存储
 */
export function RichContentEditor({
  label = "富文本内容",
  description,
  markdownValue = "",
  htmlValue = "",
  onMarkdownChange,
  onHtmlChange,
  className,
}: RichContentEditorProps) {
  const onHtmlChangeRef = React.useRef(onHtmlChange);

  React.useEffect(() => {
    onHtmlChangeRef.current = onHtmlChange;
  }, [onHtmlChange]);

  React.useEffect(() => {
    let canceled = false;

    const run = async () => {
      const source = (markdownValue || "").trim();
      if (!source) {
        onHtmlChangeRef.current?.("");
        return;
      }

      // 当 markdownValue 来自 htmlValue 的 fallback 时，传入的是 HTML 而非 Markdown，不解析
      if (markdownValue === htmlValue) {
        return;
      }

      const parsed = await Promise.resolve(marked.parse(markdownValue));
      if (canceled) return;
      const html = typeof parsed === "string" ? parsed : "";

      // 后端存储的 htmlValue 可能由主题/扩展渲染（含 ::: folding、data-line、folding-tag 等），
      // 标准 marked 不支持这些语法，解析结果会不同。若强制覆盖会导致一进页就显示「有未保存的更改」。
      // 仅当 parsed 与 htmlValue 一致，或 htmlValue 为空时，才同步到父组件。
      const hasStoredThemeHtml =
        htmlValue &&
        (htmlValue.includes("data-line") || htmlValue.includes("folding-tag") || htmlValue.includes('class="'));

      if (html === htmlValue || !hasStoredThemeHtml) {
        onHtmlChangeRef.current?.(html);
      }
    };

    run();

    return () => {
      canceled = true;
    };
  }, [markdownValue, htmlValue]);

  return (
    <div className={cn(className)}>
      <FormMonacoEditor
        label={label}
        value={markdownValue}
        onValueChange={onMarkdownChange}
        language="markdown"
        height={260}
        wordWrap
        description={description || "使用 Markdown/HTML 编写内容，系统会自动生成并保存对应 HTML。"}
      />
    </div>
  );
}
