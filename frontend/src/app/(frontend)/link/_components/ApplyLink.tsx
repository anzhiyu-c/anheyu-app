"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { addToast, Button, Checkbox, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { Send, Loader2, AlertTriangle, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui";
import { useApplyLink, useApplications } from "@/hooks/queries/use-friends";
import { friendsApi } from "@/lib/api/friends";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useCodeBlockEnhancer } from "@/hooks/use-code-block-enhancer";
import type { LinkApplyType, LinkStatus } from "@/types/friends";

const ALL_STATUS_KEY = "ALL";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  APPROVED: { label: "已通过", color: "text-green-600 bg-green-50 dark:bg-green-900/20" },
  PENDING: { label: "待审核", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
  REJECTED: { label: "已拒绝", color: "text-red-600 bg-red-50 dark:bg-red-900/20" },
  INVALID: { label: "已失效", color: "text-gray-500 bg-gray-50 dark:bg-gray-800/30" },
};

export function ApplyLink() {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const applyLink = useApplyLink();

  // 从配置获取
  const rawConditions = siteConfig?.FRIEND_LINK_APPLY_CONDITION;
  const conditions: string[] = useMemo(() => {
    if (!rawConditions) return [];
    if (Array.isArray(rawConditions)) return rawConditions;
    try {
      const parsed = JSON.parse(rawConditions as string);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [rawConditions]);

  const customCodeRef = useRef<HTMLDivElement>(null);
  const customCodeHtml = (siteConfig?.FRIEND_LINK_APPLY_CUSTOM_CODE_HTML as string) || "";
  useCodeBlockEnhancer(customCodeRef, customCodeHtml);
  const placeholderName = (siteConfig?.FRIEND_LINK_PLACEHOLDER_NAME as string) || "例如：安知鱼";
  const placeholderURL = (siteConfig?.FRIEND_LINK_PLACEHOLDER_URL as string) || "https://blog.anheyu.com/";
  const placeholderLogo = (siteConfig?.FRIEND_LINK_PLACEHOLDER_LOGO as string) || "https://example.com/logo.png";
  const placeholderDesc = (siteConfig?.FRIEND_LINK_PLACEHOLDER_DESCRIPTION as string) || "一句话介绍你的站点";
  const placeholderSiteshot =
    (siteConfig?.FRIEND_LINK_PLACEHOLDER_SITESHOT as string) || "https://example.com/screenshot.png (可选)";

  // 条件勾选
  const [checkedStates, setCheckedStates] = useState<boolean[]>([]);
  useEffect(() => {
    setCheckedStates(new Array(conditions.length).fill(false));
  }, [conditions.length]);
  const allChecked =
    conditions.length === 0 || (checkedStates.length === conditions.length && checkedStates.every(Boolean));

  // 表单
  const [type, setType] = useState<LinkApplyType>("NEW");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [logo, setLogo] = useState("");
  const [description, setDescription] = useState("");
  const [siteshot, setSiteshot] = useState("");
  const [email, setEmail] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [updateReason, setUpdateReason] = useState("");
  const [urlChecking, setUrlChecking] = useState(false);

  // 申请列表
  const [appPage, setAppPage] = useState(1);
  const [appStatusFilter, setAppStatusFilter] = useState<LinkStatus | "">("");
  const [searchName, setSearchName] = useState("");
  const statusFilterLabel = appStatusFilter ? STATUS_MAP[appStatusFilter]?.label || "全部状态" : "全部状态";
  const { data: appData, isPending: appLoading } = useApplications({
    page: appPage,
    pageSize: 20,
    status: appStatusFilter || undefined,
    name: searchName || undefined,
  });
  const applications = appData?.list || [];
  const appTotal = appData?.total || 0;
  const appTotalPages = Math.max(1, Math.ceil(appTotal / 20));

  const handleCheckUrl = useCallback(async () => {
    if (!url.trim()) return;
    try {
      new URL(url);
    } catch {
      return;
    }

    setUrlChecking(true);
    try {
      const res = await friendsApi.checkLinkExists(url);
      if (res.exists) {
        setType("UPDATE");
        addToast({ title: "该网站已申请过友链，已自动切换为修改模式", color: "warning", timeout: 3000 });
      }
    } catch {
      // 检查失败不阻止操作
    } finally {
      setUrlChecking(false);
    }
  }, [url]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      addToast({ title: "请输入网站名称", color: "warning", timeout: 3000 });
      return;
    }
    if (!url.trim()) {
      addToast({ title: "请输入网站链接", color: "warning", timeout: 3000 });
      return;
    }
    if (!logo.trim()) {
      addToast({ title: "请输入网站 Logo", color: "warning", timeout: 3000 });
      return;
    }
    if (!description.trim()) {
      addToast({ title: "请输入网站简介", color: "warning", timeout: 3000 });
      return;
    }
    if (!email.trim()) {
      addToast({ title: "请输入联系邮箱", color: "warning", timeout: 3000 });
      return;
    }
    if (type === "UPDATE" && !updateReason.trim()) {
      addToast({ title: "请说明修改原因", color: "warning", timeout: 3000 });
      return;
    }

    try {
      await applyLink.mutateAsync({
        type,
        name: name.trim(),
        url: url.trim(),
        logo: logo.trim(),
        description: description.trim(),
        siteshot: siteshot.trim() || undefined,
        email: email.trim(),
        original_url: type === "UPDATE" ? originalUrl.trim() || undefined : undefined,
        update_reason: type === "UPDATE" ? updateReason.trim() : undefined,
      });
      addToast({ title: "申请提交成功，请等待博主审核！", color: "success", timeout: 3000 });
      // 重置表单
      setName("");
      setUrl("");
      setLogo("");
      setDescription("");
      setSiteshot("");
      setEmail("");
      setOriginalUrl("");
      setUpdateReason("");
      setType("NEW");
    } catch (err) {
      addToast({ title: err instanceof Error ? err.message : "申请失败，请稍后再试", color: "danger", timeout: 3000 });
    }
  };

  return (
    <div className="space-y-8">
      {/* 自定义代码区 */}
      {customCodeHtml && (
        <div ref={customCodeRef} className="post-content" dangerouslySetInnerHTML={{ __html: customCodeHtml }} />
      )}

      {/* 申请条件 */}
      {conditions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="text-base font-semibold text-foreground">申请条件</h3>
          <p className="text-sm text-muted-foreground">请先确认满足以下条件：</p>
          <div className="flex flex-col gap-2">
            {conditions.map((condition, index) => (
              <Checkbox
                key={index}
                isSelected={checkedStates[index] || false}
                onValueChange={val => {
                  const next = [...checkedStates];
                  next[index] = val;
                  setCheckedStates(next);
                }}
                classNames={{
                  base: "w-full max-w-full cursor-pointer inline-flex",
                  label: "text-sm text-foreground",
                }}
              >
                <span dangerouslySetInnerHTML={{ __html: condition }} />
              </Checkbox>
            ))}
          </div>
          {!allChecked && (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              请先勾选所有条件后再填写申请表单
            </div>
          )}
        </div>
      )}

      {/* 申请表单 */}
      {allChecked && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h3 className="text-base font-semibold text-foreground">友链申请</h3>

          {/* 申请类型 */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground">申请类型：</label>
            <div className="flex gap-3">
              {(["NEW", "UPDATE"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-all cursor-pointer ${
                    type === t
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {t === "NEW" ? "新增申请" : "修改信息"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              placeholder={placeholderName}
              value={name}
              onChange={e => setName(e.target.value)}
              label="网站名称"
            />
            <div>
              <Input
                placeholder={placeholderURL}
                value={url}
                onChange={e => setUrl(e.target.value)}
                onBlur={handleCheckUrl}
                label="网站链接"
                endAdornment={
                  urlChecking ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : undefined
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              placeholder={placeholderLogo}
              value={logo}
              onChange={e => setLogo(e.target.value)}
              label="Logo 链接"
            />
            <Input
              placeholder={placeholderDesc}
              value={description}
              onChange={e => setDescription(e.target.value)}
              label="网站简介"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              placeholder={placeholderSiteshot}
              value={siteshot}
              onChange={e => setSiteshot(e.target.value)}
              label="网站截图（可选）"
            />
            <Input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              label="联系邮箱"
            />
          </div>

          {type === "UPDATE" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                placeholder="原友链 URL"
                value={originalUrl}
                onChange={e => setOriginalUrl(e.target.value)}
                label="原友链 URL（可选）"
              />
              <Input
                placeholder="请说明修改原因"
                value={updateReason}
                onChange={e => setUpdateReason(e.target.value)}
                label="修改原因"
              />
            </div>
          )}

          <button
            type="button"
            disabled={applyLink.isPending}
            onClick={handleSubmit}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {applyLink.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            提交申请
          </button>
        </div>
      )}

      {/* 友链申请列表 */}
      <div className="applications-card">
        <div className="applications-header">
          <div className="header-title">
            <span>友链申请列表</span>
            <span className="header-count">（共 {appTotal} 条）</span>
          </div>
          <div className="header-filters">
            <div className="status-filter-wrap">
              <Dropdown
                placement="bottom-end"
                shouldBlockScroll={false}
                classNames={{ content: "status-filter-popover" }}
              >
                <DropdownTrigger>
                  <Button
                    aria-label="状态筛选"
                    variant="flat"
                    disableAnimation
                    className="status-filter-trigger"
                    endContent={<ChevronDown className="status-filter-arrow" />}
                  >
                    {statusFilterLabel}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="状态筛选菜单"
                  disallowEmptySelection
                  selectionMode="single"
                  selectedKeys={new Set([appStatusFilter || ALL_STATUS_KEY])}
                  onSelectionChange={keys => {
                    if (keys === "all") return;
                    const selected = Array.from(keys)[0] as string | undefined;
                    setAppStatusFilter(selected && selected !== ALL_STATUS_KEY ? (selected as LinkStatus) : "");
                    setAppPage(1);
                  }}
                  className="status-filter-menu"
                >
                  <DropdownItem key={ALL_STATUS_KEY} className="status-filter-item">
                    全部状态
                  </DropdownItem>
                  <DropdownItem key="PENDING" className="status-filter-item">
                    待审核
                  </DropdownItem>
                  <DropdownItem key="APPROVED" className="status-filter-item">
                    已通过
                  </DropdownItem>
                  <DropdownItem key="REJECTED" className="status-filter-item">
                    已拒绝
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
            <input
              type="text"
              className="name-search"
              placeholder="搜索名称"
              value={searchName}
              onChange={e => {
                setSearchName(e.target.value);
                setAppPage(1);
              }}
            />
          </div>
        </div>

        <div className="applications-list">
          {appLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : applications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">暂无申请记录</p>
          ) : (
            <div className="application-items">
              {applications.map(app => {
                const statusInfo = STATUS_MAP[app.status] || { label: app.status, color: "" };
                const typeLabel = app.type === "UPDATE" ? "修改" : "新增";
                return (
                  <div key={app.id} className="application-item">
                    <div className="item-content">
                      <div className="item-header">
                        <span className="item-name">{app.name}</span>
                        <div className="item-tags">
                          <span className={`item-tag ${statusInfo.color}`}>{statusInfo.label}</span>
                          {app.type && (
                            <span className="item-tag text-gray-500 bg-gray-100 dark:bg-gray-800/40">{typeLabel}</span>
                          )}
                        </div>
                      </div>
                      <div className="item-description">{app.description || "暂无描述"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 分页 */}
          {appTotalPages > 1 && (
            <div className="pagination">
              <button type="button" disabled={appPage <= 1} onClick={() => setAppPage(p => p - 1)} className="page-btn">
                上一页
              </button>
              <span className="page-info">
                {appPage} / {appTotalPages}
              </span>
              <button
                type="button"
                disabled={appPage >= appTotalPages}
                onClick={() => setAppPage(p => p + 1)}
                className="page-btn"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
