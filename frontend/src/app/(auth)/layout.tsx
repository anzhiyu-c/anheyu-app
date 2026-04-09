import type { Metadata } from "next";
import { createRobotsMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "账号认证",
  description: "账号登录与第三方登录回调页面",
  robots: createRobotsMetadata(false),
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-muted">
      {children}
    </div>
  );
}
