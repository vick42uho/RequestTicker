use axum::{extract::{Path, State}, http::StatusCode, Json};
use sqlx::PgPool;
use validator::Validate;

use super::models::{Department, DepartmentPayload};
use crate::error::ApiError;

// 1. [Public] ดึงรายชื่อแผนกทั้งหมด (สำหรับหน้าสมัครสมาชิก และ Dropdown)
pub async fn get_departments(State(pool): State<PgPool>) -> Result<Json<Vec<Department>>, ApiError> {
    let query = "SELECT id, name FROM m_departments WHERE del_flag = FALSE ORDER BY id ASC";
    let departments = sqlx::query_as::<_, Department>(query).fetch_all(&pool).await?;
    Ok(Json(departments))
}

// 2. [Admin] เพิ่มแผนกใหม่
pub async fn create_department(
    State(pool): State<PgPool>,
    Json(payload): Json<DepartmentPayload>,
) -> Result<(StatusCode, Json<Department>), ApiError> {
    if let Err(e) = payload.validate() {
        return Err(ApiError::BadRequest(e.to_string()));
    }
    
    let query = "INSERT INTO m_departments (name) VALUES ($1) RETURNING id, name";
    let dept = sqlx::query_as::<_, Department>(query)
        .bind(&payload.name)
        .fetch_one(&pool).await?;
        
    Ok((StatusCode::CREATED, Json(dept)))
}

// 3. [Admin] แก้ไขชื่อแผนก
pub async fn update_department(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
    Json(payload): Json<DepartmentPayload>,
) -> Result<Json<Department>, ApiError> {
    if let Err(e) = payload.validate() {
        return Err(ApiError::BadRequest(e.to_string()));
    }

    let query = "UPDATE m_departments SET name = $1 WHERE id = $2 RETURNING id, name";
    let dept = sqlx::query_as::<_, Department>(query)
        .bind(&payload.name)
        .bind(id)
        .fetch_optional(&pool).await?
        .ok_or_else(|| ApiError::NotFound("ไม่พบแผนกที่ต้องการแก้ไข".to_string()))?;

    Ok(Json(dept))
}


// [Admin] ลบแผนก (เปลี่ยนเป็น Soft Delete)
pub async fn delete_department(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
) -> Result<StatusCode, ApiError> {
    // เปลี่ยนจาก DELETE FROM เป็น UPDATE SET del_flag = TRUE
    let query = "UPDATE m_departments SET del_flag = TRUE WHERE id = $1 AND del_flag = FALSE";
    let result = sqlx::query(query).bind(id).execute(&pool).await?;
    
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบแผนกที่ต้องการลบ หรือแผนกถูกลบไปแล้ว".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}
