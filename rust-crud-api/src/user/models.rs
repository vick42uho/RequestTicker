use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use validator::Validate;

// ข้อมูล User ที่จะส่งกลับไปให้ Frontend (ซ่อนรหัสผ่านไว้)
#[derive(Serialize, FromRow)]
pub struct UserResponse {
    pub id: i32,
    pub employee_code: Option<String>,
    pub username: Option<String>,
    pub name: String,
    pub email: String,
    pub role: String,
    pub position: Option<String>,
    pub department_id: Option<i32>,
    pub phone_number: Option<String>,
    pub department: Option<String>, // 🌟 เพิ่มฟิลด์ชื่อแผนกเพื่อส่งให้ Frontend
}

// ข้อมูลที่รับมาตอน สมัครสมาชิก
#[derive(Deserialize, Validate)]
pub struct RegisterUser {
    #[validate(length(min = 1, message = "กรุณาระบุ username"))]
    pub username: String,
    #[validate(length(min = 1, message = "กรุณาระบุชื่อ"))]
    pub name: String,
    #[validate(email(message = "รูปแบบอีเมลไม่ถูกต้อง"))]
    pub email: String,
    #[validate(length(min = 6, message = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"))]
    pub password: String,
    pub position: Option<String>,
    pub department_id: Option<i32>,
    pub phone_number: Option<String>,
}

// ข้อมูลที่รับมาตอน ล็อคอิน
#[derive(Deserialize, Validate)]
pub struct LoginUser {
    #[validate(length(min = 1, message = "กรุณาระบุ username หรือ email"))]
    pub username_or_email: Option<String>,
    #[validate(length(min = 1, message = "กรุณาระบุรหัสผ่าน"))]
    pub password: String,
}

// โครงสร้างตอนล็อกอิน (ใช้ตัวแปรเดียว รับได้ทั้ง user/email)
// #[derive(Deserialize)]
// pub struct LoginPayload {
//     pub username_or_email: String, // 🆕 เปลี่ยนชื่อให้สื่อความหมาย
//     pub password: String,
// }

// สิ่งที่จะตอบกลับไปเมื่อล็อคอินสำเร็จ (มี Token + ข้อมูล User)
#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

// ข้อมูลที่จะฝังไว้ใน JWT Token (ตั๋วผ่านทาง)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String, // เก็บ User ID
    pub role: String, // เก็บสิทธิ์การใช้งาน (user, admin)
    pub exp: usize,   // วันหมดอายุของ Token
    pub department_id: Option<i32>, // 🌟 เพิ่ม department_id
}



