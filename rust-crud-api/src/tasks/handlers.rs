use axum::{
    extract::{Path, State, Extension, Query}, // 🌟 เพิ่ม Query
    http::StatusCode,
    Json,
};
use sqlx::PgPool;

use super::models::{AcceptTaskPayload, CursorFilter, CursorPaginatedResponse, UpdateAssigneesPayload, StartTaskPayload, CloseTaskPayload, VerifyTaskPayload};
use crate::error::ApiError;
use crate::user::models::{Claims, UserResponse};
use crate::request::models::RequestItem; // 🌟 ดึง Model โครงสร้างใบงานมาจากโฟลเดอร์ requests

pub async fn accept_task(
    // ... (โค้ดฟังก์ชัน accept_task เหมือนเดิมทั้งหมด ไม่ต้องแก้) ...
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<AcceptTaskPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    // ... [โค้ดของ accept_task เดิม] ...
    
    let current_user_id: i32 = claims.sub.parse().map_err(|_| {
        ApiError::InternalServerError("ข้อมูล User ID ใน Token ไม่ถูกต้อง".to_string())
    })?;

    if payload.assignees.is_empty() {
        return Err(ApiError::BadRequest("กรุณาระบุผู้รับผิดชอบงานอย่างน้อย 1 คน".to_string()));
    }

    let mut tx = pool.begin().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    let req_info = sqlx::query!(
        "SELECT status_id FROM requests WHERE id = $1 AND is_deleted = FALSE",
        request_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| ApiError::NotFound("ไม่พบข้อมูลใบงาน".to_string()))?;

    if let Some(req) = req_info {
        let current_status = req.status_id.unwrap_or(0);

        if [4, 5].contains(&current_status) {
            return Err(ApiError::BadRequest("ไม่สามารถรับงานได้ เนื่องจากใบงานนี้ถูกปิดหรือยกเลิกไปแล้ว".to_string()));
        }

        // 🚨 ไม่อนุญาตให้รับงานถ้ายังไม่อนุมัติ (2, 7, 8, 10)
        if [2, 7, 8, 10].contains(&current_status) {
            return Err(ApiError::BadRequest("ไม่สามารถรับงานได้ เนื่องจากใบงานยังอยู่ระหว่างขั้นตอนการอนุมัติ".to_string()));
        }

        sqlx::query(
            "UPDATE requests SET status_id = 1, plan_start_date = $1, plan_finish_date = $2 WHERE id = $3"
        )
        .bind(payload.plan_start_date)
        .bind(payload.plan_finish_date)
        .bind(request_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

        for agent_id in &payload.assignees {
            // ลบข้อมูลเก่าถ้ามี แล้วเพิ่มข้อมูลใหม่
            sqlx::query(
                "DELETE FROM request_assignees WHERE request_id = $1 AND assignee_id = $2"
            )
            .bind(request_id)
            .bind(agent_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

            sqlx::query(
                "INSERT INTO request_assignees (request_id, assignee_id, assigned_by) VALUES ($1, $2, $3)"
            )
            .bind(request_id)
            .bind(agent_id)
            .bind(current_user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        }

        sqlx::query(
            "INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) VALUES ($1, $2, 99, 'AGENT_ACCEPT', 1, $3, NOW())"
        )
        .bind(request_id)
        .bind(current_user_id)
        .bind(&payload.remark)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

        tx.commit().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

        Ok((StatusCode::OK, Json(serde_json::json!({ 
            "message": "จ่ายงาน/รับงานสำเร็จ และประเมินเวลาเรียบร้อยแล้ว",
            "request_id": request_id,
            "assigned_count": payload.assignees.len()
        }))))
    } else {
        Err(ApiError::NotFound("ไม่พบข้อมูลใบงานในระบบ".to_string()))
    }
}

// ==========================================
// 🌟 เส้นที่ 2: ดึงข้อมูล "งานของแผนก" (สำหรับหัวหน้า/ช่าง)
// ==========================================
pub async fn get_dept_tasks(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<CursorFilter>,
) -> Result<Json<CursorPaginatedResponse<RequestItem>>, ApiError> {
    let limit = filter.limit.unwrap_or(10);
    
    // 🌟 ดึง department_id จาก token
    let department_id = claims.department_id.ok_or_else(|| 
        ApiError::BadRequest("ไม่พบข้อมูลแผนกใน Token ของคุณ".to_string())
    )?; 

    let cursor_condition = match filter.cursor {
        Some(c) => format!("AND r.id < {}", c),
        None => "".to_string(),
    };

let query = format!(
        r#"
        SELECT 
            r.id, 
            r.req_code,                             -- รหัสใบงาน (เช่น REQ-20241014-0001)
            r.requester_id, 
            u1.name AS requester_name,              -- ชื่อผู้แจ้ง (เช่น Administrator)
            r.subject_id, 
            s.name AS subject_name,                 -- หัวข้อปัญหา
            t.name AS topic_name,                   -- หมวดหมู่ย่อย
            rt.name AS type_name,                   -- ประเภทคำขอหลัก
            r.phone_number, 
            r.requirement, 
            r.description, 
            r.file_url,
            r.status_id, 
            ms.name_th AS status_name,               -- ชื่อสถานะภาษาไทย
            ms.badge_variant AS status_variant,      -- รูปแบบ Badge (เช่น outline, default)
            ms.color_class AS status_color,          -- สี Badge (Class Tailwind)
            r.request_date,                         -- วันที่แจ้ง
            r.recorded_by, 
            u3.name AS recorded_by_name,
            r.plan_start_date, 
            r.plan_finish_date, 
            r.actual_start_date, 
            r.actual_finish_date,
            (SELECT COALESCE(json_agg(
                json_build_object(
                    'id', u4.id,
                    'name', u4.name,
                    'position', u4.position,
                    'email', u4.email,
                    'phone_number', u4.phone_number
                )
            ), '[]')
            FROM request_assignees ra2
            LEFT JOIN users u4 ON ra2.assignee_id = u4.id
            WHERE ra2.request_id = r.id
            ) AS assignees,
            (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'step', ra.approve_step,
                        'approver_id', ra.approver_id,
                        'approver_name', u2.name,
                        'approval_type', ra.approval_type,
                        'status_name', ams.name_th,
                        'comment', ra.comment,
                        'action_date', ra.action_date
                    ) ORDER BY ra.approve_step ASC
                ), '[]')
                FROM request_approvals ra
                LEFT JOIN users u2 ON ra.approver_id = u2.id
                LEFT JOIN m_status ams ON ra.status_id = ams.id
                WHERE ra.request_id = r.id
            ) AS approvals
        FROM requests r
        LEFT JOIN m_status ms ON r.status_id = ms.id
        LEFT JOIN users u1 ON r.requester_id = u1.id
        LEFT JOIN m_subjects s ON r.subject_id = s.id
        LEFT JOIN m_topics t ON s.topic_id = t.id
        LEFT JOIN m_request_types rt ON t.type_id = rt.id
        LEFT JOIN users u3 ON r.recorded_by = u3.id
        WHERE r.is_deleted = FALSE AND rt.responsible_dept_id = $1 {} 
        ORDER BY r.id DESC LIMIT $2 
        "#,
        cursor_condition
    );

    let mut requests = sqlx::query_as::<_, RequestItem>(&query)
        .bind(department_id)
        .bind(limit + 1)
        .fetch_all(&pool)
        .await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    let has_more = requests.len() > limit as usize;
    if has_more { requests.pop(); }
    let next_cursor = requests.last().map(|r| r.id);

    Ok(Json(CursorPaginatedResponse { data: requests, next_cursor, has_more }))
}

