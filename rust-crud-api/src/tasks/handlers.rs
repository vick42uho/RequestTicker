use axum::{
    extract::{Path, State, Extension, Query},
    http::StatusCode,
    Json,
};
use sqlx::{PgPool, Postgres, QueryBuilder};

use super::models::{AcceptTaskPayload, CursorFilter, CursorPaginatedResponse, UpdateAssigneesPayload, StartTaskPayload, CloseTaskPayload, VerifyTaskPayload, SubTaskItem, CreateSubTasksPayload, UpdateSubTaskStatusPayload, AssignSubTaskMembersPayload};
use crate::error::ApiError;
use crate::user::models::{Claims, UserResponse};
use crate::request::models::RequestItem;

pub async fn accept_task(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<AcceptTaskPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    
    let current_user_id: i32 = claims.sub.parse().map_err(|_| {
        ApiError::InternalServerError("ข้อมูล User ID ใน Token ไม่ถูกต้อง".to_string())
    })?;

    if payload.assignees.is_empty() {
        return Err(ApiError::BadRequest("กรุณาระบุผู้รับผิดชอบงานอย่างน้อย 1 คน".to_string()));
    }

    let mut tx = pool.begin().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    // 🛡️ [CHECK PERMISSION] เฉพาะ Admin หรือแผนกที่รับผิดชอบงานหลักเท่านั้นที่รับงานได้
    let req_data = sqlx::query!(
        r#"
        SELECT r.status_id, rt.responsible_dept_id 
        FROM requests r
        JOIN m_subjects s ON r.subject_id = s.id
        JOIN m_topics t ON s.topic_id = t.id
        JOIN m_request_types rt ON t.type_id = rt.id
        WHERE r.id = $1 AND r.is_deleted = FALSE
        "#,
        request_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| ApiError::NotFound("ไม่พบข้อมูลใบงาน".to_string()))?
    .ok_or_else(|| ApiError::NotFound("ไม่พบข้อมูลใบงานในระบบ".to_string()))?;

    let user_dept_id = claims.department_id.unwrap_or(0);
    let is_admin = claims.role == "admin";
    if !is_admin && req_data.responsible_dept_id != Some(user_dept_id) {
        return Err(ApiError::Forbidden("คุณไม่มีสิทธิ์รับงานนี้ เฉพาะแผนกที่รับผิดชอบหลักเท่านั้น".to_string()));
    }

    let current_status = req_data.status_id.unwrap_or(0);
    if [4, 5].contains(&current_status) {
        return Err(ApiError::BadRequest("ไม่สามารถรับงานได้ เนื่องจากใบงานนี้ถูกปิดหรือยกเลิกไปแล้ว".to_string()));
    }
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
        sqlx::query("DELETE FROM request_assignees WHERE request_id = $1 AND assignee_id = $2")
            .bind(request_id).bind(agent_id).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO request_assignees (request_id, assignee_id, assigned_by) VALUES ($1, $2, $3)")
            .bind(request_id).bind(agent_id).bind(current_user_id).execute(&mut *tx).await?;
    }

    sqlx::query(
        "INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) VALUES ($1, $2, 99, 'AGENT_ACCEPT', 1, $3, NOW())"
    )
    .bind(request_id).bind(current_user_id).bind(&payload.remark).execute(&mut *tx).await?;

    tx.commit().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({ 
        "message": "จ่ายงาน/รับงานสำเร็จ และประเมินเวลาเรียบร้อยแล้ว",
        "request_id": request_id,
        "assigned_count": payload.assignees.len()
    }))))
}

