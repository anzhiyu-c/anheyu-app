"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { settingsApi } from "@/lib/api/settings";
import { AuthExpiredError } from "@/lib/api/client";
import {
  type SettingCategoryId,
  type SettingDescriptor,
  getKeysByCategory,
  getAllBackendKeys,
  flattenApiResponse,
  parseBackendValues,
  getChangedValues,
} from "@/lib/settings/setting-descriptors";
import { addToast } from "@heroui/react";
import { useAuthStore } from "@/store/auth-store";
import { useSiteConfigStore } from "@/store/site-config-store";

interface UseSettingsReturn {
  /** 当前表单值 */
  values: Record<string, string>;
  /** 原始值（从服务器加载的） */
  originalValues: Record<string, string>;
  /** 是否正在加载 */
  loading: boolean;
  /** 是否正在保存 */
  saving: boolean;
  /** 是否有未保存的变更 */
  isDirty: boolean;
  /** 更新单个值 */
  setValue: (key: string, value: string) => void;
  /** 批量更新值 */
  setValues: (updates: Record<string, string>) => void;
  /** 保存变更 */
  save: () => Promise<boolean>;
  /** 重置为原始值 */
  reset: () => void;
  /** 重新从服务器加载 */
  reload: () => void;
  /** 获取该分类的描述符列表 */
  descriptors: SettingDescriptor[];
}

/**
 * 设置管理 Hook
 * 按分类加载和保存设置，支持变更检测
 */
