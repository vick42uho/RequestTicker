use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use validator::Validate;

// ==========================================
// 1. Models สำหรับส่งข้อมูลกลับให้ Frontend (Response)
// ==========================================

#[derive(Serialize, FromRow)]
pub struct RequestItem {
    pub id: i32,
    pub req_code: String,
    
    pub requester_id: i32,
    pub requester_name: Option<String>,
    
    pub subject_id: i32,
    pub subject_name: Option<String>,
    pub topic_name: Option<String>,
    pub type_name: Option<String>,
    pub responsible_dept_id: Option<i32>, // 🆕 เพิ่มฟิลด์แผนกที่รับผิดชอบงานหลัก
    
    pub phone_number: Option<String>,
    pub requirement: Option<String>,
    pub description: String,
    pub file_url: Option<String>,

    pub status_id: i32,
    pub status_name: String,
    pub status_variant: String,
    pub status_color: Option<String>,
    
    pub request_date: DateTime<Utc>,
    pub recorded_by: i32,
    pub recorded_by_name: Option<String>,

    pub assignees: Option<serde_json::Value>,
    pub approvals: Option<serde_json::Value>,
    pub sub_tasks: Option<serde_json::Value>,

    pub plan_start_date: Option<DateTime<Utc>>,
    pub plan_finish_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_finish_date: Option<DateTime<Utc>>,
}

#[derive(serde::Deserialize, serde::Serialize, Debug)]
pub struct ApproverInput {
    pub approver_id: i32,
    pub step: i32,
    pub approval_type: String, 
}

#[derive(serde::Deserialize, validator::Validate)]
pub struct CreateRequestPayload {
    pub subject_id: i32,
    pub phone_number: String,
    pub requirement: Option<String>,
    #[validate(length(min = 1, message = "กรุณาระบุรายละเอียด"))]
    pub description: String,
    pub approvers: Option<Vec<ApproverInput>>, 
}

#[derive(Deserialize, Validate)]
pub struct UpdateRequest {
    pub subject_id: i32,
    pub phone_number: String,
    pub requirement: Option<String>,
    #[validate(length(min = 1, message = "กรุณาระบุรายละเอียดปัญหาหรือสิ่งที่ต้องการ"))]
    pub description: String,
    pub approvers: Option<Vec<crate::request::models::ApproverInput>>,
}

#[derive(Serialize, FromRow)]
pub struct MasterRequestType {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub responsible_dept_id: Option<i32>,
}

#[derive(Serialize, FromRow)]
pub struct MasterTopic {
    pub id: i32,
    pub type_id: i32,
    pub name: String,
}

#[derive(Serialize, FromRow)]
pub struct MasterSubject {
    pub id: i32,
    pub topic_id: i32,
    pub name: String,
    pub is_other: bool, 
    pub requires_approval: bool,
    pub requires_receiver_approval: bool,
}

#[derive(Deserialize)]
pub struct DeleteFilesPayload {
    pub files_to_delete: Vec<String>,
}

#[derive(serde::Serialize, sqlx::FromRow)]
pub struct PendingApprovalResponse {
    pub approval_id: i32,
    pub request_id: i32,
    pub req_code: String,
    pub subject_name: Option<String>,
    pub topic_name: Option<String>,
    pub type_name: Option<String>,
    pub requirement: Option<String>,
    pub description: String,
    pub phone_number: Option<String>,
    pub file_url: Option<String>,
    pub requester_name: Option<String>,
    pub requester_department: Option<String>,
    pub approve_step: i32,
    pub status_id: i32,
    pub status_name: String,
    pub status_variant: String,
    pub status_color: Option<String>,
    pub request_date: Option<chrono::DateTime<chrono::Utc>>,
    pub approvals: Option<serde_json::Value>,
}

#[derive(serde::Deserialize)]
pub struct ApprovalActionPayload {
    pub action: String,
    pub comment: Option<String>,
    pub forward_to_id: Option<i32>,
}

#[derive(Deserialize)]
pub struct RequestFilter {
    pub filter: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub search: Option<String>,    // 🆕 ค้นหาจากรหัส หรือรายละเอียด
    pub status_ids: Option<String>, // 🆕 กรองตามสถานะ (เลือกได้หลายอัน ส่งมาเป็น 1,2,3)
    pub type_ids: Option<String>,   // 🆕 กรองตามประเภทงาน (เลือกได้หลายอัน ส่งมาเป็น 1,2,3)
    pub requester_name: Option<String>, // 🆕 กรองตามชื่อผู้แจ้ง
    pub start_date: Option<String>, // 🆕 กรองจากวันที่เริ่ม
    pub end_date: Option<String>,   // 🆕 กรองถึงวันที่
}

#[derive(Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total_records: i64,
    pub total_pages: i64,
    pub current_page: i64,
    pub limit: i64,
}

#[derive(Serialize)]
pub struct ApprovalPaginatedResponse<T> {
    pub data: Vec<T>,
    pub total_records: i64,
    pub total_pages: i64,
    pub current_page: i64,
    pub limit: i64,
    pub pending_count: i64,
    pub waiting_count: i64,
}

#[derive(Serialize)]
pub struct DashboardStats {
    pub pending: i64,
    pub in_progress: i64,
    pub waiting_verify: i64,
    pub completed_today: i64,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct DailyStat {
    pub date: String,
    pub requests: i64,
    pub completed: i64,
}