pub async fn get_dept_tasks(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<CursorFilter>,
) -> Result<Json<CursorPaginatedResponse<RequestItem>>, ApiError> {
    let limit = filter.limit.unwrap_or(10);
    let department_id = claims.department_id.ok_or_else(|| 
        ApiError::BadRequest("ไม่พบข้อมูลแผนกใน Token ของคุณ".to_string())
    )?; 

    let mut query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
        r#"
        SELECT 
            r.id, r.req_code, r.requester_id, u1.name AS requester_name,
            r.subject_id, s.name AS subject_name, t.name AS topic_name, rt.name AS type_name,
            rt.responsible_dept_id,
            r.phone_number, r.requirement, r.description, r.file_url,
            r.status_id, ms.name_th AS status_name, ms.badge_variant AS status_variant, ms.color_class AS status_color,
            r.request_date, r.recorded_by, u3.name AS recorded_by_name,
            r.plan_start_date, r.plan_finish_date, r.actual_start_date, r.actual_finish_date,
            (SELECT COALESCE(json_agg(json_build_object('id', u4.id, 'name', u4.name, 'position', u4.position, 'email', u4.email, 'phone_number', u4.phone_number)), '[]') FROM request_assignees ra2 LEFT JOIN users u4 ON ra2.assignee_id = u4.id WHERE ra2.request_id = r.id) AS assignees,
            (SELECT COALESCE(json_agg(json_build_object('step', ra.approve_step, 'approver_id', ra.approver_id, 'approver_name', u2.name, 'approval_type', ra.approval_type, 'status_id', ra.status_id, 'status_name', ams.name_th, 'comment', ra.comment, 'action_date', ra.action_date) ORDER BY ra.action_date ASC, ra.id ASC), '[]') FROM request_approvals ra LEFT JOIN users u2 ON ra.approver_id = u2.id LEFT JOIN m_status ams ON ra.status_id = ams.id WHERE ra.request_id = r.id) AS approvals
        FROM requests r
        LEFT JOIN m_status ms ON r.status_id = ms.id
        LEFT JOIN users u1 ON r.requester_id = u1.id
        LEFT JOIN m_subjects s ON r.subject_id = s.id
        LEFT JOIN m_topics t ON s.topic_id = t.id
        LEFT JOIN m_request_types rt ON t.type_id = rt.id
        LEFT JOIN users u3 ON r.recorded_by = u3.id
        WHERE r.is_deleted = FALSE 
        AND (
            rt.responsible_dept_id = "#
    );
    query_builder.push_bind(department_id);
    query_builder.push(r#" OR EXISTS (SELECT 1 FROM request_sub_tasks rst WHERE rst.request_id = r.id AND rst.responsible_dept_id = "#);
    query_builder.push_bind(department_id);
    query_builder.push("))");

    if let Some(cursor) = filter.cursor {
        query_builder.push(" AND r.id < ");
        query_builder.push_bind(cursor);
    }

    // 🔍 Dynamic Filters
    if let Some(search) = &filter.search {
        if !search.is_empty() {
            let search_pattern = format!("%{}%", search.to_lowercase());
            query_builder.push(" AND (LOWER(r.req_code) LIKE ");
            query_builder.push_bind(search_pattern.clone());
            query_builder.push(" OR LOWER(r.description) LIKE ");
            query_builder.push_bind(search_pattern.clone());
            query_builder.push(" OR LOWER(s.name) LIKE ");
            query_builder.push_bind(search_pattern.clone());
            query_builder.push(")");
        }
    }

    if let Some(status_id) = filter.status_id {
        query_builder.push(" AND r.status_id = ");
        query_builder.push_bind(status_id);
    }

    if let Some(start_date) = &filter.start_date {
        if !start_date.is_empty() {
            query_builder.push(" AND r.request_date >= ");
            query_builder.push_bind(start_date);
            query_builder.push("::TIMESTAMPTZ"); // 🌟 เพิ่ม Casting
        }
    }

    if let Some(end_date) = &filter.end_date {
        if !end_date.is_empty() {
            let end_date_full = format!("{} 23:59:59", end_date);
            query_builder.push(" AND r.request_date <= ");
            query_builder.push_bind(end_date_full);
            query_builder.push("::TIMESTAMPTZ"); // 🌟 เพิ่ม Casting
        }
    }

    query_builder.push(" ORDER BY r.id DESC LIMIT ");
    query_builder.push_bind(limit + 1);

    let mut requests = query_builder.build_query_as::<RequestItem>().fetch_all(&pool).await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    for req in &mut requests {
        let sub_tasks = sqlx::query_as::<_, SubTaskItem>(
            r#"
            SELECT 
                st.id, st.request_id, st.responsible_dept_id, d.name as department_name,
                st.status_id, ms.name_th as status_name, ms.badge_variant as status_variant, ms.color_class as status_color,
                st.description, st.plan_start_date, st.plan_finish_date,
                (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name, 'position', u.position, 'phone_number', u.phone_number)), '[]') FROM sub_task_assignees sta JOIN users u ON sta.assignee_id = u.id WHERE sta.sub_task_id = st.id) as assignees
            FROM request_sub_tasks st
            LEFT JOIN m_departments d ON st.responsible_dept_id = d.id
            LEFT JOIN m_status ms ON st.status_id = ms.id
            WHERE st.request_id = $1"#
        ).bind(req.id).fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

        if !sub_tasks.is_empty() {
            req.sub_tasks = Some(serde_json::json!(sub_tasks));
        }
    }

    let has_more = requests.len() > limit as usize;
    if has_more { requests.pop(); }
    let next_cursor = requests.last().map(|r| r.id);

    Ok(Json(CursorPaginatedResponse { data: requests, next_cursor, has_more }))
}

