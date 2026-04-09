import type { Metadata } from "next";
import { createRobotsMetadata } from "@/lib/seo";
import { ForgotPasswordPageClient } from "./_components/ForgotPasswordPageClient";

export const metadata: Metadata = {
  title: "忘记密码",
  description: "重置您的账号密码",
  robots: createRobotsMetadata(false),
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />;
}
