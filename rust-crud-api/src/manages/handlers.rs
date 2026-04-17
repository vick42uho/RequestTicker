use axum::{
    extract::{Path, State, Extension, Query},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use serde_json::{json, Value};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};

use crate::error::ApiError;
use crate::user::models::Claims;
use super::models::{TypePayload, TopicPayload, SubjectPayload, DepartmentPayload, DepartmentResponse, UserListResponse, UserPayload, UserFilter, UserPaginatedResponse, StatusResponse};

// ฟังก์ชันเช็คสิทธิ์ใช้งาน (ใช้ร่วมกัน)
fn check_admin_access(claims: &Claims) -> Result<(), ApiError> {
    // ให้สิทธิ์ admin หรือ it เข้าจัดการ Master Data ได้
    if claims.role != "admin" && claims.role != "it" {
        return Err(ApiError::Forbidden("คุณไม่มีสิทธิ์เข้าถึงส่วนผู้ดูแลระบบ".to_string()));
    }
    Ok(())
}

// ==========================================
// 🔴 1. จัดการ Types (m_request_types)
// ==========================================
pub async fn create_type(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Json(payload): Json<TypePayload>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    sqlx::query!(
        "INSERT INTO m_request_types (name, description, responsible_dept_id) VALUES ($1, $2, $3)", 
        payload.name, 
        payload.description,
        payload.responsible_dept_id
    )
    .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    Ok((StatusCode::CREATED, Json(json!({ "message": "เพิ่มประเภทบริการสำเร็จ" }))))
}

pub async fn update_type(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Path(id): Path<i32>, Json(payload): Json<TypePayload>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    let result = sqlx::query!(
        "UPDATE m_request_types SET name = $1, description = $2, responsible_dept_id = $3 WHERE id = $4", 
        payload.name, 
        payload.description,
        payload.responsible_dept_id,
        id
    )
    .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบข้อมูลประเภทที่ต้องการแก้ไข".to_string()));
    }
    Ok((StatusCode::OK, Json(json!({ "message": "อัปเดตข้อมูลสำเร็จ" }))))
}

pub async fn delete_type(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Path(id): Path<i32>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    let result = sqlx::query!("UPDATE m_request_types SET del_flag = TRUE WHERE id = $1", id)
        .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบข้อมูลที่ต้องการลบ".to_string()));
    }
    Ok((StatusCode::OK, Json(json!({ "message": "ลบข้อมูลสำเร็จ" }))))
}

// ==========================================
// 🟠 2. จัดการ Topics (m_topics)
// ==========================================
pub async fn create_topic(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Json(payload): Json<TopicPayload>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    sqlx::query!(
        "INSERT INTO m_topics (type_id, name) VALUES ($1, $2)", 
        payload.type_id, 
        payload.name
    )
    .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    Ok((StatusCode::CREATED, Json(json!({ "message": "เพิ่มหมวดหมู่สำเร็จ" }))))
}

pub async fn update_topic(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Path(id): Path<i32>, Json(payload): Json<TopicPayload>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    let result = sqlx::query!(
        "UPDATE m_topics SET type_id = $1, name = $2 WHERE id = $3", 
        payload.type_id, 
        payload.name,
        id
    )
    .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบข้อมูลหมวดหมู่ที่ต้องการแก้ไข".to_string()));
    }
    Ok((StatusCode::OK, Json(json!({ "message": "อัปเดตข้อมูลสำเร็จ" }))))
}

pub async fn delete_topic(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Path(id): Path<i32>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    let result = sqlx::query!("UPDATE m_topics SET del_flag = TRUE WHERE id = $1", id)
        .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบข้อมูลที่ต้องการลบ".to_string()));
    }
    Ok((StatusCode::OK, Json(json!({ "message": "ลบข้อมูลสำเร็จ" }))))
}

