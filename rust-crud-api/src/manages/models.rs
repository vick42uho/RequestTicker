use serde::{Deserialize, Serialize};
use validator::Validate;

// ==========================================
// 🔴 1. รับข้อมูลสร้าง/แก้ไข ประเภทบริการ (Types)
// ==========================================
#[derive(Deserialize, Validate)]
pub struct TypePayload {
    pub id: Option<i32>,
    #[validate(length(min = 1, message = "กรุณากรอกชื่อประเภท"))]
    pub name: String,
    pub description: Option<String>,
    pub responsible_dept_id: i32, 
    pub del_flag: Option<bool>,
}

#[derive(Deserialize, Validate)]
pub struct TopicPayload {
    pub id: Option<i32>,
    pub type_id: i32,
    #[validate(length(min = 1, message = "กรุณากรอกชื่อหมวดหมู่"))]
    pub name: String,
    pub del_flag: Option<bool>,
}

#[derive(Deserialize, Validate)]
pub struct SubjectPayload {
    pub id: Option<i32>,
    pub topic_id: i32,
    #[validate(length(min = 1, message = "กรุณากรอกชื่อหัวข้อปัญหา"))]
    pub name: String,
    pub requires_approval: bool, 
    pub requires_receiver_approval: bool, 
    pub del_flag: Option<bool>,
}

// ==========================================
// 🟨 4. รับข้อมูลสร้าง/แก้ไข แผนก (Departments)
// ==========================================
#[derive(Deserialize, Validate)]
pub struct DepartmentPayload {
    pub id: Option<i32>, // 🆕 เพิ่ม ID เพื่อให้รองรับการ Import แบบ Update
    #[validate(length(min = 1, message = "กรุณากรอกชื่อแผนก"))]
    pub name: String,
}

// Struct สำหรับส่งข้อมูล GET กลับไปหน้าเว็บ
#[derive(Serialize)]
pub struct DepartmentResponse {
    pub id: i32,
    pub name: String,
}

// ==========================================
// 📦 Structs สำหรับ Users 
// ==========================================
#[derive(Serialize)]
pub struct UserListResponse {
    pub id: i32,
    pub employee_code: Option<String>,
    pub name: String,
    pub username: Option<String>,
    pub email: String,
    pub role: String,
    pub department_id: Option<i32>,
    pub department_name: Option<String>,
    pub position: Option<String>,
    pub phone_number: Option<String>,
    pub is_active: bool,
}

#[derive(Deserialize)]
pub struct UserFilter {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub search: Option<String>,
    pub department_id: Option<i32>,
    pub role: Option<String>,
}

#[derive(Serialize)]
pub struct UserPaginatedResponse {
    pub data: Vec<UserListResponse>,
    pub total_records: i64,
    pub total_pages: i64,
    pub current_page: i64,
}

#[derive(Deserialize, Validate)]
pub struct UserPayload {
    pub employee_code: Option<String>,
    #[validate(length(min = 1, message = "กรุณากรอกชื่อ-นามสกุล"))]
    pub name: String,
    pub username: Option<String>,
    pub email: String,
    pub password: Option<String>,
    pub role: String,
    pub department_id: Option<i32>,
    pub position: Option<String>,
    pub phone_number: Option<String>,
    pub is_active: bool,
}

// ==========================================
// 🆕 5. Master Status
// ==========================================
#[derive(Serialize, sqlx::FromRow)]
pub struct StatusResponse {
    pub id: i32,
    pub name_th: String,
    pub badge_variant: Option<String>,
    pub color_class: Option<String>,
}
