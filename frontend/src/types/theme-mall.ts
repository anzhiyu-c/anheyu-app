/**
 * 主题商城类型定义（对齐 anheyu-app assets/src/api/theme-mall/type.ts）
 */

/** 主题类型 */
export type ThemeType = "community" | "pro";

/** 部署类型 */
export type DeployType = "standard" | "ssr";

/** SSR 主题状态 */
export type SSRThemeStatus = "not_installed" | "installed" | "running" | "error";

/** 主题对象（与后端 ThemeInfo 结构匹配） */
export interface Theme {
  id: number;
  name: string;
  author: string;
  description: string;
  themeType: ThemeType;
  deployType: DeployType;
  repoUrl: string;
  instructionUrl: string;
  /** 价格（分） */
  price: number;
  downloadUrl: string;
  tags: string[];
  previewUrl: string;
  demoUrl: string;
  version: string;
  downloadCount: number;
  /** 评分 0-5 */
  rating: number;
  isOfficial: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // 本地状态字段（已安装主题特有）
  is_current?: boolean;
  is_installed?: boolean;
  install_time?: string;
  user_config?: Record<string, unknown>;
  installed_version?: string;

  // SSR 主题特有字段
  ssrStatus?: SSRThemeStatus;
  ssrPort?: number;
}

/** 主题列表请求参数 */
export interface ThemeListParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string;
  themeType?: ThemeType | string;
}

/** 主题列表响应数据 */
export interface ThemeListData {
  list: Theme[];
  total: number;
}

/** SSR 主题信息 */
export interface SSRThemeInfo {
  name: string;
  version: string;
  status: SSRThemeStatus;
  port?: number;
  installedAt?: string;
  startedAt?: string;
  is_current?: boolean;
}

/** SSR 主题安装请求 */
export interface SSRThemeInstallRequest {
  themeName: string;
  downloadUrl: string;
}

/** SSR 主题启动请求 */
export interface SSRThemeStartRequest {
  port?: number;
}

/** 主题上传响应 */
export interface ThemeUploadResponse {
  theme_name: string;
  theme_info: Theme;
  installed: boolean;
  message: string;
}

/** 主题验证结果 */
export interface ThemeValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
  file_list: string[];
  total_size: number;
  existing_theme?: Theme;
}

/** 主题配置字段选项 */
export interface ThemeSettingOption {
  label: string;
  value: string | number | boolean;
}

/** 字段验证规则 */
export interface ThemeFieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

/** 字段显示条件 */
export interface ThemeFieldCondition {
  field: string;
  operator: "eq" | "neq" | "contains" | "gt" | "lt";
  value: unknown;
}

/** 主题配置字段定义 */
export interface ThemeSettingField {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "color" | "switch" | "image" | "code";
  default?: unknown;
  placeholder?: string;
  description?: string;
  required?: boolean;
  options?: ThemeSettingOption[];
  validation?: ThemeFieldValidation;
  condition?: ThemeFieldCondition;
}

/** 主题配置分组 */
export interface ThemeSettingGroup {
  group: string;
  label: string;
  fields: ThemeSettingField[];
}

/** 主题配置响应 */
export interface ThemeConfigResponse {
  theme_name: string;
  settings: ThemeSettingGroup[];
  values: Record<string, unknown>;
}

/** 保存主题配置请求 */
export interface ThemeConfigSaveRequest {
  theme_name: string;
  config: Record<string, unknown>;
}
