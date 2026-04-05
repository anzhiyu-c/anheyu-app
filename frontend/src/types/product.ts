/**
 * 商品管理类型定义（管理端）
 */

export enum ProductStatus {
  Draft = 1,
  Published = 2,
  Offline = 3,
}

export enum DeliveryMethod {
  Fixed = "FIXED_REPLY",
  Stock = "STOCK_ITEM",
}

export enum StockStatus {
  Available = 1,
  Used = 2,
  Invalid = 3,
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  cover_url?: string;
  delivery_method: DeliveryMethod;
  fixed_reply_content?: string;
  stock_count?: number;
  sold_count: number;
  status: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  description_html?: string;
  cover_url?: string;
  status: ProductStatus;
  exclude_from_membership: boolean;
  show_on_homepage: boolean;
  sort_order: number;
  total_sales?: number;
  total_revenue?: number;
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
}

export interface ProductListItem {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  status: ProductStatus;
  min_price: number;
  max_price?: number;
  total_sales: number;
  total_revenue?: number;
  variant_count: number;
  exclude_from_membership?: boolean;
  show_on_homepage?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface StockItem {
  id: string;
  variant_id: string;
  content: string;
  status: StockStatus;
  order_id?: number;
  used_at?: string;
  created_at: string;
}

export interface CreateVariantRequest {
  id?: string;
  name: string;
  price: number;
  delivery_method: DeliveryMethod;
  fixed_reply_content?: string;
  sort_order?: number;
}

export interface UpdateVariantRequest {
  id?: string;
  name?: string;
  price?: number;
  delivery_method?: DeliveryMethod;
  fixed_reply_content?: string;
  sort_order?: number;
}

export interface CreateProductRequest {
  title: string;
  description?: string;
  cover_url?: string;
  status?: ProductStatus;
  exclude_from_membership?: boolean;
  show_on_homepage?: boolean;
  sort_order?: number;
  variants?: CreateVariantRequest[];
}

export interface UpdateProductRequest {
  title?: string;
  description?: string;
  cover_url?: string;
  status?: ProductStatus;
  exclude_from_membership?: boolean;
  show_on_homepage?: boolean;
  sort_order?: number;
  variants?: UpdateVariantRequest[];
}

export interface ListProductsRequest {
  page?: number;
  page_size?: number;
  status?: ProductStatus;
  keyword?: string;
}

export interface ListProductsResponse {
  list: ProductListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListStockRequest {
  page?: number;
  page_size?: number;
  status?: StockStatus;
}

export interface ListStockResponse {
  list: StockItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ImportStockRequest {
  items?: string[];
  item_text?: string;
}

export interface ImportStockResponse {
  total?: number;
  imported?: number;
  duplicate?: number;
  imported_count?: number;
  failed_count?: number;
  errors?: string[];
}
