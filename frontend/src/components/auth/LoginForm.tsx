/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-01-31 14:55:41
 * @LastEditTime: 2026-02-07 20:31:24
 * @LastEditors: 安知鱼
 */
"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { ArrowLeft, Eye, EyeOff, Lock, User, Loader2 } from "lucide-react";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/react";
import { Input } from "@/components/ui";
import { authApi as authService } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";
import { useSiteConfigStore } from "@/store/site-config-store";
import { ThemeToggle } from "@/components/common";
import { CaptchaWidget, type CaptchaWidgetRef } from "./CaptchaWidget";
import { cn } from "@/lib/utils";

// 邮箱图标
function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 3.5H7C4 3.5 2 5 2 8.5V15.5C2 19 4 20.5 7 20.5H17C20 20.5 22 19 22 15.5V8.5C22 5 20 3.5 17 3.5ZM17.47 9.59L14.34 12.09C13.68 12.62 12.84 12.88 12 12.88C11.16 12.88 10.31 12.62 9.66 12.09L6.53 9.59C6.21 9.33 6.16 8.85 6.41 8.53C6.67 8.21 7.14 8.15 7.46 8.41L10.59 10.91C11.35 11.52 12.64 11.52 13.4 10.91L16.53 8.41C16.85 8.15 17.33 8.2 17.58 8.53C17.84 8.85 17.79 9.33 17.47 9.59Z" />
    </svg>
  );
}

type Step = "check-email" | "login-password" | "confirm-register" | "register";

interface LoginFormProps {
  redirectUrl?: string;
  initialStep?: Step;
}

// 主按钮组件 - 紧凑版
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: "primary" | "ghost";
}

