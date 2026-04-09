import { describe, expect, it } from "vitest";
import { buildPageMetadata } from "@/lib/seo";

describe("buildPageMetadata canonical policy", () => {
  it("noindex 页面默认不输出 canonical", async () => {
    const metadata = await buildPageMetadata({
      title: "登录",
      description: "登录页面",
      path: "/login",
      noindex: true,
      siteConfig: {
        APP_NAME: "安和鱼",
        SUB_TITLE: "生活明朗，万物可爱",
      },
    });

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it("显式 includeCanonical=true 时 noindex 页面仍可输出 canonical", async () => {
    const metadata = await buildPageMetadata({
      title: "登录",
      description: "登录页面",
      path: "/login",
      noindex: true,
      includeCanonical: true,
      siteConfig: {
        APP_NAME: "安和鱼",
        SUB_TITLE: "生活明朗，万物可爱",
      },
    });

    expect(metadata.alternates).toMatchObject({
      canonical: "/login",
    });
  });
});
