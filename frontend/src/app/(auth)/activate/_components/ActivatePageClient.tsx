"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";
import { Spinner } from "@/components/ui";

type ActivateStatus = "loading" | "success" | "error";
const MISSING_PARAMS_MESSAGE = "激活链接无效：缺少必要参数。";

function ActivateInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const id = searchParams.get("id");
  const sign = searchParams.get("sign");
  const hasRequiredParams = Boolean(id && sign);

  const [status, setStatus] = useState<ActivateStatus>(hasRequiredParams ? "loading" : "error");
  const [message, setMessage] = useState(hasRequiredParams ? "" : MISSING_PARAMS_MESSAGE);
  const activatedRef = useRef(false);

  useEffect(() => {
    if (activatedRef.current) return;
    const activationId = id;
    const activationSign = sign;

    if (!hasRequiredParams || !activationId || !activationSign) {
      return;
    }

    activatedRef.current = true;

    authApi
      .activateUser(activationId, activationSign)
      .then((response) => {
        if (response.code === 200 && response.data) {
          setAuth({
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            expires: response.data.expires,
            userInfo: response.data.userInfo,
            roles: response.data.roles,
          });
          setStatus("success");
          setMessage("您的账号已成功激活！即将跳转...");
          setTimeout(() => router.push("/"), 2000);
        } else {
          setStatus("error");
          setMessage(response.message || "激活失败，请重试或联系管理员。");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("激活链接无效或已过期，请重新注册或联系管理员。");
      });
  }, [hasRequiredParams, id, sign, setAuth, router]);

  return (
    <div className="w-full max-w-[400px] mx-4">
      <div className="bg-card rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/20 border border-border overflow-hidden">
        <div className="px-10 py-12 flex flex-col items-center text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
              <h1 className="text-xl font-semibold text-foreground mb-2">
                正在激活账号
              </h1>
              <p className="text-sm text-muted-foreground">
                请稍候，正在验证您的激活链接...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-6" />
              <h1 className="text-xl font-semibold text-foreground mb-2">
                激活成功
              </h1>
              <p className="text-sm text-muted-foreground mb-6">{message}</p>
              <Link
                href="/"
                className="text-sm text-primary hover:underline font-medium"
              >
                立即前往首页
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-12 h-12 text-red-500 mb-6" />
              <h1 className="text-xl font-semibold text-foreground mb-2">
                激活失败
              </h1>
              <p className="text-sm text-muted-foreground mb-6">{message}</p>
              <div className="flex gap-4">
                <Link
                  href="/login"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  前往登录
                </Link>
                <Link
                  href="/login?register=true"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  重新注册
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ActivatePageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <ActivateInner />
    </Suspense>
  );
}
