import { describe, it, expect } from "vitest";
import { ADMIN_EMPTY_TEXTS } from "@/lib/constants/admin";

describe("ADMIN_EMPTY_TEXTS", () => {
  const requiredKeys = [
    "posts",
    "users",
    "albums",
    "docSeries",
    "comments",
    "friends",
    "orders",
    "supports",
    "products",
  ] as const;

  it("has entries for all admin modules", () => {
    for (const key of requiredKeys) {
      expect(ADMIN_EMPTY_TEXTS).toHaveProperty(key);
    }
  });

  it("each entry has required fields", () => {
    for (const key of requiredKeys) {
      const entry = ADMIN_EMPTY_TEXTS[key];
      expect(entry.filterEmptyText).toBeTruthy();
      expect(entry.emptyText).toBeTruthy();
    }
  });

  it("filterEmptyText follows '没有匹配的...' pattern", () => {
    for (const key of requiredKeys) {
      const entry = ADMIN_EMPTY_TEXTS[key];
      expect(entry.filterEmptyText).toMatch(/^没有匹配的/);
    }
  });

  it("community edition does not expose essays module", () => {
    expect(ADMIN_EMPTY_TEXTS).not.toHaveProperty("essays");
  });
});
