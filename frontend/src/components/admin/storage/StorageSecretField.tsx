"use client";

import { useState } from "react";
import { Button, Input } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";

export interface StorageSecretFieldProps {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  description?: string;
  isRequired?: boolean;
  placeholder?: string;
}

/** 存储策略中的密钥类输入：支持小眼睛切换显示/隐藏 */
export function StorageSecretField({
  label,
  value,
  onValueChange,
  description,
  isRequired,
  placeholder,
}: StorageSecretFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      label={label}
      labelPlacement="outside"
      size="sm"
      type={visible ? "text" : "password"}
      isRequired={isRequired}
      value={value}
      onValueChange={onValueChange}
      description={description}
      placeholder={placeholder}
      endContent={
        <Button
          isIconOnly
          size="sm"
          variant="light"
          aria-label={visible ? `隐藏${label}` : `显示${label}`}
          className="text-default-400"
          onPress={() => setVisible(v => !v)}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
      }
    />
  );
}
