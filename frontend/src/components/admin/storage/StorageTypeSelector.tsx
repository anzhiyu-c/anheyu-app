"use client";

import { ModalBody } from "@heroui/react";
import { HardDrive, CloudCog, Globe, CloudUpload, Server, Warehouse, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORAGE_TYPES, STORAGE_TYPE_LABELS, type StoragePolicyType } from "@/types/storage-policy";
import { AdminDialog } from "@/components/admin/AdminDialog";

const TYPE_ICONS: Record<StoragePolicyType, typeof Server> = {
  local: HardDrive,
  onedrive: CloudCog,
  tencent_cos: Globe,
  aliyun_oss: CloudUpload,
  aws_s3: Server,
  qiniu_kodo: Warehouse,
};

interface StorageTypeSelectorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: StoragePolicyType) => void;
}

export function StorageTypeSelector({ isOpen, onOpenChange, onSelect }: StorageTypeSelectorProps) {
  return (
    <AdminDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      placement="center"
      size="lg"
      header={{ title: "选择存储方式", description: "请选择要添加的存储策略类型", icon: Database }}
    >
      {onClose => (
        <>
          <ModalBody className="pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {STORAGE_TYPES.map(type => {
                const Icon = TYPE_ICONS[type];
                return (
                  <button
                    key={type}
                    onClick={() => {
                      onSelect(type);
                      onClose();
                    }}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-lg border border-border/60",
                      "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                      "transition-all duration-200 ease-in-out cursor-pointer",
                      "group"
                    )}
                  >
                    <Icon className="w-6 h-6 shrink-0" />
                    <span className="text-sm font-medium">{STORAGE_TYPE_LABELS[type]}</span>
                  </button>
                );
              })}
            </div>
          </ModalBody>
        </>
      )}
    </AdminDialog>
  );
}
