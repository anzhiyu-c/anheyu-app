"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ModalBody, ModalFooter, Button } from "@heroui/react";
import katex from "katex";
import { Sigma } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";

interface MathFormulaDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 插入块级公式 */
  onInsertBlock: (latex: string) => void;
  /** 插入行内公式 */
  onInsertInline: (latex: string) => void;
}

/** 常用公式模板 */
const FORMULA_TEMPLATES = [
  { label: "分数", latex: "\\frac{a}{b}" },
  { label: "平方根", latex: "\\sqrt{x}" },
  { label: "求和", latex: "\\sum_{i=1}^{n} x_i" },
  { label: "积分", latex: "\\int_{a}^{b} f(x) \\, dx" },
  { label: "极限", latex: "\\lim_{x \\to \\infty} f(x)" },
  { label: "矩阵", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { label: "上下标", latex: "x^{2} + y_{i}" },
  { label: "希腊字母", latex: "\\alpha, \\beta, \\gamma, \\delta" },
  { label: "质能方程", latex: "E = mc^2" },
  { label: "二次公式", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
  { label: "欧拉公式", latex: "e^{i\\pi} + 1 = 0" },
  { label: "偏导数", latex: "\\frac{\\partial f}{\\partial x}" },
];

export function MathFormulaDialog({ isOpen, onOpenChange, onInsertBlock, onInsertInline }: MathFormulaDialogProps) {
  const [latex, setLatex] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(false);

  // 关闭时重置状态（渲染阶段调整状态）
  if (!isOpen && prevIsOpen) {
    setLatex("");
    setPrevIsOpen(false);
  } else if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
  }

  // 实时预览（纯计算，用 useMemo 替代 effect + state）
  const { previewHtml, previewError } = useMemo(() => {
    if (!latex.trim()) return { previewHtml: "", previewError: "" };
    try {
      const html = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: true,
        output: "html",
      });
      return { previewHtml: html, previewError: "" };
    } catch (err) {
      return { previewHtml: "", previewError: err instanceof Error ? err.message : "渲染错误" };
    }
  }, [latex]);

  // 打开时聚焦
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleInsertBlock = useCallback(() => {
    if (!latex.trim()) return;
    onInsertBlock(latex.trim());
    onOpenChange(false);
  }, [latex, onInsertBlock, onOpenChange]);

  const handleInsertInline = useCallback(() => {
    if (!latex.trim()) return;
    onInsertInline(latex.trim());
    onOpenChange(false);
  }, [latex, onInsertInline, onOpenChange]);

  const handleTemplateClick = useCallback((templateLatex: string) => {
    setLatex(templateLatex);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl+Enter 插入块级公式
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleInsertBlock();
      }
    },
    [handleInsertBlock]
  );

  return (
    <AdminDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
      classNames={{ wrapper: "z-[200]", backdrop: "z-[199]" }}
      header={{ title: "插入数学公式", description: "支持 LaTeX 输入并实时预览", icon: Sigma }}
    >
      {onClose => (
        <>
          <ModalBody className="gap-4">
            {/* 公式输入 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                LaTeX 公式
                <span className="text-muted-foreground/40 ml-2">Ctrl+Enter 快速插入</span>
              </label>
              <textarea
                ref={textareaRef}
                value={latex}
                onChange={e => setLatex(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入 LaTeX 公式，如 E = mc^2"
                className="w-full min-h-[80px] p-3 font-mono text-sm bg-muted/30 border border-border/60 rounded-lg resize-y outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* 实时预览 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">预览</label>
              <div className="min-h-[60px] flex items-center justify-center p-4 bg-muted/30 border border-border/60 rounded-lg">
                {previewError ? (
                  <span className="text-xs text-danger">{previewError}</span>
                ) : previewHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                ) : (
                  <span className="text-xs text-muted-foreground/40">输入公式后实时预览</span>
                )}
              </div>
            </div>

            {/* 常用公式模板 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">常用公式</label>
              <div className="flex flex-wrap gap-1.5">
                {FORMULA_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => handleTemplateClick(tpl.latex)}
                    className="px-2.5 py-1 text-xs bg-muted hover:bg-secondary text-foreground/70 rounded-md transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant="flat" onPress={onClose} size="sm">
              取消
            </Button>
            <Button
              variant="flat"
              color="primary"
              onPress={handleInsertInline}
              isDisabled={!latex.trim() || !!previewError}
              size="sm"
            >
              插入行内公式
            </Button>
            <Button color="primary" onPress={handleInsertBlock} isDisabled={!latex.trim() || !!previewError} size="sm">
              插入块级公式
            </Button>
          </ModalFooter>
        </>
      )}
    </AdminDialog>
  );
}
