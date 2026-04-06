use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

// 1. โครงสร้าง JSON ที่จะส่งกลับไปให้ Client (Frontend/Postman)
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

// 2. สร้าง Enum เก็บประเภท Error ของระบบเรา
pub enum ApiError {
    InternalServerError(String),
    NotFound(String),
    BadRequest(String),
    Forbidden(String),
}

// 3. สอน Axum ว่าจะแปลง ApiError เป็น HTTP Response ได้ยังไง
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            ApiError::InternalServerError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
        };

        (status, Json(serde_json::json!({ "error": error_message }))).into_response()
    }
}

// 4. ***เวทมนตร์ของ Rust***: สอนวิธีแปลง sqlx::Error ให้กลายเป็น ApiError อัตโนมัติ
impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        eprintln!("🔥 Database Error: {:?}", err); 
        ApiError::InternalServerError("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล หรือคำสั่ง SQL ไม่ถูกต้อง".to_string())
    }
}