"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

/**
 * 创建 QueryClient 配置
 *
 * 配置说明：
 * - staleTime: 数据多久后变为"陈旧"状态（5分钟）
 * - gcTime: 垃圾回收时间，数据多久后被清除（1小时）
 * - refetchOnWindowFocus: 窗口聚焦时不自动刷新（避免不必要的请求）
 * - retry: 失败重试次数
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 分钟
        gcTime: 1000 * 60 * 60, // 1 小时
        refetchOnWindowFocus: false,
        retry: 1,
        // 在 SSR 时不自动获取数据
        refetchOnMount: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// 浏览器端单例
let browserQueryClient: QueryClient | undefined = undefined;

/**
 * 获取 QueryClient 实例
 * 服务端每次创建新实例，客户端使用单例
 */
function getQueryClient() {
  if (typeof window === "undefined") {
    // 服务端：每次创建新实例
    return makeQueryClient();
  } else {
    // 客户端：使用单例
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * TanStack Query Provider
 *
 * 用于提供数据查询和缓存功能
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // 使用 useState 确保在 SSR 中每个请求获得独立的 QueryClient
  // 在客户端使用单例以保持缓存一致性
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 仅在开发环境显示 DevTools */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}

/**
 * 导出 queryClient 获取函数（用于服务端预取数据）
 */
export { getQueryClient };
