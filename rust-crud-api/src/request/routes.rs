use axum::{
    routing::{get, post, put},
    Router,
    middleware as axum_middleware, // <- 1. นำเข้า middleware ของ axum
};
use sqlx::PgPool;

use super::handlers::{
    create_request, delete_request, get_master_subjects, get_master_topics, get_master_types, get_request, get_requests, update_request, upload_request_files, delete_request_files, get_pending_approvals, process_approval, get_department_approvers, get_dashboard_stats, get_daily_stats
};
use crate::middleware::auth; // <- 2. นำเข้ายามเฝ้าประตูของเรา

pub fn create_router(pool: PgPool) -> Router {
    Router::new()
        // API สำหรับสรุปสถิติ
        .route("/stats/summary", get(get_dashboard_stats))
        .route("/stats/daily", get(get_daily_stats))

        // API สำหรับจัดการการอนุมัติ
        .route("/approvals/pending", get(get_pending_approvals))
        .route("/approvals/:id/action", put(process_approval))

        // API สำหรับดึงรายชื่อผู้อนุมัติ
        .route("/approvers/department", get(get_department_approvers))
        
    
        // API สำหรับดึงข้อมูล Master
        .route("/master/types", get(get_master_types))
        .route("/master/topics/:type_id", get(get_master_topics))
        .route("/master/subjects/:topic_id", get(get_master_subjects))
        
        // API สำหรับจัดการคำขอ
        .route("/", get(get_requests).post(create_request))
        .route("/:id", get(get_request).put(update_request).delete(delete_request))
        .route("/:id/files", post(upload_request_files).delete(delete_request_files))

        
        // 3. นำยามมาเฝ้าประตู! (จะล็อคทุก Route ที่อยู่ด้านบนของบรรทัดนี้)
        .route_layer(axum_middleware::from_fn(auth))
        
        .with_state(pool)
}