/**
 * @description 主题色管理工具
 * 用于动态更新浏览器 meta theme-color
 */

/**
 * @description 更新 meta 标签的主题色
 * @param color - 主题色值
 */
const updateMetaThemeColor = (color: string) => {
  if (typeof document === "undefined") return;

  // 更新 theme-color meta 标签（不删除，避免 React hydration 冲突）
  let themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeColorMeta) {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.setAttribute("name", "theme-color");
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.setAttribute("content", color);

  // 更新 msapplication-TileColor meta 标签
  let tileColorMeta = document.querySelector('meta[name="msapplication-TileColor"]');
  if (!tileColorMeta) {
    tileColorMeta = document.createElement("meta");
    tileColorMeta.setAttribute("name", "msapplication-TileColor");
    document.head.appendChild(tileColorMeta);
  }
  tileColorMeta.setAttribute("content", color);
};

/**
 * @description 动态更新 meta 标签的主题色（公开方法）
 * @param color - 主题色值，可以是 CSS 变量名（如 'var(--background)'）或具体颜色值
 */
export const updateMetaThemeColorDynamic = (color: string) => {
  if (typeof document === "undefined") return;

  // 如果传入的是 CSS 变量，则获取其计算后的值
  if (color.startsWith("var(")) {
    const variableName = color.match(/var\((--[^)]+)\)/)?.[1];
    if (variableName) {
      const computedColor = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
      if (computedColor) {
        updateMetaThemeColor(computedColor);
        return;
      }
    }
  }
  // 直接使用传入的颜色值
  updateMetaThemeColor(color);
};

/**
 * @description 恢复 meta 标签的默认主题色（使用背景色）
 */
export const restoreMetaThemeColor = () => {
  if (typeof document === "undefined") return;

  const defaultThemeColor =
    getComputedStyle(document.documentElement).getPropertyValue("--background").trim() || "#f7f9fe";

  updateMetaThemeColor(defaultThemeColor);
};

/**
 * @description 设置文章主题色到 meta 标签
 * @param primaryColor - 文章的主色调
 */
export const setArticleMetaThemeColor = (primaryColor: string) => {
  if (!primaryColor) {
    restoreMetaThemeColor();
    return;
  }
  updateMetaThemeColor(primaryColor);
};
