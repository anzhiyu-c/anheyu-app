import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosHeaders } from "axios";
import type { ApiResponse } from "@/types";
import type { RefreshTokenResponseData } from "@/types/auth";

/**
 * API 客户端配置
 *
 * 使用 Next.js rewrites 代理：
 * - 客户端请求使用相对路径（/api/xxx），由 Next.js 代理到后端
 * - 服务端请求需要完整 URL
 */
const API_TIMEOUT = 30000; // 30 秒超时

/**
 * Token 管理器
 * 提供统一的 token 获取/设置/清除接口
 * 支持与 Zustand store 集成
 */
class TokenManager {
  private static instance: TokenManager;
  private getTokenFn: (() => string | null) | null = null;
  private getRefreshTokenFn: (() => string | null) | null = null;
  private clearTokenFn: (() => void) | null = null;
  private updateTokenFn: ((accessToken: string, expires: string) => void) | null = null;

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * 设置 token 获取函数（用于与 Zustand store 集成）
   */
  setTokenGetter(fn: () => string | null): void {
    this.getTokenFn = fn;
  }

  /**
   * 设置 refresh token 获取函数（用于与 Zustand store 集成）
   */
  setRefreshTokenGetter(fn: () => string | null): void {
    this.getRefreshTokenFn = fn;
  }

  /**
   * 设置 token 清除函数（用于与 Zustand store 集成）
   */
  setTokenClearer(fn: () => void): void {
    this.clearTokenFn = fn;
  }

  /**
   * 设置 token 更新函数（用于与 Zustand store 集成）
   */
  setTokenUpdater(fn: (accessToken: string, expires: string) => void): void {
    this.updateTokenFn = fn;
  }

  /**
   * 获取 token
   * 优先使用注入的函数，否则从 localStorage 获取
   */
  getToken(): string | null {
    if (typeof window === "undefined") return null;

    // 优先使用注入的 getter（来自 Zustand store）
    if (this.getTokenFn) {
      return this.getTokenFn();
    }

    // 回退到 localStorage（兼容性）
    try {
      const authStorage = localStorage.getItem("auth-storage");
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.accessToken || null;
      }
    } catch {
      // 忽略解析错误
    }

    return null;
  }

  /**
   * 获取 refresh token
   * 优先使用注入的函数，否则从 localStorage 获取
   */
  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;

    if (this.getRefreshTokenFn) {
      return this.getRefreshTokenFn();
    }

    try {
      const authStorage = localStorage.getItem("auth-storage");
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.refreshToken || null;
      }
    } catch {
      // 忽略解析错误
    }

    return null;
  }

  /**
   * 清除 token
   */
  clearToken(): void {
    if (this.clearTokenFn) {
      this.clearTokenFn();
    }
  }

  /**
   * 更新 token（刷新后调用）
   */
  updateToken(accessToken: string, expires: string): void {
    if (this.updateTokenFn) {
      this.updateTokenFn(accessToken, expires);
      return;
    }

    if (typeof window === "undefined") return;

    try {
      const authStorage = localStorage.getItem("auth-storage");
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        const nextState = {
          ...parsed,
          state: {
            ...parsed.state,
            accessToken,
            expires,
          },
        };
        localStorage.setItem("auth-storage", JSON.stringify(nextState));
      }
    } catch {
      // 忽略解析错误
    }
  }
}

export const tokenManager = TokenManager.getInstance();

const AUTH_WHITELIST = ["/api/auth/refresh-token", "/api/auth/login", "/api/auth/register", "/api/auth/check-email"];
const PUBLIC_PREFIX = "/api/public/";

interface RetryableRequestConfig extends AxiosRequestConfig {
  _isRetryAfterRefresh?: boolean;
}

const isAuthEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return AUTH_WHITELIST.some(path => url.includes(path));
};

const isPublicEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return url.includes(PUBLIC_PREFIX);
};

const shouldAttachAccessToken = (config: AxiosRequestConfig): boolean => {
  if ((config as RetryableRequestConfig)._isRetryAfterRefresh) {
    return false;
  }
  if (config.headers?.Authorization) {
    return false;
  }
  if (isAuthEndpoint(config.url)) {
    return false;
  }
  const method = config.method?.toLowerCase();
  if (method === "get" && isPublicEndpoint(config.url)) {
    return false;
  }
  return true;
};

const dispatchUnauthorized = (): void => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
};

/**
 * 获取 API 基础地址
 * - 客户端：使用空字符串（相对路径，通过 Next.js rewrites 代理）
 * - 服务端：使用后端完整 URL
 */
function getApiBaseUrl(): string {
  // 客户端：使用相对路径，让 Next.js rewrites 代理
  if (typeof window !== "undefined") {
    return "";
  }

  // 服务端：需要完整 URL
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8091";
  return backendUrl;
}

function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return path;
  return `${baseUrl}${path}`;
}

interface RetryRequest {
  config: AxiosRequestConfig;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

let isRefreshing = false;
let retryQueue: RetryRequest[] = [];

function addRetryRequest(config: AxiosRequestConfig): Promise<unknown> {
  return new Promise((resolve, reject) => {
    retryQueue.push({ config, resolve, reject });
  });
}

function processQueue(token?: string, error?: Error): void {
  retryQueue.forEach(item => {
    if (error) {
      item.reject(error);
      return;
    }
    if (token) {
      item.config.headers = item.config.headers ?? {};
      item.config.headers.Authorization = `Bearer ${token}`;
      (item.config as RetryableRequestConfig)._isRetryAfterRefresh = true;
      item.resolve(axiosInstance(item.config));
    }
  });
  retryQueue = [];
}

/** 认证过期错误标记，用于区分预期的登录过期和意外错误 */
class AuthExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthExpiredError";
  }
}

