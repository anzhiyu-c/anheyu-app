"use client";

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import type { CaptchaConfig } from "@/types/auth";

const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const GEETEST_SCRIPT_URL = "https://static.geetest.com/v4/gt4.js";

/** 极验 getValidate() 返回结构 */
interface GeetestValidate {
  lot_number: string;
  captcha_output: string;
  pass_token: string;
  gen_time: string;
}

/** 极验 4.0 验证实例（gt4.js 回调参数） */
interface GeetestCaptchaInstance {
  appendTo: (el: string | HTMLElement) => void;
  showCaptcha: () => void;
  getValidate: () => GeetestValidate | false;
  reset: () => void;
  onReady: (cb: () => void) => GeetestCaptchaInstance;
  onSuccess: (cb: () => void) => GeetestCaptchaInstance;
  onError: (cb: (err: { code?: string; msg?: string }) => void) => GeetestCaptchaInstance;
  onClose: (cb: () => void) => GeetestCaptchaInstance;
}

declare global {
  interface Window {
    initGeetest4?: (
      options: {
        captchaId: string;
        product?: string;
        language?: string;
        protocol?: string;
        onError?: () => void;
      },
      callback: (captcha: GeetestCaptchaInstance) => void
    ) => void;
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          callback?: (token: string) => void;
          "error-callback"?: (errorCode?: string) => void;
          "expired-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
      ready: (fn: () => void) => void;
    };
  }
}

export interface CaptchaResult {
  turnstile_token?: string;
  geetest_lot_number?: string;
  geetest_captcha_output?: string;
  geetest_pass_token?: string;
  geetest_gen_time?: string;
  image_captcha_id?: string;
  image_captcha_answer?: string;
}

export interface CaptchaWidgetRef {
  getCaptchaParams: () => CaptchaResult;
  verify: () => Promise<CaptchaResult | null>;
  refresh: () => void;
  isReady: () => boolean;
}

interface CaptchaWidgetProps {
  className?: string;
}

