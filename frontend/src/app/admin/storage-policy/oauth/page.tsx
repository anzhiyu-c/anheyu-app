"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Spinner, addToast } from "@heroui/react";
import { storagePolicyApi } from "@/lib/api/storage-policy";
import { getErrorMessage } from "@/lib/api/client";

/** 避免 React Strict Mode 下 effect 重复执行时同一 code 被兑换两次 */
let oneDriveOAuthHandledKey: string | null = null;

function OneDriveOAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apiError, setApiError] = useState<string | null>(null);

  const oauthError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";

  const paramErrorMessage = useMemo(() => {
    if (oauthError) {
      return errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : oauthError;
    }
    if (!code || !state) {
      return "缺少授权参数，请从存储策略页面重新发起授权";
    }
    return null;
  }, [oauthError, errorDescription, code, state]);

  const shouldComplete = !paramErrorMessage && !!code && !!state;

  useEffect(() => {
    if (!shouldComplete || !code || !state) return;

    const dedupeKey = `${code}:${state}`;
    if (oneDriveOAuthHandledKey === dedupeKey) return;
    oneDriveOAuthHandledKey = dedupeKey;

    let cancelled = false;
    (async () => {
      try {
        await storagePolicyApi.completeOneDriveAuth({ code: code!, state });
        if (cancelled) return;
        addToast({ title: "OneDrive 授权成功", color: "success" });
        router.replace("/admin/storage");
      } catch (e) {
        if (cancelled) return;
        setApiError(getErrorMessage(e));
        addToast({ title: getErrorMessage(e), color: "danger" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldComplete, code, state, router]);

  if (paramErrorMessage || apiError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center px-4">
        <p className="text-sm text-muted-foreground max-w-md">{paramErrorMessage ?? apiError}</p>
        <Button color="primary" onPress={() => router.push("/admin/storage")}>
          返回存储策略
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center px-4">
      <Spinner size="lg" label="正在完成 OneDrive 授权…" />
    </div>
  );
}

export default function OneDriveOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[50vh]">
          <Spinner size="lg" label="加载中…" />
        </div>
      }
    >
      <OneDriveOAuthCallbackContent />
    </Suspense>
  );
}