function Button({ children, isLoading, variant = "primary", className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "w-full h-11 rounded-[8px] text-sm font-medium transition-all duration-200 ease-out cursor-pointer",
        "disabled:opacity-70 disabled:cursor-not-allowed",
        variant === "primary" && [
          "bg-primary text-primary-foreground shadow-primary",
          "hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]",
        ],
        variant === "ghost" && [
          "text-muted-foreground",
          "hover:text-primary hover:bg-primary-op-light",
          "active:bg-primary-op",
        ],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">
        {isLoading && (
          <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </span>
    </button>
  );
}

// 动画变体
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// 彩虹聚合登录方式配置（图标 + 颜色 + 标签）
const RAINBOW_METHOD_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  qq: { label: "QQ登录", color: "#12B7F5", icon: "ri:qq-fill" },
  wechat: { label: "微信登录", color: "#07C160", icon: "ri:wechat-fill" },
  alipay: { label: "支付宝登录", color: "#1677FF", icon: "ri:alipay-fill" },
  weibo: { label: "微博登录", color: "#E6162D", icon: "ri:weibo-fill" },
  baidu: { label: "百度登录", color: "#2932E1", icon: "ri:baidu-fill" },
  douyin: { label: "抖音登录", color: "#000000", icon: "ri:tiktok-fill" },
  github: { label: "GitHub登录", color: "#24292E", icon: "ri:github-fill" },
  gitee: { label: "Gitee登录", color: "#C71D23", icon: "ri:git-repository-fill" },
  google: { label: "Google登录", color: "#4285F4", icon: "ri:google-fill" },
  microsoft: { label: "Microsoft登录", color: "#00A4EF", icon: "ri:microsoft-fill" },
  facebook: { label: "Facebook登录", color: "#1877F2", icon: "ri:facebook-fill" },
  twitter: { label: "Twitter登录", color: "#1DA1F2", icon: "mdi:twitter" },
  dingtalk: { label: "钉钉登录", color: "#0089FF", icon: "ri:chat-3-fill" },
};

// 默认 Logo 路径
const DEFAULT_LOGO_DAY = "/static/img/logo-horizontal-day.png";
const DEFAULT_LOGO_NIGHT = "/static/img/logo-horizontal-night.png";

export function LoginForm({ redirectUrl = "/admin", initialStep }: LoginFormProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const setAuth = useAuthStore(state => state.setAuth);
  const { getTitle, getHorizontalLogo, enableRegistration } = useSiteConfigStore();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const registrationEnabled = mounted && enableRegistration();

  // 获取当前主题对应的横向 Logo
  const isDark = mounted ? resolvedTheme === "dark" : false;
  const defaultLogo = isDark ? DEFAULT_LOGO_NIGHT : DEFAULT_LOGO_DAY;
  const configLogo = mounted ? getHorizontalLogo(isDark) : null;
  const logoSrc = configLogo || defaultLogo;
  const siteName = mounted ? getTitle() : "AnHeYu";

  const captchaRef = useRef<CaptchaWidgetRef>(null);

  const [step, setStep] = useState<Step>(initialStep ?? "check-email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- will be used when OAuth handlers are implemented
  const [oauthLoading, setOauthLoading] = useState(false);

  // OAuth 配置
  const oauthConfig = siteConfig?.oauth;

  // 彩虹聚合登录方式
  const rainbowLoginMethods = useMemo(() => {
    if (!oauthConfig?.rainbow?.enable) return [];
    const methods = oauthConfig.rainbow.login_methods || "";
    return methods
      .split(",")
      .map(m => m.trim())
      .filter(Boolean);
  }, [oauthConfig]);

  // 是否有任何 OAuth 登录方式启用
  const hasOAuthProviders = useMemo(() => {
    return !!(
      oauthConfig?.qq?.enable ||
      oauthConfig?.wechat?.enable ||
      oauthConfig?.logto?.enable ||
      oauthConfig?.oidc?.enable ||
      rainbowLoginMethods.length > 0
    );
  }, [oauthConfig, rainbowLoginMethods]);

  const switchStep = (targetStep: Step) => {
    setStep(targetStep);
    setError("");
    if (targetStep === "check-email") {
      setPassword("");
      setRepeatPassword("");
      setNickname("");
    }
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleCheckEmail = async () => {
    if (!email) {
      setError("请输入邮箱地址");
      return;
    }
    if (!validateEmail(email)) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await authService.checkEmail(email);
      if (response.code === 200) {
        if (response.data?.exists) {
          switchStep("login-password");
        } else if (registrationEnabled) {
          switchStep("confirm-register");
        } else {
          setError("该账号不存在，且站点未开放注册");
        }
      } else {
        addToast({ title: response.message || "检查邮箱失败", color: "danger", timeout: 3000 });
      }
    } catch (err) {
      // 检查邮箱失败时，默认进入密码登录步骤
      console.warn("检查邮箱失败:", getErrorMessage(err));
      switchStep("login-password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (skipCaptcha = false) => {
    if (!password) {
      addToast({ title: "请输入密码", color: "warning", timeout: 3000 });
      return;
    }

    let captchaParams = {};
    if (!skipCaptcha && captchaRef.current) {
      const result = await captchaRef.current.verify();
      if (result === null) return;
      captchaParams = result;
    }

    setIsLoading(true);

    try {
      const response = await authService.login({ email, password, ...captchaParams });
      if (response.code === 200 && response.data) {
        setAuth({
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
          expires: response.data.expires,
          userInfo: response.data.userInfo,
          roles: response.data.roles,
        });
        addToast({ title: "登录成功", color: "success", timeout: 3000 });
        router.push(redirectUrl);
      } else {
        addToast({ title: response.message || "登录失败", color: "danger", timeout: 3000 });
        captchaRef.current?.refresh();
      }
    } catch (err) {
      addToast({ title: getErrorMessage(err), color: "danger", timeout: 3000 });
      captchaRef.current?.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email) {
      addToast({ title: "请输入邮箱地址", color: "warning", timeout: 3000 });
      return;
    }
    if (!validateEmail(email)) {
      addToast({ title: "请输入有效的邮箱地址", color: "warning", timeout: 3000 });
      return;
    }
    if (!nickname) {
      addToast({ title: "请输入昵称", color: "warning", timeout: 3000 });
      return;
    }
    if (!password) {
      addToast({ title: "请输入密码", color: "warning", timeout: 3000 });
      return;
    }
    if (password.length < 6) {
      addToast({ title: "密码至少 6 位", color: "warning", timeout: 3000 });
      return;
    }
    if (password !== repeatPassword) {
      setError("两次密码不一致");
      return;
    }
    let captchaParams = {};
    if (captchaRef.current) {
      const result = await captchaRef.current.verify();
      if (result === null) return;
      captchaParams = result;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await authService.register({
        email,
        nickname,
        password,
        repeat_password: repeatPassword,
        ...captchaParams,
      });
      if (response.code === 200) {
        if (response.data?.activation_required) {
          addToast({ title: "注册成功！请查收激活邮件。", color: "success", timeout: 3000 });
          switchStep("check-email");
        } else {
          await handleLogin(true);
        }
      } else {
        const msg = response.message || "注册失败";
        // 邮箱已被注册时在邮箱输入框下方内联展示，不弹 toast
        if (msg === "该邮箱已被注册" || (msg.includes("邮箱") && msg.includes("注册"))) {
          setError(msg);
        } else {
          addToast({ title: msg, color: "danger", timeout: 3000 });
        }
        captchaRef.current?.refresh();
      }
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "该邮箱已被注册" || (msg.includes("邮箱") && msg.includes("注册"))) {
        setError(msg);
      } else {
        addToast({ title: msg, color: "danger", timeout: 3000 });
      }
      captchaRef.current?.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleOAuthLogin = async (_provider: string, _loginType?: string) => {};

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (step === "check-email") handleCheckEmail();
        else if (step === "login-password") handleLogin();
        else if (step === "register") handleRegister();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, email, password, repeatPassword, nickname]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-[400px] mx-4"
    >
      {/* 卡片 - 紧凑版带 border */}
      <div className="relative bg-card rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/20 border border-border overflow-hidden transition-[background-color,border-color,box-shadow] duration-250 ease-out">
        {/* 主题切换 */}
        <ThemeToggle className="absolute right-8 top-6 z-10" />

        {/* 内容区域 */}
        <div className="px-10 py-8" onKeyDown={handleKeyDown}>
          {/* Logo + 标题 */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-5">
              <AnimatePresence mode="wait">
                <motion.img
                  key={logoSrc}
                  src={logoSrc}
                  alt={siteName}
                  className="h-10 w-auto max-w-[180px] object-contain"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                />
              </AnimatePresence>
            </Link>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                {step === "check-email" && <h1 className="text-xl font-semibold text-foreground">登录你的账号</h1>}
                {step === "login-password" && (
                  <>
                    <h1 className="text-xl font-semibold text-foreground">请输入密码</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                      请输入账号 <span className="text-foreground font-medium">{email}</span> 的密码
                    </p>
                  </>
                )}
                {step === "confirm-register" && (
                  <>
                    <h1 className="text-xl font-semibold text-foreground">登录你的账号</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                      你输入的账户 <span className="text-foreground font-medium">{email}</span> 不存在，是否立即注册？
                    </p>
                  </>
                )}
                {step === "register" && <h1 className="text-xl font-semibold text-foreground">创建新账号</h1>}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 表单内容 */}
          <AnimatePresence mode="wait">
            {/* Step 1: 邮箱 */}
            {step === "check-email" && (
              <motion.div
                key="check-email"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <Input
                  type="email"
                  placeholder="电子邮箱"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  onBlur={() => {
                    if (email && !validateEmail(email)) {
                      setError("请输入有效的电子邮箱地址");
                    }
                  }}
                  autoFocus
                  error={!!error}
                  helperText={error || undefined}
                  startAdornment={<MailIcon className="w-5 h-5" />}
                />

                <Button isLoading={isLoading} onClick={handleCheckEmail}>
                  下一步
                </Button>

                {/* 注册链接 */}
                {registrationEnabled && (
                  <p className="text-sm text-center text-muted-foreground">
                    还没有账号？{" "}
                    <button
                      type="button"
                      onClick={() => switchStep("register")}
                      className="text-primary hover:underline cursor-pointer font-medium"
                    >
                      立即注册
                    </button>
                  </p>
                )}

                {/* 第三方登录 */}
                {hasOAuthProviders && (
                  <>
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full h-px bg-border" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-3 bg-card text-muted-foreground">或使用以下方式登录</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* 微信登录 */}
                      {oauthConfig?.wechat?.enable && (
                        <button
                          type="button"
                          disabled={oauthLoading}
                          onClick={() => handleOAuthLogin("wechat")}
                          className="w-full h-10 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                          style={{ backgroundColor: "#07C160" }}
                        >
                          <Icon icon="ri:wechat-fill" width={20} />
                          微信登录
                        </button>
                      )}

                      {/* QQ登录 */}
                      {oauthConfig?.qq?.enable && (
                        <button
                          type="button"
                          disabled={oauthLoading}
                          onClick={() => handleOAuthLogin("qq")}
                          className="w-full h-10 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                          style={{ backgroundColor: "#12B7F5" }}
                        >
                          <Icon icon="ri:qq-fill" width={20} />
                          QQ登录
                        </button>
                      )}

                      {/* Logto登录 */}
                      {oauthConfig?.logto?.enable && (
                        <button
                          type="button"
                          disabled={oauthLoading}
                          onClick={() => handleOAuthLogin("logto")}
                          className="w-full h-10 rounded-lg text-sm font-medium border border-border text-foreground bg-card flex items-center justify-center gap-2 transition-all cursor-pointer hover:bg-muted disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          <Icon icon="ri:shield-keyhole-fill" width={18} />
                          {oauthConfig.logto.display_name || "SSO登录"}
                        </button>
                      )}

                      {/* OIDC登录 */}
                      {oauthConfig?.oidc?.enable && (
                        <button
                          type="button"
                          disabled={oauthLoading}
                          onClick={() => handleOAuthLogin("oidc")}
                          className="w-full h-10 rounded-lg text-sm font-medium border border-border text-foreground bg-card flex items-center justify-center gap-2 transition-all cursor-pointer hover:bg-muted disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          <Icon icon="ri:openid-fill" width={18} />
                          {oauthConfig.oidc.display_name || "企业登录"}
                        </button>
                      )}

                      {/* 彩虹聚合登录 */}
                      {rainbowLoginMethods.map(method => {
                        const cfg = RAINBOW_METHOD_CONFIG[method];
                        return (
                          <button
                            key={method}
                            type="button"
                            disabled={oauthLoading}
                            onClick={() => handleOAuthLogin("rainbow", method)}
                            className="w-full h-10 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                            style={{ backgroundColor: cfg?.color || "#409EFF" }}
                          >
                            <Icon icon={cfg?.icon || "ri:login-circle-fill"} width={18} />
                            {cfg?.label || method}
                          </button>
                        );
                      })}
                    </div>

                    {oauthLoading && (
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        正在跳转...
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* Step: 确认注册 */}
            {step === "confirm-register" && (
              <motion.div
                key="confirm-register"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="pt-2">
                  <Button onClick={() => switchStep("register")}>注册账号</Button>
                </div>

                <Button variant="ghost" onClick={() => switchStep("check-email")}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  上一步
                </Button>
              </motion.div>
            )}

            {/* Step 2: 密码登录 */}
            {step === "login-password" && (
              <motion.div
                key="login-password"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="密码"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                  startAdornment={<Lock className="w-4 h-4" />}
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                <div className="flex justify-end">
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                    忘记密码？
                  </Link>
                </div>

                <CaptchaWidget ref={captchaRef} />

                <Button isLoading={isLoading} onClick={() => handleLogin()}>
                  登录
                </Button>

                <Button variant="ghost" onClick={() => switchStep("check-email")}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  上一步
                </Button>
              </motion.div>
            )}

            {/* Step 3: 注册 */}
            {step === "register" && (
              <motion.div
                key="register"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <Input
                  type="email"
                  placeholder="电子邮箱"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  autoFocus
                  error={!!error && error !== "两次密码不一致"}
                  helperText={error && error !== "两次密码不一致" ? error : undefined}
                  startAdornment={<MailIcon className="w-5 h-5" />}
                />

                <Input
                  type="text"
                  placeholder="昵称"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  startAdornment={<User className="w-4 h-4" />}
                />

                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="密码"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  startAdornment={<Lock className="w-4 h-4" />}
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="重复密码"
                  value={repeatPassword}
                  onChange={e => setRepeatPassword(e.target.value)}
                  error={repeatPassword.length > 0 && password !== repeatPassword}
                  helperText={repeatPassword.length > 0 && password !== repeatPassword ? "两次密码不一致" : undefined}
                  startAdornment={<Lock className="w-4 h-4" />}
                />

                <CaptchaWidget ref={captchaRef} />

                <Button isLoading={isLoading} onClick={handleRegister}>
                  注册
                </Button>

                {/* 登录链接 */}
                <p className="text-sm text-center text-muted-foreground">
                  已有账号？{" "}
                  <button
                    type="button"
                    onClick={() => switchStep("check-email")}
                    className="text-primary hover:underline cursor-pointer font-medium"
                  >
                    立即登录
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 底部 */}
        <div className="px-10 py-5 bg-muted/30 border-t border-border transition-[background-color,border-color] duration-250 ease-out">
          <p className="text-[11px] text-center text-muted-foreground">
            继续即表示同意{" "}
            <Link href="/terms" className="text-foreground hover:underline">
              服务条款
            </Link>{" "}
            和{" "}
            <Link href="/privacy" className="text-foreground hover:underline">
              隐私政策
            </Link>
          </p>
        </div>
      </div>

      {/* 微信扫码登录弹窗 */}
    </motion.div>
  );
}
