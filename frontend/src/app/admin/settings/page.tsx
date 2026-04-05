"use client";

import { useState, useMemo, useCallback, useRef, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, Input, Button } from "@heroui/react";
import { Search, ChevronRight, RotateCcw, AlertCircle, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMultiSettings } from "@/hooks/use-settings";
import { FloatingSaveButton } from "@/components/admin/settings/FloatingSaveButton";
import type { SettingCategoryId } from "@/lib/settings/setting-descriptors";
import { settingsCategories, ALL_CATEGORY_IDS } from "./_config/settings-nav";
import { settingsFormRegistry } from "./_config/settings-forms";

// ==================== ErrorBoundary 组件 ====================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class SettingsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Settings form load error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <AlertCircle className="w-10 h-10 text-danger" />
            <div>
              <p className="text-sm font-medium text-foreground">加载失败</p>
              <p className="text-xs text-muted-foreground mt-1">表单组件加载出错，请刷新页面重试</p>
            </div>
            <button
              onClick={() => {
                if (this.props.onRetry) this.props.onRetry();
                else this.setState({ hasError: false });
              }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
            >
              重试
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

const categories = settingsCategories;
const allCategoryIds = ALL_CATEGORY_IDS;

// ==================== 搜索结果类型 ====================

interface SearchResult {
  sectionId: SettingCategoryId;
  sectionLabel: string;
  categoryId: string;
  categoryLabel: string;
}

// ==================== 表单加载占位 ====================

function FormFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  );
}

