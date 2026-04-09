"use client";

import { usePublicCategories, usePublicLinks } from "@/hooks/queries/use-friends";
import { Loader2 } from "lucide-react";
import { SiteCardGroup } from "./SiteCardGroup";
import { FlinkList } from "./FlinkList";
import type { LinkCategory } from "@/types/friends";

function CategorySection({ category }: { category: LinkCategory }) {
  const { data, isPending } = usePublicLinks({ category_id: category.id, pageSize: 200 });
  const links = data?.list || [];
  const total = data?.total || 0;

  return (
    <div className="link-group" data-category-id={category.id}>
      <div className="power_title_bar">
        <h2 id={category.name}>
          <a href={`#${category.name}`} className="headerlink">
            {category.name} ({total})
          </a>
        </h2>
        {category.description && <div className="flink-desc">{category.description}</div>}
      </div>

      {category.style === "card" ? <SiteCardGroup links={links} /> : <FlinkList links={links} />}

      {isPending && (
        <div className="loading-tip">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
          正在加载...
        </div>
      )}
    </div>
  );
}

export function LinkListSection() {
  const { data: categories, isPending, isError } = usePublicCategories();

  if (isPending) {
    return (
      <div className="loading-tip" style={{ padding: "40px 0" }}>
        <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
        加载中...
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm" style={{ color: "var(--anzhiyu-secondtext)" }}>
        加载友链分类失败，请稍后再试。
      </p>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--anzhiyu-secondtext)" }}>
        暂无友链分类
      </p>
    );
  }

  return (
    <div id="article-container" className="flink">
      {categories.map(category => (
        <CategorySection key={category.id} category={category} />
      ))}
    </div>
  );
}
