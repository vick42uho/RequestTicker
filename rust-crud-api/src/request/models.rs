use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use validator::Validate;

// ==========================================
// 1. Models สำหรับส่งข้อมูลกลับให้ Frontend (Response)
// ==========================================

// โครงสร้างใหม่สำหรับ GET ข้อมูลแบบโชว์ชื่อสวยๆ
#[derive(Serialize, FromRow)]
pub struct RequestItem {
    pub id: i32,
    pub req_code: String,
    
    // ข้อมูลผู้ร้องขอ
    pub requester_id: i32,
    pub requester_name: Option<String>, // 🆕 ดึงมาจากการ JOIN ตาราง users
    
    // ข้อมูลประเภทคำขอ (ประกอบร่างจาก 3 ตาราง)
    pub subject_id: i32,
    pub subject_name: Option<String>,   // 🆕 ดึงจาก m_subjects
    pub topic_name: Option<String>,     // 🆕 ดึงจาก m_topics
    pub type_name: Option<String>,      // 🆕 ดึงจาก m_request_types
    
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
    pub recorded_by_name: Option<String>, // 🆕 ชื่อคนบันทึก

    pub assignees: Option<serde_json::Value>,  // 🆕 รายชื่อผู้รับผิดชอบ (JSON array)
    pub approvals: Option<serde_json::Value>,

    pub plan_start_date: Option<DateTime<Utc>>,
    pub plan_finish_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_finish_date: Option<DateTime<Utc>>,
}


// ==========================================
// 2. Models สำหรับรับข้อมูลจาก Frontend (Payload)
// ==========================================

// เพิ่ม Struct นี้เข้าไป
#[derive(serde::Deserialize, serde::Serialize, Debug)]
pub struct ApproverInput {
    pub approver_id: i32,
    pub step: i32,
    pub approval_type: String, 
}

// อัปเดต CreateRequestPayload
#[derive(serde::Deserialize, validator::Validate)]
pub struct CreateRequestPayload {
    pub subject_id: i32,
    pub phone_number: String,
    pub requirement: Option<String>,
    
    #[validate(length(min = 1, message = "กรุณาระบุรายละเอียด"))]
    pub description: String,
    
    // เปลี่ยนจาก pub approver_id: Option<i32> เป็น Array แบบนี้แทน 👇
    pub approvers: Option<Vec<ApproverInput>>, 
}

// ข้อมูลที่ Frontend ส่งมาตอน "แก้ไข" คำขอ (PUT)
#[derive(Deserialize, Validate)]
pub struct UpdateRequest {
    pub subject_id: i32,
    pub phone_number: String,
    pub requirement: Option<String>,
    #[validate(length(min = 1, message = "กรุณาระบุรายละเอียดปัญหาหรือสิ่งที่ต้องการ"))]
    pub description: String,
    pub approvers: Option<Vec<crate::request::models::ApproverInput>>,
}


// ==========================================
// 3. Models สำหรับ Master Data
// ==========================================

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

// ข้อมูลสำหรับรับรายชื่อไฟล์ที่ต้องการลบ
#[derive(Deserialize)]
pub struct DeleteFilesPayload {
    pub files_to_delete: Vec<String>, // ส่งมาเป็น Array เช่น ["uploads/file1.png", "uploads/file2.pdf"]
}


// สำหรับส่งข้อมูลรายการที่รออนุมัติไปให้หน้ากระดาน
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
    pub requester_department: Option<String>, // 🌟 เพิ่มชื่อแผนกผู้แจ้ง
    pub approve_step: i32,
    pub status_id: i32,
    pub status_name: String,
    pub status_variant: String,
    pub status_color: Option<String>,
    pub request_date: Option<chrono::DateTime<chrono::Utc>>,
    pub approvals: Option<serde_json::Value>,
}

// สำหรับรับข้อมูลตอนหัวหน้ากด "อนุมัติ" หรือ "ไม่อนุมัติ"
#[derive(serde::Deserialize)]
pub struct ApprovalActionPayload {
    pub action: String, // ส่งมาเป็น "APPROVE" หรือ "REJECT"
    pub comment: Option<String>,
    pub forward_to_id: Option<i32>,
}

// 1. เพิ่ม page และ limit ใน RequestFilter
#[derive(Deserialize)]
pub struct RequestFilter {
    pub filter: Option<String>,
    pub page: Option<i64>,  // 🆕 หน้าที่เท่าไหร่ (ค่าเริ่มต้น 1)
    pub limit: Option<i64>, // 🆕 ดึงกี่รายการ (ค่าเริ่มต้น 50)
}

// 2. 🌟 โครงสร้างใหม่สำหรับส่งข้อมูลแบบมี Pagination
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

// 🌟 โครงสร้างสำหรับสรุปสถิติหน้า Dashboard
#[derive(Serialize)]
pub struct DashboardStats {
    pub pending: i64,
    pub in_progress: i64,
    pub waiting_verify: i64,
    pub completed_today: i64,
}

// 🌟 โครงสร้างสำหรับข้อมูลกราฟรายวัน
#[derive(Serialize, sqlx::FromRow)]
pub struct DailyStat {
    pub date: String,
    pub requests: i64,
    pub completed: i64,
}