// ==========================================
// 🌟 เส้นที่ 4: ดึงรายชื่อ Agent ในแผนก (สำหรับหน้า Assign งาน)
// ==========================================
pub async fn get_department_agents(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<UserResponse>>, ApiError> {
    let department_id = claims.department_id.ok_or_else(|| 
        ApiError::BadRequest("ไม่พบข้อมูลแผนกใน Token ของคุณ".to_string())
    )?;

    let query = r#"
        SELECT 
            u.id, u.username, u.name, u.email, u.role, u.position, u.department_id, u.phone_number,
            d.name as department
        FROM users u
        LEFT JOIN m_departments d ON u.department_id = d.id
        WHERE u.department_id = $1 
        AND u.role IN ('user', 'admin', 'agent') 
        AND u.is_active = TRUE 
        ORDER BY u.name ASC
    "#;

    let agents = sqlx::query_as::<_, UserResponse>(query)
    .bind(department_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok(Json(agents))
}

// ==========================================
// 🌟 เส้นที่ 5: อัปเดตรายชื่อผู้รับผิดชอบงาน (Assignees)
// ==========================================
pub async fn update_assignees(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<UpdateAssigneesPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    // TODO: (Optional) อาจจะเพิ่มการเช็คว่าคนที่กดเป็น Admin หรือเป็นหัวหน้าแผนกหรือไม่

    let mut tx = pool.begin().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    // 1. ล้างรายชื่อผู้รับผิดชอบเก่าของใบงานนี้ออกทั้งหมด
    sqlx::query!("DELETE FROM request_assignees WHERE request_id = $1", request_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::InternalServerError(format!("ลบข้อมูลเก่าไม่สำเร็จ: {}", e)))?;

    // 2. วนลูปเพิ่มรายชื่อใหม่เข้าไป
    if !payload.assignee_ids.is_empty() {
        for agent_id in &payload.assignee_ids {
            sqlx::query!(
                "INSERT INTO request_assignees (request_id, assignee_id, assigned_by) VALUES ($1, $2, $3)",
                request_id,
                agent_id,
                claims.sub.parse::<i32>().map_err(|_| ApiError::InternalServerError("User ID ไม่ถูกต้อง".to_string()))? // assigned_by
            )
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::InternalServerError(format!("เพิ่มข้อมูลใหม่ไม่สำเร็จ: {}", e)))?;
        }
    }

    tx.commit().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({ 
        "message": "อัปเดตรายชื่อผู้รับผิดชอบสำเร็จ",
        "request_id": request_id,
        "new_assignee_count": payload.assignee_ids.len()
    }))))
}