export const CaptchaWidget = forwardRef<CaptchaWidgetRef, CaptchaWidgetProps>(function CaptchaWidget(
  { className },
  ref
) {
  const [config, setConfig] = useState<CaptchaConfig | null>(null);
  const [imageData, setImageData] = useState<{ id: string; base64: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const [geetestResult, setGeetestResult] = useState<GeetestValidate | null>(null);
  const [geetestInstanceReady, setGeetestInstanceReady] = useState(false);
  const [geetestError, setGeetestError] = useState(false);
  const [geetestRetryKey, setGeetestRetryKey] = useState(0);
  const geetestInstanceRef = useRef<GeetestCaptchaInstance | null>(null);
  const geetestLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geetestVerifyResolveRef = useRef<((result: CaptchaResult | null) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    authApi.getCaptchaConfig().then(res => {
      if (!cancelled && res.code === 200 && res.data) {
        setConfig(res.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchImage = useCallback(async () => {
    setLoading(true);
    setAnswer("");
    try {
      const res = await authApi.generateImageCaptcha();
      if (res.code === 200 && res.data) {
        setImageData({ id: res.data.captcha_id, base64: res.data.image_base64 });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (config?.provider === "image") {
      fetchImage();
    }
  }, [config?.provider, fetchImage]);

  // Turnstile：加载脚本并渲染 widget
  useEffect(() => {
    if (config?.provider !== "turnstile" || !config.turnstile_site_key) return;

    const sitekey = config.turnstile_site_key;

    const renderWidget = () => {
      const container = turnstileContainerRef.current;
      if (!window.turnstile || !container?.isConnected) return;
      const widgetId = window.turnstile.render(container, {
        sitekey,
        theme: "auto",
        size: "normal",
        callback: (token: string) => setTurnstileToken(token),
        "error-callback": () => setTurnstileToken(null),
        "expired-callback": () => setTurnstileToken(null),
      });
      turnstileWidgetIdRef.current = widgetId;
    };

    if (window.turnstile) {
      // api.js 若以 async/defer 加载则 turnstile.ready() 会抛错；已就绪时直接 render
      queueMicrotask(renderWidget);
      return () => {
        if (turnstileWidgetIdRef.current) {
          window.turnstile?.remove(turnstileWidgetIdRef.current);
          turnstileWidgetIdRef.current = null;
        }
        setTurnstileToken(null);
      };
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    // 动态插入的 script 默认 async=true；与 Turnstile explicit 模式组合时需同步加载语义，避免 api.js 内部校验失败
    script.async = false;
    script.onload = () => {
      renderWidget();
    };
    document.head.appendChild(script);

    return () => {
      if (turnstileWidgetIdRef.current) {
        window.turnstile?.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
      setTurnstileToken(null);
    };
  }, [config?.provider, config?.turnstile_site_key]);

  // 极验 4.0：加载 gt4.js 并初始化，appendTo 到容器，onSuccess 时用 getValidate() 取结果
  useEffect(() => {
    if (config?.provider !== "geetest" || !config.geetest_captcha_id) return;

    setGeetestError(false);

    const handleUncaughtGeetestError = (event: ErrorEvent) => {
      if (
        event.message?.includes("网络错误") &&
        (event.filename?.includes("gt4") || event.filename?.includes("geetest"))
      ) {
        if (geetestLoadTimeoutRef.current) {
          clearTimeout(geetestLoadTimeoutRef.current);
          geetestLoadTimeoutRef.current = null;
        }
        setGeetestInstanceReady(false);
        setGeetestError(true);
      }
    };
    window.addEventListener("error", handleUncaughtGeetestError);
    const captchaId = config.geetest_captcha_id;
    const GEETEST_LOAD_TIMEOUT_MS = 15000;

    const init = () => {
      if (!window.initGeetest4) return;

      geetestLoadTimeoutRef.current = setTimeout(() => {
        geetestLoadTimeoutRef.current = null;
        setGeetestInstanceReady(false);
        setGeetestError(true);
      }, GEETEST_LOAD_TIMEOUT_MS);

      window.initGeetest4(
        {
          captchaId,
          product: "bind",
          language: "zho",
          protocol: typeof window !== "undefined" ? `${window.location.protocol}//` : "https://",
          onError: () => {
            if (geetestLoadTimeoutRef.current) {
              clearTimeout(geetestLoadTimeoutRef.current);
              geetestLoadTimeoutRef.current = null;
            }
            setGeetestInstanceReady(false);
            setGeetestError(true);
          },
        },
        (captchaObj: GeetestCaptchaInstance) => {
          if (geetestLoadTimeoutRef.current) {
            clearTimeout(geetestLoadTimeoutRef.current);
            geetestLoadTimeoutRef.current = null;
          }
          geetestInstanceRef.current = captchaObj;
          setGeetestInstanceReady(true);
          captchaObj.onSuccess(() => {
            const v = captchaObj.getValidate();
            if (v) {
              setGeetestResult(v);
              if (geetestVerifyResolveRef.current) {
                geetestVerifyResolveRef.current({
                  geetest_lot_number: v.lot_number,
                  geetest_captcha_output: v.captcha_output,
                  geetest_pass_token: v.pass_token,
                  geetest_gen_time: v.gen_time,
                });
                geetestVerifyResolveRef.current = null;
              }
            }
          });
          captchaObj.onClose(() => {
            if (geetestVerifyResolveRef.current) {
              geetestVerifyResolveRef.current(null);
              geetestVerifyResolveRef.current = null;
            }
          });
          captchaObj.onError(() => {
            setGeetestResult(null);
            if (geetestVerifyResolveRef.current) {
              geetestVerifyResolveRef.current(null);
              geetestVerifyResolveRef.current = null;
            }
          });
        }
      );
    };

    const cleanup = () => {
      window.removeEventListener("error", handleUncaughtGeetestError);
      if (geetestLoadTimeoutRef.current) {
        clearTimeout(geetestLoadTimeoutRef.current);
        geetestLoadTimeoutRef.current = null;
      }
      setGeetestResult(null);
      setGeetestInstanceReady(false);
      setGeetestError(false);
      geetestInstanceRef.current = null;
      if (geetestVerifyResolveRef.current) {
        geetestVerifyResolveRef.current(null);
        geetestVerifyResolveRef.current = null;
      }
    };

    if (window.initGeetest4) {
      init();
      return cleanup;
    }

    const script = document.createElement("script");
    script.src = GEETEST_SCRIPT_URL;
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);

    return cleanup;
  }, [config?.provider, config?.geetest_captcha_id, geetestRetryKey]);

  useImperativeHandle(
    ref,
    () => ({
      getCaptchaParams(): CaptchaResult {
        if (!config || config.provider === "none") return {};
        if (config.provider === "image") {
          return { image_captcha_id: imageData?.id, image_captcha_answer: answer };
        }
        if (config.provider === "turnstile" && turnstileToken) {
          return { turnstile_token: turnstileToken };
        }
        if (config.provider === "geetest" && geetestResult) {
          return {
            geetest_lot_number: geetestResult.lot_number,
            geetest_captcha_output: geetestResult.captcha_output,
            geetest_pass_token: geetestResult.pass_token,
            geetest_gen_time: geetestResult.gen_time,
          };
        }
        return {};
      },
      verify(): Promise<CaptchaResult | null> {
        if (!config || config.provider === "none") return Promise.resolve({});
        if (config.provider === "image") {
          if (imageData?.id && answer.trim()) {
            return Promise.resolve({ image_captcha_id: imageData.id, image_captcha_answer: answer });
          }
          return Promise.resolve(null);
        }
        if (config.provider === "turnstile") {
          return Promise.resolve(turnstileToken ? { turnstile_token: turnstileToken } : null);
        }
        if (config.provider === "geetest") {
          const instance = geetestInstanceRef.current;
          if (!instance || geetestError) return Promise.resolve(null);
          return new Promise<CaptchaResult | null>((resolve) => {
            geetestVerifyResolveRef.current = resolve;
            instance.showCaptcha();
          });
        }
        return Promise.resolve({});
      },
      refresh() {
        if (config?.provider === "image") fetchImage();
        if (config?.provider === "turnstile" && turnstileWidgetIdRef.current) {
          setTurnstileToken(null);
          window.turnstile?.reset(turnstileWidgetIdRef.current ?? undefined);
        }
        if (config?.provider === "geetest") {
          setGeetestResult(null);
          geetestInstanceRef.current?.reset();
        }
      },
      isReady() {
        if (!config || config.provider === "none") return true;
        if (config.provider === "image") return !!(imageData?.id && answer.trim());
        if (config.provider === "turnstile") return !!turnstileToken;
        if (config.provider === "geetest") return geetestInstanceReady;
        return true;
      },
    }),
    [config, imageData, answer, fetchImage, turnstileToken, geetestResult, geetestInstanceReady, geetestError]
  );

  if (!config || config.provider === "none") return null;

  if (config.provider === "image") {
    return (
      <div className={cn("flex w-full items-center gap-3", className)}>
        <button
          type="button"
          onClick={fetchImage}
          disabled={loading}
          className="group relative shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30 cursor-pointer transition-all duration-200 hover:border-primary/40 disabled:cursor-wait"
          title="点击刷新验证码"
        >
          {loading ? (
            <div className="flex h-[44px] w-[140px] items-center justify-center">
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : imageData ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- base64 captcha, not suitable for next/image */}
              <img
                src={imageData.base64}
                alt="验证码"
                className="h-[44px] w-[140px] object-contain dark:invert dark:hue-rotate-180"
                draggable={false}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <RefreshCw className="h-4 w-4 text-white" />
              </div>
            </>
          ) : (
            <div className="flex h-[44px] w-[140px] items-center justify-center text-xs text-muted-foreground">
              加载失败
            </div>
          )}
        </button>
        <input
          type="text"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="请输入验证码"
          maxLength={config.image_captcha_length || 6}
          autoComplete="one-time-code"
          className={cn(
            "h-11 min-w-0 flex-1 rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "outline-none transition-all duration-200",
            "focus:border-primary focus:bg-card"
          )}
        />
      </div>
    );
  }

  if (config.provider === "turnstile" && config.turnstile_site_key) {
    return (
      <div className={cn("flex flex-col gap-2 items-center", className)}>
        <div ref={turnstileContainerRef} className="min-h-[65px]" />
      </div>
    );
  }

  if (config.provider === "geetest" && config.geetest_captcha_id) {
    if (!geetestError) return null;
    return (
      <div className={cn("flex flex-col gap-2 items-center", className)}>
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">验证码加载失败</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                可能是网络问题，请点击下方按钮重试。若为本地开发，可在后台「系统设置 →
                人机验证」中切换为「图形验证码」。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setGeetestError(false);
              setGeetestRetryKey(k => k + 1);
              document.querySelectorAll('script[src*="static.geetest.com"]').forEach(s => s.remove());
              delete (window as { initGeetest4?: unknown }).initGeetest4;
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/15"
          >
            <RefreshCw className="h-4 w-4" />
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return null;
});