// ==========================================
// 🟡 3. จัดการ Subjects (m_subjects)
// ==========================================
pub async fn create_subject(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Json(payload): Json<SubjectPayload>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    sqlx::query!(
        "INSERT INTO m_subjects (topic_id, name, requires_approval, requires_receiver_approval) VALUES ($1, $2, $3, $4)", 
        payload.topic_id, payload.name, payload.requires_approval, payload.requires_receiver_approval
    )
    .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    Ok((StatusCode::CREATED, Json(json!({ "message": "เพิ่มหัวข้อปัญหาสำเร็จ" }))))
}

pub async fn update_subject(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Path(id): Path<i32>, Json(payload): Json<SubjectPayload>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    let result = sqlx::query!(
        "UPDATE m_subjects SET topic_id = $1, name = $2, requires_approval = $3, requires_receiver_approval = $4 WHERE id = $5", 
        payload.topic_id, payload.name, payload.requires_approval, payload.requires_receiver_approval, id
    )
    .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบข้อมูลหัวข้อปัญหาที่ต้องการแก้ไข".to_string()));
    }
    Ok((StatusCode::OK, Json(json!({ "message": "อัปเดตข้อมูลสำเร็จ" }))))
}

pub async fn delete_subject(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Path(id): Path<i32>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    let result = sqlx::query!("UPDATE m_subjects SET del_flag = TRUE WHERE id = $1", id)
        .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบข้อมูลที่ต้องการลบ".to_string()));
    }
    Ok((StatusCode::OK, Json(json!({ "message": "ลบข้อมูลสำเร็จ" }))))
}

// ==========================================
// 🟨 4. จัดการ Departments (m_departments)
// ==========================================
pub async fn get_departments(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    let departments = sqlx::query_as!(
        DepartmentResponse,
        "SELECT id, name FROM m_departments WHERE del_flag = FALSE ORDER BY id ASC"
    )
    .fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    Ok((StatusCode::OK, Json(json!(departments))))
}

pub async fn create_department(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Json(payload): Json<DepartmentPayload>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    sqlx::query!(
        "INSERT INTO m_departments (name) VALUES ($1)", 
        payload.name
    )
    .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    Ok((StatusCode::CREATED, Json(json!({ "message": "เพิ่มแผนกสำเร็จ" }))))
}

pub async fn update_department(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Path(id): Path<i32>, Json(payload): Json<DepartmentPayload>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    let result = sqlx::query!(
        "UPDATE m_departments SET name = $1 WHERE id = $2", 
        payload.name, 
        id
    )
    .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบข้อมูลแผนกที่ต้องการแก้ไข".to_string()));
    }
    Ok((StatusCode::OK, Json(json!({ "message": "อัปเดตข้อมูลสำเร็จ" }))))
}

pub async fn delete_department(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Path(id): Path<i32>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    
    let result = sqlx::query!("UPDATE m_departments SET del_flag = TRUE WHERE id = $1", id)
        .execute(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบข้อมูลที่ต้องการลบ".to_string()));
    }
    Ok((StatusCode::OK, Json(json!({ "message": "ลบข้อมูลสำเร็จ" }))))
}

pub async fn import_departments(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Json(payload): Json<Vec<DepartmentPayload>>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    let mut tx = pool.begin().await?;
    for item in payload {
        let mut existing_id = item.id;

        // 1. ถ้าไม่มี ID ให้ลองหาจากชื่อแผนก
        if existing_id.is_none() {
            let by_name = sqlx::query!("SELECT id FROM m_departments WHERE name = $1", item.name)
                .fetch_optional(&mut *tx).await?;
            if let Some(record) = by_name { existing_id = Some(record.id); }
        }

        // 2. ถ้ามี ID (ไม่ว่าจะมาจากการส่งมาตรงๆ หรือหาจากชื่อ) ให้ทำการ Update
        if let Some(id) = existing_id {
            sqlx::query!(
                "UPDATE m_departments SET name = $1, del_flag = FALSE WHERE id = $2",
                item.name, id
            ).execute(&mut *tx).await?;
        } else {
            // 3. ถ้าหาไม่เจอจริงๆ ให้ Insert ใหม่
            sqlx::query!(
                "INSERT INTO m_departments (name) VALUES ($1)",
                item.name
            ).execute(&mut *tx).await?;
        }
    }
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"message": "นำเข้าข้อมูลแผนกสำเร็จ"}))))
}

