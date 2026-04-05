/**
 * 文章版权信息组件
 * 与 anheyu-app 实现一致
 */
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import type { Article } from "@/types/article";
import { useSiteConfigStore } from "@/store/site-config-store";
import { apiClient } from "@/lib/api/client";
import { generatePoster, downloadPoster, getPosterCoverImageUrl } from "@/utils/poster-generator";
import { formatDate } from "@/utils/date";
import styles from "./PostCopyright.module.css";

interface PostCopyrightProps {
  article: Article;
}

export function PostCopyright({ article }: PostCopyrightProps) {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  // 状态
  const [showRewardPanel, setShowRewardPanel] = useState(false);
  const [showPosterDialog, setShowPosterDialog] = useState(false);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [posterDataUrl, setPosterDataUrl] = useState<string>("");
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeCode, setSubscribeCode] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);

  // 倒计时效果
  useEffect(() => {
    if (codeCountdown > 0) {
      const timer = setTimeout(() => setCodeCountdown(codeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [codeCountdown]);

  // 判断是否为转载文章
  const isReprintArticle = article.is_reprint === true;

  // 获取站点所有者名称
  const siteOwnerName = siteConfig.frontDesk?.siteOwner?.name || siteConfig.APP_NAME || "本站博主";

  // 获取文章发布者的信息（用于原创文章显示）
  const articlePublisher = useMemo(() => {
    if (article.owner_nickname) {
      return article.owner_nickname;
    }
    if (article.owner_name) {
      return article.owner_name;
    }
    return siteOwnerName;
  }, [article.owner_nickname, article.owner_name, siteOwnerName]);

  // 获取显示的作者名称（转载文章显示原作者，原创文章显示发布者）
  const articleAuthor = useMemo(() => {
    if (isReprintArticle && article.copyright_author) {
      return article.copyright_author;
    }
    return articlePublisher;
  }, [isReprintArticle, article.copyright_author, articlePublisher]);

  // 获取作者链接（转载文章使用原作者链接）
  const articleAuthorHref = useMemo(() => {
    if (isReprintArticle && article.copyright_author_href) {
      return article.copyright_author_href;
    }
    return null;
  }, [isReprintArticle, article.copyright_author_href]);

  // 获取文章发布者的头像
  const articleAuthorAvatar = useMemo(() => {
    const avatar = article.owner_avatar;
    if (avatar) {
      // 如果是完整 URL，直接使用
      if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
        return avatar;
      }
      // 如果是 Gravatar 相对路径（如 avatar/xxx?d=identicon），拼接 Gravatar base URL
      if (avatar.startsWith("avatar/")) {
        const baseUrl = siteConfig.GRAVATAR_URL || "https://cravatar.cn";
        return `${baseUrl}/${avatar}`;
      }
      // 其他情况直接返回（可能是本地路径）
      return avatar;
    }
    // 否则使用站点所有者头像
    return siteConfig.USER_AVATAR || "/avatar.png";
  }, [article.owner_avatar, siteConfig.GRAVATAR_URL, siteConfig.USER_AVATAR]);

  // 版权声明内容
  const copyrightInfo = useMemo(() => {
    const license = siteConfig.copyright?.license ?? "CC BY-NC-SA 4.0";
    const licenseUrl = siteConfig.copyright?.license_url ?? "https://creativecommons.org/licenses/by-nc-sa/4.0/";
    const siteUrl = siteConfig.site?.url ?? siteConfig.SITE_URL ?? "/";

    // 获取自定义版权声明模板配置
    const copyrightConfig = siteConfig.post?.copyright;

    if (isReprintArticle) {
      // 转载文章的版权声明
      const originalAuthor = article.copyright_author || articlePublisher;
      const originalUrl = article.copyright_url;

      if (originalUrl) {
        // 有原文链接的转载文章
        const templateWithUrl =
          copyrightConfig?.reprintTemplateWithUrl ||
          copyrightConfig?.reprint_template_with_url ||
          '本文是转载或翻译文章，版权归 <a href="{originalUrl}" target="_blank">{originalAuthor}</a> 所有。建议访问原文，转载本文请联系原作者。';
        return templateWithUrl.replace(/{originalAuthor}/g, originalAuthor).replace(/{originalUrl}/g, originalUrl);
      } else {
        // 无原文链接的转载文章
        const templateWithoutUrl =
          copyrightConfig?.reprintTemplateWithoutUrl ||
          copyrightConfig?.reprint_template_without_url ||
          "本文是转载或翻译文章，版权归 {originalAuthor} 所有。建议访问原文，转载本文请联系原作者。";
        return templateWithoutUrl.replace(/{originalAuthor}/g, originalAuthor);
      }
    } else {
      // 原创文章的版权声明（使用文章发布者）
      const originalTemplate =
        copyrightConfig?.originalTemplate ||
        copyrightConfig?.original_template ||
        '本文是原创文章，采用 <a href="{licenseUrl}" target="_blank">{license}</a> 协议，完整转载请注明来自 <a href="{siteUrl}" target="_blank">{author}</a>';
      return originalTemplate
        .replace(/{license}/g, license)
        .replace(/{licenseUrl}/g, licenseUrl)
        .replace(/{author}/g, articlePublisher)
        .replace(/{siteUrl}/g, siteUrl);
    }
  }, [siteConfig, isReprintArticle, article.copyright_author, article.copyright_url, articlePublisher]);

  // 订阅配置
  const subscribeConfig = useMemo(
    () => ({
      enable: siteConfig.post?.subscribe?.enable ?? false,
      buttonText: siteConfig.post?.subscribe?.buttonText || "订阅",
      dialogTitle: siteConfig.post?.subscribe?.dialogTitle || "订阅博客更新",
      dialogDesc: siteConfig.post?.subscribe?.dialogDesc || "输入您的邮箱，获取最新文章推送",
    }),
    [siteConfig.post?.subscribe]
  );

  // 打赏配置
  const rewardConfig = useMemo(
    () => ({
      buttonText: siteConfig.post?.reward?.button_text || "打赏作者",
      title: siteConfig.post?.reward?.title || "感谢你赐予我前进的力量",
      wechatLabel: siteConfig.post?.reward?.wechat_label || "微信",
      alipayLabel: siteConfig.post?.reward?.alipay_label || "支付宝",
      listButtonText: siteConfig.post?.reward?.list_button_text || "打赏者名单",
      listButtonDesc: siteConfig.post?.reward?.list_button_desc || "因为你们的支持让我意识到写文章的价值",
    }),
    [siteConfig.post?.reward]
  );

  // 检查是否有任何打赏方式可用
  const hasAnyRewardMethod = useMemo(() => {
    const reward = siteConfig.post?.reward;
    if (!reward) return false;
    const wechatEnabled = reward.wechat_enable !== false && reward.wechat_qr;
    const alipayEnabled = reward.alipay_enable !== false && reward.alipay_qr;
    return Boolean(wechatEnabled || alipayEnabled);
  }, [siteConfig.post?.reward]);

  // 检查微信打赏是否可用
  const isWechatEnabled = useMemo(() => {
    const reward = siteConfig.post?.reward;
    return reward?.wechat_enable !== false && reward?.wechat_qr;
  }, [siteConfig.post?.reward]);

  // 检查支付宝打赏是否可用
  const isAlipayEnabled = useMemo(() => {
    const reward = siteConfig.post?.reward;
    return reward?.alipay_enable !== false && reward?.alipay_qr;
  }, [siteConfig.post?.reward]);

  // 版权区域按钮显示控制（系统级别 && 文章级别）
  const showRewardButton = useMemo(() => {
    const copyright = siteConfig.post?.copyright;
    const globalSetting = copyright?.showRewardButton ?? copyright?.show_reward_button ?? true;
    return globalSetting !== false && article.show_reward_button !== false;
  }, [siteConfig.post?.copyright, article.show_reward_button]);

  const showShareButton = useMemo(() => {
    const copyright = siteConfig.post?.copyright;
    const globalSetting = copyright?.showShareButton ?? copyright?.show_share_button ?? true;
    return globalSetting !== false && article.show_share_button !== false;
  }, [siteConfig.post?.copyright, article.show_share_button]);

  const showSubscribeButton = useMemo(() => {
    const copyright = siteConfig.post?.copyright;
    const globalSetting = copyright?.showSubscribeButton ?? copyright?.show_subscribe_button ?? true;
    return globalSetting !== false && article.show_subscribe_button !== false;
  }, [siteConfig.post?.copyright, article.show_subscribe_button]);

  // 判断是否有任何按钮需要显示
  const hasAnyButton = useMemo(() => {
    const rewardVisible = showRewardButton && siteConfig.post?.reward?.enable && hasAnyRewardMethod;
    return rewardVisible || showShareButton || showSubscribeButton;
  }, [showRewardButton, showShareButton, showSubscribeButton, siteConfig.post?.reward?.enable, hasAnyRewardMethod]);

  // 获取当前文章URL
  const articleUrl = typeof window !== "undefined" ? window.location.href : "";

  // 复制链接
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(articleUrl);
      alert("链接已复制到剪贴板");
    } catch {
      alert("复制失败，请手动复制");
    }
  }, [articleUrl]);

  // 分享到社交平台
  const shareToWeibo = useCallback(() => {
    const url = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(
      articleUrl
    )}&title=${encodeURIComponent(article.title)}`;
    window.open(url, "_blank", "width=600,height=400");
  }, [articleUrl, article.title]);

  const shareToQQ = useCallback(() => {
    const url = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(
      articleUrl
    )}&title=${encodeURIComponent(article.title)}&summary=${encodeURIComponent(article.summaries?.[0] || "")}`;
    window.open(url, "_blank", "width=600,height=400");
  }, [articleUrl, article.title, article.summaries]);

  const shareToQZone = useCallback(() => {
    const url = `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodeURIComponent(
      articleUrl
    )}&title=${encodeURIComponent(article.title)}&summary=${encodeURIComponent(article.summaries?.[0] || "")}`;
    window.open(url, "_blank", "width=600,height=400");
  }, [articleUrl, article.title, article.summaries]);

  // 处理订阅按钮点击
  const handleSubscribeClick = useCallback(() => {
    if (subscribeConfig.enable) {
      setSubscribeEmail("");
      setSubscribeCode("");
      setShowSubscribeDialog(true);
    } else {
      // 跳转到 RSS
      window.open("/rss.xml", "_blank");
    }
  }, [subscribeConfig.enable]);

  // 发送验证码
  const handleSendCode = useCallback(async () => {
    if (!subscribeEmail) {
      alert("请输入邮箱地址");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(subscribeEmail)) {
      alert("请输入有效的邮箱地址");
      return;
    }

    if (isSendingCode || codeCountdown > 0) return;

    try {
      setIsSendingCode(true);
      const result = await apiClient.post<null>("/api/public/subscribe/code", { email: subscribeEmail });

      if (result.code === 200) {
        alert("验证码已发送，请查收邮件");
        setCodeCountdown(60);
      } else {
        alert(result.message || "发送验证码失败，请稍后重试");
      }
    } catch {
      alert("发送验证码失败，请稍后重试");
    } finally {
      setIsSendingCode(false);
    }
  }, [subscribeEmail, isSendingCode, codeCountdown]);

  // 提交订阅
  const handleSubscribe = useCallback(async () => {
    if (!subscribeEmail) {
      alert("请输入邮箱地址");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(subscribeEmail)) {
      alert("请输入有效的邮箱地址");
      return;
    }

    if (!subscribeCode) {
      alert("请输入验证码");
      return;
    }

    try {
      setIsSubscribing(true);
      const result = await apiClient.post<null>("/api/public/subscribe", {
        email: subscribeEmail,
        code: subscribeCode,
      });

      if (result.code === 200) {
        alert("订阅成功！您将在新文章发布时收到邮件通知");
        setShowSubscribeDialog(false);
        setSubscribeEmail("");
        setSubscribeCode("");
        setCodeCountdown(0);
      } else {
        alert(result.message || "订阅失败，请稍后重试");
      }
    } catch {
      alert("订阅失败，请稍后重试");
    } finally {
      setIsSubscribing(false);
    }
  }, [subscribeEmail, subscribeCode]);

  // 生成分享海报
  const handleGeneratePoster = useCallback(async () => {
    if (isGeneratingPoster) return;

    try {
      setIsGeneratingPoster(true);

      // 与 PostHeader 一致：优先 top_img_url，其次 cover_url
      const coverImage = getPosterCoverImageUrl(article);

      // 获取文章简介
      const description = article.summaries?.[0] || undefined;

      // 格式化发布时间
      const publishDate = formatDate(article.created_at);

      // 生成海报
      const dataUrl = await generatePoster({
        title: article.title,
        description: description,
        author: articleAuthor,
        authorAvatar: articleAuthorAvatar,
        siteName: siteConfig.APP_NAME || siteConfig.frontDesk?.siteOwner?.name,
        siteSubtitle: siteConfig.SUB_TITLE,
        articleUrl: articleUrl,
        coverImage: coverImage,
        publishDate: publishDate,
      });

      // 保存海报数据并显示弹窗
      setPosterDataUrl(dataUrl);
      setShowPosterDialog(true);
    } catch (error) {
      console.error("生成海报失败:", error);
      alert("生成海报失败，请稍后重试");
    } finally {
      setIsGeneratingPoster(false);
    }
  }, [isGeneratingPoster, article, articleAuthor, articleAuthorAvatar, siteConfig, articleUrl]);

  // 下载海报
  const handleDownloadPoster = useCallback(() => {
    if (!posterDataUrl) return;
    const filename = `${article.title || "文章"}_分享海报.png`;
    downloadPoster(posterDataUrl, filename);
  }, [posterDataUrl, article.title]);

  // 如果文章的 copyright 字段为 false，不显示版权区域
  if (article.copyright === false) {
    return null;
  }

  return (
    <div className={styles.postCopyright}>
      {/* 作者头像 */}
      <Link href="/about" className={styles.authorAvatar} title="关于作者">
        <Image src={articleAuthorAvatar} alt="作者头像" fill className={styles.avatarImage} unoptimized />
      </Link>

      {/* 作者名称 */}
      <div className={styles.authorName}>
        {articleAuthorHref ? (
          <a href={articleAuthorHref} target="_blank" rel="noopener noreferrer" className={styles.authorLink}>
            {articleAuthor}
          </a>
        ) : (
          <span>{articleAuthor}</span>
        )}
      </div>

      {/* 作者描述 */}
      <div className={styles.authorDesc}>
        {isReprintArticle ? "转载文章 · 原作者" : siteConfig.SUB_TITLE || "生活明朗，万物可爱"}
      </div>

      {/* 按钮组 */}
      {hasAnyButton && (
        <div className={styles.buttonGroup}>
          {/* 打赏按钮 */}
          {showRewardButton && siteConfig.post?.reward?.enable && hasAnyRewardMethod && (
            <div className={styles.reward}>
              <button className={styles.rewardButton} onClick={() => setShowRewardPanel(!showRewardPanel)}>
                <Icon icon="ri:hand-heart-fill" width={18} height={18} />
                <span>{rewardConfig.buttonText}</span>
              </button>

              {/* 打赏面板 */}
              {showRewardPanel && (
                <>
                  <div className={styles.rewardMain}>
                    <div className={styles.rewardAll}>
                      <span className={styles.rewardTitle}>{rewardConfig.title}</span>
                      <ul className={styles.rewardGroup}>
                        {isWechatEnabled && (
                          <li className={styles.rewardItem}>
                            <a href={siteConfig.post?.reward?.wechat_qr} target="_blank" rel="noopener noreferrer">
                              <Image
                                src={siteConfig.post?.reward?.wechat_qr || ""}
                                alt={rewardConfig.wechatLabel}
                                width={130}
                                height={130}
                                className={styles.qrCode}
                                unoptimized
                              />
                            </a>
                            <div className={styles.qrCodeDesc}>{rewardConfig.wechatLabel}</div>
                          </li>
                        )}
                        {isAlipayEnabled && (
                          <li className={styles.rewardItem}>
                            <a href={siteConfig.post?.reward?.alipay_qr} target="_blank" rel="noopener noreferrer">
                              <Image
                                src={siteConfig.post?.reward?.alipay_qr || ""}
                                alt={rewardConfig.alipayLabel}
                                width={130}
                                height={130}
                                className={styles.qrCode}
                                unoptimized
                              />
                            </a>
                            <div className={styles.qrCodeDesc}>{rewardConfig.alipayLabel}</div>
                          </li>
                        )}
                      </ul>
                      <Link href="/about" className={styles.rewardMainBtn}>
                        <div className={styles.rewardText}>{rewardConfig.listButtonText}</div>
                        <div className={styles.rewardDec}>{rewardConfig.listButtonDesc}</div>
                      </Link>
                    </div>
                  </div>
                  <div className={styles.quitBox} onClick={() => setShowRewardPanel(false)} />
                </>
              )}
            </div>
          )}

          {/* 订阅按钮 */}
          {showSubscribeButton && (
            <button className={styles.subscribeButton} onClick={handleSubscribeClick}>
              <Icon icon="ri:plant-fill" width={18} height={18} />
              <span>{subscribeConfig.buttonText}</span>
            </button>
          )}

          {/* 分享按钮 */}
          {showShareButton && (
            <button
              className={`${styles.shareButton} ${isGeneratingPoster ? styles.loading : ""}`}
              onClick={handleGeneratePoster}
              disabled={isGeneratingPoster}
            >
              <Icon icon="basil:share-box-solid" width={18} height={18} />
              <span>{isGeneratingPoster ? "生成中..." : "分享"}</span>
            </button>
          )}
        </div>
      )}

      {/* 版权声明 */}
      <div className={styles.copyrightNotice} dangerouslySetInnerHTML={{ __html: copyrightInfo }} />

      {/* 分享弹窗 */}
      {showPosterDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowPosterDialog(false)}>
          <div className={`${styles.dialog} ${styles.posterDialog}`} onClick={e => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h3>分享海报</h3>
              <button className={styles.dialogClose} onClick={() => setShowPosterDialog(false)}>
                <Icon icon="ri:close-line" width={20} height={20} />
              </button>
            </div>
            <div className={styles.posterDialogContent}>
              {/* 左侧：海报预览 */}
              <div className={styles.posterPreviewSide}>
                {posterDataUrl ? (
                  <div className={styles.posterImageWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={posterDataUrl} alt="分享海报" className={styles.posterImage} />
                  </div>
                ) : (
                  <div className={styles.posterLoading}>
                    <p>正在生成海报...</p>
                  </div>
                )}
              </div>

              {/* 右侧：操作区域 */}
              <div className={styles.posterActionsSide}>
                {/* 复制链接 */}
                <div className={styles.actionSection}>
                  <div className={styles.sectionLabel}>点击复制链接：</div>
                  <input type="text" readOnly value={articleUrl} className={styles.urlInput} onClick={handleCopyLink} />
                </div>

                {/* 分享到 */}
                <div className={styles.actionSection}>
                  <div className={styles.sectionLabel}>分享到：</div>
                  <div className={styles.shareButtons}>
                    <button className={`${styles.shareBtn} ${styles.shareBtnWeibo}`} onClick={shareToWeibo}>
                      <Icon icon="ri:weibo-fill" width={18} height={18} />
                      <span>微博</span>
                    </button>
                    <button className={`${styles.shareBtn} ${styles.shareBtnQQ}`} onClick={shareToQQ}>
                      <Icon icon="ri:qq-fill" width={18} height={18} />
                      <span>QQ好友</span>
                    </button>
                    <button className={`${styles.shareBtn} ${styles.shareBtnQzone}`} onClick={shareToQZone}>
                      <Icon icon="ri:qq-fill" width={18} height={18} />
                      <span>QQ空间</span>
                    </button>
                  </div>
                </div>

                {/* 下载海报 */}
                <div className={styles.actionSection}>
                  <div className={styles.sectionLabel}>下载海报：</div>
                  <button className={styles.downloadBtn} onClick={handleDownloadPoster} disabled={!posterDataUrl}>
                    <span>点击下载</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 订阅弹窗 */}
      {showSubscribeDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowSubscribeDialog(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h3>{subscribeConfig.dialogTitle}</h3>
              <button className={styles.dialogClose} onClick={() => setShowSubscribeDialog(false)}>
                <Icon icon="ri:close-line" width={20} height={20} />
              </button>
            </div>
            <div className={styles.subscribeDialogContent}>
              <p className={styles.subscribeDesc}>{subscribeConfig.dialogDesc}</p>
              <input
                type="email"
                placeholder="请输入您的邮箱"
                value={subscribeEmail}
                onChange={e => setSubscribeEmail(e.target.value)}
                disabled={isSubscribing}
                className={styles.subscribeInput}
              />
              <div className={styles.codeInputWrapper}>
                <input
                  type="text"
                  placeholder="请输入验证码"
                  value={subscribeCode}
                  onChange={e => setSubscribeCode(e.target.value)}
                  disabled={isSubscribing}
                  className={styles.subscribeInput}
                />
                <button
                  className={styles.sendCodeBtn}
                  disabled={codeCountdown > 0 || isSendingCode}
                  onClick={handleSendCode}
                >
                  {codeCountdown > 0 ? `${codeCountdown}s` : "发送验证码"}
                </button>
              </div>
              <div className={styles.subscribeActions}>
                <button className={styles.subscribeSubmitBtn} disabled={isSubscribing} onClick={handleSubscribe}>
                  {isSubscribing ? "订阅中..." : "订阅"}
                </button>
              </div>
              <p className={styles.subscribeTips}>您可以随时通过邮件中的链接取消订阅</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PostCopyright;
