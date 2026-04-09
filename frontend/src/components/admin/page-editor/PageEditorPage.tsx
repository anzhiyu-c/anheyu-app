/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-27 18:23:25
 * @LastEditTime: 2026-02-27 18:27:34
 * @LastEditors: 安知鱼
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { addToast, Spinner, Switch, Input, Textarea, Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import TurndownService from "turndown";
import { marked } from "marked";
import { ArrowLeft, PanelRightClose, PanelRightOpen, Save } from "lucide-react";
import { EditorToolbar, type EditorMode } from "../article-editor/EditorToolbar";
import { TiptapEditor } from "../article-editor/TiptapEditor";
import { SourceCodeEditor } from "../article-editor/SourceCodeEditor";
import { useArticleEditor } from "../article-editor/use-article-editor";
import { useAdminPageDetail, useCreatePage, useUpdatePage, pageManagementKeys } from "@/hooks/queries/use-page-management";
import { useQueryClient } from "@tanstack/react-query";
import { processHtmlForSave } from "@/lib/content-processor";
import { registerCustomRules } from "@/lib/turndown-rules";
import { registerMarkedExtensions, fixTaskListHtml } from "@/lib/marked-extensions";

import type { Editor } from "@tiptap/react";

interface PageEditorPageProps {
  pageId?: number;
}

function WordCount({ editor }: { editor: Editor | null }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const text = editor.state.doc.textContent;
      const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
      const englishWords = (text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "").match(/[a-zA-Z0-9]+/g) || []).length;
      setCount(chineseChars + englishWords);
    };

    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  return (
    <div className="absolute bottom-2 left-3 pointer-events-none z-10">
      <span className="text-xs text-muted-foreground tabular-nums">{count}字</span>
    </div>
  );
}

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
registerCustomRules(turndownService);
registerMarkedExtensions(marked);

function normalizePagePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

