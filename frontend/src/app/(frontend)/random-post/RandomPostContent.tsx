"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { articleApi } from "@/lib/api/article";

export function RandomPostContent() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function redirect() {
      try {
        const data = await articleApi.getRandomArticle();

        if (cancelled) return;

        if (data.is_doc) {
          router.replace(`/doc/${data.id}`);
        } else {
          router.replace(`/posts/${data.id}`);
        }
      } catch {
        if (!cancelled) {
          router.replace("/");
        }
      }
    }

    redirect();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
        fontSize: "1rem",
        color: "var(--anzhiyu-secondtext, #666)",
      }}
    >
      正在随机跳转文章...
    </div>
  );
}
