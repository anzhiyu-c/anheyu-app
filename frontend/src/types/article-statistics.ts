/**
 * 文章统计页面类型定义
 * 对应后端 API: GET /api/public/articles/statistics
 */

export interface CategoryStatItem {
  name: string;
  count: number;
}

export interface TagStatItem {
  name: string;
  count: number;
}

export interface TopViewedPostItem {
  id: string;
  title: string;
  views: number;
  cover_url: string;
}

export interface PublishTrendItem {
  month: string;
  count: number;
}

export interface ArticleStatistics {
  total_posts: number;
  total_words: number;
  avg_words: number;
  total_views: number;
  category_stats: CategoryStatItem[];
  tag_stats: TagStatItem[];
  top_viewed_posts: TopViewedPostItem[];
  publish_trend: PublishTrendItem[];
}
