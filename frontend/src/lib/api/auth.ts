/**
 * 认证相关 API
 */
import { apiClient } from "./client";
import type { ApiResponse } from "@/types";
import type {
  LoginRequest,
  LoginResponseData,
  RegisterRequest,
  RegisterResponseData,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  RefreshTokenResponseData,
  CheckEmailResponseData,
  CaptchaConfig,
  ImageCaptchaResponse,
} from "@/types/auth";

export const authApi = {
  /** 用户登录 */
  login(data: LoginRequest): Promise<ApiResponse<LoginResponseData>> {
    return apiClient.post<LoginResponseData>("/api/auth/login", data);
  },

  /** 用户注册 */
  register(data: RegisterRequest): Promise<ApiResponse<RegisterResponseData>> {
    return apiClient.post<RegisterResponseData>("/api/auth/register", data);
  },

  /** 检查邮箱是否已注册 */
  checkEmail(email: string): Promise<ApiResponse<CheckEmailResponseData>> {
    return apiClient.get<CheckEmailResponseData>(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
  },

  /** 刷新访问令牌 */
  refreshToken(refreshToken: string): Promise<ApiResponse<RefreshTokenResponseData>> {
    return apiClient.post<RefreshTokenResponseData>(
      "/api/auth/refresh-token",
      { refreshToken },
      { headers: { Authorization: `Bearer ${refreshToken}` } }
    );
  },

  /** 忘记密码 - 发送重置邮件 */
  forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse<null>> {
    return apiClient.post<null>("/api/auth/forgot-password", data);
  },

  /** 重置密码 */
  resetPassword(data: ResetPasswordRequest): Promise<ApiResponse<null>> {
    return apiClient.post<null>("/api/auth/reset-password", data);
  },

  /** 激活用户账号 */
  activateUser(id: string, sign: string): Promise<ApiResponse<LoginResponseData>> {
    return apiClient.post<LoginResponseData>("/api/auth/activate", { id, sign });
  },

  /** 获取验证码配置 */
  getCaptchaConfig(): Promise<ApiResponse<CaptchaConfig>> {
    return apiClient.get<CaptchaConfig>("/api/public/captcha/config");
  },

  /** 生成图形验证码 */
  generateImageCaptcha(): Promise<ApiResponse<ImageCaptchaResponse>> {
    return apiClient.get<ImageCaptchaResponse>("/api/public/captcha/image");
  },
};

/** @deprecated 使用 authApi 代替 */
export const authService = authApi;
