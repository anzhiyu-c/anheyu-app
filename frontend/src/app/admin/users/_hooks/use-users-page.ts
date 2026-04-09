import { useState, useMemo, useCallback } from "react";
import { addToast, useDisclosure } from "@heroui/react";
import type { Selection } from "@heroui/react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useAdminUsers,
  useUserGroups,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useBatchDeleteUsers,
  useResetPassword,
  useUpdateUserStatus,
} from "@/hooks/queries/use-user-management";
import type { AdminUser, AdminUserListParams, UserStatus } from "@/types/user-management";
import { USER_STATUS } from "@/types/user-management";

export function useUsersManagementPage() {
  // ---- 筛选 & 分页 ----
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---- 选择 ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ---- 弹窗 ----
  const [actionTarget, setActionTarget] = useState<AdminUser | null>(null);
  const createModal = useDisclosure();
  const editModal = useDisclosure();
  const deleteModal = useDisclosure();
  const batchDeleteModal = useDisclosure();
  const resetPwdModal = useDisclosure();
  const statusModal = useDisclosure();

  // ---- 表单状态 ----
  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    email: "",
    nickname: "",
    userGroupID: "",
  });
  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    nickname: "",
    userGroupID: "",
  });
  const [newPassword, setNewPassword] = useState("");

  // ---- 查询 ----
  const queryParams: AdminUserListParams = useMemo(
    () => ({
      page,
      pageSize,
      keyword: debouncedSearch || undefined,
      status: statusFilter ? (Number(statusFilter) as UserStatus) : undefined,
      groupID: groupFilter || undefined,
    }),
    [page, pageSize, debouncedSearch, statusFilter, groupFilter]
  );

  const { data, isLoading, isFetching, refetch } = useAdminUsers(queryParams);
  const users = useMemo(() => data?.users ?? [], [data?.users]);
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const { data: userGroups = [] } = useUserGroups();

  // ---- Mutations ----
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const batchDeleteUsers = useBatchDeleteUsers();
  const resetPassword = useResetPassword();
  const updateUserStatus = useUpdateUserStatus();

  // ---- 选择逻辑 (兼容 HeroUI Table) ----
  const isSomeSelected = selectedIds.size > 0;

  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      if (keys === "all") {
        setSelectedIds(new Set(users.map(u => u.id)));
      } else {
        setSelectedIds(new Set(Array.from(keys).map(String)));
      }
    },
    [users]
  );

  // ---- 筛选变更 ----
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleReset = useCallback(() => {
    setSearchInput("");
    setStatusFilter("");
    setGroupFilter("");
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  // ---- 新增用户 ----
  const handleCreateOpen = useCallback(() => {
    setCreateForm({ username: "", password: "", email: "", nickname: "", userGroupID: "" });
    createModal.onOpen();
  }, [createModal]);

  const handleCreateConfirm = useCallback(async () => {
    if (
      !createForm.username.trim() ||
      !createForm.password.trim() ||
      !createForm.email.trim() ||
      !createForm.userGroupID
    ) {
      addToast({ title: "请填写所有必填项", color: "warning", timeout: 3000 });
      return;
    }
    try {
      await createUser.mutateAsync({
        username: createForm.username.trim(),
        password: createForm.password,
        email: createForm.email.trim(),
        nickname: createForm.nickname.trim() || undefined,
        userGroupID: createForm.userGroupID,
      });
      addToast({ title: "用户创建成功", color: "success", timeout: 3000 });
      createModal.onClose();
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "创建用户失败", color: "danger", timeout: 3000 });
    }
  }, [createForm, createUser, createModal]);

  // ---- 编辑用户 ----
  const handleEditOpen = useCallback(
    (user: AdminUser) => {
      setActionTarget(user);
      setEditForm({
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        userGroupID: user.userGroupID,
      });
      editModal.onOpen();
    },
    [editModal]
  );

  const handleEditConfirm = useCallback(async () => {
    if (!actionTarget) return;
    try {
      await updateUser.mutateAsync({
        id: actionTarget.id,
        data: {
          username: editForm.username.trim() || undefined,
          email: editForm.email.trim() || undefined,
          nickname: editForm.nickname.trim() || undefined,
          userGroupID: editForm.userGroupID || undefined,
        },
      });
      addToast({ title: "用户信息已更新", color: "success", timeout: 3000 });
      editModal.onClose();
      setActionTarget(null);
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "更新用户失败", color: "danger", timeout: 3000 });
    }
  }, [actionTarget, editForm, updateUser, editModal]);

  // ---- 删除用户 ----
  const handleDeleteClick = useCallback(
    (user: AdminUser) => {
      setActionTarget(user);
      deleteModal.onOpen();
    },
    [deleteModal]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!actionTarget) return;
    try {
      await deleteUser.mutateAsync(actionTarget.id);
      addToast({ title: "用户已删除", color: "success", timeout: 3000 });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(actionTarget.id);
        return next;
      });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "删除用户失败", color: "danger", timeout: 3000 });
    }
    deleteModal.onClose();
    setActionTarget(null);
  }, [actionTarget, deleteUser, deleteModal]);

  // ---- 批量删除 ----
  const handleBatchDeleteConfirm = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await batchDeleteUsers.mutateAsync(ids);
      addToast({ title: `已删除 ${ids.length} 个用户`, color: "success", timeout: 3000 });
      setSelectedIds(new Set());
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "批量删除失败", color: "danger", timeout: 3000 });
    }
    batchDeleteModal.onClose();
  }, [selectedIds, batchDeleteUsers, batchDeleteModal]);

  // ---- 重置密码 ----
  const handleResetPwdOpen = useCallback(
    (user: AdminUser) => {
      setActionTarget(user);
      setNewPassword("");
      resetPwdModal.onOpen();
    },
    [resetPwdModal]
  );

  const handleResetPwdConfirm = useCallback(async () => {
    if (!actionTarget) return;
    if (!newPassword.trim() || newPassword.length < 6) {
      addToast({ title: "密码长度至少为 6 位", color: "warning", timeout: 3000 });
      return;
    }
    try {
      await resetPassword.mutateAsync({ id: actionTarget.id, data: { newPassword } });
      addToast({ title: "密码已重置", color: "success", timeout: 3000 });
      resetPwdModal.onClose();
      setActionTarget(null);
      setNewPassword("");
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "重置密码失败", color: "danger", timeout: 3000 });
    }
  }, [actionTarget, newPassword, resetPassword, resetPwdModal]);

  // ---- 封禁/解封 ----
  const handleStatusClick = useCallback(
    (user: AdminUser) => {
      setActionTarget(user);
      statusModal.onOpen();
    },
    [statusModal]
  );

  const handleStatusConfirm = useCallback(async () => {
    if (!actionTarget) return;
    const newStatus = actionTarget.status === USER_STATUS.BANNED ? USER_STATUS.ACTIVE : USER_STATUS.BANNED;
    try {
      await updateUserStatus.mutateAsync({ id: actionTarget.id, data: { status: newStatus } });
      addToast({
        title: newStatus === USER_STATUS.BANNED ? "用户已封禁" : "用户已解封",
        color: "success",
        timeout: 3000,
      });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "操作失败", color: "danger", timeout: 3000 });
    }
    statusModal.onClose();
    setActionTarget(null);
  }, [actionTarget, updateUserStatus, statusModal]);

  // ---- 表格行统一操作入口 ----
  const handleUserAction = useCallback(
    (user: AdminUser, action: string) => {
      switch (action) {
        case "edit":
          handleEditOpen(user);
          break;
        case "resetPwd":
          handleResetPwdOpen(user);
          break;
        case "toggleStatus":
          handleStatusClick(user);
          break;
        case "delete":
          handleDeleteClick(user);
          break;
      }
    },
    [handleEditOpen, handleResetPwdOpen, handleStatusClick, handleDeleteClick]
  );

  return {
    // 筛选
    searchInput,
    handleSearchChange,
    debouncedSearch,
    statusFilter,
    setStatusFilter,
    groupFilter,
    setGroupFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    handleReset,
    refetch,

    // 数据
    users,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    userGroups,

    // 选择
    selectedIds,
    setSelectedIds,
    isSomeSelected,
    handleSelectionChange,

    // 弹窗 & 表单
    actionTarget,
    handleUserAction,
    createModal,
    createForm,
    setCreateForm,
    createUser,
    handleCreateOpen,
    handleCreateConfirm,
    editModal,
    editForm,
    setEditForm,
    updateUser,
    handleEditOpen,
    handleEditConfirm,
    deleteModal,
    deleteUser,
    handleDeleteClick,
    handleDeleteConfirm,
    batchDeleteModal,
    batchDeleteUsers,
    handleBatchDeleteConfirm,
    resetPwdModal,
    newPassword,
    setNewPassword,
    resetPassword,
    handleResetPwdOpen,
    handleResetPwdConfirm,
    statusModal,
    updateUserStatus,
    handleStatusClick,
    handleStatusConfirm,
  };
}

/** 页面状态类型，供子组件使用 */
export type UsersPageState = ReturnType<typeof useUsersManagementPage>;
