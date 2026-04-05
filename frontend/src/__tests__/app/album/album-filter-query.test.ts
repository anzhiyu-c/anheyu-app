import { describe, expect, it } from "vitest";
import { buildAlbumFilterQuery, parseAlbumFilterQuery } from "@/app/(album)/album/_utils/album-filter-query";

describe("album-filter-query", () => {
  it("解析合法参数", () => {
    const parsed = parseAlbumFilterQuery("?categoryId=7&sort=created_at_desc");
    expect(parsed).toEqual({
      categoryId: 7,
      sort: "created_at_desc",
    });
  });

  it("非法参数回退默认值", () => {
    const parsed = parseAlbumFilterQuery("?categoryId=abc&sort=unknown");
    expect(parsed).toEqual({
      categoryId: null,
      sort: "display_order_asc",
    });
  });

  it("构建 query 时保留无关参数", () => {
    const query = buildAlbumFilterQuery("?utm_source=x", {
      categoryId: 9,
      sort: "view_count_desc",
    });
    expect(query).toBe("?utm_source=x&categoryId=9&sort=view_count_desc");
  });

  it("默认值应移除对应参数", () => {
    const query = buildAlbumFilterQuery("?categoryId=7&sort=created_at_desc&utm_source=x", {
      categoryId: null,
      sort: "display_order_asc",
    });
    expect(query).toBe("?utm_source=x");
  });
});
