use axum::{
    routing::{get, post, put},
    Router,
    middleware as axum_middleware,
};
use sqlx::PgPool;

use super::handlers::{create_department, delete_department, get_departments, update_department};
use crate::middleware::auth;

pub fn create_router(pool: PgPool) -> Router {
    // 1. สร้างกลุ่ม API สำหรับ Admin (บังคับตรวจ Token)
    let admin_routes = Router::new()
        .route("/", post(create_department))
        .route("/:id", put(update_department).delete(delete_department))
        .route_layer(axum_middleware::from_fn(auth)); // <- ยามเฝ้าเฉพาะกลุ่มนี้!

    // 2. นำมารวมกับ API Public
    Router::new()
        .route("/", get(get_departments)) // Public: ไม่มียามเฝ้า
        .merge(admin_routes)              // เอาของ Admin มาต่อ
        .with_state(pool)
}