"use client";

import { useRef, useState, useEffect, useCallback } from "react";

type MonacoModule = typeof import("monaco-editor");
type MonacoEditor = import("monaco-editor").editor.IStandaloneCodeEditor;
type MonacoEnvironment = {
  getWorker: (moduleId: string, label: string) => Worker;
};

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

export interface SourceCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: "html" | "markdown";
}

export function SourceCodeEditor({ value, onChange, language }: SourceCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const monacoRef = useRef<MonacoModule | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const syncingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        lineNumbers: "on",
        fontSize: 14,
        tabSize: 2,
        padding: { top: 12, bottom: 12 },
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
          useShadows: false,
        },
      });

      editor.onDidChangeModelContent(() => {
        if (syncingRef.current) return;
        onChangeRef.current(editor.getValue());
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

  const setValue = useCallback((newValue: string) => {
    const editor = editorRef.current;
    if (!editor || newValue === editor.getValue()) return;
    syncingRef.current = true;
    editor.setValue(newValue);
    syncingRef.current = false;
  }, []);

  useEffect(() => {
    setValue(value);
  }, [value, setValue]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelLanguage(model, language);
  }, [language]);

  useEffect(() => {
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

  return (
    <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-xl border border-border/80 bg-card">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/60 z-10">
          <span className="text-sm text-muted-foreground animate-pulse">加载编辑器中...</span>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
