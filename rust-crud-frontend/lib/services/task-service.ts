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
  },

  /**
   * สร้างงานย่อย (แตกงานไปแผนกอื่น)
   */
  createSubTasks: async (requestId: number, subTasks: { responsible_dept_id: number; description?: string }[]) => {
    return fetchApi(`/tasks/${requestId}/sub-tasks`, {
      method: 'POST',
      body: JSON.stringify({ sub_tasks: subTasks }),
    });
  },

  /**
   * อัปเดตสถานะงานย่อย หรือแก้ไขรายละเอียดแผนงาน
   */
  updateSubTaskStatus: async (
    requestId: number, 
    subTaskId: number, 
    payload: { status_id: number; description?: string; plan_start_date?: string; plan_finish_date?: string }
  ) => {
    return fetchApi(`/tasks/${requestId}/sub-tasks/${subTaskId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * ลบงานย่อย
   */
  deleteSubTask: async (requestId: number, subTaskId: number) => {
    return fetchApi(`/tasks/${requestId}/sub-tasks/${subTaskId}`, {
      method: 'DELETE',
    });
  },

  /**
   * มอบหมายคนทำงานให้งานย่อย
   */
  assignSubTaskMembers: async (requestId: number, subTaskId: number, assigneeIds: number[]) => {
    return fetchApi(`/tasks/${requestId}/sub-tasks/${subTaskId}/assignees`, {
      method: 'POST',
      body: JSON.stringify({ assignee_ids: assigneeIds }),
    });
  },

  /**
   * ดึงรายชื่อ Agent เฉพาะแผนก (สำหรับมอบหมายงานย่อย)
   */
  getAgentsByDept: async (deptId: number): Promise<any[]> => {
    return fetchApi<any[]>(`/departments/${deptId}/agents`);
  },

  /**
   * ดึงรายชื่อแผนกทั้งหมด (สำหรับเลือกแตกงานย่อย)
   */
  getDepartments: async (): Promise<any[]> => {
    return fetchApi<any[]>("/departments");
  }
};