// ==========================================
// 🚀 Handlers สำหรับ Users
// ==========================================
pub async fn get_all_users(
    State(pool): State<PgPool>, 
    Extension(claims): Extension<Claims>,
    Query(params): Query<UserFilter>,
) -> Result<Json<UserPaginatedResponse>, ApiError> {
    if claims.role != "admin" && claims.role != "it" {
        return Err(ApiError::Forbidden("ไม่มีสิทธิ์เข้าถึง".to_string()));
    }

    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(10).max(1).min(100);
    let offset = (page - 1) * limit;
    let search = params.search.unwrap_or_default();
    let search_query = format!("%{}%", search.to_lowercase());

    // 1. นับจำนวนทั้งหมดตามเงื่อนไขค้นหา
    let count_query = r#"
        SELECT COUNT(*) 
        FROM users u
        LEFT JOIN m_departments d ON u.department_id = d.id
        WHERE (LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1 OR LOWER(u.username) LIKE $1 OR LOWER(d.name) LIKE $1 OR LOWER(u.employee_code) LIKE $1)
          AND ($2::INT IS NULL OR u.department_id = $2)
          AND ($3::TEXT IS NULL OR u.role = $3)
    "#;
    let total_records: (i64,) = sqlx::query_as(count_query)
        .bind(&search_query)
        .bind(params.department_id)
        .bind(params.role.clone())
        .fetch_one(&pool).await
        .unwrap_or((0,));

    // 2. ดึงข้อมูลแบบแบ่งหน้า
    let users = sqlx::query_as!(
        UserListResponse,
        r#"
        SELECT 
            u.id, 
            u.employee_code as "employee_code?",
            u.name as "name!", 
            u.username as "username?",
            u.email as "email!", 
            u.role as "role!", 
            u.department_id as "department_id?", 
            u.position as "position?",           
            u.is_active as "is_active!",
            d.name as "department_name?",
            u.phone_number as "phone_number?"
        FROM users u
        LEFT JOIN m_departments d ON u.department_id = d.id
        WHERE (LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1 OR LOWER(u.username) LIKE $1 OR LOWER(d.name) LIKE $1 OR LOWER(u.employee_code) LIKE $1)
          AND ($2::INT IS NULL OR u.department_id = $2)
          AND ($3::TEXT IS NULL OR u.role = $3)
        ORDER BY u.id ASC
        LIMIT $4 OFFSET $5
        "#,
        search_query,
        params.department_id,
        params.role,
        limit,
        offset
    )
    .fetch_all(&pool).await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    let total_pages = (total_records.0 as f64 / limit as f64).ceil() as i64;

    Ok(Json(UserPaginatedResponse {
        data: users,
        total_records: total_records.0,
        total_pages,
        current_page: page,
    }))
}

pub async fn create_user(
    State(pool): State<PgPool>, 
    Extension(claims): Extension<Claims>, 
    Json(payload): Json<UserPayload>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    if claims.role != "admin" { return Err(ApiError::Forbidden("Admin เท่านั้น".to_string())); }

    let raw_password = payload.password
        .as_deref()
        .filter(|p| !p.trim().is_empty())
        .unwrap_or("123456");

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(raw_password.as_bytes(), &salt)
        .map_err(|_| ApiError::InternalServerError("เข้ารหัสผ่านไม่สำเร็จ".to_string()))?
        .to_string();

    sqlx::query!(
        "INSERT INTO users (name, username, email, password_hash, role, department_id, position, phone_number, is_active, employee_code) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        payload.name, 
        payload.username, 
        payload.email, 
        password_hash,
        payload.role, 
        payload.department_id, 
        payload.position,
        payload.phone_number,
        payload.is_active,
        payload.employee_code
    )
    .execute(&pool).await
    .map_err(|e| {
        let err_msg = e.to_string();
        if err_msg.contains("users_employee_code_key") {
            ApiError::BadRequest("รหัสพนักงานนี้มีในระบบแล้ว กรุณาใช้รหัสอื่น".to_string())
        } else if err_msg.contains("users_email_key") {
            ApiError::BadRequest("อีเมลนี้มีในระบบแล้ว".to_string())
        } else {
            ApiError::InternalServerError(err_msg)
        }
    })?;

    Ok((StatusCode::CREATED, Json(json!({ "message": "สร้างผู้ใช้งานสำเร็จ" }))))
}