// ==========================================
// 🌟 เส้นที่ 3: ดึงข้อมูล "งานของฉัน" (งานที่ช่างถูก Assign)
// ==========================================
pub async fn get_my_assigned_tasks(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<CursorFilter>,
) -> Result<Json<CursorPaginatedResponse<RequestItem>>, ApiError> {
    let limit = filter.limit.unwrap_or(10);
    let user_id: i32 = claims.sub.parse().unwrap_or(0);

    let cursor_condition = match filter.cursor {
        Some(c) => format!("AND r.id < {}", c),
        None => "".to_string(),
    };

    let query = format!(
        r#"
SELECT 
            r.id, 
            r.req_code,                             -- รหัสใบงาน (เช่น REQ-20241014-0001)
            r.requester_id, 
            u1.name AS requester_name,              -- ชื่อผู้แจ้ง (เช่น Administrator)
            r.subject_id, 
            s.name AS subject_name,                 -- หัวข้อปัญหา
            t.name AS topic_name,                   -- หมวดหมู่ย่อย
            rt.name AS type_name,                   -- ประเภทคำขอหลัก
            r.phone_number, 
            r.requirement, 
            r.description, 
            r.file_url,
            r.status_id, 
            ms.name_th AS status_name,               -- ชื่อสถานะภาษาไทย
            ms.badge_variant AS status_variant,      -- รูปแบบ Badge (เช่น outline, default)
            ms.color_class AS status_color,          -- สี Badge (Class Tailwind)
            r.request_date,                         -- วันที่แจ้ง
            r.recorded_by, 
            u3.name AS recorded_by_name,
            r.plan_start_date, 
            r.plan_finish_date, 
            r.actual_start_date, 
            r.actual_finish_date,
            (SELECT COALESCE(json_agg(
                json_build_object(
                    'id', u4.id,
                    'name', u4.name,
                    'position', u4.position,
                    'email', u4.email,
                    'phone_number', u4.phone_number
                )
            ), '[]')
            FROM request_assignees ra2
            LEFT JOIN users u4 ON ra2.assignee_id = u4.id
            WHERE ra2.request_id = r.id
            ) AS assignees,
            (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'step', ra.approve_step,
                        'approver_id', ra.approver_id,
                        'approver_name', u2.name,
                        'approval_type', ra.approval_type,
                        'status_name', ams.name_th,
                        'comment', ra.comment,
                        'action_date', ra.action_date
                    ) ORDER BY ra.approve_step ASC
                ), '[]')
                FROM request_approvals ra
                LEFT JOIN users u2 ON ra.approver_id = u2.id
                LEFT JOIN m_status ams ON ra.status_id = ams.id
                WHERE ra.request_id = r.id
            ) AS approvals
        FROM requests r
        LEFT JOIN m_status ms ON r.status_id = ms.id
        LEFT JOIN users u1 ON r.requester_id = u1.id
        LEFT JOIN m_subjects s ON r.subject_id = s.id
        LEFT JOIN m_topics t ON s.topic_id = t.id
        LEFT JOIN m_request_types rt ON t.type_id = rt.id
        LEFT JOIN users u3 ON r.recorded_by = u3.id
        WHERE r.is_deleted = FALSE 
        AND EXISTS (SELECT 1 FROM request_assignees rasg WHERE rasg.request_id = r.id AND rasg.assignee_id = $1)
        {} 
        ORDER BY r.id DESC LIMIT $2
        "#, 
        cursor_condition
    );

    let mut requests = sqlx::query_as::<_, RequestItem>(&query)
        .bind(user_id)
        .bind(limit + 1)
        .fetch_all(&pool)
        .await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    let has_more = requests.len() > limit as usize;
    if has_more { requests.pop(); }
    let next_cursor = requests.last().map(|r| r.id);

    Ok(Json(CursorPaginatedResponse { data: requests, next_cursor, has_more }))
}

