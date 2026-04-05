"use client";

import { useCallback } from "react";
import Image from "next/image";
import { Chip, Button, Tooltip } from "@heroui/react";
import { Mail, Calendar, Edit, KeyRound, Ban, CheckCircle, Trash2 } from "lucide-react";
import { formatDateTimeParts } from "@/utils/date";
import { toSameOriginMediaUrl } from "@/utils/same-origin-media-url";
import type { AdminUser } from "@/types/user-management";
import { USER_STATUS, USER_STATUS_LABEL, USER_STATUS_COLOR } from "@/types/user-management";

/** 表格列定义 */
export const USER_TABLE_COLUMNS = [
  { key: "user", label: "用户信息" },
  { key: "group", label: "用户组" },
  { key: "status", label: "状态" },
  { key: "lastLogin", label: "最后登录" },
  { key: "createdAt", label: "创建时间" },
  { key: "actions", label: "操作" },
];

type UserAction = "edit" | "resetPwd" | "toggleStatus" | "delete";

interface UseUserRenderCellOptions {
  onAction: (user: AdminUser, action: UserAction) => void;
}

/**
 * 返回用户表格的 renderCell 函数
 */
export function useUserRenderCell({ onAction }: UseUserRenderCellOptions) {
  return useCallback(
    (user: AdminUser, columnKey: React.Key) => {
      switch (columnKey) {
        case "user": {
          return (
            <div className="flex items-center gap-3 min-w-0">
              {user.avatar ? (
                <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 ring-border/20">
                  <Image
                    src={toSameOriginMediaUrl(user.avatar)}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="36px"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-linear-to-br from-primary/20 to-primary/40 flex items-center justify-center shrink-0 text-primary font-medium text-sm">
                  {(user.nickname || user.username || "?")[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{user.nickname || user.username}</span>
                  <span className="text-xs text-muted-foreground truncate">@{user.username}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-xs text-primary truncate">{user.email}</span>
                </div>
              </div>
            </div>
          );
        }
        case "group":
          return <span className="text-xs text-muted-foreground">{user.userGroup?.name || "-"}</span>;
        case "status": {
          const label = USER_STATUS_LABEL[user.status] ?? String(user.status);
          const color = (USER_STATUS_COLOR[user.status] ?? "default") as "success" | "default" | "danger";
          return (
            <Chip size="sm" color={color} variant="flat">
              {label}
            </Chip>
          );
        }
        case "lastLogin": {
          if (!user.lastLoginAt) {
            return <span className="text-xs text-muted-foreground/40">-</span>;
          }
          const parts = formatDateTimeParts(user.lastLoginAt);
          return (
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground tabular-nums">
                <Calendar className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                <span>{parts.date}</span>
              </div>
              <span className="text-muted-foreground/60 tabular-nums ml-4">{parts.time}</span>
            </div>
          );
        }
        case "createdAt": {
          const parts = formatDateTimeParts(user.created_at);
          return (
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground tabular-nums">
                <Calendar className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                <span>{parts.date}</span>
              </div>
              <span className="text-muted-foreground/60 tabular-nums ml-4">{parts.time}</span>
            </div>
          );
        }
        case "actions": {
          const isBanned = user.status === USER_STATUS.BANNED;
          return (
            <div className="flex items-center justify-center gap-1">
              <Tooltip content="编辑" placement="top" size="sm">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className="w-7 h-7 min-w-0 text-primary bg-primary/10 hover:bg-primary/20"
                  onPress={() => onAction(user, "edit")}
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content="重置密码" placement="top" size="sm">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className="w-7 h-7 min-w-0 text-warning-600 bg-warning/10 hover:bg-warning/20"
                  onPress={() => onAction(user, "resetPwd")}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content={isBanned ? "解封" : "封禁"} placement="top" size="sm">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className={
                    isBanned
                      ? "w-7 h-7 min-w-0 text-success bg-success/10 hover:bg-success/20"
                      : "w-7 h-7 min-w-0 text-warning-600 bg-warning/10 hover:bg-warning/20"
                  }
                  onPress={() => onAction(user, "toggleStatus")}
                >
                  {isBanned ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                </Button>
              </Tooltip>
              <Tooltip content="删除" placement="top" size="sm" color="danger">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className="w-7 h-7 min-w-0 text-danger bg-danger/10 hover:bg-danger/20"
                  onPress={() => onAction(user, "delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </Tooltip>
            </div>
          );
        }
        default:
          return null;
      }
    },
    [onAction]
  );
}
