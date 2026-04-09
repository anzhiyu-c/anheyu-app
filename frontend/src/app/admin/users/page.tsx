"use client";

import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Pagination,
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ShieldAlert, Ban, CheckCircle, ChevronDown, Users } from "lucide-react";
import { adminContainerVariants, adminItemVariants } from "@/lib/motion";
import { PAGE_SIZES, ADMIN_EMPTY_TEXTS } from "@/lib/constants/admin";
import { USER_STATUS } from "@/types/user-management";
import { useUsersManagementPage } from "./_hooks/use-users-page";
import { USER_TABLE_COLUMNS, useUserRenderCell } from "@/components/admin/users/UserTableColumns";
import { UserFilterBar } from "@/components/admin/users/UserFilterBar";
import { UserManagementSkeleton } from "@/components/admin/users/UserManagementSkeleton";
import { CreateUserModal } from "@/components/admin/users/CreateUserModal";
import { EditUserModal } from "@/components/admin/users/EditUserModal";
import { ResetPasswordModal } from "@/components/admin/users/ResetPasswordModal";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { FloatingSelectionBar } from "@/components/admin/FloatingSelectionBar";
import { TableEmptyState } from "@/components/admin/TableEmptyState";

export default function UsersManagementPage() {
  const um = useUsersManagementPage();

  const renderCell = useUserRenderCell({
    onAction: um.handleUserAction,
  });

  // ---- bottomContent ----
  const bottomContent = (
    <div className="py-2 px-2 flex flex-wrap justify-between items-center gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-small text-muted-foreground whitespace-nowrap">共 {um.totalItems} 人</span>
        <span className="text-small text-muted-foreground/40">|</span>
        <Dropdown>
          <DropdownTrigger>
            <Button variant="light" size="sm" className="text-muted-foreground text-small h-7 min-w-0 gap-1 px-2">
              {um.pageSize}条/页
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="每页显示条数"
            selectedKeys={new Set([String(um.pageSize)])}
            selectionMode="single"
            onSelectionChange={keys => {
              const v = Array.from(keys)[0];
              if (v) {
                um.setPageSize(Number(v));
                um.setPage(1);
              }
            }}
          >
            {PAGE_SIZES.map(n => (
              <DropdownItem key={String(n)}>{n}条/页</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        {um.selectedIds.size > 0 && (
          <>
            <span className="text-small text-muted-foreground/40">|</span>
            <span className="text-small text-primary font-medium whitespace-nowrap">已选 {um.selectedIds.size} 项</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={um.page}
          total={um.totalPages}
          onChange={um.setPage}
        />
        <div className="hidden sm:flex gap-1.5">
          <Button
            isDisabled={um.page <= 1}
            size="sm"
            variant="flat"
            onPress={() => um.setPage(Math.max(1, um.page - 1))}
          >
            上一页
          </Button>
          <Button
            isDisabled={um.page >= um.totalPages}
            size="sm"
            variant="flat"
            onPress={() => um.setPage(Math.min(um.totalPages, um.page + 1))}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );

  if (um.isLoading) {
    return <UserManagementSkeleton />;
  }

  return (
    <motion.div
      className="relative h-full flex flex-col overflow-hidden -m-4 lg:-m-8"
      variants={adminContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={adminItemVariants}
        className="flex-1 min-h-0 flex flex-col mx-6 mt-5 mb-2 bg-card border border-border/60 rounded-xl overflow-hidden"
      >
        {/* 标题区 + 操作按钮 */}
        <div className="shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">用户管理</h1>
              <p className="text-xs text-muted-foreground mt-1">管理系统用户、用户组和权限</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                color="primary"
                startContent={<Plus className="w-3.5 h-3.5" />}
                onPress={um.handleCreateOpen}
                className="font-medium shadow-sm"
              >
                新增用户
              </Button>
            </div>
          </div>
        </div>

        {/* 筛选栏 */}
        <UserFilterBar
          searchInput={um.searchInput}
          onSearchInputChange={um.handleSearchChange}
          statusFilter={um.statusFilter}
          onStatusFilterChange={um.setStatusFilter}
          groupFilter={um.groupFilter}
          onGroupFilterChange={um.setGroupFilter}
          userGroups={um.userGroups}
          onReset={um.handleReset}
          onPageReset={() => um.setPage(1)}
        />

        {/* 表格 */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Table
            isHeaderSticky
            aria-label="用户管理表格"
            selectionMode="multiple"
            color="default"
            checkboxesProps={{ color: "primary" }}
            selectedKeys={um.selectedIds}
            onSelectionChange={um.handleSelectionChange}
            bottomContent={bottomContent}
            bottomContentPlacement="outside"
            classNames={{
              base: "flex-1 min-h-0 flex flex-col",
              wrapper: "flex-1 min-h-0 px-3! py-0! shadow-none! rounded-none! border-none!",
              table: "border-separate border-spacing-y-1.5 -mt-1.5",
              thead: "[&>tr]:first:shadow-none! after:hidden!",
              th: "bg-[#F6F7FA] dark:bg-muted first:rounded-tl-lg! last:rounded-tr-lg!",
              tr: "rounded-xl!",
              td: "first:before:rounded-s-xl! last:before:rounded-e-xl!",
            }}
          >
            <TableHeader columns={USER_TABLE_COLUMNS}>
              {column => (
                <TableColumn key={column.key} align={column.key === "actions" ? "center" : "start"}>
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={um.users}
              emptyContent={
                <TableEmptyState
                  icon={Users}
                  hasFilter={!!(um.debouncedSearch || um.statusFilter || um.groupFilter)}
                  filterEmptyText={ADMIN_EMPTY_TEXTS.users.filterEmptyText}
                  emptyText={ADMIN_EMPTY_TEXTS.users.emptyText}
                  emptyHint={ADMIN_EMPTY_TEXTS.users.emptyHint}
                />
              }
              isLoading={um.isFetching && !um.isLoading}
              loadingContent={<Spinner size="sm" label="加载中..." />}
            >
              {user => (
                <TableRow key={user.id} className={user.status === USER_STATUS.BANNED ? "opacity-50" : ""}>
                  {columnKey => <TableCell>{renderCell(user, columnKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* 浮动选择操作栏 */}
      <AnimatePresence>
        {um.isSomeSelected && (
          <FloatingSelectionBar
            count={um.selectedIds.size}
            actions={[
              {
                key: "delete",
                label: "删除",
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: um.batchDeleteModal.onOpen,
                variant: "danger",
              },
            ]}
            onClear={() => um.setSelectedIds(new Set())}
          />
        )}
      </AnimatePresence>

      {/* 弹窗 */}
      <CreateUserModal
        isOpen={um.createModal.isOpen}
        onOpenChange={um.createModal.onOpenChange}
        form={um.createForm}
        onFormChange={um.setCreateForm}
        userGroups={um.userGroups}
        onConfirm={um.handleCreateConfirm}
        isLoading={um.createUser.isPending}
      />

      <EditUserModal
        isOpen={um.editModal.isOpen}
        onOpenChange={um.editModal.onOpenChange}
        form={um.editForm}
        onFormChange={um.setEditForm}
        userGroups={um.userGroups}
        onConfirm={um.handleEditConfirm}
        isLoading={um.updateUser.isPending}
      />

      <ConfirmDialog
        isOpen={um.deleteModal.isOpen}
        onOpenChange={um.deleteModal.onOpenChange}
        title="删除用户"
        description={`确定要删除用户「${
          um.actionTarget?.nickname || um.actionTarget?.username
        }」吗？该用户的所有数据将被清除，此操作不可撤销。`}
        confirmText="删除"
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={um.deleteUser.isPending}
        onConfirm={um.handleDeleteConfirm}
      />

      <ConfirmDialog
        isOpen={um.batchDeleteModal.isOpen}
        onOpenChange={um.batchDeleteModal.onOpenChange}
        title="批量删除"
        description={`确定要删除选中的 ${um.selectedIds.size} 个用户吗？此操作不可撤销。`}
        confirmText={`删除 ${um.selectedIds.size} 个用户`}
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={um.batchDeleteUsers.isPending}
        onConfirm={um.handleBatchDeleteConfirm}
      />

      <ResetPasswordModal
        isOpen={um.resetPwdModal.isOpen}
        onOpenChange={um.resetPwdModal.onOpenChange}
        target={um.actionTarget}
        newPassword={um.newPassword}
        onPasswordChange={um.setNewPassword}
        onConfirm={um.handleResetPwdConfirm}
        isLoading={um.resetPassword.isPending}
      />

      <ConfirmDialog
        isOpen={um.statusModal.isOpen}
        onOpenChange={um.statusModal.onOpenChange}
        title={um.actionTarget?.status === USER_STATUS.BANNED ? "解封用户" : "封禁用户"}
        description={
          um.actionTarget?.status === USER_STATUS.BANNED
            ? `确定要解封用户「${um.actionTarget?.nickname || um.actionTarget?.username}」吗？`
            : `确定要封禁用户「${um.actionTarget?.nickname || um.actionTarget?.username}」吗？封禁后该用户将无法登录。`
        }
        confirmText={um.actionTarget?.status === USER_STATUS.BANNED ? "解封" : "封禁"}
        confirmColor={um.actionTarget?.status === USER_STATUS.BANNED ? "success" : "danger"}
        icon={
          um.actionTarget?.status === USER_STATUS.BANNED ? (
            <CheckCircle className="w-5 h-5 text-success" />
          ) : (
            <Ban className="w-5 h-5 text-danger" />
          )
        }
        iconBg={um.actionTarget?.status === USER_STATUS.BANNED ? "bg-success-50" : "bg-danger-50"}
        loading={um.updateUserStatus.isPending}
        onConfirm={um.handleStatusConfirm}
      />
    </motion.div>
  );
}
