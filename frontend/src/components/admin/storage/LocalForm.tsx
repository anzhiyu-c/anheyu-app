"use client";

import { Input } from "@heroui/react";
import type { StoragePolicy } from "@/types/storage-policy";

interface LocalFormProps {
  form: Partial<StoragePolicy>;
  onChange: (form: Partial<StoragePolicy>) => void;
}

export function LocalForm({ form, onChange }: LocalFormProps) {
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2">路径设置</div>

      <Input
        label="应用内挂载路径"
        labelPlacement="outside"
        placeholder="例如 /local"
        size="sm"
        value={form.virtual_path ?? ""}
        onValueChange={v => onChange({ ...form, virtual_path: v })}
        description="此策略在应用内的访问路径，需以 / 开头且唯一"
      />

      <Input
        label="存储目录"
        labelPlacement="outside"
        placeholder="例如 data/storage/local"
        size="sm"
        value={form.base_path ?? ""}
        onValueChange={v => onChange({ ...form, base_path: v })}
        description="服务器上的物理存储目录，必须在 data/storage/ 下"
      />
    </div>
  );
}
