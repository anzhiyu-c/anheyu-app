/**
 * 订单管理类型定义（管理端）
 */

export type OrderStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";
export type PaymentProvider = "ALIPAY" | "WECHAT" | "EPAY" | "HUPIJIAO";
export type OrderType = "ARTICLE" | "SHARE" | "PRODUCT" | "MEMBERSHIP";

export interface OrderListParams {
  page?: number;
  page_size?: number;
  status?: OrderStatus;
  payment_provider?: PaymentProvider;
  user_email?: string;
  order_no?: string;
  trade_no?: string;
  user_id?: number;
  start_date?: string;
  end_date?: string;
  order_type?: OrderType;
  sort_by?: "created_at" | "pay_time" | "amount" | "order_no";
  sort_order?: "asc" | "desc";
}

export interface AdminOrder {
  id: number;
  order_no: string;
  order_type: OrderType;
  article_id?: string;
  share_id?: string;
  product_id?: number;
  variant_id?: number;
  membership_plan_id?: number;
  user_id: string;
  user_email: string;
  amount: number;
  currency: string;
  payment_provider: string;
  payment_status: string;
  trade_no: string;
  pay_time?: string;
  expire_time?: string;
  client_ip?: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderListResponse {
  orders: AdminOrder[];
  total: number;
  page: number;
  size: number;
}
