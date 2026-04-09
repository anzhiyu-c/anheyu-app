import { afterEach, describe, expect, it } from "vitest";
import {
  applyAppearanceModeTokensToDocument,
  clearSiteAppearanceOverrides,
} from "@/utils/site-theme-colors";

const FULL: Parameters<typeof applyAppearanceModeTokensToDocument>[0] = {
  primary: "#163bf2",
  primaryForeground: "#ffffff",
  success: "#57bd6a",
  warning: "#c28b00",
  danger: "#d80020",
  info: "#3e86f6",
  accent: "#7c3aed",
};

describe("applyAppearanceModeTokensToDocument", () => {
  afterEach(() => {
    clearSiteAppearanceOverrides();
  });

  it("writes primary and semantic colors", () => {
    applyAppearanceModeTokensToDocument(FULL);
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--primary").trim().toLowerCase()).toBe("#163bf2");
    expect(root.getPropertyValue("--green").trim().toLowerCase()).toBe("#57bd6a");
  });

  it("removes --primary-foreground when hex invalid", () => {
    applyAppearanceModeTokensToDocument(FULL);
    expect(document.documentElement.style.getPropertyValue("--primary-foreground")).toBeTruthy();
    applyAppearanceModeTokensToDocument({
      ...FULL,
      primaryForeground: "not-a-color",
    });
    expect(document.documentElement.style.getPropertyValue("--primary-foreground")).toBe("");
  });
});
