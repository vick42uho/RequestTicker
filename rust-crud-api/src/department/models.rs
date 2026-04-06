use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use validator::Validate;

// สำหรับดึงข้อมูลส่งให้ Frontend
#[derive(Serialize, FromRow)]
pub struct Department {
    pub id: i32,
    pub name: String,
}

// สำหรับรับข้อมูลตอน Admin กด "เพิ่มแผนก" หรือ "แก้ไขชื่อแผนก"
#[derive(Deserialize, Validate)]
pub struct DepartmentPayload {
    #[validate(length(min = 1, message = "กรุณาระบุชื่อแผนก"))]
    pub name: String,
}