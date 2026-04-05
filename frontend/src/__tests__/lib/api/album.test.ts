import { afterEach, describe, expect, it } from "vitest";
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { axiosInstance } from "@/lib/api/client";
import { albumApi } from "@/lib/api/album";
import type { AlbumListResponse } from "@/types/album";

const createWrappedResponse = <T>(config: AxiosRequestConfig, data: T): AxiosResponse => ({
  data: { code: 200, data, message: "ok" },
  status: 200,
  statusText: "OK",
  headers: {},
  config: config as InternalAxiosRequestConfig,
});

const createRawResponse = <T>(config: AxiosRequestConfig, data: T): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: config as InternalAxiosRequestConfig,
});

function parseBody(config: AxiosRequestConfig): unknown {
  if (!config.data) return undefined;
  if (typeof config.data === "string") {
    try {
      return JSON.parse(config.data);
    } catch {
      return config.data;
    }
  }
  return config.data;
}

describe("albumApi admin endpoints", () => {
  const originalAdapter = axiosInstance.defaults.adapter;

  afterEach(() => {
    axiosInstance.defaults.adapter = originalAdapter;
  });

  it("getList 会正确拼接分页与筛选参数", async () => {
    axiosInstance.defaults.adapter = async config => {
      expect(config.url).toBe(
        "/api/albums/get?page=2&pageSize=20&categoryId=3&tag=%E9%A3%8E%E6%99%AF&sort=created_at_desc"
      );

      const payload: AlbumListResponse = {
        list: [],
        total: 0,
        pageNum: 2,
        pageSize: 20,
      };
      return createWrappedResponse(config, payload);
    };

    const data = await albumApi.getList({
      page: 2,
      pageSize: 20,
      categoryId: 3,
      tag: "风景",
      sort: "created_at_desc",
    });
    expect(data.pageNum).toBe(2);
    expect(data.pageSize).toBe(20);
  });

  it("分类接口会命中 album-categories 路径", async () => {
    let stage = 0;
    axiosInstance.defaults.adapter = async config => {
      stage += 1;
      if (stage === 1) {
        expect(config.method).toBe("get");
        expect(config.url).toBe("/api/album-categories");
        return createWrappedResponse(config, []);
      }

      if (stage === 2) {
        expect(config.method).toBe("post");
        expect(config.url).toBe("/api/album-categories");
        expect(parseBody(config)).toEqual({
          name: "风景",
          description: "自然风光",
          displayOrder: 1,
        });
        return createWrappedResponse(config, {
          id: 9,
          name: "风景",
          description: "自然风光",
          displayOrder: 1,
        });
      }

      if (stage === 3) {
        expect(config.method).toBe("put");
        expect(config.url).toBe("/api/album-categories/9");
        expect(parseBody(config)).toEqual({
          name: "风景图集",
          description: "山川湖海",
          displayOrder: 2,
        });
        return createWrappedResponse(config, {
          id: 9,
          name: "风景图集",
          description: "山川湖海",
          displayOrder: 2,
        });
      }

      expect(config.method).toBe("delete");
      expect(config.url).toBe("/api/album-categories/9");
      return createWrappedResponse(config, null);
    };

    await expect(albumApi.getCategories()).resolves.toEqual([]);
    await albumApi.createCategory({
      name: "风景",
      description: "自然风光",
      displayOrder: 1,
    });
    await albumApi.updateCategory(9, {
      name: "风景图集",
      description: "山川湖海",
      displayOrder: 2,
    });
    await expect(albumApi.deleteCategory(9)).resolves.toBeUndefined();
  });

  it("batchImportAlbums 会发送 URL 导入 payload", async () => {
    axiosInstance.defaults.adapter = async config => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/api/albums/batch-import");
      expect(parseBody(config)).toEqual({
        categoryId: 4,
        urls: ["https://img.example.com/1.jpg", "https://img.example.com/2.jpg"],
        thumbParam: "?x-oss-process=image/resize,w_400",
        bigParam: "?x-oss-process=image/quality,q_90",
        tags: ["风景", "旅行"],
        displayOrder: 0,
      });
      return createWrappedResponse(config, {
        successCount: 2,
        failCount: 0,
        skipCount: 0,
        total: 2,
      });
    };

    const result = await albumApi.batchImportAlbums({
      categoryId: 4,
      urls: ["https://img.example.com/1.jpg", "https://img.example.com/2.jpg"],
      thumbParam: "?x-oss-process=image/resize,w_400",
      bigParam: "?x-oss-process=image/quality,q_90",
      tags: ["风景", "旅行"],
      displayOrder: 0,
    });
    expect(result.successCount).toBe(2);
  });

  it("exportAlbums 会请求 blob 并返回二进制结果", async () => {
    const blob = new Blob(["zip-content"], { type: "application/zip" });

    axiosInstance.defaults.adapter = async config => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/api/albums/export");
      expect(config.responseType).toBe("blob");
      expect(parseBody(config)).toEqual({
        album_ids: [1, 2, 3],
        format: "zip",
      });
      return createRawResponse(config, blob);
    };

    const result = await albumApi.exportAlbums({
      album_ids: [1, 2, 3],
      format: "zip",
    });
    expect(result).toBe(blob);
  });

  it("importAlbums 会通过 multipart/form-data 发送表单字段", async () => {
    const formData = new FormData();
    formData.append("file", new File([new Blob(["{}"], { type: "application/json" })], "albums.json"));
    formData.append("skip_existing", "true");
    formData.append("overwrite_existing", "false");
    formData.append("default_category_id", "6");

    axiosInstance.defaults.adapter = async config => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/api/albums/import");
      expect(String(config.headers?.["Content-Type"])).toContain("multipart/form-data");

      const sentData = config.data as FormData;
      expect(sentData.get("skip_existing")).toBe("true");
      expect(sentData.get("overwrite_existing")).toBe("false");
      expect(sentData.get("default_category_id")).toBe("6");
      expect(sentData.get("file")).toBeTruthy();

      return createWrappedResponse(config, {
        total_count: 1,
        success_count: 1,
        skipped_count: 0,
        failed_count: 0,
        created_ids: [101],
      });
    };

    const result = await albumApi.importAlbums(formData);
    expect(result.success_count).toBe(1);
    expect(result.created_ids).toEqual([101]);
  });
});