// ==================== 主页面 ====================

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<string>("site-basic");
  const [formRetryKey, setFormRetryKey] = useState(0);

  // 搜索相关状态
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 移动端侧边栏
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // 内容区 ref，用于切换时滚动到顶部
  const contentRef = useRef<HTMLDivElement>(null);

  const { values, loading, saving, isDirty, setValue, save, reset, resetCategory, isCategoryDirty } =
    useMultiSettings(allCategoryIds);

  // 获取当前激活的子区域信息
  const currentSection = useMemo(() => {
    for (const cat of categories) {
      const found = cat.children.find(s => s.id === activeSection);
      if (found) return found;
    }
    return null;
  }, [activeSection]);

  // 获取当前 section 所属的 category
  const parentCategory = useMemo(() => {
    for (const cat of categories) {
      if (cat.children.some(s => s.id === activeSection)) {
        return cat;
      }
    }
    return null;
  }, [activeSection]);

  // 获取当前 section 所属的 category 中所有 section ids
  const currentCategorySectionIds = useMemo(() => parentCategory?.children.map(s => s.id) ?? [], [parentCategory]);

  // ==================== 搜索功能 ====================

  const searchIndex = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = [];
    for (const category of categories) {
      for (const child of category.children) {
        results.push({
          sectionId: child.id,
          sectionLabel: child.label,
          categoryId: category.id,
          categoryLabel: category.label,
        });
      }
    }
    return results;
  }, []);

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchKeyword.trim()) return [];
    const keyword = searchKeyword.toLowerCase();

    return searchIndex.filter(item => {
      if (item.sectionLabel.toLowerCase().includes(keyword)) return true;
      if (item.categoryLabel.toLowerCase().includes(keyword)) return true;
      const section = categories.find(c => c.id === item.categoryId)?.children.find(s => s.id === item.sectionId);
      if (section?.keywords?.some(k => k.toLowerCase().includes(keyword))) return true;
      return false;
    });
  }, [searchKeyword, searchIndex]);

  const showSearchResults = isSearchFocused && searchKeyword.trim().length > 0;

  const handleSearchNavigate = useCallback((result: SearchResult) => {
    setActiveSection(result.sectionId);
    setSearchKeyword("");
    setIsSearchFocused(false);
    setShowMobileSidebar(false);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ==================== 导航功能 ====================

  const selectSection = useCallback((_categoryId: string, sectionId: string) => {
    setActiveSection(sectionId);
    setShowMobileSidebar(false);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ==================== 重置功能 ====================

  const handleResetCurrent = useCallback(() => {
    if (currentCategorySectionIds.length > 0) {
      resetCategory(currentCategorySectionIds);
    }
  }, [currentCategorySectionIds, resetCategory]);

  const handleResetAll = useCallback(() => {
    reset();
  }, [reset]);

  const isCurrentDirty = useMemo(() => {
    if (currentCategorySectionIds.length === 0) return false;
    return isCategoryDirty(currentCategorySectionIds);
  }, [currentCategorySectionIds, isCategoryDirty]);

  // 表单 props
  const formProps = useMemo(() => ({ values, onChange: setValue, loading }), [values, setValue, loading]);

  const renderForm = () => {
    const FormComponent = settingsFormRegistry[activeSection as SettingCategoryId];
    if (!FormComponent) return null;
    return (
      <SettingsErrorBoundary
        key={`${activeSection}-${formRetryKey}`}
        onRetry={() => setFormRetryKey(k => k + 1)}
      >
        <Suspense key={activeSection} fallback={<FormFallback />}>
          <FormComponent {...formProps} />
        </Suspense>
      </SettingsErrorBoundary>
    );
  };

  // ==================== 扁平分组式导航 ====================

  const renderNavigation = () => (
    <nav className="space-y-6" aria-label="设置导航">
      {categories.map(category => (
        <div key={category.id}>
          {/* 分类标签 */}
          <div className="px-3 mb-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {category.label}
            </span>
          </div>

          {/* 子项列表 */}
          <div className="space-y-0.5">
            {category.children.map(sub => {
              const SubIcon = sub.icon;
              const isActive = activeSection === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => selectSection(category.id, sub.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group w-full flex items-center gap-2.5 px-3 py-[7px] rounded-full text-[13px] transition-all duration-150",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <SubIcon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-muted-foreground"
                    )}
                  />
                  <span className="truncate">{sub.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  // ==================== 搜索组件 ====================

  const renderSearch = () => (
    <div className="relative">
      <Input
        ref={searchInputRef}
        size="sm"
        value={searchKeyword}
        onValueChange={setSearchKeyword}
        onFocus={() => setIsSearchFocused(true)}
        onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
        placeholder="搜索设置..."
        startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
        classNames={{
          inputWrapper: cn(
            "bg-muted/40 border border-border/50 rounded-full shadow-none! h-9 min-h-9",
            "data-[hover=true]:bg-muted/60 data-[hover=true]:border-border/80",
            "group-data-[focus=true]:border-primary/40 group-data-[focus=true]:bg-card! group-data-[focus=true]:ring-1 group-data-[focus=true]:ring-primary/15",
            "transition-all duration-200"
          ),
          input: "text-[13px] placeholder:text-muted-foreground/60",
        }}
      />

      {/* 搜索结果下拉 */}
      <AnimatePresence>
        {showSearchResults && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-1.5 left-0 right-0 bg-card border border-border/60 rounded-xl shadow-sm dark:shadow-lg z-50 overflow-hidden"
          >
            {searchResults.length > 0 ? (
              <div className="max-h-[320px] overflow-y-auto p-1">
                {searchResults.map(result => (
                  <button
                    key={result.sectionId}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleSearchNavigate(result);
                    }}
                  >
                    <div className="text-[11px] text-muted-foreground">{result.categoryLabel}</div>
                    <div className="text-[13px] font-medium text-foreground">{result.sectionLabel}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-[13px] text-muted-foreground">
                <Search className="w-5 h-5 mb-1.5 text-muted-foreground/60" />
                未找到相关设置
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="flex h-full bg-card rounded-xl border border-border/60 overflow-hidden">
      {/* ==================== 左侧导航面板 - 桌面端 ==================== */}
      <aside className="w-[260px] shrink-0 border-r border-border/60 bg-muted/30 flex flex-col max-lg:hidden">
        {/* 搜索框 */}
        <div className="p-3 pb-2">{renderSearch()}</div>

        {/* 导航列表 */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 pt-2">{renderNavigation()}</div>
      </aside>

      {/* ==================== 右侧内容区 ==================== */}
      <div ref={contentRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable] bg-muted/40">
        <div className="max-w-3xl mx-auto px-8 py-6 max-md:px-4 max-md:py-4">
          {/* 内容区头部 */}
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start justify-between mb-8 max-md:mb-6"
          >
            <div>
              {/* 面包屑 */}
              <div className="flex items-center gap-1.5 mb-1.5">
                {/* 移动端菜单触发 */}
                <button
                  className="hidden max-lg:flex items-center justify-center w-6 h-6 -ml-1 mr-0.5 rounded-md hover:bg-muted transition-colors"
                  onClick={() => setShowMobileSidebar(true)}
                  aria-label="打开导航菜单"
                >
                  <Menu className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-xs text-muted-foreground">{parentCategory?.label}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-xs text-foreground/70 font-medium">{currentSection?.label}</span>
              </div>

              {/* 页面标题 */}
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{currentSection?.label}</h1>
            </div>

            {/* 重置按钮 */}
            <div className="flex items-center gap-2 mt-1">
              <Tooltip
                content={
                  <div className="px-1 py-0.5">
                    <p className="text-xs font-medium">重置当前分类</p>
                    <p className="text-[11px] text-muted-foreground">撤销当前页面的未保存更改</p>
                  </div>
                }
                placement="bottom"
                delay={400}
              >
                <Button
                  size="sm"
                  variant="flat"
                  isDisabled={!isCurrentDirty}
                  onPress={handleResetCurrent}
                  startContent={<RotateCcw className="w-3.5 h-3.5" />}
                  className="h-8 px-3 min-w-0 bg-muted text-foreground/70 hover:bg-secondary hover:text-foreground/80 text-xs font-medium"
                >
                  重置当前
                </Button>
              </Tooltip>

              <Tooltip
                content={
                  <div className="px-1 py-0.5">
                    <p className="text-xs font-medium">重置全部更改</p>
                    <p className="text-[11px] text-muted-foreground">撤销所有分类的未保存更改</p>
                  </div>
                }
                placement="bottom"
                delay={400}
              >
                <Button
                  size="sm"
                  variant="flat"
                  isDisabled={!isDirty}
                  onPress={handleResetAll}
                  startContent={<RotateCcw className="w-3.5 h-3.5" />}
                  className="h-8 px-3 min-w-0 bg-danger-50 text-danger hover:bg-danger-100 hover:text-danger-600 text-xs font-medium"
                >
                  重置全部
                </Button>
              </Tooltip>
            </div>
          </motion.div>

          {/* 表单内容 */}
          {renderForm()}
        </div>
      </div>

      {/* ==================== 移动端侧边栏抽屉 ==================== */}
      <AnimatePresence>
        {showMobileSidebar && (
          <>
            {/* 遮罩层 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
              onClick={() => setShowMobileSidebar(false)}
            />
            {/* 抽屉 */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] bg-card border-r border-border/60 shadow-lg flex flex-col"
            >
              {/* 抽屉头部 */}
              <div className="flex items-center justify-between px-4 h-14 border-b border-border/40">
                <span className="text-sm font-semibold text-foreground">设置导航</span>
                <button
                  className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors"
                  onClick={() => setShowMobileSidebar(false)}
                  aria-label="关闭导航菜单"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* 搜索 */}
              <div className="px-3 py-3">{renderSearch()}</div>

              {/* 导航列表 */}
              <div className="flex-1 overflow-y-auto px-2 pb-4">{renderNavigation()}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 悬浮保存按钮 */}
      <FloatingSaveButton hasChanges={isDirty} loading={saving} onSave={save} />
    </div>
  );
}
