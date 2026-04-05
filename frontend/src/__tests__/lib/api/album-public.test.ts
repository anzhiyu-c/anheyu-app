import { afterEach, describe, expect, it } from "vitest";
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { axiosInstance } from "@/lib/api/client";
import { albumPublicApi } from "@/lib/api/album-public";
import { useSiteConfigStore } from "@/store/site-config-store";
import type { PublicAlbumListData } from "@/types/album";

const createOkResponse = <T>(config: AxiosRequestConfig, data: T): AxiosResponse => ({
  data: { code: 200, data, message: "ok" },
  status: 200,
  statusText: "OK",
  headers: {},
  config: config as InternalAxiosRequestConfig,
});

describe("albumPublicApi query and dynamic url", () => {
  const originalAdapter = axiosInstance.defaults.adapter;
  const originalSiteConfig = useSiteConfigStore.getState().siteConfig;

  afterEach(() => {
    axiosInstance.defaults.adapter = originalAdapter;
    useSiteConfigStore.setState({ siteConfig: originalSiteConfig });
  });

  it("优先使用 siteConfig.API_URL 拼接公开相册列表请求", async () => {
    useSiteConfigStore.setState({
      siteConfig: {
        ...originalSiteConfig,
        API_URL: "https://blog.anheyu.com/",
      },
    });

    axiosInstance.defaults.adapter = async config => {
      expect(config.url).toBe(
        "https://blog.anheyu.com/api/public/albums?page=2&pageSize=30&sort=created_at_desc&categoryId=7"
      );

      const payload: PublicAlbumListData = {
        list: [],
        total: 0,
        pageNum: 2,
        pageSize: 30,
      };
      return createOkResponse(config, payload);
    };

    const data = await albumPublicApi.getPublicAlbums({
      page: 2,
      pageSize: 30,
      sort: "created_at_desc",
      categoryId: 7,
    });

    expect(data.pageNum).toBe(2);
    expect(data.pageSize).toBe(30);
  });

  it("当 API_URL 缺失时回退到本地相对路径", async () => {
    useSiteConfigStore.setState({
      siteConfig: {
        ...originalSiteConfig,
        API_URL: "",
      },
    });

    axiosInstance.defaults.adapter = async config => {
      expect(config.url).toBe("/api/public/albums?page=1&pageSize=24&sort=display_order_asc");
      const payload: PublicAlbumListData = {
        list: [],
        total: 0,
        pageNum: 1,
        pageSize: 24,
      };
      return createOkResponse(config, payload);
    };

    const data = await albumPublicApi.getPublicAlbums();
    expect(data.pageNum).toBe(1);
    expect(data.pageSize).toBe(24);
  });

  it("当 API_URL 已包含 /api 时不重复拼接", async () => {
    useSiteConfigStore.setState({
      siteConfig: {
        ...originalSiteConfig,
        API_URL: "https://blog.anheyu.com/api/",
      },
    });

    axiosInstance.defaults.adapter = async config => {
      expect(config.url).toBe("https://blog.anheyu.com/api/public/album-categories");
      return createOkResponse(config, []);
    };

    const data = await albumPublicApi.getPublicAlbumCategories();
    expect(data).toEqual([]);
  });
});
