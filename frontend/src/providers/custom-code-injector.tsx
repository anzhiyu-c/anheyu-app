"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { useSiteConfigStore } from "@/store/site-config-store";

/**
 * 自定义代码注入器
 * 从站点配置读取 CUSTOM_HEADER_HTML / CUSTOM_FOOTER_HTML / CUSTOM_CSS / CUSTOM_JS，
 * 注入到页面的 <head> 和 <body> 中。
 */
export function CustomCodeInjector() {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  const customHeaderHtml = (siteConfig?.CUSTOM_HEADER_HTML as string) || "";
  const customFooterHtml = (siteConfig?.CUSTOM_FOOTER_HTML as string) || "";
  const customCss = (siteConfig?.CUSTOM_CSS as string) || "";
  const customJs = (siteConfig?.CUSTOM_JS as string) || "";

  return (
    <>
      {customCss && <CustomCssInjector css={customCss} />}
      {customHeaderHtml && <CustomHeadInjector html={customHeaderHtml} />}
      {customJs && (
        <Script id="anheyu-custom-js" strategy="afterInteractive">
          {customJs}
        </Script>
      )}
      {customFooterHtml && <CustomFooterRenderer html={customFooterHtml} />}
    </>
  );
}

function CustomCssInjector({ css }: { css: string }) {
  return <style id="anheyu-custom-css" dangerouslySetInnerHTML={{ __html: css }} />;
}

function CustomHeadInjector({ html }: { html: string }) {
  const injectedRef = useRef(false);
  const prevHtmlRef = useRef("");

  useEffect(() => {
    if (!html || html === prevHtmlRef.current) return;

    // 清理之前注入的内容
    document.querySelectorAll("[data-anheyu-custom-head]").forEach(el => el.remove());

    const container = document.createElement("div");
    container.innerHTML = html;

    Array.from(container.childNodes).forEach(node => {
      if (node instanceof HTMLElement) {
        node.setAttribute("data-anheyu-custom-head", "");
      }
      document.head.appendChild(node);
    });

    prevHtmlRef.current = html;
    injectedRef.current = true;

    return () => {
      document.querySelectorAll("[data-anheyu-custom-head]").forEach(el => el.remove());
    };
  }, [html]);

  return null;
}

function CustomFooterRenderer({ html }: { html: string }) {
  return <div id="anheyu-custom-footer" dangerouslySetInnerHTML={{ __html: html }} />;
}
