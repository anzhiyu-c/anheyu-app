"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type MonacoModule = typeof import("monaco-editor");
type MonacoEditor = import("monaco-editor").editor.IStandaloneCodeEditor;
type MonacoEnvironment = {
  getWorker: (moduleId: string, label: string) => Worker;
};

type MonacoLanguage = "plaintext" | "markdown" | "html" | "css" | "javascript" | "typescript" | "json" | "yaml" | "xml";

export interface FormMonacoEditorProps {
  label?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  description?: React.ReactNode;
  error?: string;
  language?: MonacoLanguage;
  height?: number;
  readOnly?: boolean;
  wordWrap?: boolean;
  disabled?: boolean;
  className?: string;
}

function ensureMonacoEnvironment() {
  const globalScope = self as typeof self & { MonacoEnvironment?: MonacoEnvironment };
  if (globalScope.MonacoEnvironment) return;

  globalScope.MonacoEnvironment = {
    getWorker: (_moduleId: string, label: string) => {
      if (label === "json") {
        return new Worker(new URL("monaco-editor/esm/vs/language/json/json.worker", import.meta.url), {
          type: "module",
        });
      }
      if (label === "css" || label === "scss" || label === "less") {
        return new Worker(new URL("monaco-editor/esm/vs/language/css/css.worker", import.meta.url), { type: "module" });
      }
      if (label === "html" || label === "handlebars" || label === "razor") {
        return new Worker(new URL("monaco-editor/esm/vs/language/html/html.worker", import.meta.url), {
          type: "module",
        });
      }
      if (label === "typescript" || label === "javascript") {
        return new Worker(new URL("monaco-editor/esm/vs/language/typescript/ts.worker", import.meta.url), {
          type: "module",
        });
      }
      return new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker", import.meta.url), { type: "module" });
    },
  };
}

function getTheme() {
  if (typeof document === "undefined") return "vs";
  return document.documentElement.classList.contains("dark") ? "vs-dark" : "vs";
}

export function FormMonacoEditor({
  label,
  value = "",
  onValueChange,
  description,
  error,
  language = "plaintext",
  height = 220,
  readOnly = false,
  wordWrap = true,
  disabled = false,
  className,
}: FormMonacoEditorProps) {
  const id = React.useId();
  const descId = `${id}-desc`;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const monacoRef = React.useRef<MonacoModule | null>(null);
  const editorRef = React.useRef<MonacoEditor | null>(null);
  const syncingRef = React.useRef(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    const init = async () => {
      if (editorRef.current) return;
      setLoading(true);
      const monaco = await import("monaco-editor");
      if (disposed || !containerRef.current) return;
      monacoRef.current = monaco;
      ensureMonacoEnvironment();

      const editor = monaco.editor.create(containerRef.current, {
        value,
        language,
        theme: getTheme(),
        readOnly: readOnly || disabled,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        scrollbar: {
          // 未聚焦时不捕获滚轮，避免页面滚动被卡住
          handleMouseWheel: false,
          alwaysConsumeMouseWheel: false,
          // 优化滚动条外观：更细、无阴影
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
          useShadows: false,
          verticalSliderSize: 6,
          horizontalSliderSize: 6,
        },
        wordWrap: wordWrap ? "on" : "off",
        lineNumbers: "on",
        fontSize: 13,
        tabSize: 2,
        padding: { top: 10, bottom: 10 },
      });

      editor.onDidChangeModelContent(() => {
        if (syncingRef.current || readOnly || disabled) return;
        onValueChange?.(editor.getValue());
      });

      // 聚焦时启用内部滚轮，失焦时关闭，避免页面滚动被拦截
      editor.onDidFocusEditorWidget(() => {
        editor.updateOptions({ scrollbar: { handleMouseWheel: true } });
      });
      editor.onDidBlurEditorWidget(() => {
        editor.updateOptions({ scrollbar: { handleMouseWheel: false } });
      });

      editorRef.current = editor;
      setLoading(false);
    };

    init();

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === editor.getValue()) return;
    syncingRef.current = true;
    editor.setValue(value);
    syncingRef.current = false;
  }, [value]);

  React.useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelLanguage(model, language);
  }, [language]);

  React.useEffect(() => {
    editorRef.current?.updateOptions({
      readOnly: readOnly || disabled,
      wordWrap: wordWrap ? "on" : "off",
    });
  }, [readOnly, disabled, wordWrap]);

  React.useEffect(() => {
    if (loading) return;
    const monaco = monacoRef.current;
    if (!monaco) return;
    monaco.editor.setTheme(getTheme());
    const observer = new MutationObserver(() => {
      monaco.editor.setTheme(getTheme());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [loading]);

  const languageLabel = (language || "plaintext").toUpperCase();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-sm font-medium text-foreground/80">
            {label}
          </label>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {languageLabel}
          </span>
        </div>
      )}

      <div
        id={id}
        ref={containerRef}
        aria-invalid={!!error}
        aria-describedby={description || error ? descId : undefined}
        className={cn(
          "relative w-full overflow-hidden rounded-xl border bg-card",
          error
            ? "border-danger ring-1 ring-danger/20"
            : "border-border/80 hover:border-border-hover/40 focus-within:border-primary/65 focus-within:ring-2 focus-within:ring-primary/15"
        )}
        style={{ height: `${height}px` }}
      >
        {loading && <div className="absolute inset-0 animate-pulse bg-muted/60" />}
      </div>

      {(description || error) && (
        <p
          id={descId}
          role={error ? "alert" : undefined}
          className={cn("text-xs leading-relaxed", error ? "text-danger" : "text-muted-foreground")}
        >
          {error || description}
        </p>
      )}
    </div>
  );
}
