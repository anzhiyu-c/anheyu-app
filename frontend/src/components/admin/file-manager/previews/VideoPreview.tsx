"use client";

import { forwardRef, useImperativeHandle } from "react";
import { Fancybox } from "@fancyapps/ui";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

export interface VideoPreviewRef {
  open: (url: string) => void;
}

/**
 * 视频预览组件 - 基于 Fancybox
 * 纯命令式调用，不渲染任何 DOM
 */
export const VideoPreview = forwardRef<VideoPreviewRef>((_, ref) => {
  useImperativeHandle(ref, () => ({
    open: (url: string) => {
      Fancybox.show(
        [
          {
            src: url,
            type: "html5video",
          },
        ],
        {
          showClass: "f-zoomInUp",
          hideClass: "f-fadeOut",
        }
      );
    },
  }));

  return null;
});

VideoPreview.displayName = "VideoPreview";
