use axum::{
    routing::{get, post, put},
    Router,
};
use sqlx::PgPool;

use super::handlers::*;
use crate::middleware::auth; // ระบบเช็ค Token เข้าใช้งาน

pub fn create_router(pool: PgPool) -> Router {
    Router::new()
        // ⚪ Master Status (Public/Authenticated general)
        .route("/master/statuses", get(get_statuses))

        // 🔴 หมวด Types
        .route("/master/types", post(create_type))
        .route("/master/types/:id", put(update_type).delete(delete_type))
        .route("/master/types/import", post(import_types))
        
        // 🟠 หมวด Topics
        .route("/master/topics", post(create_topic))
        .route("/master/topics/:id", put(update_topic).delete(delete_topic))
        .route("/master/topics/import", post(import_topics))
        
        // 🟡 หมวด Subjects
        .route("/master/subjects", post(create_subject))
        .route("/master/subjects/:id", put(update_subject).delete(delete_subject))
        .route("/master/subjects/import", post(import_subjects))

        // 🟨 หมวด Departments
        .route("/master/departments", get(get_departments).post(create_department))
        .route("/master/departments/:id", put(update_department).delete(delete_department))
        .route("/master/departments/import", post(import_departments))

        // 🟨 หมวด Users
        .route("/master/users", get(get_all_users).post(create_user))
        .route("/master/users/:id", put(update_user))
        .route("/master/users/import", post(import_users))

        // 🛡️ ป้องกันความปลอดภัย! ทุก API ในโมดูลนี้ต้องมี Token และผ่านด่านตรวจก่อน
        .route_layer(axum::middleware::from_fn_with_state(pool.clone(), auth))
        .with_state(pool)
}