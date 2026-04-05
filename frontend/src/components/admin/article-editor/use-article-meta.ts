/**
 * 文章元数据管理 Hook
 * 管理编辑器之外的所有文章属性：分类、标签、封面、状态、摘要、SEO、版权等
 */
"use client";

import { useState, useCallback, useRef } from "react";
import type { ArticleStatus, ArticleDetailForEdit, CreateArticleRequest } from "@/types/post-management";
import { datetimeLocalToRFC3339, isoStringToDatetimeLocal } from "@/lib/datetime-local";

/** 文章元数据状态 */
export interface ArticleMeta {
  // 基础
  status: ArticleStatus;
  post_category_ids: string[];
  post_tag_ids: string[];
  cover_url: string;
  top_img_url: string;
  is_reprint: boolean;
  copyright_author: string;
  // 摘要 & SEO
  summaries: string[];
  keywords: string;
  abbrlink: string;
  // 显示控制
  show_on_home: boolean;
  home_sort: number;
  pin_sort: number;
  primary_color: string;
  is_primary_color_manual: boolean;
  // 版权
  copyright: boolean;
  copyright_author_href: string;
  copyright_url: string;
  // 高级
  ip_location: string;
  custom_js: string;
  is_doc: boolean;
  doc_series_id: string;
  doc_sort: number;
  // 定时发布
  scheduled_at: string;
  /** 自定义发布时间（datetime-local），对应后端 created_at；定时发布状态下不使用 */
  custom_published_at: string;
}

const DEFAULT_META: ArticleMeta = {
  status: "PUBLISHED",
  post_category_ids: [],
  post_tag_ids: [],
  cover_url: "",
  top_img_url: "",
  is_reprint: false,
  copyright_author: "",
  summaries: [],
  keywords: "",
  abbrlink: "",
  show_on_home: true,
  home_sort: 0,
  pin_sort: 0,
  primary_color: "",
  is_primary_color_manual: false,
  copyright: true,
  copyright_author_href: "",
  copyright_url: "",
  ip_location: "",
  custom_js: "",
  is_doc: false,
  doc_series_id: "",
  doc_sort: 0,
  scheduled_at: "",
  custom_published_at: "",
};

function normalizeSummaries(raw: string[] | undefined, max: number): string[] {
  const cleaned = (raw || []).map(s => s.trim()).filter(Boolean);
  return cleaned.slice(0, max);
}

/**
 * 从文章数据初始化元数据
 */
function initFromArticle(article: ArticleDetailForEdit, maxSummaries: number): ArticleMeta {
  return {
    status: article.status || "PUBLISHED",
    post_category_ids: article.post_categories?.map(c => c.id) || [],
    post_tag_ids: article.post_tags?.map(t => t.id) || [],
    cover_url: article.cover_url || "",
    top_img_url: article.top_img_url || "",
    is_reprint: article.is_reprint || false,
    copyright_author: article.copyright_author || "",
    summaries: normalizeSummaries(article.summaries, maxSummaries),
    keywords: article.keywords || "",
    abbrlink: article.abbrlink || "",
    show_on_home: article.show_on_home ?? true,
    home_sort: article.home_sort || 0,
    pin_sort: article.pin_sort || 0,
    primary_color: article.primary_color || "",
    is_primary_color_manual: article.is_primary_color_manual || false,
    copyright: article.copyright ?? true,
    copyright_author_href: article.copyright_author_href || "",
    copyright_url: article.copyright_url || "",
    ip_location: article.ip_location || "",
    custom_js: article.extra_config?.custom_js || "",
    is_doc: article.is_doc || false,
    doc_series_id: article.doc_series_id || "",
    doc_sort: article.doc_sort || 0,
    scheduled_at: isoStringToDatetimeLocal(article.scheduled_at ?? undefined),
    custom_published_at: isoStringToDatetimeLocal(article.created_at),
  };
}

export function useArticleMeta(
  article?: ArticleDetailForEdit | null,
  options?: { isAdmin?: boolean; maxSummaries?: number }
) {
  const isAdmin = options?.isAdmin ?? false;
  const maxSummaries = options?.maxSummaries ?? 1;
  const [meta, setMeta] = useState<ArticleMeta>(
    article ? initFromArticle(article, maxSummaries) : { ...DEFAULT_META }
  );
  const [initialized, setInitialized] = useState(false);
  const initialCustomJsRef = useRef(article?.extra_config?.custom_js || "");

  // 从文章数据初始化（仅首次）
  const initFromData = useCallback(
    (data: ArticleDetailForEdit) => {
      if (!initialized) {
        const nextMeta = initFromArticle(data, maxSummaries);
        setMeta(nextMeta);
        initialCustomJsRef.current = nextMeta.custom_js;
        setInitialized(true);
      }
    },
    [initialized, maxSummaries]
  );

  // 更新单个字段
  const updateField = useCallback(<K extends keyof ArticleMeta>(key: K, value: ArticleMeta[K]) => {
    setMeta(prev => ({ ...prev, [key]: value }));
  }, []);

  // 批量更新
  const updateFields = useCallback((updates: Partial<ArticleMeta>) => {
    setMeta(prev => ({ ...prev, ...updates }));
  }, []);

  // 生成提交数据（合并到 CreateArticleRequest）
  const getSubmitData = useCallback((): Partial<CreateArticleRequest> => {
    const summariesForSubmit = normalizeSummaries(meta.summaries, maxSummaries);
    const data: Partial<CreateArticleRequest> = {
      status: meta.status,
      post_category_ids: meta.post_category_ids.length > 0 ? meta.post_category_ids : undefined,
      post_tag_ids: meta.post_tag_ids.length > 0 ? meta.post_tag_ids : undefined,
      cover_url: meta.cover_url || undefined,
      top_img_url: meta.top_img_url || undefined,
      summaries: summariesForSubmit.length > 0 ? summariesForSubmit : undefined,
      keywords: meta.keywords || undefined,
      abbrlink: meta.abbrlink || undefined,
      show_on_home: meta.show_on_home,
      home_sort: meta.home_sort,
      pin_sort: meta.pin_sort,
      primary_color: meta.primary_color || undefined,
      is_primary_color_manual: meta.is_primary_color_manual,
      copyright: meta.copyright,
      is_reprint: meta.is_reprint,
      copyright_author: meta.copyright_author || undefined,
      copyright_author_href: meta.copyright_author_href || undefined,
      copyright_url: meta.copyright_url || undefined,
      is_doc: meta.is_doc,
      doc_series_id: meta.doc_series_id || undefined,
      doc_sort: meta.doc_sort,
    };
    const hasCustomJS = meta.custom_js.trim().length > 0;
    const customJSChanged = meta.custom_js !== initialCustomJsRef.current;
    if (isAdmin && (hasCustomJS || customJSChanged)) {
      data.extra_config = {
        custom_js: meta.custom_js,
      };
    }

    if (meta.status === "SCHEDULED") {
      const rfc = datetimeLocalToRFC3339(meta.scheduled_at);
      if (rfc) {
        data.scheduled_at = rfc;
      }
    } else {
      data.scheduled_at = "";
      const pub = datetimeLocalToRFC3339(meta.custom_published_at);
      if (pub) {
        data.custom_published_at = pub;
      }
    }

    return data;
  }, [isAdmin, maxSummaries, meta]);

  return {
    meta,
    updateField,
    updateFields,
    initFromData,
    getSubmitData,
  };
}
