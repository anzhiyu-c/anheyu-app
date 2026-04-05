/**
 * 售后工单类型定义（管理端）
 */

export type TicketStatus = "OPEN" | "REPLIED" | "CLOSED";
export type SenderType = "USER" | "ADMIN";

export interface TicketMessage {
  id: string;
  content: string;
  sender_type: SenderType;
  sender_id?: number;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_no: string;
  trade_no: string;
  order_id?: number;
  user_id?: number;
  user_email?: string;
  subject: string;
  type?: string;
  status: TicketStatus;
  message_count?: number;
  last_reply_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

export interface ReplyTicketRequest {
  content: string;
}

export interface ListTicketsRequest {
  page?: number;
  page_size?: number;
  status?: string;
  type?: string;
  keyword?: string;
}

export interface ListTicketsResponse {
  list: Ticket[];
  total: number;
  page: number;
  page_size: number;
}

export interface TicketStatsResponse {
  pending: number;
  processing: number;
  closed: number;
  total: number;
}
