/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-04 15:42:10
 * @LastEditTime: 2026-02-06 14:14:18
 * @LastEditors: 安知鱼
 */
"use client";

import { forwardRef, useImperativeHandle } from "react";
import { Fancybox } from "@fancyapps/ui";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

export interface ImagePreviewItem {
  imageUrl: string;
  downloadUrl: string;
  fileSize: number;
  createTime: Date;
}

export interface ImagePreviewRef {
  open: (items: ImagePreviewItem[], index: number) => void;
}

/**
 * 图片预览组件 - 基于 Fancybox
 * 纯命令式调用，不渲染任何 DOM
 * 自带缩放、拖拽、滑动、键盘导航、全屏、下载等功能
 */
export const ImagePreview = forwardRef<ImagePreviewRef>((_, ref) => {
  useImperativeHandle(ref, () => ({
    open: (items, startIndex) => {
      const slides = items.map(item => ({
        src: item.imageUrl,
        type: "image",
        downloadSrc: item.downloadUrl,
      }));

      Fancybox.show(slides, {
        startIndex,
        showClass: "f-zoomInUp",
        hideClass: "f-fadeOut",
      });
    },
  }));

  return null;
});

ImagePreview.displayName = "ImagePreview";