export function PageEditorPage({ pageId }: PageEditorPageProps) {
  const router = useRouter();
  const isEditMode = !!pageId;

  const { data: pageData, isLoading: isLoadingPage } = useAdminPageDetail(pageId ?? 0, { enabled: isEditMode });

  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [showComment, setShowComment] = useState(true);
  const [sort, setSort] = useState(0);
  const [customJs, setCustomJs] = useState("");
  const [customCss, setCustomCss] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [prevPageId, setPrevPageId] = useState<number | null>(null);

  const editor = useArticleEditor({
    initialContent: "",
    placeholder: "开始编写页面内容...",
  });

  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [sourceContent, setSourceContent] = useState("");
  const visualBackupRef = useRef<Record<string, unknown> | null>(null);
  const sourceModifiedRef = useRef(false);

  const handleSourceChange = useCallback((value: string) => {
    setSourceContent(value);
    sourceModifiedRef.current = true;
  }, []);

  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      if (newMode === editorMode) return;

      if (editorMode === "visual") {
        if (editor && !editor.isDestroyed) {
          visualBackupRef.current = editor.getJSON() as Record<string, unknown>;
        }
        sourceModifiedRef.current = false;

        const rawHtml = editor?.getHTML() ?? "";
        const processedHtml = processHtmlForSave(rawHtml);
        if (newMode === "html") {
          setSourceContent(processedHtml);
        } else {
          setSourceContent(turndownService.turndown(processedHtml));
        }
      } else if (newMode === "visual") {
        if (!sourceModifiedRef.current && visualBackupRef.current) {
          if (editor && !editor.isDestroyed) {
            const backupSnapshot = visualBackupRef.current;
            queueMicrotask(() => editor.commands.setContent(backupSnapshot));
          }
        } else if (editorMode === "html") {
          if (editor && !editor.isDestroyed) {
            queueMicrotask(() => editor.commands.setContent(sourceContent));
          }
        } else {
          const html = fixTaskListHtml(marked.parse(sourceContent, { async: false }) as string);
          if (editor && !editor.isDestroyed) {
            queueMicrotask(() => editor.commands.setContent(html));
          }
        }
        visualBackupRef.current = null;
      } else {
        if (editorMode === "html") {
          setSourceContent(turndownService.turndown(sourceContent));
        } else {
          setSourceContent(fixTaskListHtml(marked.parse(sourceContent, { async: false }) as string));
        }
      }

      setEditorMode(newMode);
    },
    [editorMode, editor, sourceContent]
  );

  const queryClient = useQueryClient();
  const createMutation = useCreatePage();
  const updateMutation = useUpdatePage();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (pageData && prevPageId !== pageData.id) {
    setPrevPageId(pageData.id);
    setTitle(pageData.title || "");
    setPath(pageData.path || "");
    setDescription(pageData.description || "");
    setIsPublished(pageData.is_published);
    setShowComment(pageData.show_comment);
    setSort(pageData.sort);
    setCustomJs(pageData.custom_js || "");
    setCustomCss(pageData.custom_css || "");
  }

  const editorSyncedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!pageData || !editor || editor.isDestroyed) return;
    if (editorSyncedRef.current === pageData.id) return;
    editorSyncedRef.current = pageData.id;
    const contentHtml = pageData.content;
    if (contentHtml) {
      queueMicrotask(() => {
        if (!editor.isDestroyed) {
          editor.commands.setContent(contentHtml);
        }
      });
    }
  }, [pageData, editor]);

  const handleSave = () => {
    const currentTitle = title.trim();
    const currentPath = normalizePagePath(path);

    if (!currentTitle) {
      addToast({ title: "请输入页面标题", color: "warning" });
      return;
    }
    if (!currentPath) {
      addToast({ title: "请输入页面路径", color: "warning" });
      return;
    }
    if (!/^\/[a-zA-Z0-9\/_-]+$/.test(currentPath)) {
      addToast({ title: "路径格式不正确，需以 / 开头，仅支持字母数字下划线和连字符", color: "warning" });
      return;
    }

    if (currentPath !== path) {
      setPath(currentPath);
    }

    let html: string;
    let markdown: string;

    if (editorMode === "visual") {
      const rawHtml = editor?.getHTML() ?? "";
      html = processHtmlForSave(rawHtml);
      markdown = turndownService.turndown(html);
    } else if (editorMode === "html") {
      html = processHtmlForSave(sourceContent);
      markdown = turndownService.turndown(html);
    } else {
      markdown = sourceContent;
      html = processHtmlForSave(fixTaskListHtml(marked.parse(sourceContent, { async: false }) as string));
    }

    const data = {
      title: currentTitle,
      path: currentPath,
      content: html,
      markdown_content: markdown,
      custom_js: customJs,
      custom_css: customCss,
      description: description.trim(),
      is_published: isPublished,
      show_comment: showComment,
      sort,
    };

    if (isEditMode && pageId) {
      updateMutation.mutate(
        { id: pageId, data },
        {
          onSuccess: () => {
            addToast({ title: "页面已更新", color: "success" });
          },
          onError: error => {
            addToast({ title: "更新失败", description: error.message, color: "danger" });
          },
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: async () => {
          addToast({ title: "页面已创建", color: "success" });
          await queryClient.invalidateQueries({ queryKey: pageManagementKeys.lists() });
          router.push("/admin/page-management");
        },
        onError: error => {
          addToast({ title: "创建失败", description: error.message, color: "danger" });
        },
      });
    }
  };

  if (isEditMode && isLoadingPage) {
    return (
      <div className="flex flex-col h-screen items-center justify-center gap-3 bg-background">
        <Spinner size="lg" />
        <p className="text-muted-foreground">加载页面中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* 标题栏 */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={() => router.push("/admin/page-management")}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="页面标题"
          className="flex-1 text-lg font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
        />

        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setSidebarOpen(!sidebarOpen)}
            className="text-muted-foreground"
          >
            {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            color="primary"
            startContent={<Save className="w-3.5 h-3.5" />}
            onPress={handleSave}
            isLoading={isSaving}
            className="font-medium"
          >
            {isEditMode ? "更新" : "创建"}
          </Button>
        </div>
      </div>

      {/* 工具栏 */}
      <EditorToolbar editor={editor} editorMode={editorMode} onModeChange={handleModeChange} />

      {/* 主体区域 */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* 编辑器 */}
        <div className="flex-1 min-h-0 relative flex flex-col">
          <div className={editorMode === "visual" ? "flex-1 overflow-auto bg-card" : "hidden"}>
            <div className="max-w-4xl mx-auto">
              <TiptapEditor editor={editor} />
            </div>
          </div>
          {editorMode === "visual" && <WordCount editor={editor} />}
          {editorMode !== "visual" && (
            <SourceCodeEditor
              value={sourceContent}
              onChange={handleSourceChange}
              language={editorMode === "html" ? "html" : "markdown"}
            />
          )}
        </div>

        {/* 设置面板 */}
        {sidebarOpen && (
          <div className="w-72 shrink-0 h-full border-l border-border/60 bg-background overflow-auto">
            <div className="p-4 space-y-5">
              <h3 className="text-sm font-semibold text-foreground">页面设置</h3>

              <div className="space-y-3">
                <Input
                  size="sm"
                  label="路径"
                  placeholder="/privacy"
                  description="以 / 开头，如 /about、/privacy"
                  value={path}
                  onValueChange={setPath}
                />

                <Textarea
                  size="sm"
                  label="描述"
                  placeholder="页面描述（可选）"
                  value={description}
                  onValueChange={setDescription}
                  minRows={2}
                  maxRows={4}
                />

                <Input
                  size="sm"
                  label="排序"
                  type="number"
                  placeholder="0"
                  value={String(sort)}
                  onValueChange={v => setSort(Number(v) || 0)}
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">发布</p>
                    <p className="text-xs text-muted-foreground">启用后页面将公开可见</p>
                  </div>
                  <Switch size="sm" isSelected={isPublished} onValueChange={setIsPublished} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">显示评论</p>
                    <p className="text-xs text-muted-foreground">允许访客在此页面评论</p>
                  </div>
                  <Switch size="sm" isSelected={showComment} onValueChange={setShowComment} />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/40">
                <p className="text-sm font-medium text-foreground">高级设置</p>
                <Textarea
                  size="sm"
                  label="自定义 CSS"
                  placeholder="此页面专用的 CSS 样式"
                  value={customCss}
                  onValueChange={setCustomCss}
                  minRows={4}
                  maxRows={8}
                />
                <Textarea
                  size="sm"
                  label="自定义 JS"
                  placeholder="此页面专用的 JavaScript"
                  value={customJs}
                  onValueChange={setCustomJs}
                  minRows={4}
                  maxRows={8}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
