import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { UserCenterContent } from "./_components/UserCenterContent";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "用户中心",
    description: "管理个人资料、密码、通知设置等",
    path: "/user-center",
  });
}

export default function UserCenterPage() {
  return <UserCenterContent />;
}