// ==========================================
// 🌟 API สำหรับ "เริ่มงาน" (บันทึก Plan และบันทึก Actual Start Date เป็นเวลาปัจจุบัน)
// ==========================================
pub async fn start_task(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<StartTaskPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    let current_user_id: i32 = claims.sub.parse().map_err(|_| {
        ApiError::InternalServerError("ข้อมูล User ID ใน Token ไม่ถูกต้อง".to_string())
    })?;

    // 🌟 1. ตรวจสอบสถานะปัจจุบันก่อนเริ่มงาน
    let req_info = sqlx::query!(
        "SELECT status_id FROM requests WHERE id = $1 AND is_deleted = FALSE",
        request_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?
    .ok_or_else(|| ApiError::NotFound("ไม่พบใบงานในระบบ".to_string()))?;

    let current_status = req_info.status_id.unwrap_or(0);

    // 🚨 ไม่อนุญาตให้เริ่มงานถ้ายังไม่อนุมัติ (2, 7, 8, 10) หรือปิดไปแล้ว (4, 5)
    if [2, 7, 8, 10].contains(&current_status) {
        return Err(ApiError::BadRequest("ไม่สามารถเริ่มงานได้ เนื่องจากใบงานยังอยู่ระหว่างขั้นตอนการอนุมัติ".to_string()));
    }
    if [4, 5].contains(&current_status) {
        return Err(ApiError::BadRequest("ไม่สามารถเริ่มงานได้ เนื่องจากใบงานถูกปิดหรือยกเลิกไปแล้ว".to_string()));
    }

    // อัปเดตข้อมูล requests (เปลี่ยน status เป็น 3 = กำลังดำเนินการ)
    let result = sqlx::query!(
        "UPDATE requests 
         SET plan_start_date = $1, plan_finish_date = $2, actual_start_date = NOW(), status_id = 3 
         WHERE id = $3 AND is_deleted = FALSE",
        payload.plan_start_date,
        payload.plan_finish_date,
        request_id
    )
    .execute(&pool)
    .await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบใบงาน หรือใบงานถูกลบไปแล้ว".to_string()));
    }

    // เก็บ Log ว่าใครเป็นคนกดเริ่มงาน
    sqlx::query!(
        "INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) 
         VALUES ($1, $2, 99, 'START_TASK', 3, 'ช่างเริ่มดำเนินการ', NOW())",
        request_id, current_user_id
    )
    .execute(&pool)
    .await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "เริ่มดำเนินการเรียบร้อยแล้ว" }))))
}

