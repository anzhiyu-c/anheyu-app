"use client";

import { useMemo, useState, useCallback } from "react";
import { ModalBody, ModalFooter, Button, Tabs, Tab, Chip, Switch, addToast } from "@heroui/react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import {
  AlertTriangle,
  CheckCircle,
  FileCode2,
  Link2,
  SkipForward,
  SlidersHorizontal,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { useAlbumCategories, useBatchImportAlbums, useImportAlbums } from "@/hooks/queries/use-album";
import type { AlbumImportMode } from "@/types/album";

interface AlbumImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportSummary {
  success: number;
  failed: number;
  skipped: number;
  invalid: number;
  total: number;
  errors: string[];
  duplicates: string[];
}

const PANEL_CLASS = "rounded-lg border border-[#f0f0f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]";

const RESULT_CARD_CLASS = "rounded-lg border border-[#f0f0f0] bg-white p-3.5 text-center";

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url) || url.includes("upload") || url.includes("image");
}

function isJsonOrZip(file: File): boolean {
  return file.name.endsWith(".json") || file.name.endsWith(".zip");
}

function countValidLines(content: string): number {
  return content
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean).length;
}

export default function AlbumImportDialog({ isOpen, onClose }: AlbumImportDialogProps) {
  const [mode, setMode] = useState<AlbumImportMode>("urls");
  const [file, setFile] = useState<File | null>(null);
  const [jsonContent, setJsonContent] = useState("");
  const [urlsContent, setUrlsContent] = useState("");
  const [skipExisting, setSkipExisting] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [thumbParam, setThumbParam] = useState("");
  const [bigParam, setBigParam] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [result, setResult] = useState<ImportSummary | null>(null);

  const { data: categories = [] } = useAlbumCategories();
  const batchImportAlbums = useBatchImportAlbums();
  const importAlbums = useImportAlbums();

  const isImporting = batchImportAlbums.isPending || importAlbums.isPending;
  const urlCount = useMemo(() => countValidLines(urlsContent), [urlsContent]);

  const tags = useMemo(() => {
    return tagsInput
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }, [tagsInput]);
  const defaultCategoryOptions = useMemo(
    () => [
      { key: "__none__", label: "不设置默认分类" },
      ...categories.map(category => ({
        key: String(category.id),
        label: category.name,
      })),
    ],
    [categories]
  );
  const successRate = useMemo(() => {
    if (!result || result.total <= 0) {
      return 0;
    }
    return Math.round((result.success / result.total) * 100);
  }, [result]);

  const resetForm = useCallback(() => {
    setMode("urls");
    setFile(null);
    setJsonContent("");
    setUrlsContent("");
    setSkipExisting(true);
    setOverwriteExisting(false);
    setDefaultCategoryId("");
    setThumbParam("");
    setBigParam("");
    setTagsInput("");
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!isJsonOrZip(nextFile)) {
      addToast({ title: "仅支持 .json 或 .zip 文件", color: "warning", timeout: 3000 });
      event.target.value = "";
      return;
    }

    if (nextFile.size > 50 * 1024 * 1024) {
      addToast({ title: "文件大小不能超过 50MB", color: "warning", timeout: 3000 });
      event.target.value = "";
      return;
    }

    setFile(nextFile);
  }, []);

  const handleImportUrls = useCallback(async () => {
    const urls = urlsContent
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      addToast({ title: "请至少输入一个图片链接", color: "warning", timeout: 3000 });
      return;
    }

    if (urls.length > 100) {
      addToast({ title: "单次最多导入 100 个链接", color: "warning", timeout: 3000 });
      return;
    }

    const invalidUrls: string[] = [];
    const validUrls = urls.filter(url => {
      try {
        // URL 格式校验（图片后缀仅作为弱提示）
        new URL(url);
        if (!isImageUrl(url)) {
          console.warn("可能不是图片链接:", url);
        }
        return true;
      } catch {
        invalidUrls.push(url);
        return false;
      }
    });

    if (validUrls.length === 0) {
      addToast({ title: "未检测到有效链接", color: "danger", timeout: 3000 });
      return;
    }

    const importResult = await batchImportAlbums.mutateAsync({
      categoryId: defaultCategoryId ? Number(defaultCategoryId) : undefined,
      urls: validUrls,
      thumbParam: thumbParam.trim() || undefined,
      bigParam: bigParam.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      displayOrder: 0,
    });

    setResult({
      success: importResult.successCount,
      failed: importResult.failCount,
      skipped: importResult.skipCount,
      invalid: invalidUrls.length,
      total: validUrls.length + invalidUrls.length,
      errors: [
        ...invalidUrls.map(url => `[无效URL] ${url}`),
        ...(importResult.errors?.map(item => `[导入失败] ${item.url} - ${item.reason}`) ?? []),
      ],
      duplicates: importResult.duplicates ?? [],
    });

    addToast({
      title: `导入完成：成功 ${importResult.successCount}，失败 ${importResult.failCount}，跳过 ${importResult.skipCount}`,
      color: importResult.failCount > 0 || invalidUrls.length > 0 ? "warning" : "success",
      timeout: 5000,
    });
  }, [urlsContent, batchImportAlbums, defaultCategoryId, thumbParam, bigParam, tags]);

  const handleImportFileOrJson = useCallback(async () => {
    const formData = new FormData();

    if (mode === "json") {
      if (!jsonContent.trim()) {
        addToast({ title: "请输入 JSON 数据", color: "warning", timeout: 3000 });
        return;
      }

      try {
        JSON.parse(jsonContent);
      } catch {
        addToast({ title: "JSON 格式不正确", color: "danger", timeout: 3000 });
        return;
      }

      const jsonBlob = new Blob([jsonContent], { type: "application/json" });
      const jsonFile = new File([jsonBlob], "albums-import.json", { type: "application/json" });
      formData.append("file", jsonFile);
    } else {
      if (!file) {
        addToast({ title: "请上传相册数据文件", color: "warning", timeout: 3000 });
        return;
      }
      formData.append("file", file);
    }

    formData.append("skip_existing", skipExisting ? "true" : "false");
    formData.append("overwrite_existing", overwriteExisting ? "true" : "false");
    if (defaultCategoryId) {
      formData.append("default_category_id", defaultCategoryId);
    }

    const importResult = await importAlbums.mutateAsync(formData);
    setResult({
      success: importResult.success_count,
      failed: importResult.failed_count,
      skipped: importResult.skipped_count,
      invalid: 0,
      total: importResult.total_count,
      errors: importResult.errors ?? [],
      duplicates: [],
    });

    addToast({
      title: `导入完成：成功 ${importResult.success_count}，跳过 ${importResult.skipped_count}，失败 ${importResult.failed_count}`,
      color: importResult.failed_count > 0 ? "warning" : "success",
      timeout: 5000,
    });
  }, [mode, jsonContent, file, skipExisting, overwriteExisting, defaultCategoryId, importAlbums]);

  const handleImport = useCallback(async () => {
    try {
      if (mode === "urls") {
        await handleImportUrls();
        return;
      }
      await handleImportFileOrJson();
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "导入失败",
        color: "danger",
        timeout: 3000,
      });
    }
  }, [mode, handleImportUrls, handleImportFileOrJson]);

  return (
    <AdminDialog
      isOpen={isOpen}
      onClose={handleClose}
      size="4xl"
      scrollBehavior="inside"
      header={{ title: "导入相册", description: "支持链接、JSON 与压缩包导入", icon: UploadCloud }}
    >
      <ModalBody className="gap-4 pt-2">
        {!result ? (
          <>
            <Tabs
              selectedKey={mode}
              onSelectionChange={key => setMode(String(key) as AlbumImportMode)}
              variant="underlined"
              classNames={{
                tabList: "border-b border-[#f0f0f0] px-1 gap-5",
                cursor: "bg-[#1677ff] h-[2px]",
                tab: "h-10 px-1 text-[#595959] data-[selected=true]:text-[#1677ff]",
                panel: "pt-4",
              }}
            >
              <Tab
                key="urls"
                title={
                  <div className="flex items-center gap-2 text-sm">
                    <Link2 className="w-3.5 h-3.5" />
                    <span>链接导入</span>
                  </div>
                }
              >
                <div className={`${PANEL_CLASS} space-y-4`}>
                  <FormTextarea
                    label="图片链接"
                    placeholder="每行一个链接，例如：https://example.com/image.jpg"
                    value={urlsContent}
                    onValueChange={setUrlsContent}
                    minRows={8}
                    maxRows={12}
                    description="支持 jpg/jpeg/png/gif/webp/bmp/svg，单次最多 100 条"
                    textareaClassName="font-mono text-[13px] leading-6"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormInput
                      label="缩略图参数"
                      placeholder="例如：x-oss-process=image/resize,w_400"
                      value={thumbParam}
                      onValueChange={setThumbParam}
                    />
                    <FormInput
                      label="大图参数"
                      placeholder="例如：x-oss-process=image/quality,q_90"
                      value={bigParam}
                      onValueChange={setBigParam}
                    />
                  </div>

                  <FormInput
                    label="标签"
                    placeholder="多个标签用英文逗号分隔"
                    value={tagsInput}
                    onValueChange={setTagsInput}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" color={urlCount > 100 ? "danger" : "primary"} variant="flat">
                      已输入 {urlCount} 条
                    </Chip>
                    <Chip size="sm" color="default" variant="flat">
                      建议单批 20~80 条
                    </Chip>
                  </div>
                </div>
              </Tab>

              <Tab
                key="json"
                title={
                  <div className="flex items-center gap-2 text-sm">
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>JSON 导入</span>
                  </div>
                }
              >
                <div className={PANEL_CLASS}>
                  <FormTextarea
                    label="JSON 数据"
                    placeholder='请粘贴 JSON，例如：{"version":"1.0","albums":[...]}'
                    value={jsonContent}
                    onValueChange={setJsonContent}
                    minRows={10}
                    maxRows={14}
                    textareaClassName="font-mono text-[13px] leading-6"
                    description="仅校验 JSON 格式，具体字段由后端导入接口解析"
                  />
                </div>
              </Tab>

              <Tab
                key="file"
                title={
                  <div className="flex items-center gap-2 text-sm">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>文件导入</span>
                  </div>
                }
              >
                <div className={PANEL_CLASS}>
                  <div className="rounded-lg border border-dashed border-[#d9d9d9] bg-[#fafafa] p-5">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-[#262626]">上传文件（.json / .zip）</p>
                      <p className="text-xs text-[#8c8c8c]">适合离线整理后批量导入，单文件不超过 50MB。</p>
                    </div>

                    <input
                      type="file"
                      accept=".json,.zip"
                      onChange={handleFileChange}
                      className="mt-4 block w-full text-sm text-[#595959] file:mr-3 file:rounded-md file:border file:border-[#91caff] file:bg-[#e6f4ff] file:px-3.5 file:py-1.5 file:text-[#1677ff] file:font-medium hover:file:bg-[#bae0ff]"
                    />

                    {file ? (
                      <div className="mt-4 rounded-md border border-[#b7eb8f] bg-[#f6ffed] px-3 py-2.5 text-xs text-[#389e0d]">
                        已选择：{file.name}（{(file.size / 1024 / 1024).toFixed(2)} MB）
                      </div>
                    ) : (
                      <div className="mt-4 rounded-md border border-[#d9d9d9] bg-white px-3 py-2.5 text-xs text-[#8c8c8c]">
                        尚未选择文件
                      </div>
                    )}
                  </div>
                </div>
              </Tab>
            </Tabs>

            <div className={`${PANEL_CLASS} space-y-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">导入策略</p>
                </div>
                <Chip size="sm" variant="flat" color="default">
                  可选配置
                </Chip>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#f0f0f0] bg-[#fafafa] px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#262626]">跳过已存在</p>
                      <p className="text-xs text-[#8c8c8c] mt-1">重复项直接跳过，适合增量导入</p>
                    </div>
                    <Switch
                      size="sm"
                      isSelected={skipExisting}
                      onValueChange={value => {
                        setSkipExisting(value);
                        if (value) setOverwriteExisting(false);
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-[#f0f0f0] bg-[#fafafa] px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#262626]">覆盖已存在</p>
                      <p className="text-xs text-[#8c8c8c] mt-1">用于修正旧数据，风险更高</p>
                    </div>
                    <Switch
                      size="sm"
                      isDisabled={skipExisting}
                      isSelected={overwriteExisting}
                      onValueChange={setOverwriteExisting}
                    />
                  </div>
                </div>
              </div>

              <FormSelect
                label="默认分类"
                value={defaultCategoryId || "__none__"}
                onValueChange={value => setDefaultCategoryId(value === "__none__" ? "" : value)}
                placeholder="为无分类相册设置默认分类（可选）"
              >
                {defaultCategoryOptions.map(option => (
                  <FormSelectItem key={option.key}>{option.label}</FormSelectItem>
                ))}
              </FormSelect>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#bae0ff] bg-[#e6f4ff] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#1d39c4]">导入任务已完成</p>
                  <p className="text-xs text-[#595959]">你可以继续导入下一批，或先关闭弹窗返回列表查看。</p>
                </div>
                <Chip
                  size="sm"
                  variant="flat"
                  className={
                    result.failed > 0 || result.invalid > 0
                      ? "border border-[#ffe58f] bg-[#fffbe6] text-[#d48806]"
                      : "border border-[#b7eb8f] bg-[#f6ffed] text-[#389e0d]"
                  }
                >
                  成功率 {successRate}%
                </Chip>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={RESULT_CARD_CLASS}>
                <p className="text-xl font-semibold text-[#52c41a]">{result.success}</p>
                <p className="text-xs text-[#8c8c8c] mt-1">成功</p>
              </div>
              <div className={RESULT_CARD_CLASS}>
                <p className="text-xl font-semibold text-[#ff4d4f]">{result.failed}</p>
                <p className="text-xs text-[#8c8c8c] mt-1">失败</p>
              </div>
              <div className={RESULT_CARD_CLASS}>
                <p className="text-xl font-semibold text-[#faad14]">{result.skipped}</p>
                <p className="text-xs text-[#8c8c8c] mt-1">跳过</p>
              </div>
              <div className={RESULT_CARD_CLASS}>
                <p className="text-xl font-semibold text-[#595959]">{result.invalid}</p>
                <p className="text-xs text-[#8c8c8c] mt-1">无效</p>
              </div>
            </div>

            <div className="rounded-lg border border-[#f0f0f0] bg-white px-4 py-3 text-sm text-[#262626]">
              总计处理：{result.total}
            </div>

            {result.errors.length > 0 ? (
              <div className="rounded-lg border border-[#ffccc7] bg-[#fff2f0] p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-[#ff4d4f]" />
                  <p className="text-sm font-medium text-[#cf1322]">错误项（{result.errors.length}）</p>
                </div>
                <div className="max-h-44 overflow-y-auto space-y-2">
                  {result.errors.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-md border border-[#ffccc7] bg-white p-2 text-xs text-[#a8071a]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {result.duplicates.length > 0 ? (
              <div className="rounded-lg border border-[#ffe58f] bg-[#fffbe6] p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <SkipForward className="w-4 h-4 text-[#faad14]" />
                  <p className="text-sm font-medium text-[#ad6800]">重复项（{result.duplicates.length}）</p>
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {result.duplicates.map((item, index) => (
                    <Chip key={`${item}-${index}`} variant="flat" color="warning" className="mr-2 mb-2">
                      {item}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}

            {result.errors.length === 0 && result.duplicates.length === 0 ? (
              <div className="rounded-lg border border-[#b7eb8f] bg-[#f6ffed] p-3.5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#52c41a]" />
                  <p className="text-sm font-medium text-[#237804]">本次导入未发现错误或重复项</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-[#ffe58f] bg-[#fffbe6] p-3.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#faad14]" />
                  <p className="text-xs text-[#ad6800]">建议处理错误项后再执行下一轮导入。</p>
                </div>
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {result ? (
          <>
            <Button variant="flat" onPress={() => setResult(null)}>
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
            <Button color="primary" onPress={handleImport} isLoading={isImporting}>
              开始导入
            </Button>
          </>
        )}
      </ModalFooter>
    </AdminDialog>
  );
}
