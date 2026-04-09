"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  User,
  Camera,
  Pencil,
  Lock,
  Bell,
  LogOut,
  ChevronRight,
  Calendar,
  Mail,
  IdCard,
  Home,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useSiteConfigStore } from "@/store/site-config-store";
import { userCenterApi } from "@/lib/api/user-center";
import { getErrorMessage } from "@/lib/api/client";
import { getUserAvatarUrl } from "@/utils/avatar";
import { EditProfileDialog } from "./EditProfileDialog";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { NotificationSettingsDialog } from "./NotificationSettingsDialog";
import styles from "../user-center.module.css";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "未知";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export function UserCenterContent() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const roles = useAuthStore(s => s.roles);
  const accessToken = useAuthStore(s => s.accessToken);
  const logout = useAuthStore(s => s.logout);
  const _hasHydrated = useAuthStore(s => s._hasHydrated);
  const siteConfig = useSiteConfigStore(s => s.siteConfig);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const isLoggedIn = useMemo(() => !!accessToken && !!user, [accessToken, user]);

  const userAvatar = useMemo(() => {
    if (!user) return "/static/img/avatar.jpg";
    return getUserAvatarUrl(
      { avatar: user.avatar, email: user.email, nickname: user.nickname },
      {
        gravatarUrl: siteConfig?.GRAVATAR_URL,
        defaultGravatarType: siteConfig?.DEFAULT_GRAVATAR_TYPE,
      },
      200
    );
  }, [user, siteConfig?.GRAVATAR_URL, siteConfig?.DEFAULT_GRAVATAR_TYPE]);

  const joinTimeText = useMemo(() => {
    if (!user?.created_at) return "未知";
    return formatRelativeTime(user.created_at);
  }, [user?.created_at]);

  const roleLabel = useMemo(() => {
    if (roles.includes("1")) return "管理员";
    return "普通用户";
  }, [roles]);

  const handleAvatarClick = useCallback(() => {
    if (avatarUploading) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/jpg,image/png,image/gif,image/webp";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert("头像文件大小不能超过 5MB");
        return;
      }
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        alert("只支持 JPG、PNG、GIF、WebP 格式的图片");
        return;
      }
      setAvatarUploading(true);
      try {
        const res = await userCenterApi.uploadAvatar(file);
        if (res.code === 200 && res.data?.url) {
          // 后端已更新头像，但 Zustand persist 里仍是登录时的 user，需写入新 URL 否则刷新后仍显示 Gravatar/旧图
          useAuthStore.getState().updateUserAvatar(res.data.url);
        } else if (res.code === 200) {
          alert(res.message || "头像上传成功但未返回地址，请刷新页面");
        } else {
          alert(res.message || "头像上传失败");
        }
      } catch (err) {
        const msg = getErrorMessage(err);
        alert(msg && msg !== "请求失败" ? msg : "头像上传失败，请稍后再试");
      } finally {
        setAvatarUploading(false);
      }
    };
    input.click();
  }, [avatarUploading]);

  const handleLogout = useCallback(() => {
    if (window.confirm("确定要退出登录吗？")) {
      logout();
      router.push("/");
    }
  }, [logout, router]);

  const handleProfileSuccess = useCallback(() => {
    window.location.reload();
  }, []);

  if (!_hasHydrated) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>加载中...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.notLoggedIn}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><User size={48} /></div>
            <h2 className={styles.emptyTitle}>请先登录</h2>
            <p className={styles.emptyDesc}>登录后即可访问用户中心</p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button className={styles.homeBtn} onClick={() => router.push("/login")}>
                去登录
              </button>
              <button className={styles.homeBtn} style={{ background: "var(--muted)", color: "var(--foreground)" }} onClick={() => router.push("/")}>
                <Home size={18} /> 返回首页
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const actions = [
    { icon: <Pencil size={20} />, title: "编辑资料", desc: "修改个人信息", onClick: () => setShowEditProfile(true) },
    { icon: <Lock size={20} />, title: "修改密码", desc: "更改登录密码", onClick: () => setShowChangePassword(true) },
    { icon: <Bell size={20} />, title: "通知设置", desc: "管理通知偏好", onClick: () => setShowNotificationSettings(true) },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Profile Card */}
        <div className={styles.profileCard}>
          <div className={styles.profileHeader}>
            <div className={styles.avatarSection}>
              <div className={styles.avatarWrapper} onClick={handleAvatarClick}>
                <Image
                  src={userAvatar}
                  alt={user?.nickname || "avatar"}
                  className={styles.avatar}
                  width={120}
                  height={120}
                  unoptimized
                />
                <div className={styles.avatarOverlay}>
                  <Camera />
                </div>
              </div>
            </div>
            <div className={styles.userInfo}>
              <h1 className={styles.nickname}>{user?.nickname || user?.username}</h1>
              <div className={styles.metaRow}>
                <span className={styles.metaTag}><IdCard size={14} /> UID: {user?.id || user?.username}</span>
                <span className={styles.metaTag}><Calendar size={14} /> 加入于 {joinTimeText}</span>
              </div>
              <div className={styles.email}><Mail size={14} /> {user?.email}</div>
              <div className={styles.badges}>
                <span className={styles.badge}>{roleLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className={styles.actionCards}>
          {actions.map(action => (
            <div key={action.title} className={styles.actionCard} onClick={action.onClick}>
              <div className={styles.actionIcon}>{action.icon}</div>
              <div className={styles.actionContent}>
                <div className={styles.actionTitle}>{action.title}</div>
                <div className={styles.actionDesc}>{action.desc}</div>
              </div>
              <ChevronRight className={styles.actionArrow} />
            </div>
          ))}
          <div className={`${styles.actionCard} ${styles.danger}`} onClick={handleLogout}>
            <div className={styles.actionIcon}><LogOut size={20} /></div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>退出登录</div>
              <div className={styles.actionDesc}>安全退出当前账号</div>
            </div>
            <ChevronRight className={styles.actionArrow} />
          </div>
        </div>
      </div>

      <EditProfileDialog
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        onSuccess={handleProfileSuccess}
        userInfo={{ nickname: user?.nickname || "", email: user?.email || "" }}
      />
      <ChangePasswordDialog
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
      <NotificationSettingsDialog
        open={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
    </div>
  );
}
