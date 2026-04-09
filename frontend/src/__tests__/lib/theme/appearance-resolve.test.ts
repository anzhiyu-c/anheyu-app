import { describe, expect, it } from "vitest";
import {
  parseAppearanceTokensJson,
  resolveAppearanceModeTokens,
  tryParseAppearanceTokensJson,
} from "@/lib/theme/appearance-resolve";

describe("tryParseAppearanceTokensJson", () => {
  it("accepts empty and {}", () => {
    expect(tryParseAppearanceTokensJson("")).toEqual({ ok: true, data: {} });
    expect(tryParseAppearanceTokensJson("{}")).toEqual({ ok: true, data: {} });
  });

  it("parses light/dark branches", () => {
    const raw = '{"light":{"primary":"#111111"},"dark":{"primary":"#222222"}}';
    const r = tryParseAppearanceTokensJson(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.light?.primary).toBe("#111111");
      expect(r.data.dark?.primary).toBe("#222222");
    }
  });

  it("rejects invalid JSON", () => {
    const r = tryParseAppearanceTokensJson("{not json");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.length).toBeGreaterThan(0);
    }
  });

  it("rejects non-object root", () => {
    expect(tryParseAppearanceTokensJson("[]").ok).toBe(false);
    expect(tryParseAppearanceTokensJson('"x"').ok).toBe(false);
  });

  it("rejects light or dark when array or string", () => {
    expect(tryParseAppearanceTokensJson('{"light":[]}').ok).toBe(false);
    expect(tryParseAppearanceTokensJson('{"dark":[]}').ok).toBe(false);
    expect(tryParseAppearanceTokensJson('{"light":"x"}').ok).toBe(false);
  });

  it("strips unknown keys and non-string token values", () => {
    const r = tryParseAppearanceTokensJson(
      '{"light":{"primary":"#111","extra":"x","success":true},"dark":{"foo":"bar"}}'
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.light).toEqual({ primary: "#111" });
      expect(r.data.dark).toBeUndefined();
    }
  });
});

describe("parseAppearanceTokensJson", () => {
  it("returns {} on parse failure", () => {
    expect(parseAppearanceTokensJson("{")).toEqual({});
  });
});

describe("resolveAppearanceModeTokens", () => {
  it("merges skin base with light override", () => {
    const t = resolveAppearanceModeTokens(
      "brand_blue",
      '{"light":{"primary":"#abcdef"}}',
      false
    );
    expect(t.primary).toBe("#abcdef");
    expect(t.success.length).toBeGreaterThan(0);
  });

  it("ignores invalid override JSON", () => {
    const tBad = resolveAppearanceModeTokens("brand_blue", "{", false);
    const tOk = resolveAppearanceModeTokens("brand_blue", "{}", false);
    expect(tBad).toEqual(tOk);
  });
});