pub async fn get_my_assigned_tasks(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<CursorFilter>,
) -> Result<Json<CursorPaginatedResponse<RequestItem>>, ApiError> {
    let limit = filter.limit.unwrap_or(10);
    let user_id: i32 = claims.sub.parse().unwrap_or(0);
    
    let mut query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
        r#"
        SELECT 
            r.id, r.req_code, r.requester_id, u1.name AS requester_name,
            r.subject_id, s.name AS subject_name, t.name AS topic_name, rt.name AS type_name,
            rt.responsible_dept_id,
            r.phone_number, r.requirement, r.description, r.file_url,
            r.status_id, ms.name_th AS status_name, ms.badge_variant AS status_variant, ms.color_class AS status_color,
            r.request_date, r.recorded_by, u3.name AS recorded_by_name,
            r.plan_start_date, r.plan_finish_date, r.actual_start_date, r.actual_finish_date,
            (SELECT COALESCE(json_agg(json_build_object('id', u4.id, 'name', u4.name, 'position', u4.position, 'email', u4.email, 'phone_number', u4.phone_number)), '[]') FROM request_assignees ra2 LEFT JOIN users u4 ON ra2.assignee_id = u4.id WHERE ra2.request_id = r.id) AS assignees,
            (SELECT COALESCE(json_agg(json_build_object('step', ra.approve_step, 'approver_id', ra.approver_id, 'approver_name', u2.name, 'approval_type', ra.approval_type, 'status_id', ra.status_id, 'status_name', ams.name_th, 'comment', ra.comment, 'action_date', ra.action_date) ORDER BY ra.action_date ASC, ra.id ASC), '[]') FROM request_approvals ra LEFT JOIN users u2 ON ra.approver_id = u2.id LEFT JOIN m_status ams ON ra.status_id = ams.id WHERE ra.request_id = r.id) AS approvals
        FROM requests r
        LEFT JOIN m_status ms ON r.status_id = ms.id
        LEFT JOIN users u1 ON r.requester_id = u1.id
        LEFT JOIN m_subjects s ON r.subject_id = s.id
        LEFT JOIN m_topics t ON s.topic_id = t.id
        LEFT JOIN m_request_types rt ON t.type_id = rt.id
        LEFT JOIN users u3 ON r.recorded_by = u3.id
        WHERE r.is_deleted = FALSE 
        AND (
            EXISTS (SELECT 1 FROM request_assignees rasg WHERE rasg.request_id = r.id AND rasg.assignee_id = "#
    );
    query_builder.push_bind(user_id);
    query_builder.push(r#") OR EXISTS (SELECT 1 FROM request_sub_tasks rst JOIN sub_task_assignees sta ON rst.id = sta.sub_task_id WHERE rst.request_id = r.id AND sta.assignee_id = "#);
    query_builder.push_bind(user_id);
    query_builder.push("))");

    if let Some(cursor) = filter.cursor {
        query_builder.push(" AND r.id < ");
        query_builder.push_bind(cursor);
    }

    // 🔍 Dynamic Filters
    if let Some(search) = &filter.search {
        if !search.is_empty() {
            let search_pattern = format!("%{}%", search.to_lowercase());
            query_builder.push(" AND (LOWER(r.req_code) LIKE ");
            query_builder.push_bind(search_pattern.clone());
            query_builder.push(" OR LOWER(r.description) LIKE ");
            query_builder.push_bind(search_pattern.clone());
            query_builder.push(" OR LOWER(s.name) LIKE ");
            query_builder.push_bind(search_pattern.clone());
            query_builder.push(")");
        }
    }

    if let Some(status_id) = filter.status_id {
        query_builder.push(" AND r.status_id = ");
        query_builder.push_bind(status_id);
    }

    if let Some(start_date) = &filter.start_date {
        if !start_date.is_empty() {
            query_builder.push(" AND r.request_date >= ");
            query_builder.push_bind(start_date);
            query_builder.push("::TIMESTAMPTZ"); // 🌟 เพิ่ม Casting
        }
    }

    if let Some(end_date) = &filter.end_date {
        if !end_date.is_empty() {
            let end_date_full = format!("{} 23:59:59", end_date);
            query_builder.push(" AND r.request_date <= ");
            query_builder.push_bind(end_date_full);
            query_builder.push("::TIMESTAMPTZ"); // 🌟 เพิ่ม Casting
        }
    }

    query_builder.push(" ORDER BY r.id DESC LIMIT ");
    query_builder.push_bind(limit + 1);

    let mut requests = query_builder.build_query_as::<RequestItem>().fetch_all(&pool).await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    for req in &mut requests {
        let sub_tasks = sqlx::query_as::<_, SubTaskItem>(
            r#"
            SELECT 
                st.id, st.request_id, st.responsible_dept_id, d.name as department_name,
                st.status_id, ms.name_th as status_name, ms.badge_variant as status_variant, ms.color_class as status_color,
                st.description, st.plan_start_date, st.plan_finish_date,
                (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name, 'position', u.position, 'phone_number', u.phone_number)), '[]') FROM sub_task_assignees sta JOIN users u ON sta.assignee_id = u.id WHERE sta.sub_task_id = st.id) as assignees
            FROM request_sub_tasks st
            LEFT JOIN m_departments d ON st.responsible_dept_id = d.id
            LEFT JOIN m_status ms ON st.status_id = ms.id
            WHERE st.request_id = $1"#
        ).bind(req.id).fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

        if !sub_tasks.is_empty() {
            req.sub_tasks = Some(serde_json::json!(sub_tasks));
        }
    }

    let has_more = requests.len() > limit as usize;
    if has_more { requests.pop(); }
    let next_cursor = requests.last().map(|r| r.id);

    Ok(Json(CursorPaginatedResponse { data: requests, next_cursor, has_more }))
}

