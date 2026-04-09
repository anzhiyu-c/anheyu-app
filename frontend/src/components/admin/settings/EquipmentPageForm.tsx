"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormImageUpload } from "@/components/ui/form-image-upload";
import { EquipmentListEditor } from "./editors/EquipmentListEditor";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_EQUIPMENT_BANNER_BG,
  KEY_EQUIPMENT_BANNER_TITLE,
  KEY_EQUIPMENT_BANNER_DESC,
  KEY_EQUIPMENT_BANNER_TIP,
  KEY_EQUIPMENT_LIST,
} from "@/lib/settings/setting-keys";

interface EquipmentPageFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function EquipmentPageForm({ values, onChange, loading }: EquipmentPageFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* 横幅配置 */}
      <SettingsSection title="横幅" description="页面顶部展示区域">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04)] dark:shadow-none">
          <SettingsFieldGroup cols={2}>
            <FormImageUpload
              label="背景图"
              value={values[KEY_EQUIPMENT_BANNER_BG]}
              onValueChange={v => onChange(KEY_EQUIPMENT_BANNER_BG, v)}
              placeholder="图片 URL"
            />
            <FormInput
              label="标题"
              placeholder="页面标题"
              value={values[KEY_EQUIPMENT_BANNER_TITLE]}
              onValueChange={v => onChange(KEY_EQUIPMENT_BANNER_TITLE, v)}
            />
            <FormInput
              label="描述"
              placeholder="页面描述"
              value={values[KEY_EQUIPMENT_BANNER_DESC]}
              onValueChange={v => onChange(KEY_EQUIPMENT_BANNER_DESC, v)}
            />
            <FormInput
              label="提示"
              placeholder="提示文字"
              value={values[KEY_EQUIPMENT_BANNER_TIP]}
              onValueChange={v => onChange(KEY_EQUIPMENT_BANNER_TIP, v)}
            />
          </SettingsFieldGroup>
        </div>
      </SettingsSection>

      {/* 装备列表 */}
      <SettingsSection title="装备列表" description="分类管理，支持拖拽排序">
        <EquipmentListEditor value={values[KEY_EQUIPMENT_LIST]} onValueChange={v => onChange(KEY_EQUIPMENT_LIST, v)} />
      </SettingsSection>
    </div>
  );
}