pub async fn update_user(
    State(pool): State<PgPool>, 
    Extension(claims): Extension<Claims>, 
    Path(id): Path<i32>, 
    Json(payload): Json<UserPayload>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    if claims.role != "admin" { 
        return Err(ApiError::Forbidden("Admin เท่านั้น".to_string())); 
    }

    let new_password = payload.password.as_deref().filter(|p| !p.trim().is_empty());

    let result = if let Some(pwd) = new_password {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2.hash_password(pwd.as_bytes(), &salt)
            .map_err(|_| ApiError::InternalServerError("เข้ารหัสผ่านไม่สำเร็จ".to_string()))?
            .to_string();

        sqlx::query!(
            "UPDATE users SET name = $1, username = $2, email = $3, password_hash = $4, role = $5, department_id = $6, position = $7, phone_number = $8, is_active = $9, employee_code = $10 WHERE id = $11",
            payload.name, 
            payload.username, 
            payload.email, 
            password_hash,
            payload.role, 
            payload.department_id, 
            payload.position,
            payload.phone_number,
            payload.is_active, 
            payload.employee_code,
            id
        )
        .execute(&pool).await
    } else {
        sqlx::query!(
            "UPDATE users SET name = $1, username = $2, email = $3, role = $4, department_id = $5, position = $6, phone_number = $7, is_active = $8, employee_code = $9 WHERE id = $10",
            payload.name, 
            payload.username, 
            payload.email, 
            payload.role, 
            payload.department_id, 
            payload.position,
            payload.phone_number,
            payload.is_active, 
            payload.employee_code,
            id
        )
        .execute(&pool).await
    };

    result.map_err(|e| {
        let err_msg = e.to_string();
        if err_msg.contains("users_employee_code_key") {
            ApiError::BadRequest("รหัสพนักงานนี้มีในระบบแล้ว ไม่สามารถเปลี่ยนเป็นรหัสนี้ได้".to_string())
        } else {
            ApiError::InternalServerError(err_msg)
        }
    })?;

    Ok((StatusCode::OK, Json(json!({ "message": "อัปเดตข้อมูลสำเร็จ" }))))
}

pub async fn import_users(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<Vec<UserPayload>>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;

    let mut tx = pool.begin().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    for user in payload.iter() {
        let pass = user.password.clone().unwrap_or_else(|| "12345678".to_string());
        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(pass.as_bytes(), &salt)
            .map_err(|_| ApiError::InternalServerError("เข้ารหัสผ่านไม่สำเร็จ".to_string()))?
            .to_string();

        sqlx::query!(
            "INSERT INTO users (name, username, email, password_hash, role, department_id, position, phone_number, is_active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (email) DO UPDATE SET 
                name = EXCLUDED.name,
                username = EXCLUDED.username,
                role = EXCLUDED.role,
                department_id = EXCLUDED.department_id,
                position = EXCLUDED.position,
                phone_number = EXCLUDED.phone_number,
                is_active = EXCLUDED.is_active", 
            user.name,
            user.username,
            user.email,
            password_hash,
            user.role,
            user.department_id,
            user.position,
            user.phone_number,
            user.is_active
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::InternalServerError(format!("เกิดข้อผิดพลาดที่อีเมล {}: {}", e.to_string(), user.email)))?;
    }

    tx.commit().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({"message": format!("นำเข้าผู้ใช้งานสำเร็จ {} รายการ", payload.len())})),
    ))
}