pub async fn get_department_agents(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<UserResponse>>, ApiError> {
    let department_id = claims.department_id.ok_or_else(|| 
        ApiError::BadRequest("ไม่พบข้อมูลแผนกใน Token ของคุณ".to_string())
    )?;

    let query = r#"
        SELECT u.id, u.employee_code, u.username, u.name, u.email, u.role, u.position, u.department_id, u.phone_number, d.name as department
        FROM users u LEFT JOIN m_departments d ON u.department_id = d.id
        WHERE u.department_id = $1 AND u.role IN ('user', 'admin', 'agent', 'manager') AND u.is_active = TRUE
        ORDER BY u.name ASC"#;
    let agents = sqlx::query_as::<_, UserResponse>(query).bind(department_id).fetch_all(&pool).await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok(Json(agents))
}

pub async fn update_assignees(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<UpdateAssigneesPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    // 🛡️ [PERMISSION] เฉพาะ Admin หรือแผนกรับผิดชอบหลัก
    let req_data = sqlx::query!(
        r#"
        SELECT r.status_id, rt.responsible_dept_id 
        FROM requests r 
        JOIN m_subjects s ON r.subject_id = s.id 
        JOIN m_topics t ON s.topic_id = t.id 
        JOIN m_request_types rt ON t.type_id = rt.id 
        WHERE r.id = $1
        "#, 
        request_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|_| ApiError::NotFound("ไม่พบข้อมูลใบงาน".to_string()))?;

    let user_dept_id = claims.department_id.unwrap_or(0);
    if claims.role != "admin" && req_data.responsible_dept_id != Some(user_dept_id) {
        return Err(ApiError::Forbidden("ไม่มีสิทธิ์จัดการผู้รับผิดชอบงานหลัก".to_string()));
    }

    let current_status = req_data.status_id.unwrap_or(0);
    if [4, 5].contains(&current_status) {
        return Err(ApiError::BadRequest("ไม่สามารถแก้ไขผู้รับผิดชอบได้ เนื่องจากใบงานถูกปิดหรือยกเลิกแล้ว".to_string()));
    }

    let mut tx = pool.begin().await?;
    sqlx::query!("DELETE FROM request_assignees WHERE request_id = $1", request_id).execute(&mut *tx).await?;
    for agent_id in &payload.assignee_ids {
        sqlx::query!("INSERT INTO request_assignees (request_id, assignee_id, assigned_by) VALUES ($1, $2, $3)", request_id, agent_id, claims.sub.parse::<i32>().unwrap_or(0)).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "สำเร็จ" }))))
}