async function handleRefreshToken(): Promise<string> {
  const refreshToken = tokenManager.getRefreshToken();
  if (!refreshToken) {
    throw new AuthExpiredError("登录已过期，请重新登录");
  }

  const response = await axios.post<ApiResponse<RefreshTokenResponseData>>(
    buildApiUrl("/api/auth/refresh-token"),
    { refreshToken },
    {
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
      timeout: API_TIMEOUT,
    }
  );

  const data = response.data?.data;
  if (!data?.accessToken || !data?.expires) {
    throw new Error("刷新 token 响应缺少必要字段");
  }

  tokenManager.updateToken(data.accessToken, data.expires);
  return data.accessToken;
}

/**
 * 创建 axios 实例
 */
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: API_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // 请求拦截器
  instance.interceptors.request.use(
    config => {
      // FormData 上传必须由浏览器设置 multipart boundary；默认的 application/json 会导致 Gin 无法解析 multipart
      if (config.data instanceof FormData) {
        const headers = AxiosHeaders.from(config.headers ?? {});
        headers.delete("Content-Type");
        config.headers = headers;
      }

      if (!shouldAttachAccessToken(config)) {
        return config;
      }

      const token = tokenManager.getToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    error => {
      return Promise.reject(error);
    }
  );

  // 响应拦截器
  instance.interceptors.response.use(
    response => {
      return response;
    },
    async (error: AxiosError) => {
      // 统一错误处理
      if (error.response) {
        // 服务器返回了错误响应
        const status = error.response.status;
        switch (status) {
          case 401:
            // 登录/刷新接口自身返回 401，不触发刷新
            if (isAuthEndpoint(error.config?.url)) {
              if (error.config?.url?.includes("/api/auth/refresh-token")) {
                tokenManager.clearToken();
                dispatchUnauthorized();
              }
              return Promise.reject(error);
            }

            if (!isRefreshing) {
              isRefreshing = true;
              try {
                const newAccessToken = await handleRefreshToken();
                processQueue(newAccessToken);
                if (!error.config) {
                  return Promise.reject(error);
                }

                const headers = AxiosHeaders.from(error.config.headers ?? {});
                headers.set("Authorization", `Bearer ${newAccessToken}`);
                error.config.headers = headers;
                (error.config as RetryableRequestConfig)._isRetryAfterRefresh = true;
                return axiosInstance(error.config);
              } catch (refreshError) {
                processQueue(undefined, refreshError as Error);
                tokenManager.clearToken();
                dispatchUnauthorized();
                return Promise.reject(refreshError);
              } finally {
                isRefreshing = false;
              }
            }

            if (!error.config) {
              return Promise.reject(error);
            }
            return addRetryRequest(error.config);
          case 403:
            console.error("没有权限访问该资源");
            break;
          case 404:
            console.error("请求的资源不存在");
            break;
          case 500:
            console.error("服务器内部错误");
            break;
        }
      } else if (error.request) {
        // 请求发出但没有收到响应
        if (process.env.NODE_ENV === "development") {
          console.warn(`[API] 网络错误: ${error.config?.url} - 请确保后端服务已启动`);
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

/**
 * Axios 实例
 */
const axiosInstance = createAxiosInstance();

/**
 * API 客户端类
 * 封装常用的 HTTP 方法，提供类型安全的 API 调用
 */
class ApiClient {
  private instance: AxiosInstance;

  constructor(instance: AxiosInstance) {
    this.instance = instance;
  }

  /**
   * GET 请求
   */
  async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.get<ApiResponse<T>>(endpoint, config);
    return response.data;
  }

  /**
   * POST 请求
   */
  async post<T>(endpoint: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.post<ApiResponse<T>>(endpoint, data, config);
    return response.data;
  }

  /**
   * PUT 请求
   */
  async put<T>(endpoint: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.put<ApiResponse<T>>(endpoint, data, config);
    return response.data;
  }

  /**
   * PATCH 请求
   */
  async patch<T>(endpoint: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.patch<ApiResponse<T>>(endpoint, data, config);
    return response.data;
  }

  /**
   * DELETE 请求
   */
  async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.delete<ApiResponse<T>>(endpoint, config);
    return response.data;
  }

  /**
   * 设置认证 token
   */
  setToken(token: string): void {
    this.instance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  /**
   * 清除认证 token
   */
  clearToken(): void {
    delete this.instance.defaults.headers.common["Authorization"];
  }
}

/**
 * 导出 API 客户端实例
 */
export const apiClient = new ApiClient(axiosInstance);

/**
 * 导出 axios 实例（用于特殊场景）
 */
export { axiosInstance, AuthExpiredError };

/**
 * API 错误类型
 */
export interface ApiError {
  code: number;
  message: string;
  details?: unknown;
}

/**
 * 判断是否为 API 错误
 */
export function isApiError(error: unknown): error is AxiosError<ApiResponse<unknown>> {
  return axios.isAxiosError(error);
}

/**
 * 获取错误信息
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.response?.data?.message || error.message || "请求失败";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "未知错误";
}