pub async fn import_types(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Json(payload): Json<Vec<TypePayload>>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    let mut tx = pool.begin().await?;
    for item in payload {
        // 1. ลองหาจาก ID ก่อน (ถ้ามีส่งมา)
        let mut existing_id = item.id;
        
        // 2. ถ้าไม่มี ID ลองหาจากชื่อ (เพื่อกันชื่อซ้ำกรณีสร้างใหม่)
        if existing_id.is_none() {
            let by_name = sqlx::query!("SELECT id FROM m_request_types WHERE name = $1", item.name)
                .fetch_optional(&mut *tx).await?;
            if let Some(record) = by_name { existing_id = Some(record.id); }
        }

        if let Some(id) = existing_id {
            sqlx::query!(
                "UPDATE m_request_types SET name = $1, description = $2, responsible_dept_id = $3, del_flag = $4 WHERE id = $5",
                item.name, item.description, item.responsible_dept_id, item.del_flag.unwrap_or(false), id
            ).execute(&mut *tx).await?;
        } else {
            sqlx::query!(
                "INSERT INTO m_request_types (name, description, responsible_dept_id, del_flag) VALUES ($1, $2, $3, $4)",
                item.name, item.description, item.responsible_dept_id, item.del_flag.unwrap_or(false)
            ).execute(&mut *tx).await?;
        }
    }
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"message": "นำเข้าประเภทบริการสำเร็จ"}))))
}

pub async fn import_topics(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Json(payload): Json<Vec<TopicPayload>>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    let mut tx = pool.begin().await?;
    for item in payload {
        let mut existing_id = item.id;
        
        if existing_id.is_none() {
            let by_name = sqlx::query!("SELECT id FROM m_topics WHERE type_id = $1 AND name = $2", item.type_id, item.name)
                .fetch_optional(&mut *tx).await?;
            if let Some(record) = by_name { existing_id = Some(record.id); }
        }

        if let Some(id) = existing_id {
            sqlx::query!(
                "UPDATE m_topics SET name = $1, type_id = $2, del_flag = $3 WHERE id = $4",
                item.name, item.type_id, item.del_flag.unwrap_or(false), id
            ).execute(&mut *tx).await?;
        } else {
            sqlx::query!(
                "INSERT INTO m_topics (type_id, name, del_flag) VALUES ($1, $2, $3)",
                item.type_id, item.name, item.del_flag.unwrap_or(false)
            ).execute(&mut *tx).await?;
        }
    }
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"message": "นำเข้าหมวดหมู่สำเร็จ"}))))
}

pub async fn import_subjects(
    State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Json(payload): Json<Vec<SubjectPayload>>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    check_admin_access(&claims)?;
    let mut tx = pool.begin().await?;
    for item in payload {
        let mut existing_id = item.id;

        if existing_id.is_none() {
            let by_name = sqlx::query!("SELECT id FROM m_subjects WHERE topic_id = $1 AND name = $2", item.topic_id, item.name)
                .fetch_optional(&mut *tx).await?;
            if let Some(record) = by_name { existing_id = Some(record.id); }
        }

        if let Some(id) = existing_id {
            sqlx::query!(
                "UPDATE m_subjects SET name = $1, requires_approval = $2, requires_receiver_approval = $3, del_flag = $4 WHERE id = $5",
                item.name, item.requires_approval, item.requires_receiver_approval, item.del_flag.unwrap_or(false), id
            ).execute(&mut *tx).await?;
        } else {
            sqlx::query!(
                "INSERT INTO m_subjects (topic_id, name, requires_approval, requires_receiver_approval, del_flag) VALUES ($1, $2, $3, $4, $5)",
                item.topic_id, item.name, item.requires_approval, item.requires_receiver_approval, item.del_flag.unwrap_or(false)
            ).execute(&mut *tx).await?;
        }
    }
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"message": "นำเข้าหัวข้อปัญหาสำเร็จ"}))))
}

// ==========================================
// 🆕 5. Master Status
// ==========================================
pub async fn get_statuses(State(pool): State<PgPool>) -> Result<Json<Vec<StatusResponse>>, ApiError> {
    let statuses = sqlx::query_as!(
        StatusResponse,
        "SELECT id, name_th, badge_variant, color_class FROM m_status ORDER BY id ASC"
    )
    .fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    Ok(Json(statuses))
}
