// 验证码配置（公共 API 返回）
export interface CaptchaConfig {
  provider: "none" | "turnstile" | "geetest" | "image";
  turnstile_site_key?: string;
  geetest_captcha_id?: string;
  image_captcha_length?: number;
}

// 图形验证码生成响应
export interface ImageCaptchaResponse {
  captcha_id: string;
  image_base64: string;
}

// 用户组响应
export interface UserGroupResponse {
  id: string;
  name: string;
  description: string;
}

// 登录用户信息响应
export interface LoginUserInfoResponse {
  id: string;
  created_at: string;
  updated_at: string;
  username: string;
  nickname: string;
  avatar: string;
  email: string;
  lastLoginAt: string | null;
  userGroupID: number;
  userGroup: UserGroupResponse;
  status: number;
}

// 登录响应数据
export interface LoginResponseData {
  userInfo: LoginUserInfoResponse;
  roles: string[];
  accessToken: string;
  refreshToken: string;
  expires: string;
}

// 登录请求
export interface LoginRequest {
  email: string;
  password: string;
  // Turnstile 验证码
  turnstile_token?: string;
  // 极验验证码
  geetest_lot_number?: string;
  geetest_captcha_output?: string;
  geetest_pass_token?: string;
  geetest_gen_time?: string;
  // 图片验证码
  image_captcha_id?: string;
  image_captcha_answer?: string;
}

// 注册请求
export interface RegisterRequest {
  email: string;
  nickname: string;
  password: string;
  repeat_password: string;
  // 验证码参数
  turnstile_token?: string;
  geetest_lot_number?: string;
  geetest_captcha_output?: string;
  geetest_pass_token?: string;
  geetest_gen_time?: string;
  image_captcha_id?: string;
  image_captcha_answer?: string;
}

// 注册响应
export interface RegisterResponseData {
  activation_required: boolean;
}

// 忘记密码请求（与后端 CaptchaParams 一致，支持多种验证码）
export interface ForgotPasswordRequest {
  email: string;
  turnstile_token?: string;
  geetest_lot_number?: string;
  geetest_captcha_output?: string;
  geetest_pass_token?: string;
  geetest_gen_time?: string;
  image_captcha_id?: string;
  image_captcha_answer?: string;
}

// 重置密码请求
export interface ResetPasswordRequest {
  id: string;
  sign: string;
  password: string;
  repeat_password: string;
}

// 刷新 Token 响应
export interface RefreshTokenResponseData {
  accessToken: string;
  expires: string;
}

// 检查邮箱响应
export interface CheckEmailResponseData {
  exists: boolean;
}

// 微信二维码数据
export interface WechatQRCodeData {
  scene_id: string;
  qrcode_url: string;
  expire_at: number;
}

// 微信二维码状态
export interface WechatQRCodeStatusData {
  status: string; // pending, scanned, confirmed, expired
  // 登录成功（confirmed）时返回
  token?: string;
  refresh_token?: string;
  user_info?: Record<string, unknown>;
  roles?: string[];
}

// OAuth 登录请求
export interface OAuthLoginRequest {
  provider: string;
  redirect_url: string;
  login_type?: string;
}

// OAuth 登录响应
export interface OAuthLoginResponseData {
  authorize_url?: string;
  url?: string;
  qrcode?: string;
  state: string;
  type?: string;
}

// OAuth 回调响应
export interface OAuthCallbackResponseData {
  token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    provider: string;
    open_id: string;
    nickname: string;
    avatar: string;
    email: string;
  };
  is_new_user: boolean;
  need_binding: boolean;
  binding_token?: string;
}
