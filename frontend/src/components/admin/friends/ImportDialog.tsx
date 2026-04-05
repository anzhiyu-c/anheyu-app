"use client";

import { useState, useCallback } from "react";
import { ModalBody, ModalFooter, Button, Switch, Tabs, Tab, Chip, addToast } from "@heroui/react";
import { Copy, FileDown, CheckCircle, XCircle, SkipForward, Upload } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { useImportLinks, useLinkCategories } from "@/hooks/queries/use-friends";
import type { ImportLinksResponse, ImportLinkItem } from "@/types/friends";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const EXAMPLE_JSON: ImportLinkItem[] = [
  {
    name: "示例博客",
    url: "https://example.com",
    logo: "https://example.com/logo.png",
    description: "这是一个示例博客",
    category_name: "小伙伴",
    tag_name: "博客",
    tag_color: "#3B82F6",
  },
  {
    name: "另一个站点",
    url: "https://another.dev",
    logo: "https://another.dev/avatar.png",
    description: "技术分享",
    status: "APPROVED",
  },
];

export default function ImportDialog({ isOpen, onClose }: ImportDialogProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [createCategories, setCreateCategories] = useState(true);
  const [createTags, setCreateTags] = useState(true);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("");
  const [importResult, setImportResult] = useState<ImportLinksResponse | null>(null);
  const [parseError, setParseError] = useState("");

  const { data: categories = [] } = useLinkCategories();
  const importLinks = useImportLinks();

  const handleCopyExample = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(EXAMPLE_JSON, null, 2));
    addToast({ title: "示例已复制到剪贴板", color: "success", timeout: 2000 });
  }, []);

  const handleFillExample = useCallback(() => {
    setJsonInput(JSON.stringify(EXAMPLE_JSON, null, 2));
    setParseError("");
  }, []);

  const validateJson = useCallback((text: string): ImportLinkItem[] | null => {
    if (!text.trim()) {
      setParseError("请输入 JSON 数据");
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setParseError("JSON 必须是数组格式");
        return null;
      }
      if (parsed.length === 0) {
        setParseError("数组不能为空");
        return null;
      }
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.name || !item.url) {
          setParseError(`第 ${i + 1} 项缺少必填字段 name 或 url`);
          return null;
        }
      }
      setParseError("");
      return parsed as ImportLinkItem[];
    } catch {
      setParseError("JSON 格式错误，请检查语法");
      return null;
    }
  }, []);

  const handleImport = useCallback(async () => {
    const links = validateJson(jsonInput);
    if (!links) return;

    try {
      const result = await importLinks.mutateAsync({
        links,
        skip_duplicates: skipDuplicates,
        create_categories: createCategories,
        create_tags: createTags,
        default_category_id: defaultCategoryId ? Number(defaultCategoryId) : undefined,
      });
      setImportResult(result);
      addToast({
        title: `导入完成: ${result.success} 成功, ${result.failed} 失败, ${result.skipped} 跳过`,
        color: result.failed > 0 ? "warning" : "success",
        timeout: 5000,
      });
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "导入失败",
        color: "danger",
        timeout: 3000,
      });
    }
  }, [jsonInput, skipDuplicates, createCategories, createTags, defaultCategoryId, importLinks, validateJson]);

  const handleClose = useCallback(() => {
    setJsonInput("");
    setParseError("");
    setImportResult(null);
    onClose();
  }, [onClose]);

  const handleReset = useCallback(() => {
    setJsonInput("");
    setParseError("");
    setImportResult(null);
  }, []);

  return (
    <AdminDialog
      isOpen={isOpen}
      onClose={handleClose}
      size="3xl"
      scrollBehavior="inside"
      header={{
        title: "批量导入友链",
        description: "支持 JSON 批量导入并自动处理分类与标签",
        icon: Upload,
      }}
    >
      <ModalBody className="gap-4">
        {!importResult ? (
          <>
            {/* JSON 输入 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">JSON 数据</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<FileDown className="w-3.5 h-3.5" />}
                    onPress={handleFillExample}
                  >
                    填入示例
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Copy className="w-3.5 h-3.5" />}
                    onPress={handleCopyExample}
                  >
                    复制示例
                  </Button>
                </div>
              </div>
              <FormTextarea
                placeholder='[{"name": "博客名称", "url": "https://...", "logo": "https://..."}]'
                value={jsonInput}
                onValueChange={v => {
                  setJsonInput(v);
                  setParseError("");
                }}
                minRows={8}
                maxRows={15}
                error={parseError}
                textareaClassName="font-mono text-xs"
              />
            </div>

            {/* 导入选项 */}
            <div className="space-y-3 p-4 rounded-lg border border-border/60 bg-muted/30">
              <span className="text-sm font-medium">导入选项</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">跳过重复（URL 相同）</span>
                  <Switch size="sm" isSelected={skipDuplicates} onValueChange={setSkipDuplicates} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">自动创建分类</span>
                  <Switch size="sm" isSelected={createCategories} onValueChange={setCreateCategories} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">自动创建标签</span>
                  <Switch size="sm" isSelected={createTags} onValueChange={setCreateTags} />
                </div>
              </div>
              <FormSelect
                size="sm"
                label="默认分类"
                placeholder="分类不存在时使用的默认分类"
                value={defaultCategoryId}
                onValueChange={setDefaultCategoryId}
              >
                {categories.map(cat => (
                  <FormSelectItem key={String(cat.id)}>{cat.name}</FormSelectItem>
                ))}
              </FormSelect>
            </div>
          </>
        ) : (
          /* 导入结果 */
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-success-50 border border-success-200 text-center">
                <p className="text-2xl font-bold text-success">{importResult.success}</p>
                <p className="text-xs text-success-600">成功</p>
              </div>
              <div className="p-3 rounded-lg bg-danger-50 border border-danger-200 text-center">
                <p className="text-2xl font-bold text-danger">{importResult.failed}</p>
                <p className="text-xs text-danger-600">失败</p>
              </div>
              <div className="p-3 rounded-lg bg-warning-50 border border-warning-200 text-center">
                <p className="text-2xl font-bold text-warning">{importResult.skipped}</p>
                <p className="text-xs text-warning-600">跳过</p>
              </div>
            </div>

            <Tabs variant="underlined" color="primary">
              <Tab
                key="success"
                title={
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                    <span>成功 ({importResult.success_list?.length || 0})</span>
                  </div>
                }
              >
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {importResult.success_list?.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-success-50/50">
                      <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground truncate">{item.url}</span>
                    </div>
                  ))}
                  {(!importResult.success_list || importResult.success_list.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">无成功项</p>
                  )}
                </div>
              </Tab>
              <Tab
                key="failed"
                title={
                  <div className="flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-danger" />
                    <span>失败 ({importResult.failed_list?.length || 0})</span>
                  </div>
                }
              >
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {importResult.failed_list?.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-danger-50/50">
                      <XCircle className="w-3.5 h-3.5 text-danger shrink-0" />
                      <span className="font-medium">{item.link.name}</span>
                      <Chip size="sm" color="danger" variant="flat">
                        {item.reason}
                      </Chip>
                    </div>
                  ))}
                  {(!importResult.failed_list || importResult.failed_list.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">无失败项</p>
                  )}
                </div>
              </Tab>
              <Tab
                key="skipped"
                title={
                  <div className="flex items-center gap-1">
                    <SkipForward className="w-3.5 h-3.5 text-warning" />
                    <span>跳过 ({importResult.skipped_list?.length || 0})</span>
                  </div>
                }
              >
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {importResult.skipped_list?.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-warning-50/50">
                      <SkipForward className="w-3.5 h-3.5 text-warning shrink-0" />
                      <span className="font-medium">{item.link.name}</span>
                      <Chip size="sm" color="warning" variant="flat">
                        {item.reason}
                      </Chip>
                    </div>
                  ))}
                  {(!importResult.skipped_list || importResult.skipped_list.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">无跳过项</p>
                  )}
                </div>
              </Tab>
            </Tabs>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {importResult ? (
          <>
            <Button variant="flat" onPress={handleReset}>
              继续导入
            </Button>
            <Button color="primary" onPress={handleClose}>
              完成
            </Button>
          </>
        ) : (
          <>
            <Button variant="flat" onPress={handleClose}>
              取消
            </Button>
            <Button color="primary" onPress={handleImport} isLoading={importLinks.isPending}>
              开始导入
            </Button>
          </>
        )}
      </ModalFooter>
    </AdminDialog>
  );
}
