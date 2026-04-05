import type { Metadata } from "next";
import { LoginPageClient } from "./_components/LoginPageClient";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "登录",
    description: "账号登录与注册页面。",
    path: "/login",
    noindex: true,
  });
}

export default function LoginPage() {
  return <LoginPageClient />;
}
