"use client";

import { useState, useMemo } from "react";
import { Button, Spinner, Tabs, Tab, Checkbox, Select, SelectItem } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { postManagementApi } from "@/lib/api/post-management";
import type { ArticleHistoryListItem, ArticleHistoryDetail } from "@/types/post-management";

interface ArticleHistoryPageProps {
  articleId: string;
}

/** 格式化历史版本时间 */
function formatHistoryTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

  if (isToday) return `今天 ${time}`;
  if (isYesterday) return `昨天 ${time}`;
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) + "" + time;
}

export function ArticleHistoryPage({ articleId }: ArticleHistoryPageProps) {
  const router = useRouter();

  // 列表状态
  const [activeTab, setActiveTab] = useState("all");
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [compareVersion, setCompareVersion] = useState<string>("");

  // 获取历史版本列表
  const { data: historyData, isLoading: isLoadingList } = useQuery({
    queryKey: ["article-history", articleId],
    queryFn: () => postManagementApi.getArticleHistory(articleId, { pageSize: 50 }),
    staleTime: 1000 * 30,
  });

  // 获取选中版本的详情
  const { data: versionDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["article-history-detail", articleId, selectedVersion],
    queryFn: () => postManagementApi.getArticleHistoryVersion(articleId, selectedVersion!),
    enabled: !!selectedVersion,
    staleTime: 1000 * 60 * 5,
  });

  // 获取对比版本的详情
  const compareVersionNum = compareVersion ? parseInt(compareVersion, 10) : null;
  const { data: compareDetail } = useQuery({
    queryKey: ["article-history-detail", articleId, compareVersionNum],
    queryFn: () => postManagementApi.getArticleHistoryVersion(articleId, compareVersionNum!),
    enabled: !!compareVersionNum,
    staleTime: 1000 * 60 * 5,
  });

  // 过滤列表
  const filteredList = useMemo(() => {
    if (!historyData?.list) return [];
    let list = historyData.list;

    // 过滤已发布
    if (publishedOnly) {
      list = list.filter(item => item.change_note?.includes("发布") || item.change_note?.includes("更新"));
    }

    // tab 过滤：版本 tab 只显示有 change_note 的
    if (activeTab === "versions") {
      list = list.filter(item => item.change_note);
    }

    return list;
  }, [historyData?.list, publishedOnly, activeTab]);

  // 默认选中第一条
  if (filteredList.length > 0 && selectedVersion === null) {
    setSelectedVersion(filteredList[0].version);
  }

  // 恢复版本
  const handleRestore = async () => {
    if (!selectedVersion) return;
    try {
      const data = await postManagementApi.restoreArticleHistory(articleId, selectedVersion);
      // 恢复 = 用历史版本数据调用更新接口
      await postManagementApi.updateArticle(articleId, {
        title: data.title,
        content_html: data.content_html,
        content_md: data.content_md,
      });
      router.push(`/admin/post-management/${articleId}/edit`);
    } catch {
      // 错误处理由 API 层处理
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/admin/post-management/${articleId}/edit`)}
            className="flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">历史记录</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="bordered" size="sm" isDisabled={!selectedVersion || !versionDetail}>
            保存为版本
          </Button>
          <Button color="success" size="sm" onPress={handleRestore} isDisabled={!selectedVersion || !versionDetail}>
            恢复此记录
          </Button>
        </div>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 左侧版本列表 */}
        <div className="w-64 shrink-0 border-r border-border flex flex-col bg-background">
          {/* Tabs */}
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={k => setActiveTab(k as string)}
            variant="underlined"
            size="sm"
            classNames={{
              tabList: "px-4 pt-2",
              panel: "px-0 py-0 flex-1 overflow-hidden",
            }}
          >
            <Tab key="all" title="全部记录">
              <div className="flex flex-col h-full">
                {/* 筛选 */}
                <div className="px-4 py-2 border-b border-border">
                  <Checkbox size="sm" isSelected={publishedOnly} onValueChange={setPublishedOnly}>
                    <span className="text-xs text-muted-foreground">仅显示已发布的历史记录</span>
                  </Checkbox>
                </div>
                {/* 列表 */}
                <HistoryList
                  items={filteredList}
                  selectedVersion={selectedVersion}
                  onSelect={setSelectedVersion}
                  isLoading={isLoadingList}
                />
              </div>
            </Tab>
            <Tab key="versions" title="版本">
              <HistoryList
                items={filteredList}
                selectedVersion={selectedVersion}
                onSelect={setSelectedVersion}
                isLoading={isLoadingList}
              />
            </Tab>
          </Tabs>
        </div>

        {/* 右侧内容预览 */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* 对比控制栏 */}
          <div className="flex items-center gap-2 px-6 py-2 border-b border-border bg-background shrink-0">
            {selectedVersion && (
              <span className="text-sm text-foreground/70">
                {versionDetail ? formatHistoryTime(versionDetail.created_at) : `版本 ${selectedVersion}`}
              </span>
            )}
            <span className="text-sm text-muted-foreground">与</span>
            <Select
              placeholder="请选择历史"
              size="sm"
              className="w-40"
              selectedKeys={compareVersion ? new Set([compareVersion]) : new Set()}
              onSelectionChange={keys => {
                const arr = Array.from(keys);
                setCompareVersion(arr.length > 0 ? String(arr[0]) : "");
              }}
            >
              {(historyData?.list ?? [])
                .filter(item => item.version !== selectedVersion)
                .map(item => (
                  <SelectItem key={String(item.version)}>
                    版本 {item.version} ({formatHistoryTime(item.created_at)})
                  </SelectItem>
                ))}
            </Select>
            <span className="text-sm text-muted-foreground">对比</span>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-auto">
            {isLoadingDetail ? (
              <div className="flex items-center justify-center h-full">
                <Spinner size="lg" />
              </div>
            ) : versionDetail ? (
              <ContentPreview detail={versionDetail} compareDetail={compareDetail ?? null} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">选择一个历史版本查看</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================
// 历史版本列表组件
// ===================================

function HistoryList({
  items,
  selectedVersion,
  onSelect,
  isLoading,
}: {
  items: ArticleHistoryListItem[];
  selectedVersion: number | null;
  onSelect: (version: number) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="sm" />
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="text-center text-muted-foreground text-sm py-12">暂无历史记录</div>;
  }

  return (
    <div className="overflow-auto flex-1">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.version)}
          className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
            selectedVersion === item.version ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-foreground/80">{formatHistoryTime(item.created_at)}</span>
            {item.change_note && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">
                {item.change_note.includes("发布") ? "已发布" : item.change_note}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{item.editor_nickname || "未知用户"}</div>
        </button>
      ))}
    </div>
  );
}

// ===================================
// 内容预览组件
// ===================================

function ContentPreview({
  detail,
  compareDetail,
}: {
  detail: ArticleHistoryDetail;
  compareDetail: ArticleHistoryDetail | null;
}) {
  return (
    <div className="max-w-4xl mx-auto py-6 px-8">
      {compareDetail ? (
        // 对比模式
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              版本 {compareDetail.version} - {formatHistoryTime(compareDetail.created_at)}
            </div>
            <div className="border border-border rounded-xl p-6 bg-card">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: compareDetail.content_html || "" }}
              />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              版本 {detail.version} - {formatHistoryTime(detail.created_at)}
            </div>
            <div className="border border-border rounded-xl p-6 bg-card">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: detail.content_html || "" }}
              />
            </div>
          </div>
        </div>
      ) : (
        // 单版本预览
        <div className="border border-border rounded-xl p-6 bg-card">
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: detail.content_html || "" }}
          />
        </div>
      )}
    </div>
  );
}
