import { describe, expect, it } from "vitest";
import { parseAlbumConfig } from "@/app/(album)/album/_utils/album-config";
import type { SiteConfigData } from "@/types/site-config";

describe("parseAlbumConfig", () => {
  it("支持嵌套配置并正确解析字符串类型", () => {
    const config: SiteConfigData = {
      album: {
        layout_mode: "waterfall",
        page_size: "30",
        enable_comment: "true",
        waterfall: {
          gap: "20",
          column_count: '{"large":5,"medium":4,"small":2}',
        },
        banner: {
          tip: "相册",
          title: "我的相册",
          description: "描述",
          background: "https://example.com/banner.jpg",
        },
      },
    };

    const parsed = parseAlbumConfig(config);

    expect(parsed.layoutMode).toBe("waterfall");
    expect(parsed.pageSize).toBe(30);
    expect(parsed.enableComment).toBe(true);
    expect(parsed.waterfall.gap).toBe(20);
    expect(parsed.waterfall.columnCount).toEqual({ large: 5, medium: 4, small: 2 });
    expect(parsed.banner.title).toBe("我的相册");
  });

  it("支持扁平 key 配置", () => {
    const config = {
      "album.layout_mode": "waterfall",
      "album.page_size": "36",
      "album.enable_comment": "false",
      "album.waterfall.gap": "18",
      "album.waterfall.column_count": { large: "6", medium: 3, small: "2" },
      "album.banner.tip": "Tip",
      "album.banner.title": "Title",
      "album.banner.description": "Description",
      "album.banner.background": "bg.png",
    } as SiteConfigData;

    const parsed = parseAlbumConfig(config);

    expect(parsed.layoutMode).toBe("waterfall");
    expect(parsed.pageSize).toBe(36);
    expect(parsed.enableComment).toBe(false);
    expect(parsed.waterfall.gap).toBe(18);
    expect(parsed.waterfall.columnCount).toEqual({ large: 6, medium: 3, small: 2 });
    expect(parsed.banner.tip).toBe("Tip");
  });

  it("非法配置会回退默认值", () => {
    const config: SiteConfigData = {
      album: {
        layout_mode: "invalid",
        page_size: "NaN",
        enable_comment: "maybe",
        waterfall: {
          gap: "-1",
          column_count: "{bad-json}",
        },
      },
    };

    const parsed = parseAlbumConfig(config);

    expect(parsed.layoutMode).toBe("waterfall");
    expect(parsed.pageSize).toBe(24);
    expect(parsed.enableComment).toBe(false);
    expect(parsed.waterfall.gap).toBe(16);
    expect(parsed.waterfall.columnCount).toEqual({ large: 4, medium: 3, small: 1 });
  });
});
