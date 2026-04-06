// lib/services/task-service.ts
import { fetchApi } from "../api";
import { RequestItem, CursorPaginatedResponse } from "../../types/request";

export const taskService = {
  /**
   * ดึงรายการงานที่ได้รับมอบหมายของฉัน (My Tasks)
   */
  getMyTasks: async (cursor?: number, limit: number = 10): Promise<CursorPaginatedResponse<RequestItem>> => {
    const query = new URLSearchParams();
    if (cursor) query.append("cursor", cursor.toString());
    query.append("limit", limit.toString());
    
    return fetchApi<CursorPaginatedResponse<RequestItem>>(`/tasks/my?${query.toString()}`);
  },

  /**
   * ดึงรายการงานทั้งหมดของแผนก (Department Tasks)
   */
  getDeptTasks: async (cursor?: number, limit: number = 10): Promise<CursorPaginatedResponse<RequestItem>> => {
    const query = new URLSearchParams();
    if (cursor) query.append("cursor", cursor.toString());
    query.append("limit", limit.toString());
    
    return fetchApi<CursorPaginatedResponse<RequestItem>>(`/tasks/dept?${query.toString()}`);
  }
};
