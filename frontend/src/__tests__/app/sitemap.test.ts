import { describe, expect, it } from "vitest";
import { buildPaginationPaths, collectConfigInternalPaths, normalizeSitemapCandidatePath } from "@/app/sitemap";
import type { SiteConfigData } from "@/types/site-config";

describe("sitemap helpers", () => {
  it("buildPaginationPaths 能正确生成分页路径", () => {
    const paths = buildPaginationPaths("/categories/frontend", 25, 10);
    expect(paths).toEqual(["/categories/frontend/page/2", "/categories/frontend/page/3"]);
  });

  it("normalizeSitemapCandidatePath 能过滤不可索引路径", () => {
    expect(normalizeSitemapCandidatePath("https://blog.anheyu.com/about")).toBeNull();
    expect(normalizeSitemapCandidatePath("/admin/dashboard")).toBeNull();
    expect(normalizeSitemapCandidatePath("/callback/qq")).toBeNull();
    expect(normalizeSitemapCandidatePath("javascript:alert(1)")).toBeNull();
    expect(normalizeSitemapCandidatePath("tags?sort=name")).toBe("/tags");
    expect(normalizeSitemapCandidatePath("/recentcomments#list")).toBe("/recentcomments");
  });

  it("collectConfigInternalPaths 会提取内部路由并去重", () => {
    const config: SiteConfigData = {
      ABOUT_LINK: "/about-me",
      HOME_TOP: {
        banner: { link: "music" },
        category: [
          { name: "分类", path: "/categories" },
          { name: "外链", path: "https://example.com", isExternal: true },
        ],
      },
      header: {
        nav: {
          menu: [
            {
              title: "导航",
              items: [
                { name: "归档", link: "/archives", icon: "ri:archive-line" },
                { name: "后台", link: "/admin/dashboard", icon: "ri:settings-line" },
              ],
            },
          ],
        },
        menu: [
          {
            title: "自定义页",
            type: "direct",
            path: "/custom-page",
          },
          {
            title: "外链菜单",
            type: "direct",
            path: "https://example.com",
            isExternal: true,
          },
          {
            title: "更多",
            type: "dropdown",
            items: [
              { title: "相册", path: "/album" },
              { title: "登录", path: "/login" },
            ],
          },
        ],
      },
      footer: {
        bar: {
          linkList: [
            { text: "友链", link: "/link" },
            { text: "友链重复", link: "/link" },
            { text: "外链", link: "https://example.com", external: true },
          ],
        },
        project: {
          list: [
            {
              title: "导航",
              links: [
                { title: "朋友圈", link: "/fcircle" },
                { title: "外链", link: "https://example.com", external: true },
              ],
            },
          ],
        },
      },
    };

    const paths = collectConfigInternalPaths(config);

    expect(paths).toContain("/about-me");
    expect(paths).toContain("/music");
    expect(paths).toContain("/categories");
    expect(paths).toContain("/archives");
    expect(paths).toContain("/custom-page");
    expect(paths).toContain("/album");
    expect(paths).toContain("/link");
    expect(paths).toContain("/fcircle");

    expect(paths).not.toContain("/admin/dashboard");
    expect(paths).not.toContain("/login");
    expect(paths.filter(path => path === "/link")).toHaveLength(1);
  });
});
