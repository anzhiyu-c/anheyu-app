/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-07 12:19:42
 * @LastEditTime: 2026-02-07 12:21:53
 * @LastEditors: 安知鱼
 */
"use client";

import { Input, Button } from "@heroui/react";
import { Search, RotateCcw } from "lucide-react";

interface DocSeriesFilterBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onReset: () => void;
  onPageReset: () => void;
}

export function DocSeriesFilterBar({
  searchInput,
  onSearchInputChange,
  onReset,
  onPageReset,
}: DocSeriesFilterBarProps) {
  return (
    <div className="shrink-0 px-5 pb-3">
      <div className="flex items-center gap-3">
        <Input
          size="sm"
          isClearable
          className="w-full sm:max-w-[300px]"
          placeholder="搜索系列名称..."
          startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
          value={searchInput}
          onValueChange={v => {
            onSearchInputChange(v);
            onPageReset();
          }}
          onClear={() => {
            onSearchInputChange("");
            onPageReset();
          }}
          classNames={{
            inputWrapper:
              "h-8 min-h-8 bg-card shadow-none! [border:var(--style-border)] data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted/30! group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted/30! group-data-[focus=true]:[border:var(--style-border-hover)] transition-all duration-200",
          }}
        />
        <div className="ml-auto">
          <Button
            size="sm"
            variant="flat"
            startContent={<RotateCcw className="w-3.5 h-3.5" />}
            onPress={onReset}
            isDisabled={!searchInput}
            className="text-foreground/70"
          >
            重置
          </Button>
        </div>
      </div>
    </div>
  );
}
