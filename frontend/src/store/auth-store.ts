import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LoginUserInfoResponse } from "@/types/auth";
import { toSameOriginMediaUrl } from "@/utils/same-origin-media-url";

interface AuthStore {
  // 访问令牌
  accessToken: string | null;
  // 刷新令牌
  refreshToken: string | null;
  // 令牌过期时间
  expires: string | null;
  // 用户信息
  user: LoginUserInfoResponse | null;
  // 用户角色
  roles: string[];
  // SSR 水合标志
  _hasHydrated: boolean;

  // 设置认证信息（登录成功后调用）
  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    expires: string;
    userInfo: LoginUserInfoResponse;
    roles: string[];
  }) => void;

  // 更新访问令牌（刷新 token 后调用）
  updateAccessToken: (accessToken: string, expires: string) => void;

  // 更新持久化用户信息中的头像 URL（上传头像成功后调用，与数据库保持一致）
  updateUserAvatar: (avatarUrl: string) => void;

  // 退出登录
  logout: () => void;

  // 设置水合状态
  setHasHydrated: (hydrated: boolean) => void;

  // 检查是否已登录
  isAuthenticated: () => boolean;

  // 检查是否为管理员
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      expires: null,
      user: null,
      roles: [],
      _hasHydrated: false,

      setAuth: data =>
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expires: data.expires,
          user:
            data.userInfo && data.userInfo.avatar
              ? { ...data.userInfo, avatar: toSameOriginMediaUrl(data.userInfo.avatar) }
              : data.userInfo,
          roles: data.roles,
        }),

      updateAccessToken: (accessToken, expires) =>
        set({
          accessToken,
          expires,
        }),

      updateUserAvatar: avatarUrl =>
        set(state => ({
          user: state.user ? { ...state.user, avatar: toSameOriginMediaUrl(avatarUrl) } : null,
        })),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          expires: null,
          user: null,
          roles: [],
        }),

      setHasHydrated: hydrated => set({ _hasHydrated: hydrated }),

      isAuthenticated: () => {
        const state = get();
        return !!state.accessToken && !!state.user;
      },

      isAdmin: () => {
        const state = get();
        // 用户组 ID 为 1 表示管理员
        return state.user?.userGroupID === 1 || state.roles.includes("1");
      },
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
    }
  )
);