pub async fn start_task(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<StartTaskPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    // 🛡️ [PERMISSION]
    let req_data = sqlx::query!(
        r#"
        SELECT r.status_id, rt.responsible_dept_id 
        FROM requests r 
        JOIN m_subjects s ON r.subject_id = s.id 
        JOIN m_topics t ON s.topic_id = t.id 
        JOIN m_request_types rt ON t.type_id = rt.id 
        WHERE r.id = $1
        "#, 
        request_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|_| ApiError::NotFound("ไม่พบข้อมูลใบงาน".to_string()))?;

    let user_dept_id = claims.department_id.unwrap_or(0);
    if claims.role != "admin" && req_data.responsible_dept_id != Some(user_dept_id) {
        return Err(ApiError::Forbidden("คุณไม่มีสิทธิ์เริ่มงานนี้ เฉพาะแผนกที่รับผิดชอบหลักเท่านั้น".to_string()));
    }

    let current_status = req_data.status_id.unwrap_or(0);
    if [4, 5].contains(&current_status) {
        return Err(ApiError::BadRequest("ไม่สามารถเริ่มงานได้ เนื่องจากใบงานถูกปิดหรือยกเลิกแล้ว".to_string()));
    }
    if [2, 7, 8, 10].contains(&current_status) {
        return Err(ApiError::BadRequest("ไม่สามารถเริ่มงานได้ เนื่องจากใบงานยังอยู่ระหว่างขั้นตอนการอนุมัติ".to_string()));
    }

    let current_user_id: i32 = claims.sub.parse().unwrap_or(0);
    sqlx::query!("UPDATE requests SET plan_start_date = $1, plan_finish_date = $2, actual_start_date = NOW(), status_id = 3 WHERE id = $3 AND is_deleted = FALSE",
        payload.plan_start_date, payload.plan_finish_date, request_id
    ).execute(&pool).await?;

    sqlx::query!(
        "INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) VALUES ($1, $2, 99, 'START_TASK', 3, 'ช่างเริ่มดำเนินการ', NOW())",
        request_id, current_user_id
    ).execute(&pool).await?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "เริ่มดำเนินการเรียบร้อยแล้ว" }))))
}

