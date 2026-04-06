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
// 🌟 โครงสร้างใหม่สำหรับระบบ Pagination แบบ Cursor (สเกลได้หลักล้าน)
// ==========================================
#[derive(Deserialize)]
pub struct CursorFilter {
    pub cursor: Option<i32>, // ID ของรายการสุดท้ายที่โหลดไป (หน้าแรกส่ง null มา)
    pub limit: Option<i64>,
}

#[derive(Serialize)]
pub struct CursorPaginatedResponse<T> {
    pub data: Vec<T>,
    pub next_cursor: Option<i32>, // ถ้าเป็น null แปลว่าข้อมูลหมดแล้ว ไม่มีหน้าต่อไป
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
// 🌟 โครงสร้างสำหรับ "ตรวจรับงาน" (ผ่าน / ตีกลับ)
// ==========================================
#[derive(Deserialize, Debug)]
pub struct VerifyTaskPayload {
    pub is_approved: bool, // true = ผ่าน (ปิดงาน), false = ไม่ผ่าน (ตีกลับ)
    pub remark: Option<String>,
}