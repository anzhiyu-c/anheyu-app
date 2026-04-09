/**
 * 会员管理类型定义（管理端）
 */

export interface MembershipPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  original_price?: number;
  duration_days: number;
  status: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserMembership {
  id: number;
  user_id: number;
  plan_id: number;
  plan_name?: string;
  is_member: boolean;
  start_time: string;
  expire_time: string;
  is_expired: boolean;
  created_at: string;
}

export interface CreatePlanRequest {
  name: string;
  description?: string;
  price: number;
  original_price?: number;
  duration_days: number;
  status?: number;
  sort_order?: number;
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  price?: number;
  original_price?: number;
  duration_days?: number;
  status?: number;
  sort_order?: number;
}

export interface ListMembersRequest {
  page?: number;
  page_size?: number;
  status?: "active" | "expired";
}

export interface ListMembersResponse {
  list: UserMembership[];
  total: number;
  page: number;
  page_size: number;
}