pub async fn close_task(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<CloseTaskPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    // 🛡️ [PERMISSION]
    let req_data = sqlx::query!(
        r#"
        SELECT r.status_id, rt.responsible_dept_id 
        FROM requests r 
        JOIN m_subjects s ON r.subject_id = s.id 
        JOIN m_topics t ON s.topic_id = t.id 
        JOIN m_request_types rt ON t.type_id = rt.id 
        WHERE r.id = $1
        "#, 
        request_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|_| ApiError::NotFound("ไม่พบข้อมูลใบงาน".to_string()))?;

    let user_dept_id = claims.department_id.unwrap_or(0);
    if claims.role != "admin" && req_data.responsible_dept_id != Some(user_dept_id) {
        return Err(ApiError::Forbidden("คุณไม่มีสิทธิ์ปิดงานนี้ เฉพาะแผนกที่รับผิดชอบหลักเท่านั้น".to_string()));
    }

    let current_status = req_data.status_id.unwrap_or(0);
    if current_status == 4 || current_status == 5 {
        return Err(ApiError::BadRequest("ไม่สามารถปิดงานได้ เนื่องจากใบงานถูกปิดหรือยกเลิกแล้ว".to_string()));
    }
    if current_status != 3 {
        return Err(ApiError::BadRequest("ไม่สามารถปิดงานได้ เนื่องจากใบงานยังไม่ได้เริ่มดำเนินการ".to_string()));
    }

    let current_user_id: i32 = claims.sub.parse().unwrap_or(0);
    sqlx::query!("UPDATE requests SET actual_finish_date = $1, status_id = 9 WHERE id = $2 AND is_deleted = FALSE",
        payload.actual_finish_date, request_id
    ).execute(&pool).await?;

    sqlx::query!(
        "INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) VALUES ($1, $2, 100, 'CLOSE_TASK', 9, $3, NOW())",
        request_id, current_user_id, payload.remark
    ).execute(&pool).await?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "บันทึกปิดงานสำเร็จ รอผู้แจ้งตรวจรับงาน" }))))
}

pub async fn verify_task(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<VerifyTaskPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    // 🛡️ [CHECK STATUS]
    let req_data = sqlx::query!("SELECT status_id, requester_id FROM requests WHERE id = $1", request_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| ApiError::NotFound("ไม่พบข้อมูลใบงาน".to_string()))?;

    let current_status = req_data.status_id.unwrap_or(0);
    if current_status != 9 {
        return Err(ApiError::BadRequest("ใบงานนี้ไม่ได้อยู่ในสถานะรอตรวจรับงาน".to_string()));
    }

    let current_user_id: i32 = claims.sub.parse().unwrap_or(0);
    // (Optional) เช็คสิทธิ์เฉพาะผู้แจ้ง (requester) หรือ Admin
    if claims.role != "admin" && req_data.requester_id != current_user_id {
        return Err(ApiError::Forbidden("เฉพาะผู้แจ้งงานเท่านั้นที่สามารถตรวจรับงานได้".to_string()));
    }

    let new_status_id = if payload.is_approved { 4 } else { 3 };
    sqlx::query!("UPDATE requests SET status_id = $1 WHERE id = $2 AND is_deleted = FALSE", new_status_id, request_id).execute(&pool).await?;

    sqlx::query!(
        "INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) VALUES ($1, $2, 101, $3, $4, $5, NOW())",
        request_id, current_user_id, if payload.is_approved { "VERIFY_PASS" } else { "VERIFY_REJECT" }, new_status_id, payload.remark
    ).execute(&pool).await?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "ตรวจรับงานเรียบร้อย" }))))
}

pub async fn create_sub_tasks(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<i32>,
    Json(payload): Json<CreateSubTasksPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    // 🛡️ [CHECK STATUS]
    let req_data = sqlx::query!("SELECT status_id FROM requests WHERE id = $1", request_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| ApiError::NotFound("ไม่พบข้อมูลใบงาน".to_string()))?;

    let current_status = req_data.status_id.unwrap_or(0);
    if [4, 5].contains(&current_status) {
        return Err(ApiError::BadRequest("ไม่สามารถสร้างงานย่อยได้ เนื่องจากใบงานหลักถูกปิดหรือยกเลิกแล้ว".to_string()));
    }

    let current_user_id: i32 = claims.sub.parse().unwrap_or(0);
    let mut tx = pool.begin().await?;
    for st in payload.sub_tasks {
        sqlx::query!("INSERT INTO request_sub_tasks (request_id, responsible_dept_id, description, status_id, plan_start_date, plan_finish_date) VALUES ($1, $2, $3, 1, $4, $5)", request_id, st.responsible_dept_id, st.description, st.plan_start_date, st.plan_finish_date).execute(&mut *tx).await?;
    }
    sqlx::query!("INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) VALUES ($1, $2, 98, 'SUB_TASK_CREATED', 1, 'มีการแตกงานย่อยไปยังแผนกอื่น', NOW())", request_id, current_user_id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(serde_json::json!({ "message": "สร้างงานย่อยสำเร็จ" }))))
}

