/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-07 21:56:56
 * @LastEditTime: 2026-02-23 16:53:29
 * @LastEditors: 安知鱼
 */
"use client";

import { Input, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Search, ChevronDown, RotateCcw } from "lucide-react";
import type { UserGroupDTO } from "@/types/user-management";

const STATUS_OPTIONS = [
  { key: "1", label: "正常" },
  { key: "2", label: "未激活" },
  { key: "3", label: "已封禁" },
];

interface UserFilterBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  userGroups: UserGroupDTO[];
  onReset: () => void;
  onPageReset: () => void;
}

export function UserFilterBar({
  searchInput,
  onSearchInputChange,
  statusFilter,
  onStatusFilterChange,
  groupFilter,
  onGroupFilterChange,
  userGroups,
  onReset,
  onPageReset,
}: UserFilterBarProps) {
  return (
    <div className="shrink-0 px-5 pb-3">
      <div className="flex items-center gap-3">
        <Input
          size="sm"
          isClearable
          className="w-full sm:max-w-[300px]"
          placeholder="搜索用户名/邮箱/昵称..."
          startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
          value={searchInput}
          onValueChange={onSearchInputChange}
          onClear={() => onSearchInputChange("")}
          classNames={{
            inputWrapper:
              "h-8 min-h-8 bg-card shadow-none! [border:var(--style-border)] data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted/30! group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted/30! group-data-[focus=true]:[border:var(--style-border-hover)] transition-all duration-200",
          }}
        />
        <Dropdown>
          <DropdownTrigger className="hidden sm:flex">
            <Button size="sm" variant="flat" endContent={<ChevronDown className="w-3.5 h-3.5" />} className="h-8">
              {statusFilter ? (STATUS_OPTIONS.find(o => o.key === statusFilter)?.label ?? "用户状态") : "用户状态"}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="用户状态筛选"
            selectedKeys={statusFilter ? new Set([statusFilter]) : new Set<string>()}
            selectionMode="single"
            onSelectionChange={keys => {
              const v = Array.from(keys)[0];
              onStatusFilterChange(v ? (v as string) : "");
              onPageReset();
            }}
          >
            {STATUS_OPTIONS.map(opt => (
              <DropdownItem key={opt.key}>{opt.label}</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        <Dropdown>
          <DropdownTrigger className="hidden sm:flex">
            <Button size="sm" variant="flat" endContent={<ChevronDown className="w-3.5 h-3.5" />} className="h-8">
              {groupFilter ? (userGroups.find(g => g.id === groupFilter)?.name ?? "用户组") : "用户组"}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="用户组筛选"
            selectedKeys={groupFilter ? new Set([groupFilter]) : new Set<string>()}
            selectionMode="single"
            onSelectionChange={keys => {
              const v = Array.from(keys)[0];
              onGroupFilterChange(v ? (v as string) : "");
              onPageReset();
            }}
          >
            {userGroups.map(group => (
              <DropdownItem key={group.id}>{group.name}</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="flat"
            startContent={<RotateCcw className="w-3.5 h-3.5" />}
            onPress={onReset}
            isDisabled={!searchInput && !statusFilter && !groupFilter}
            className="text-foreground/70"
          >
            重置
          </Button>
        </div>
      </div>
    </div>
  );
}
