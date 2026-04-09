import { DashboardStatCard } from "@/components/admin/dashboard";

interface DashboardStatsProps {
  basicStats: {
    today_visitors: number;
    today_views: number;
    month_views: number;
    year_views: number;
  };
  contentStats: {
    total_articles: number;
    published_articles: number;
    draft_articles: number;
    total_comments: number;
    pending_comments: number;
  };
  viewsTrend: { value: number; isUp: boolean };
  visitorsTrend: { value: number; isUp: boolean };
  queries: {
    summary: { isLoading: boolean };
    content: { isLoading: boolean };
  };
}

export function DashboardStats({ basicStats, contentStats, viewsTrend, visitorsTrend, queries }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <DashboardStatCard
        title="今日访客"
        value={basicStats.today_visitors}
        icon="ri:user-line"
        trend={{ ...visitorsTrend, label: "较昨日" }}
        subtitle="独立访客数"
        isLoading={queries.summary.isLoading}
      />
      <DashboardStatCard
        title="今日浏览"
        value={basicStats.today_views}
        icon="ri:eye-line"
        trend={{ ...viewsTrend, label: "较昨日" }}
        subtitle="页面浏览量"
        isLoading={queries.summary.isLoading}
      />
      <DashboardStatCard
        title="文章总数"
        value={contentStats.total_articles}
        icon="ri:article-line"
        subtitle={`${contentStats.published_articles} 已发布 · ${contentStats.draft_articles} 草稿`}
        isLoading={queries.content.isLoading}
      />
      <DashboardStatCard
        title="评论总数"
        value={contentStats.total_comments}
        icon="ri:chat-3-line"
        subtitle={contentStats.pending_comments > 0 ? `${contentStats.pending_comments} 条待审核` : "全部已审核"}
        isLoading={queries.content.isLoading}
      />
      <DashboardStatCard
        title="本月浏览"
        value={basicStats.month_views}
        icon="ri:calendar-line"
        subtitle="累计浏览量"
        isLoading={queries.summary.isLoading}
      />
      <DashboardStatCard
        title="年度浏览"
        value={basicStats.year_views}
        icon="ri:bar-chart-line"
        subtitle="年度累计"
        isLoading={queries.summary.isLoading}
      />
    </div>
  );
}
