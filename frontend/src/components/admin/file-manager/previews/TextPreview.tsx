"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RiSaveLine, RiSettings3Line, RiFullscreenLine, RiCloseLine, RiCheckLine, RiLoader4Line } from "react-icons/ri";
import type { FileItem } from "@/types/file-manager";
import { renderFileIcon } from "../file-icons";
import { overlayVariants, scaleIn, springTransition, normalTransition } from "@/lib/motion";

type MonacoModule = typeof import("monaco-editor");
type MonacoEditor = import("monaco-editor").editor.IStandaloneCodeEditor;
type MonacoEnvironment = {
  getWorker: (moduleId: string, label: string) => Worker;
};
type SaveResult = boolean | { size: number; updated: string };

export interface TextPreviewRef {
  open: (file: FileItem, url: string, onSave?: (file: FileItem, content: string) => Promise<SaveResult>) => void;
}

// 支持的语言列表
const SUPPORTED_LANGUAGES = [
  { id: "plaintext", label: "Plain Text" },
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "scss", label: "SCSS" },
  { id: "json", label: "JSON" },
  { id: "markdown", label: "Markdown" },
  { id: "yaml", label: "YAML" },
  { id: "xml", label: "XML" },
  { id: "java", label: "Java" },
  { id: "go", label: "Go" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "shell", label: "Shell" },
  { id: "ruby", label: "Ruby" },
  { id: "rust", label: "Rust" },
  { id: "sql", label: "SQL" },
  { id: "php", label: "PHP" },
] as const;

function getLanguageByFileName(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
    markdown: "markdown",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    svg: "xml",
    go: "go",
    py: "python",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    rs: "rust",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    sql: "sql",
    php: "php",
    vue: "html",
    toml: "ini",
    ini: "ini",
    conf: "ini",
    env: "ini",
    dockerfile: "dockerfile",
    makefile: "makefile",
  };
  return map[ext] || "plaintext";
}

