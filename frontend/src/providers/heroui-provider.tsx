/*
 * @Description: HeroUI Provider
 * @Author: 安知鱼
 * @Date: 2026-01-31 16:00:00
 * @LastEditTime: 2026-01-31 16:00:00
 * @LastEditors: 安知鱼
 */
"use client";

import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { useRouter } from "next/navigation";

export function HeroUIProviderWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <ToastProvider placement="top-center" toastOffset={16} />
      {children}
    </HeroUIProvider>
  );
}