pub async fn update_sub_task_status(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path((_request_id, sub_task_id)): Path<(i32, i32)>,
    Json(payload): Json<UpdateSubTaskStatusPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    let current_user_id: i32 = claims.sub.parse().unwrap_or(0);
    let user_dept_id = claims.department_id.unwrap_or(0);
    let is_admin = claims.role == "admin";
    let is_agent_or_manager = claims.role == "agent" || claims.role == "manager";
    let sub_task = sqlx::query!("SELECT responsible_dept_id, request_id, description FROM request_sub_tasks WHERE id = $1", sub_task_id).fetch_one(&pool).await?;
    if !is_admin && !(is_agent_or_manager && sub_task.responsible_dept_id == Some(user_dept_id)) {
        return Err(ApiError::Forbidden("ไม่มีสิทธิ์จัดการงานย่อยของแผนกอื่น".to_string()));
    }
    sqlx::query!("UPDATE request_sub_tasks SET status_id = $1, description = $2, plan_start_date = $3, plan_finish_date = $4 WHERE id = $5", payload.status_id, payload.description.or(sub_task.description), payload.plan_start_date, payload.plan_finish_date, sub_task_id).execute(&pool).await?;
    sqlx::query!("INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) VALUES ($1, $2, 98, 'SUB_TASK_UPDATED', $3, 'อัปเดตสถานะงานย่อย', NOW())", sub_task.request_id, current_user_id, payload.status_id).execute(&pool).await?;
    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "อัปเดตสำเร็จ" }))))
}

pub async fn delete_sub_task(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path((_request_id, sub_task_id)): Path<(i32, i32)>,
) -> Result<StatusCode, ApiError> {
    let is_admin = claims.role == "admin";
    let sub_task = sqlx::query!("SELECT request_id, status_id FROM request_sub_tasks WHERE id = $1", sub_task_id).fetch_one(&pool).await?;
    if sub_task.status_id != Some(1) && !is_admin { return Err(ApiError::BadRequest("ไม่สามารถลบงานย่อยที่เริ่มแล้วได้".to_string())); }
    let req_info = sqlx::query!(r#"SELECT rt.responsible_dept_id FROM requests r JOIN m_subjects s ON r.subject_id = s.id JOIN m_topics t ON s.topic_id = t.id JOIN m_request_types rt ON t.type_id = rt.id WHERE r.id = $1"#, sub_task.request_id).fetch_one(&pool).await?;
    if !is_admin && req_info.responsible_dept_id != Some(claims.department_id.unwrap_or(0)) { return Err(ApiError::Forbidden("ไม่มีสิทธิ์".to_string())); }
    sqlx::query!("DELETE FROM request_sub_tasks WHERE id = $1", sub_task_id).execute(&pool).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn assign_sub_task_members(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path((_request_id, sub_task_id)): Path<(i32, i32)>,
    Json(payload): Json<AssignSubTaskMembersPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    let current_user_id: i32 = claims.sub.parse().unwrap_or(0);
    let user_dept_id = claims.department_id.unwrap_or(0);
    let sub_task = sqlx::query!("SELECT responsible_dept_id, request_id FROM request_sub_tasks WHERE id = $1", sub_task_id).fetch_one(&pool).await?;
    if claims.role != "admin" && sub_task.responsible_dept_id != Some(user_dept_id) { return Err(ApiError::Forbidden("ไม่มีสิทธิ์".to_string())); }
    let mut tx = pool.begin().await?;
    sqlx::query!("DELETE FROM sub_task_assignees WHERE sub_task_id = $1", sub_task_id).execute(&mut *tx).await?;
    for agent_id in &payload.assignee_ids {
        sqlx::query!("INSERT INTO sub_task_assignees (sub_task_id, assignee_id, assigned_by) VALUES ($1, $2, $3)", sub_task_id, agent_id, current_user_id).execute(&mut *tx).await?;
    }
    sqlx::query!("INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id, comment, action_date) VALUES ($1, $2, 98, 'SUB_TASK_ASSIGNED', 3, 'มอบหมายคนทำงานย่อย', NOW())", sub_task.request_id, current_user_id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "สำเร็จ" }))))
}
