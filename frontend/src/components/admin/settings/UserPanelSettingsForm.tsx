"use client";

import { FormSwitch } from "@/components/ui/form-switch";
import { SettingsSection } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_USERPANEL_SHOW_USER_CENTER,
  KEY_USERPANEL_SHOW_NOTIFICATIONS,
  KEY_USERPANEL_SHOW_PUBLISH_ARTICLE,
  KEY_USERPANEL_SHOW_ADMIN_DASHBOARD,
} from "@/lib/settings/setting-keys";

interface UserPanelSettingsFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

const userPanelSwitches = [
  {
    key: KEY_USERPANEL_SHOW_USER_CENTER,
    label: "显示个人中心",
    description: "控制登录后用户面板中的“个人中心”入口。",
  },
  {
    key: KEY_USERPANEL_SHOW_NOTIFICATIONS,
    label: "显示全部通知",
    description: "控制登录后用户面板中的“全部通知”入口。",
  },
  {
    key: KEY_USERPANEL_SHOW_PUBLISH_ARTICLE,
    label: "显示发布文章",
    description: "控制管理员用户面板中的“发布文章”入口。",
  },
  {
    key: KEY_USERPANEL_SHOW_ADMIN_DASHBOARD,
    label: "显示后台管理",
    description: "控制管理员用户面板中的“后台管理”入口。",
  },
];

export function UserPanelSettingsForm({ values, onChange, loading }: UserPanelSettingsFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SettingsSection
        title="顶栏用户面板"
        description="控制前台顶栏头像弹层中的入口按钮显示。管理员入口即使开启，也只会对管理员显示。"
      >
        {userPanelSwitches.map(item => (
          <FormSwitch
            key={item.key}
            label={item.label}
            description={item.description}
            checked={values[item.key] !== "false"}
            onCheckedChange={checked => onChange(item.key, String(checked))}
          />
        ))}
      </SettingsSection>
    </div>
  );
}
