"use client";

import { useEffect, useRef } from "react";
import { restoreCssVariables, snapshotCssVariables, type CssVariableSnapshot } from "../_utils/css-variable-snapshot";
import "../_styles/air-conditioner.scss";

declare global {
  interface Window {
    anzhiyu_air_conditioner?: {
      init?: () => void;
      destroy?: () => void;
    };
  }
}

const SCRIPT_ID = "air-conditioner-script-tag";
const SCRIPT_URL = "https://npm.elemecdn.com/anzhiyu-air-conditioner@1.0.1/index.3f125bc6.js";

const CSS_VARIABLES_TO_MANAGE = [
  "--el-color-primary",
  "--el-color-primary-dark-1",
  "--el-color-primary-dark-2",
  "--el-color-primary-light-1",
  "--el-color-primary-light-2",
  "--el-color-primary-light-3",
  "--el-color-primary-light-4",
  "--el-color-primary-light-5",
  "--el-color-primary-light-6",
  "--el-color-primary-light-7",
  "--el-color-primary-light-8",
  "--el-color-primary-light-9",
  "--anzhiyu-main",
  "--anzhiyu-main-op-deep",
  "--anzhiyu-main-op-light",
] as const;

export function AirConditionerPageClient() {
  const cssSnapshotRef = useRef<CssVariableSnapshot>({});

  useEffect(() => {
    const rootElement = document.documentElement;
    const computedStyle = window.getComputedStyle(rootElement);

    cssSnapshotRef.current = snapshotCssVariables(CSS_VARIABLES_TO_MANAGE, computedStyle);

    let scriptTag = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.id = SCRIPT_ID;
      scriptTag.src = SCRIPT_URL;
      scriptTag.defer = true;
      document.body.appendChild(scriptTag);
    }

    return () => {
      if (window.anzhiyu_air_conditioner && typeof window.anzhiyu_air_conditioner.destroy === "function") {
        window.anzhiyu_air_conditioner.destroy();
      }

      delete window.anzhiyu_air_conditioner;

      const mountedScriptTag = document.getElementById(SCRIPT_ID);
      mountedScriptTag?.remove();

      restoreCssVariables(cssSnapshotRef.current, rootElement.style);
      cssSnapshotRef.current = {};
    };
  }, []);

  return (
    <div className="air-conditioner-container">
      <div className="air-conditioner-content">
        <div id="air-conditioner-vue" />
      </div>
    </div>
  );
}
