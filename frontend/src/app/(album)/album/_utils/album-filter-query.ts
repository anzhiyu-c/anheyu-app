import type { AlbumSortOrder } from "@/types/album";

const DEFAULT_SORT: AlbumSortOrder = "display_order_asc";

const ALLOWED_SORTS = new Set<AlbumSortOrder>(["display_order_asc", "created_at_desc", "view_count_desc"]);

export interface AlbumFilterQueryState {
  categoryId: number | null;
  sort: AlbumSortOrder;
}

function normalizeSearch(search: string): string {
  if (!search) {
    return "";
  }

  return search.startsWith("?") ? search.slice(1) : search;
}

function parseCategoryId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseSort(value: string | null): AlbumSortOrder {
  if (!value || !ALLOWED_SORTS.has(value as AlbumSortOrder)) {
    return DEFAULT_SORT;
  }

  return value as AlbumSortOrder;
}

export function parseAlbumFilterQuery(search: string): AlbumFilterQueryState {
  const params = new URLSearchParams(normalizeSearch(search));

  return {
    categoryId: parseCategoryId(params.get("categoryId")),
    sort: parseSort(params.get("sort")),
  };
}

export function buildAlbumFilterQuery(currentSearch: string, nextState: AlbumFilterQueryState): string {
  const params = new URLSearchParams(normalizeSearch(currentSearch));
  const normalizedCategoryId = parseCategoryId(nextState.categoryId === null ? null : String(nextState.categoryId));
  const normalizedSort = parseSort(nextState.sort);

  if (normalizedCategoryId === null) {
    params.delete("categoryId");
  } else {
    params.set("categoryId", String(normalizedCategoryId));
  }

  if (normalizedSort === DEFAULT_SORT) {
    params.delete("sort");
  } else {
    params.set("sort", normalizedSort);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
