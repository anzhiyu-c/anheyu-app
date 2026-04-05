"use client";

import { useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@heroui/react";
import { addToast } from "@heroui/react";
import { FaEnvelope, FaArrowLeft, FaLock, FaCircleCheck, FaKey } from "react-icons/fa6";
import { authApi } from "@/lib/api/auth";
import { CaptchaWidget, type CaptchaResult, type CaptchaWidgetRef } from "@/components/auth/CaptchaWidget";

type Step = "email" | "sent" | "reset";

function ForgotPasswordInner() {
  const searchParams = useSearchParams();
  const resetId = searchParams.get("id");
  const resetSign = searchParams.get("sign");

  const initialStep: Step = resetId && resetSign ? "reset" : "email";

  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const captchaRef = useRef<CaptchaWidgetRef>(null);

  const handleSendResetEmail = useCallback(async () => {
    if (!email.trim()) {
      setEmailError("请输入邮箱地址");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("请输入正确的邮箱格式");
      return;
    }
    setEmailError("");

    let captchaParams: CaptchaResult = {};
    if (captchaRef.current) {
      const result = await captchaRef.current.verify();
      if (result === null) return;
      captchaParams = result;
    }

    setIsLoading(true);

    try {
      const res = await authApi.forgotPassword({
        email: email.trim(),
        ...captchaParams,
      });
      if (res.code === 200) {
        setStep("sent");
        addToast({ title: "重置邮件已发送", color: "success" });
      } else {
        addToast({ title: res.message || "发送失败", color: "danger" });
        captchaRef.current?.refresh();
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "发送失败，请稍后重试";
      addToast({ title: msg, color: "danger" });
      captchaRef.current?.refresh();
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handleResetPassword = useCallback(async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("密码至少 6 个字符");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("两次输入的密码不一致");
      return;
    }
    if (!resetId || !resetSign) {
      setPasswordError("重置链接无效");
      return;
    }
    setPasswordError("");
    setIsLoading(true);

    try {
      const res = await authApi.resetPassword({
        id: resetId,
        sign: resetSign,
        password: newPassword,
        repeat_password: confirmPassword,
      });
      if (res.code === 200) {
        addToast({ title: "密码重置成功！请使用新密码登录", color: "success" });
        window.location.href = "/login";
      } else {
        addToast({ title: res.message || "重置失败", color: "danger" });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "重置失败，请稍后重试";
      addToast({ title: msg, color: "danger" });
    } finally {
      setIsLoading(false);
    }
  }, [newPassword, confirmPassword, resetId, resetSign]);

  return (
    <div className="w-full max-w-md px-6">
      <div
        className="rounded-2xl p-8"
        style={{
          background: "var(--anzhiyu-card-bg)",
          border: "var(--style-border)",
          boxShadow: "var(--anzhiyu-shadow-border)",
        }}
      >
        {step === "email" && (
          <>
            <div className="mb-6 text-center">
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: "var(--anzhiyu-theme-op)", color: "var(--anzhiyu-main)" }}
              >
                <FaKey className="text-2xl" />
              </div>
              <h2 className="text-xl font-bold" style={{ color: "var(--anzhiyu-fontcolor)" }}>
                忘记密码
              </h2>
              <p className="mt-2 text-sm" style={{ color: "var(--anzhiyu-secondtext)" }}>
                请输入您的注册邮箱地址，我们将发送重置链接
              </p>
            </div>

            <div className="space-y-4">
              <Input
                value={email}
                onValueChange={setEmail}
                placeholder="电子邮箱"
                type="email"
                size="lg"
                startContent={<FaEnvelope className="text-default-400" />}
                isInvalid={!!emailError}
                errorMessage={emailError}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSendResetEmail();
                }}
              />

              <CaptchaWidget ref={captchaRef} />

              <Button
                color="primary"
                size="lg"
                className="w-full font-medium"
                isLoading={isLoading}
                onPress={handleSendResetEmail}
              >
                发送重置邮件
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-sm transition-colors hover:underline"
                  style={{ color: "var(--anzhiyu-main)" }}
                >
                  <FaArrowLeft className="text-xs" />
                  返回登录
                </Link>
              </div>
            </div>
          </>
        )}

        {step === "sent" && (
          <div className="text-center">
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "rgba(87, 189, 106, 0.1)", color: "var(--anzhiyu-green)" }}
            >
              <FaCircleCheck className="text-3xl" />
            </div>
            <h2 className="mb-2 text-xl font-bold" style={{ color: "var(--anzhiyu-fontcolor)" }}>
              邮件已发送
            </h2>
            <p className="mb-6 text-sm" style={{ color: "var(--anzhiyu-secondtext)" }}>
              重置密码链接已发送到 <strong>{email}</strong>，请查看您的邮箱。
            </p>
            <div className="space-y-3">
              <Button variant="flat" className="w-full" onPress={() => setStep("email")}>
                重新发送
              </Button>
              <Link href="/login">
                <Button color="primary" className="w-full">
                  返回登录
                </Button>
              </Link>
            </div>
          </div>
        )}

        {step === "reset" && (
          <>
            <div className="mb-6 text-center">
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: "var(--anzhiyu-theme-op)", color: "var(--anzhiyu-main)" }}
              >
                <FaLock className="text-2xl" />
              </div>
              <h2 className="text-xl font-bold" style={{ color: "var(--anzhiyu-fontcolor)" }}>
                重置密码
              </h2>
              <p className="mt-2 text-sm" style={{ color: "var(--anzhiyu-secondtext)" }}>
                请输入您的新密码
              </p>
            </div>

            <div className="space-y-4">
              <Input
                value={newPassword}
                onValueChange={setNewPassword}
                placeholder="新密码（至少 6 个字符）"
                type="password"
                size="lg"
                startContent={<FaLock className="text-default-400" />}
                isInvalid={!!passwordError}
              />
              <Input
                value={confirmPassword}
                onValueChange={setConfirmPassword}
                placeholder="确认新密码"
                type="password"
                size="lg"
                startContent={<FaLock className="text-default-400" />}
                isInvalid={!!passwordError}
                errorMessage={passwordError}
                onKeyDown={e => {
                  if (e.key === "Enter") handleResetPassword();
                }}
              />

              <Button
                color="primary"
                size="lg"
                className="w-full font-medium"
                isLoading={isLoading}
                onPress={handleResetPassword}
              >
                重置密码
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-sm transition-colors hover:underline"
                  style={{ color: "var(--anzhiyu-main)" }}
                >
                  <FaArrowLeft className="text-xs" />
                  返回登录
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ForgotPasswordPageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <ForgotPasswordInner />
    </Suspense>
  );
}
