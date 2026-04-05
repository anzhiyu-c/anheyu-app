"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui";
import { LoginForm } from "@/components/auth";

function LoginPageInner() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/admin";
  const registerParam = searchParams.get("register");
  const initialStep = registerParam ? "register" : undefined;

  return <LoginForm redirectUrl={redirectUrl} initialStep={initialStep} />;
}

export function LoginPageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