// ==========================================
// 🌟 API สำหรับ "ปิดงาน" (ส่งงานให้ผู้แจ้งตรวจรับ)
// ==========================================
pub async fn close_task(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<CloseTaskPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    let current_user_id: i32 = claims.sub.parse().map_err(|_| {
        ApiError::InternalServerError("ข้อมูล User ID ใน Token ไม่ถูกต้อง".to_string())
    })?;

    // 🌟 1. เปลี่ยน status_id เป็น 9 (รอการตรวจรับ)
    let result = sqlx::query!(
        "UPDATE requests 
         SET actual_finish_date = $1, status_id = 9 
         WHERE id = $2 AND is_deleted = FALSE",
        payload.actual_finish_date,
        request_id
    )
    .execute(&pool)
    .await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบใบงาน หรือใบงานถูกลบไปแล้ว".to_string()));
    }

    // 🌟 2. เก็บ Log เปลี่ยน status_id เป็น 9 ด้วยเช่นกัน
    sqlx::query!(
        "INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) 
         VALUES ($1, $2, 100, 'CLOSE_TASK', 9, $3, NOW())",
        request_id,
        current_user_id,
        payload.remark
    )
    .execute(&pool)
    .await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "message": "บันทึกปิดงานสำเร็จ รอผู้แจ้งตรวจรับงาน"
        })),
    ))
}

// ==========================================
// 🌟 API สำหรับ "ตรวจรับงาน" (ผู้แจ้งกดยืนยัน หรือ ตีกลับ)
// ==========================================
pub async fn verify_task(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<VerifyTaskPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    let current_user_id: i32 = claims.sub.parse().map_err(|_| {
        ApiError::InternalServerError("User ID ไม่ถูกต้อง".to_string())
    })?;

    // กำหนดสถานะใหม่: ผ่าน = 4 (เสร็จสิ้น), ไม่ผ่าน = 3 (กำลังดำเนินการ)
    let new_status_id = if payload.is_approved { 4 } else { 3 };
    let approval_type = if payload.is_approved { "VERIFY_PASS" } else { "VERIFY_REJECT" };

    // 🚨 Logic บังคับ: ถ้าตีกลับ (ไม่ผ่าน) ต้องมีเหตุผลเสมอ
    if !payload.is_approved && payload.remark.as_ref().map(|r| r.trim().is_empty()).unwrap_or(true) {
        return Err(ApiError::BadRequest("กรุณาระบุเหตุผลในการตีกลับงานให้ช่างแก้ไข".to_string()));
    }

    // 1. อัปเดตสถานะในตาราง requests
    let result = sqlx::query!(
        "UPDATE requests 
         SET status_id = $1 
         WHERE id = $2 AND is_deleted = FALSE",
        new_status_id,
        request_id
    )
    .execute(&pool)
    .await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("ไม่พบใบงาน หรือใบงานถูกลบไปแล้ว".to_string()));
    }

    // 2. เก็บ Log การตรวจรับลง Timeline
    sqlx::query!(
        "INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) 
         VALUES ($1, $2, 101, $3, $4, $5, NOW())", // ใช้ step 101 เพื่อให้โชว์เป็นคนตรวจรับ (หรือลำดับท้ายสุด)
        request_id,
        current_user_id,
        approval_type,
        new_status_id,
        payload.remark
    )
    .execute(&pool)
    .await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    // 3. ส่งข้อความตอบกลับตามการกระทำ
    let message = if payload.is_approved {
        "ตรวจรับงานสำเร็จ ปิดใบงานเรียบร้อย"
    } else {
        "ตีกลับงานให้ช่างแก้ไขเรียบร้อย"
    };

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "message": message
        })),
    ))
}

