use axum::{
    routing::{get, post, delete},
    Router,
    middleware as axum_middleware, 
};
use sqlx::PgPool;

// 🌟 1. ดึง start_task และ close_task เข้ามา
use super::handlers::{
    accept_task, get_dept_tasks, get_my_assigned_tasks, 
    get_department_agents, update_assignees, start_task, close_task, verify_task,
    create_sub_tasks, update_sub_task_status, delete_sub_task, assign_sub_task_members
};
use crate::middleware::auth; 

pub fn create_router(pool: PgPool) -> Router {
    Router::new()
        // API สำหรับโหลดข้อมูล
        .route("/dept", get(get_dept_tasks))
        .route("/dept/agents", get(get_department_agents))
        .route("/my", get(get_my_assigned_tasks))
        
        // API สำหรับ Action กับใบงาน
        .route("/:id/accept", post(accept_task))
        .route("/:id/assignees", post(update_assignees))
        .route("/:id/sub-tasks", post(create_sub_tasks))
        .route("/:id/sub-tasks/:sub_id", post(update_sub_task_status))
        .route("/:id/sub-tasks/:sub_id", delete(delete_sub_task))
        .route("/:id/sub-tasks/:sub_id/assignees", post(assign_sub_task_members))
        
        // 🌟 2. เพิ่ม 2 เส้นทางใหม่
        .route("/:id/start", post(start_task))
        .route("/:id/close", post(close_task))

        // 🌟 เพิ่มเส้นนี้สำหรับการตรวจรับงาน (UAT)
        .route("/:id/verify", post(verify_task))
        
        // ใส่ Middleware บังคับตรวจ Token
        .route_layer(axum_middleware::from_fn(auth)) 
        
        .with_state(pool)
}