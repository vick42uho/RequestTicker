use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// ข้อมูลที่ส่งมาจากหน้าเว็บตอนกด "รับงาน / จ่ายงาน"
#[derive(Deserialize, Debug)]
pub struct AcceptTaskPayload {
    pub assignees: Vec<i32>,
    pub plan_start_date: Option<DateTime<Utc>>,
    pub plan_finish_date: Option<DateTime<Utc>>,
    pub remark: Option<String>,
}

// ข้อมูลที่ส่งมาตอนอัปเดตรายชื่อผู้รับผิดชอบงาน
#[derive(Deserialize, Debug)]
pub struct UpdateAssigneesPayload {
    pub assignee_ids: Vec<i32>,
}

// ==========================================
// 🌟 โครงสร้างใหม่สำหรับระบบ Pagination แบบ Cursor
// ==========================================
#[derive(Deserialize)]
pub struct CursorFilter {
    pub cursor: Option<i32>,
    pub limit: Option<i64>,
    pub search: Option<String>,    // 🆕 ค้นหาจากรหัส หรือรายละเอียด
    pub status_id: Option<i32>,   // 🆕 กรองตามสถานะ
    pub start_date: Option<String>, // 🆕 กรองจากวันที่เริ่ม
    pub end_date: Option<String>,   // 🆕 กรองถึงวันที่
}

#[derive(Serialize)]
pub struct CursorPaginatedResponse<T> {
    pub data: Vec<T>,
    pub next_cursor: Option<i32>,
    pub has_more: bool,
}

#[derive(Deserialize, Debug)]
pub struct StartTaskPayload {
    pub plan_start_date: Option<DateTime<Utc>>,
    pub plan_finish_date: Option<DateTime<Utc>>,
}

#[derive(Deserialize, Debug)]
pub struct CloseTaskPayload {
    pub actual_finish_date: Option<DateTime<Utc>>,
    pub remark: Option<String>,
}

// ==========================================
// 🌟 โครงสร้างสำหรับ "งานย่อย" (Sub-tasks)
// ==========================================
#[derive(Deserialize, Debug)]
pub struct SubTaskInput {
    pub responsible_dept_id: i32,
    pub description: Option<String>,
    pub plan_start_date: Option<DateTime<Utc>>,
    pub plan_finish_date: Option<DateTime<Utc>>,
}

#[derive(Deserialize, Debug)]
pub struct CreateSubTasksPayload {
    pub sub_tasks: Vec<SubTaskInput>,
}

#[derive(Deserialize, Debug)]
pub struct UpdateSubTaskStatusPayload {
    pub status_id: i32,
    pub description: Option<String>,
    pub plan_start_date: Option<DateTime<Utc>>,
    pub plan_finish_date: Option<DateTime<Utc>>,
}

#[derive(Deserialize, Debug)]
pub struct AssignSubTaskMembersPayload {
    pub assignee_ids: Vec<i32>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct SubTaskItem {
    pub id: i32,
    pub request_id: i32,
    pub responsible_dept_id: i32,
    pub department_name: Option<String>,
    pub status_id: i32,
    pub status_name: Option<String>,
    pub status_variant: Option<String>,
    pub status_color: Option<String>,
    pub description: Option<String>,
    pub assignees: Option<serde_json::Value>,
    pub plan_start_date: Option<DateTime<Utc>>,
    pub plan_finish_date: Option<DateTime<Utc>>,
}

// ==========================================
// 🌟 โครงสร้างสำหรับ "ตรวจรับงาน"
// ==========================================
#[derive(Deserialize, Debug)]
pub struct VerifyTaskPayload {
    pub is_approved: bool,
    pub remark: Option<String>,
}