export const TextPreview = forwardRef<TextPreviewRef>((_, ref) => {
  // 核心状态
  const [visible, setVisible] = useState(false);
  const [file, setFile] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [monacoLoading, setMonacoLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  // 编辑器设置
  const [wordWrap, setWordWrap] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState("plaintext");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // refs
  const fileUrlRef = useRef("");
  const saveHandlerRef = useRef<((file: FileItem, content: string) => Promise<SaveResult>) | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoModule | null>(null);

  // 暗色模式检测
  const isDark = useCallback(() => document.documentElement.classList.contains("dark"), []);
  const getMonacoTheme = useCallback(() => (isDark() ? "vs-dark" : "vs"), [isDark]);

  useImperativeHandle(ref, () => ({
    open: (fileItem, url, onSave) => {
      setFile(fileItem);
      fileUrlRef.current = url;
      saveHandlerRef.current = onSave || null;
      setReadOnly(!onSave);
      setDirty(false);
      setLoading(true);
      setVisible(true);
      setSettingsOpen(false);
      setLangMenuOpen(false);
    },
  }));

  // 配置 Monaco Worker
  const ensureMonacoEnvironment = useCallback(() => {
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
          return new Worker(new URL("monaco-editor/esm/vs/language/css/css.worker", import.meta.url), {
            type: "module",
          });
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
        return new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker", import.meta.url), {
          type: "module",
        });
      },
    };
  }, []);

  // 初始化编辑器
  useEffect(() => {
    if (!visible || !file || !fileUrlRef.current) return;
    let disposed = false;

    const init = async () => {
      setLoading(true);

      // 并行加载 Monaco 和文件内容
      let monaco = monacoRef.current;
      if (!monaco) {
        setMonacoLoading(true);
        monaco = await import("monaco-editor");
        monacoRef.current = monaco;
        setMonacoLoading(false);
      }

      ensureMonacoEnvironment();

      const response = await fetch(fileUrlRef.current);
      const content = await response.text();

      if (disposed || !editorContainerRef.current) return;

      const lang = getLanguageByFileName(file.name);
      setCurrentLanguage(lang);

      editorRef.current = monaco.editor.create(editorContainerRef.current, {
        value: content,
        language: lang,
        theme: getMonacoTheme(),
        readOnly: !saveHandlerRef.current,
        automaticLayout: true,
        minimap: { enabled: true },
        wordWrap: "on",
        scrollBeyondLastLine: false,
        scrollbar: {
          alwaysConsumeMouseWheel: false,
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
          useShadows: false,
        },
        fontSize: 14,
        tabSize: 2,
        renderWhitespace: "selection",
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true },
        smoothScrolling: true,
        cursorSmoothCaretAnimation: "on",
      });

      // 变更检测
      editorRef.current.onDidChangeModelContent(() => {
        setDirty(true);
      });

      // Ctrl/Cmd+S 快捷保存
      editorRef.current.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        triggerSave();
      });

      setLoading(false);
    };

    init();

    return () => {
      disposed = true;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, file]);

  // 监听主题变化
  useEffect(() => {
    if (!visible) return;
    const observer = new MutationObserver(() => {
      if (monacoRef.current && editorRef.current) {
        monacoRef.current.editor.setTheme(getMonacoTheme());
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [visible, getMonacoTheme]);

  // 点击外部关闭设置菜单
  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(e.target as Node) &&
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  // 保存
  const triggerSave = useCallback(async () => {
    if (!dirty || saving || !editorRef.current || !saveHandlerRef.current || !file) return;
    setSaving(true);
    try {
      const content = editorRef.current.getValue();
      const result = await saveHandlerRef.current(file, content);
      if (result) {
        setDirty(false);
        if (typeof result === "object" && file) {
          setFile(prev => (prev ? { ...prev, size: result.size, updated_at: result.updated } : prev));
        }
      }
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, file]);

  // 关闭（含未保存确认）
  const handleClose = useCallback(() => {
    if (dirty) {
      if (!window.confirm("您有未保存的更改，确定要关闭吗？")) return;
    }
    setVisible(false);
    setFile(null);
    setSettingsOpen(false);
    setLangMenuOpen(false);
    fileUrlRef.current = "";
  }, [dirty]);

  // 全屏切换
  const toggleFullScreen = useCallback(() => {
    const el = modalRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  // 切换自动换行
  const toggleWordWrap = useCallback(() => {
    setWordWrap(prev => {
      const next = !prev;
      editorRef.current?.updateOptions({ wordWrap: next ? "on" : "off" });
      return next;
    });
    setSettingsOpen(false);
    setLangMenuOpen(false);
  }, []);

  // 切换语言
  const changeLanguage = useCallback((langId: string) => {
    if (!monacoRef.current || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (model) {
      monacoRef.current.editor.setModelLanguage(model, langId);
    }
    setCurrentLanguage(langId);
    setSettingsOpen(false);
    setLangMenuOpen(false);
  }, []);

  // ESC 关闭（设置菜单打开时先关菜单）
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (settingsOpen) {
          setSettingsOpen(false);
          setLangMenuOpen(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, settingsOpen, handleClose]);

  if (typeof document === "undefined") return null;

  const darkMode = isDark();

  return createPortal(
    <AnimatePresence>
      {visible && file ? (
        <motion.div
          className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={normalTransition}
          onClick={e => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            ref={modalRef}
            className={`flex flex-col w-[85vw] max-w-[1400px] h-[85vh] rounded-xl overflow-hidden shadow-2xl ${
              darkMode ? "bg-[#1e1e1e]" : "bg-white border border-gray-200"
            }`}
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springTransition}
            onClick={e => e.stopPropagation()}
          >
            {/* ===== 顶部工具栏 ===== */}
            {!loading ? (
              <div
                className={`flex items-center gap-4 px-4 py-2 shrink-0 select-none ${
                  darkMode ? "bg-[#333] text-gray-300" : "bg-gray-100 text-gray-700 border-b border-gray-200"
                }`}
              >
                {/* 左：保存 + 设置 */}
                <div className="flex items-center gap-2">
                  {!readOnly ? (
                    <button
                      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        dirty
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : darkMode
                            ? "bg-white/10 text-gray-400 cursor-not-allowed"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                      disabled={!dirty || saving}
                      onClick={triggerSave}
                    >
                      {saving ? (
                        <RiLoader4Line className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RiSaveLine className="w-3.5 h-3.5" />
                      )}
                      {saving ? "保存中" : "保存"}
                      {/* 未保存指示点 */}
                      {dirty && !saving ? (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full" />
                      ) : null}
                    </button>
                  ) : null}

                  {/* 设置按钮 */}
                  <div className="relative">
                    <button
                      ref={settingsBtnRef}
                      className={`p-1.5 rounded-lg transition-colors ${
                        darkMode ? "hover:bg-white/10" : "hover:bg-gray-200"
                      } ${settingsOpen ? (darkMode ? "bg-white/10" : "bg-gray-200") : ""}`}
                      onClick={() => {
                        setSettingsOpen(prev => !prev);
                        setLangMenuOpen(false);
                      }}
                      title="设置"
                    >
                      <RiSettings3Line className="w-4 h-4" />
                    </button>

                    {/* 设置下拉菜单 */}
                    <AnimatePresence>
                      {settingsOpen ? (
                        <motion.div
                          ref={settingsMenuRef}
                          className={`absolute top-full left-0 mt-1 w-52 rounded-xl border shadow-lg z-50 overflow-hidden ${
                            darkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"
                          }`}
                          initial={{ opacity: 0, scale: 0.92, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: -4 }}
                          transition={{ duration: 0.15 }}
                        >
                          {/* 语言选择 */}
                          <div className="relative">
                            <button
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                                darkMode ? "hover:bg-white/10" : "hover:bg-gray-100"
                              }`}
                              onClick={() => setLangMenuOpen(prev => !prev)}
                            >
                              <span>文本类型</span>
                              <span className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                                {SUPPORTED_LANGUAGES.find(l => l.id === currentLanguage)?.label || currentLanguage}
                              </span>
                            </button>

                            <AnimatePresence>
                              {langMenuOpen ? (
                                <motion.div
                                  className={`max-h-60 overflow-y-auto border-t ${
                                    darkMode ? "border-gray-700" : "border-gray-100"
                                  }`}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  {SUPPORTED_LANGUAGES.map(lang => (
                                    <button
                                      key={lang.id}
                                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                                        currentLanguage === lang.id
                                          ? darkMode
                                            ? "bg-blue-500/20 text-blue-400"
                                            : "bg-blue-50 text-blue-600"
                                          : darkMode
                                            ? "hover:bg-white/5"
                                            : "hover:bg-gray-50"
                                      }`}
                                      onClick={() => changeLanguage(lang.id)}
                                    >
                                      {currentLanguage === lang.id ? (
                                        <RiCheckLine className="w-3.5 h-3.5 shrink-0" />
                                      ) : (
                                        <span className="w-3.5 shrink-0" />
                                      )}
                                      {lang.label}
                                    </button>
                                  ))}
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>

                          {/* 分割线 */}
                          <div className={`${darkMode ? "border-gray-700" : "border-gray-100"} border-t`} />

                          {/* 自动换行 */}
                          <button
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              darkMode ? "hover:bg-white/10" : "hover:bg-gray-100"
                            }`}
                            onClick={toggleWordWrap}
                          >
                            {wordWrap ? (
                              <RiCheckLine className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                            ) : (
                              <span className="w-3.5 shrink-0" />
                            )}
                            自动换行
                          </button>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>

                {/* 中：文件图标 + 文件名 */}
                <div className="flex-1 flex justify-center items-center gap-2 min-w-0 overflow-hidden">
                  <span className="w-[18px] h-[18px] shrink-0">{renderFileIcon(file, "w-full h-full")}</span>
                  <span className="text-sm font-medium truncate">{file.name}</span>
                  {readOnly ? (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        darkMode ? "bg-white/10 text-gray-400" : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      只读
                    </span>
                  ) : null}
                </div>

                {/* 右：全屏 + 关闭 */}
                <div className="flex items-center gap-1">
                  <button
                    className={`p-1.5 rounded-lg transition-colors ${
                      darkMode ? "hover:bg-white/10 text-gray-300 hover:text-white" : "hover:bg-gray-200"
                    }`}
                    onClick={toggleFullScreen}
                    title="全屏"
                  >
                    <RiFullscreenLine className="w-4 h-4" />
                  </button>
                  <button
                    className={`p-1.5 rounded-lg transition-colors ${
                      darkMode ? "hover:bg-white/10 text-gray-300 hover:text-white" : "hover:bg-gray-200"
                    }`}
                    onClick={handleClose}
                    title="关闭"
                  >
                    <RiCloseLine className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* ===== 编辑器区域 ===== */}
            <div className="relative flex-1 w-full min-h-0">
              {/* 加载状态 */}
              {loading ? (
                <div
                  className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 ${
                    darkMode ? "bg-[#1e1e1e]" : "bg-white"
                  }`}
                >
                  <div
                    className={`w-10 h-10 border-4 rounded-full animate-spin ${
                      darkMode ? "border-white/20 border-t-white" : "border-gray-200 border-t-blue-500"
                    }`}
                  />
                  {monacoLoading ? (
                    <span className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                      编辑器首次加载中...
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div ref={editorContainerRef} className="w-full h-full" />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
});

TextPreview.displayName = "TextPreview";
