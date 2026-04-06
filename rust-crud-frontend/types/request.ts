// types/request.ts

export interface RequestItem {
  id: number;
  req_code: string;
  requester_id: number;
  requester_name?: string;
  subject_id: number;
  subject_name?: string;
  topic_name?: string;
  type_name?: string;
  phone_number?: string;
  requirement?: string;
  description: string;
  file_url?: string;
  status_id: number;
  status_name: string;
  status_variant: string;
  status_color?: string;
  request_date: string;
  recorded_by: number;
  recorded_by_name?: string;
  assignees?: any[]; // สามารถระบุ type ละเอียดขึ้นได้ถ้าต้องการ
  approvals?: any[];
  plan_start_date?: string;
  plan_finish_date?: string;
  actual_start_date?: string;
  actual_finish_date?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total_records: number;
  total_pages: number;
  current_page: number;
  limit: number;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  next_cursor: number | null;
  has_more: boolean;
}

export interface DashboardStats {
  pending: number;
  inProgress: number;
  waitingVerify: number;
  completedToday: number;
}

// Keep existing types if they are used elsewhere, but RequestItem is the main one for the dashboard.
export type RequestStatus = 
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';