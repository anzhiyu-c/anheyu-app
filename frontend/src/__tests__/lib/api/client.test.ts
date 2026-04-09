import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { AxiosHeaders } from "axios";
import { axiosInstance, tokenManager } from "@/lib/api/client";

const getHeader = (config: AxiosRequestConfig, key: string): string | undefined => {
  const headers = AxiosHeaders.from(config.headers as unknown as AxiosHeaders | Record<string, string> | undefined);
  const value = headers.get(key);
  return typeof value === "string" ? value : undefined;
};

const createOkResponse = (config: AxiosRequestConfig): AxiosResponse => ({
  data: { code: 200, data: null, message: "ok" },
  status: 200,
  statusText: "OK",
  headers: {},
  config: config as InternalAxiosRequestConfig,
});

describe("api client token attachment", () => {
  const originalAdapter = axiosInstance.defaults.adapter;

  beforeEach(() => {
    tokenManager.setTokenGetter(() => "test-access-token");
  });

  afterEach(() => {
    axiosInstance.defaults.adapter = originalAdapter;
    tokenManager.setTokenGetter(() => null);
  });

  it("GET /api/public 不应附带 Authorization", async () => {
    axiosInstance.defaults.adapter = async config => {
      expect(getHeader(config, "Authorization")).toBeUndefined();
      return createOkResponse(config);
    };

    await axiosInstance.get("/api/public/site-config");
  });

  it("POST /api/public 会附带 Authorization", async () => {
    axiosInstance.defaults.adapter = async config => {
      expect(getHeader(config, "Authorization")).toBe("Bearer test-access-token");
      return createOkResponse(config);
    };

    await axiosInstance.post("/api/public/comments", { content: "test" });
  });
});