export function useSettings(categoryId: SettingCategoryId): UseSettingsReturn {
  const descriptors = useMemo(() => getKeysByCategory(categoryId), [categoryId]);
  const backendKeys = useMemo(() => getAllBackendKeys(descriptors), [descriptors]);
  const accessToken = useAuthStore(state => state.accessToken);

  const [values, setValuesState] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadFlag, setReloadFlag] = useState(0);

  // 使用 abort controller 防止 StrictMode 双调用和竞态
  useEffect(() => {
    if (backendKeys.length === 0 || !accessToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const doLoad = async () => {
      setLoading(true);
      try {
        const res = await settingsApi.getByKeys(backendKeys);
        if (!cancelled && res.data) {
          // 后端 GetByKeys 会调用 unflatten()，将扁平键转为嵌套对象，需要先还原
          // 传入已知键集合，防止 JSON 对象类型字段被过度展开
          const knownKeySet = new Set(backendKeys);
          const flat = flattenApiResponse(res.data as Record<string, unknown>, knownKeySet);
          const parsed = parseBackendValues(flat, descriptors);
          setValuesState(parsed);
          setOriginalValues({ ...parsed });
        }
      } catch (err) {
        if (!cancelled) {
          // 认证过期是预期行为，不需要弹出错误提示（会自动跳转登录页）
          if (!(err instanceof AuthExpiredError)) {
            console.error(`加载设置失败 [${categoryId}]:`, err);
            addToast({
              title: "加载设置失败",
              description: "请检查网络连接后重试",
              color: "danger",
            });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doLoad();
    return () => {
      cancelled = true;
    };
  }, [categoryId, backendKeys, descriptors, reloadFlag, accessToken]);

  const isDirty = useMemo(() => {
    const changed = getChangedValues(originalValues, values, descriptors);
    return Object.keys(changed).length > 0;
  }, [originalValues, values, descriptors]);

  const setValue = useCallback((key: string, value: string) => {
    setValuesState(prev => ({ ...prev, [key]: value }));
  }, []);

  const setValues = useCallback((updates: Record<string, string>) => {
    setValuesState(prev => ({ ...prev, ...updates }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const changed = getChangedValues(originalValues, values, descriptors);
    if (Object.keys(changed).length === 0) {
      addToast({ title: "没有需要保存的更改", color: "warning" });
      return false;
    }

    setSaving(true);
    try {
      await settingsApi.update(changed);
      setOriginalValues({ ...values });
      // 强制刷新前台站点配置，确保注入的自定义代码等立即生效
      await useSiteConfigStore.getState().forceRefreshFromServer();
      addToast({ title: "保存成功", color: "success" });
      return true;
    } catch (err) {
      console.error("保存设置失败:", err);
      addToast({
        title: "保存失败",
        description: "请稍后重试",
        color: "danger",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [values, originalValues, descriptors]);

  const reset = useCallback(() => {
    setValuesState({ ...originalValues });
  }, [originalValues]);

  const reload = useCallback(() => {
    setReloadFlag(prev => prev + 1);
  }, []);

  return {
    values,
    originalValues,
    loading,
    saving,
    isDirty,
    setValue,
    setValues,
    save,
    reset,
    reload,
    descriptors,
  };
}

/**
 * 组合多个分类的设置
 * 用于主页面需要同时管理多个分类的场景
 */
export function useMultiSettings(categoryIds: SettingCategoryId[]) {
  const [allValues, setAllValues] = useState<Record<string, string>>({});
  const [allOriginal, setAllOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadFlag, setReloadFlag] = useState(0);
  const accessToken = useAuthStore(state => state.accessToken);

  const categoryKey = categoryIds.join(",");

  const allDescriptors = useMemo(
    () => categoryIds.flatMap(id => getKeysByCategory(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryKey]
  );
  const allKeys = useMemo(() => getAllBackendKeys(allDescriptors), [allDescriptors]);

  // 使用 abort controller 防止 StrictMode 双调用和竞态
  useEffect(() => {
    if (allKeys.length === 0 || !accessToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const doLoad = async () => {
      setLoading(true);
      try {
        const res = await settingsApi.getByKeys(allKeys);
        if (!cancelled && res.data) {
          // 后端 GetByKeys 会调用 unflatten()，将扁平键转为嵌套对象，需要先还原
          // 传入已知键集合，防止 JSON 对象类型字段被过度展开
          const knownKeySet = new Set(allKeys);
          const flat = flattenApiResponse(res.data as Record<string, unknown>, knownKeySet);
          const parsed = parseBackendValues(flat, allDescriptors);
          setAllValues(parsed);
          setAllOriginal({ ...parsed });
        }
      } catch (err) {
        if (!cancelled) {
          // 认证过期是预期行为，不需要弹出错误提示（会自动跳转登录页）
          if (!(err instanceof AuthExpiredError)) {
            console.error("批量加载设置失败:", err);
            addToast({ title: "加载设置失败", color: "danger" });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doLoad();
    return () => {
      cancelled = true;
    };
  }, [allKeys, allDescriptors, reloadFlag, accessToken]);

  const isDirty = useMemo(
    () => Object.keys(getChangedValues(allOriginal, allValues, allDescriptors)).length > 0,
    [allOriginal, allValues, allDescriptors]
  );

  const setValue = useCallback((key: string, value: string) => {
    setAllValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const changed = getChangedValues(allOriginal, allValues, allDescriptors);
    if (Object.keys(changed).length === 0) {
      addToast({ title: "没有需要保存的更改", color: "warning" });
      return false;
    }

    setSaving(true);
    try {
      await settingsApi.update(changed);
      setAllOriginal({ ...allValues });
      // 强制刷新前台站点配置，确保注入的自定义代码等立即生效
      await useSiteConfigStore.getState().forceRefreshFromServer();
      addToast({ title: "保存成功", color: "success" });
      return true;
    } catch (err) {
      console.error("保存设置失败:", err);
      addToast({ title: "保存失败", color: "danger" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [allValues, allOriginal, allDescriptors]);

  const reset = useCallback(() => {
    setAllValues({ ...allOriginal });
  }, [allOriginal]);

  /** 重置指定分类的设置值为原始值 */
  const resetCategory = useCallback(
    (catIds: SettingCategoryId[]) => {
      const catDescriptors = catIds.flatMap(id => getKeysByCategory(id));
      const catKeys = new Set(getAllBackendKeys(catDescriptors));
      setAllValues(prev => {
        const next = { ...prev };
        for (const key of catKeys) {
          if (key in allOriginal) {
            next[key] = allOriginal[key];
          }
        }
        return next;
      });
    },
    [allOriginal]
  );

  /** 检查指定分类是否有未保存的变更 */
  const isCategoryDirty = useCallback(
    (catIds: SettingCategoryId[]): boolean => {
      const catDescriptors = catIds.flatMap(id => getKeysByCategory(id));
      return Object.keys(getChangedValues(allOriginal, allValues, catDescriptors)).length > 0;
    },
    [allValues, allOriginal]
  );

  const reload = useCallback(() => {
    setReloadFlag(prev => prev + 1);
  }, []);

  return {
    values: allValues,
    loading,
    saving,
    isDirty,
    setValue,
    save,
    reset,
    resetCategory,
    isCategoryDirty,
    reload,
  };
}
