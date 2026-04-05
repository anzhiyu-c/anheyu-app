import { describe, expect, it, vi } from "vitest";
import {
  restoreCssVariables,
  snapshotCssVariables,
} from "@/app/(frontend)/air-conditioner/_utils/css-variable-snapshot";

describe("css variable snapshot", () => {
  it("会记录变量值并在恢复时对空值变量执行 removeProperty", () => {
    const reader = {
      getPropertyValue: (property: string) => {
        if (property === "--with-value") return "  #163bf2 ";
        if (property === "--empty-value") return "   ";
        return "";
      },
    };

    const snapshot = snapshotCssVariables(["--with-value", "--empty-value"], reader);

    expect(snapshot["--with-value"]).toEqual({ exists: true, value: "#163bf2" });
    expect(snapshot["--empty-value"]).toEqual({ exists: false, value: "" });

    const writer = {
      setProperty: vi.fn(),
      removeProperty: vi.fn(() => ""),
    };

    restoreCssVariables(snapshot, writer);

    expect(writer.setProperty).toHaveBeenCalledWith("--with-value", "#163bf2");
    expect(writer.removeProperty).toHaveBeenCalledWith("--empty-value");
  });
});
