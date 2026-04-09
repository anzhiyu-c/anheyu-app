import type { AlbumLayoutMode } from "@/types/album";
import type { AlbumSiteConfig, SiteConfigData } from "@/types/site-config";

export interface ParsedAlbumConfig {
  layoutMode: AlbumLayoutMode;
  pageSize: number;
  enableComment: boolean;
  waterfall: {
    gap: number;
    columnCount: {
      large: number;
      medium: number;
      small: number;
    };
  };
  banner: {
    tip: string;
    title: string;
    description: string;
    background: string;
  };
}

const DEFAULT_CONFIG: ParsedAlbumConfig = {
  layoutMode: "waterfall",
  pageSize: 24,
  enableComment: false,
  waterfall: {
    gap: 6,
    columnCount: {
      large: 4,
      medium: 3,
      small: 1,
    },
  },
  banner: {
    tip: "",
    title: "",
    description: "",
    background: "",
  },
};

function getConfigValue(config: SiteConfigData | undefined, path: string): unknown {
  if (!config || typeof config !== "object") {
    return undefined;
  }

  const record = config as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, path)) {
    return record[path];
  }

  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, config);
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function parsePositiveNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return fallback;
}

function parseLayoutMode(value: unknown): AlbumLayoutMode {
  if (value === "waterfall") return "waterfall";
  if (value === "grid") return "grid";
  return DEFAULT_CONFIG.layoutMode;
}

function parseColumnCount(value: unknown): ParsedAlbumConfig["waterfall"]["columnCount"] {
  const fallback = DEFAULT_CONFIG.waterfall.columnCount;

  let source: Record<string, unknown> | null = null;

  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        source = parsed as Record<string, unknown>;
      }
    } catch {
      source = null;
    }
  } else if (value && typeof value === "object") {
    source = value as Record<string, unknown>;
  }

  if (!source) {
    return { ...fallback };
  }

  return {
    large: parsePositiveNumber(source.large, fallback.large),
    medium: parsePositiveNumber(source.medium, fallback.medium),
    small: parsePositiveNumber(source.small, fallback.small),
  };
}

function getAlbumConfig(config: SiteConfigData | undefined): AlbumSiteConfig {
  const nested = getConfigValue(config, "album");
  if (nested && typeof nested === "object") {
    return nested as AlbumSiteConfig;
  }
  return {};
}

export function parseAlbumConfig(config: SiteConfigData | undefined): ParsedAlbumConfig {
  const albumConfig = getAlbumConfig(config);

  const layoutMode = parseLayoutMode(
    albumConfig.layout_mode ?? getConfigValue(config, "album.layout_mode") ?? DEFAULT_CONFIG.layoutMode
  );

  const pageSize = parsePositiveNumber(
    albumConfig.page_size ?? getConfigValue(config, "album.page_size"),
    DEFAULT_CONFIG.pageSize
  );

  const enableComment = parseBoolean(
    albumConfig.enable_comment ?? getConfigValue(config, "album.enable_comment"),
    DEFAULT_CONFIG.enableComment
  );

  const waterfallGap = parsePositiveNumber(
    albumConfig.waterfall?.gap ?? getConfigValue(config, "album.waterfall.gap"),
    DEFAULT_CONFIG.waterfall.gap
  );

  const waterfallColumnCount = parseColumnCount(
    albumConfig.waterfall?.column_count ?? getConfigValue(config, "album.waterfall.column_count")
  );

  const tip = String(
    albumConfig.banner?.tip ?? getConfigValue(config, "album.banner.tip") ?? DEFAULT_CONFIG.banner.tip
  );

  const title = String(
    albumConfig.banner?.title ?? getConfigValue(config, "album.banner.title") ?? DEFAULT_CONFIG.banner.title
  );

  const description = String(
    albumConfig.banner?.description ??
      getConfigValue(config, "album.banner.description") ??
      DEFAULT_CONFIG.banner.description
  );

  const background = String(
    albumConfig.banner?.background ??
      getConfigValue(config, "album.banner.background") ??
      DEFAULT_CONFIG.banner.background
  );

  return {
    layoutMode,
    pageSize,
    enableComment,
    waterfall: {
      gap: waterfallGap,
      columnCount: waterfallColumnCount,
    },
    banner: {
      tip,
      title,
      description,
      background,
    },
  };
}
