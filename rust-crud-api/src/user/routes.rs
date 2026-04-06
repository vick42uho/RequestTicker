use axum::{Router, routing::{post, get}}; // 🆕 อย่าลืมเพิ่ม get ตรงนี้ด้วย
use sqlx::PgPool;
use super::handlers::{login, register, get_approvers}; // 🆕 นำเข้า get_approvers

pub fn create_router(pool: PgPool) -> Router {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/approvers", get(get_approvers)) // 🆕 เพิ่ม Route สำหรับดึงข้อมูลหัวหน้า
        .with_state(pool)
}