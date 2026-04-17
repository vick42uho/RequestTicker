use axum::{
    extract::{Multipart, Path, State, Extension, Query},
    http::StatusCode,
    Json,
};
use sqlx::{PgPool, Postgres, QueryBuilder};
use tokio::{fs::File, io::AsyncWriteExt};
use uuid::Uuid;
use validator::Validate;

use super::models::{
    RequestItem, UpdateRequest, MasterRequestType, MasterTopic, MasterSubject, 
    CreateRequestPayload, PendingApprovalResponse, ApprovalActionPayload,
    RequestFilter, PaginatedResponse, ApprovalPaginatedResponse, DashboardStats, DailyStat
};
use crate::error::ApiError;
use crate::user::models::Claims;

//use std::fs; // 🆕 นำเข้าโมดูลจัดการไฟล์
use crate::request::models::DeleteFilesPayload;

use crate::user::models::UserResponse;


pub async fn create_request(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateRequestPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> { 
    if let Err(e) = payload.validate() {
        return Err(ApiError::BadRequest(e.to_string()));
    }

    let requester_id: i32 = claims.sub.parse().map_err(|_| {
        ApiError::InternalServerError("ข้อมูล User ID ใน Token ไม่ถูกต้อง".to_string())
    })?;

    // 🌟 1. ดึงเงื่อนไขการอนุมัติ "ทั้ง 2 ฝั่ง"
    let subject_info = sqlx::query!(
        r#"
        SELECT 
            s.requires_approval, 
            s.requires_receiver_approval, -- 🌟 ดึงฟิลด์ที่เราเพิ่งสร้างใหม่
            rt.responsible_dept_id 
        FROM m_subjects s
        JOIN m_topics t ON s.topic_id = t.id
        JOIN m_request_types rt ON t.type_id = rt.id
        WHERE s.id = $1
        "#,
        payload.subject_id
    )
    .fetch_one(&pool).await
    .map_err(|_| ApiError::NotFound("ไม่พบข้อมูลหัวข้อปัญหา หรือการตั้งค่าหมวดหมู่ไม่สมบูรณ์".to_string()))?;

    let req_approval = subject_info.requires_approval.unwrap_or(false);
    
    // (หมายเหตุ: ถ้าบรรทัดนี้ตอน Compile แจ้ง Error ให้เติม .unwrap_or(false) ต่อท้ายนะครับ)
    let req_receiver_approval = subject_info.requires_receiver_approval; 

    // 🌟 2. กำหนดสถานะตั้งต้นให้ใบงาน
    // ถ้าฝั่งใดฝั่งหนึ่งต้องอนุมัติ -> สถานะตั้งต้นคือ 2 (รออนุมัติ)
    // ถ้าไม่ต้องอนุมัติเลยทั้งคู่ -> สถานะตั้งต้นคือ 1 (รอรับงาน ทะลุไปแผนกที่รับผิดชอบเลย)
    let initial_status_id = if req_approval || req_receiver_approval { 2 } else { 1 };

    let new_uuid = Uuid::new_v4().to_string();
    let req_code = format!("REQ-{}", &new_uuid[0..8].to_uppercase());

    // 🚨 เปิด Transaction ป้องกันข้อมูลเข้าไม่ครบ
    let mut tx = pool.begin().await.map_err(|e| {
        ApiError::InternalServerError(format!("ไม่สามารถเริ่ม Transaction ได้: {}", e))
    })?;

    // 🌟 3. บันทึกใบงานหลักลงตาราง requests
    let insert_req_query = r#"
        INSERT INTO requests (
            req_code, requester_id, subject_id, phone_number, requirement, 
            description, status_id, recorded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING id
    "#;

    let new_req_id: (i32,) = sqlx::query_as(insert_req_query)
        .bind(&req_code)
        .bind(requester_id)
        .bind(payload.subject_id)
        .bind(&payload.phone_number)
        .bind(&payload.requirement)
        .bind(&payload.description)
        .bind(initial_status_id)
        .bind(requester_id)
        .fetch_one(&mut *tx).await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    // ===============================================
    // 🌟 4. สร้างคิวการอนุมัติ (Dynamic Routing)
    // ===============================================
    let mut current_step = 1; // ตัวแปรนับว่าตอนนี้อยู่คิวที่เท่าไหร่

    // 🟡 4.1 คิวอนุมัติ "ฝั่งผู้แจ้ง" (ถ้ามี)
    if req_approval {
        if let Some(apps) = &payload.approvers {
            for app in apps { 
                let step_status_id = if app.step == 1 { 2 } else { 7 };

                sqlx::query(
                    "INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id) VALUES ($1, $2, $3, $4, $5)"
                )
                .bind(new_req_id.0)
                .bind(app.approver_id)
                .bind(app.step)
                .bind(&app.approval_type)
                .bind(step_status_id)
                .execute(&mut *tx).await
                .map_err(|e| ApiError::InternalServerError(e.to_string()))?;
                
                current_step = app.step + 1; // อัปเดตตัวนับคิวให้บวก 1 เตรียมไว้ให้คิวถัดไป
            }
        } else {
            return Err(ApiError::BadRequest("หัวข้อนี้ต้องได้รับการอนุมัติจากผู้แจ้ง กรุณาระบุผู้อนุมัติมาด้วย".to_string()));
        }
    }

    // 🟢 4.2 คิวอนุมัติ "ฝั่งผู้รับงาน" (ถ้ามี) - ระบบจะปั้นคิวนี้ต่อท้ายให้เอง!
    if req_receiver_approval {
        // ถ้าไม่มีคิวฝั่งผู้แจ้งมาก่อนหน้านี้เลย (current_step = 1) ก็ให้ตื่นมารออนุมัติ (2)
        // แต่ถ้ามีฝั่งผู้แจ้งบังหน้าอยู่ ให้หลับรอ (7) ไปก่อน
        let step_status_id = if current_step == 1 { 2 } else { 7 };

        sqlx::query(
            "INSERT INTO request_approvals (request_id, approve_step, approval_type, status_id) VALUES ($1, $2, 'RECEIVER_DEPT', $3)"
        )
        .bind(new_req_id.0)
        .bind(current_step) // ต่อคิวตามตัวนับล่าสุด
        .bind(step_status_id)
        .execute(&mut *tx).await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    }

    // ยืนยันการบันทึก
    tx.commit().await.map_err(|e| {
        ApiError::InternalServerError(format!("ไม่สามารถยืนยันการบันทึกได้: {}", e))
    })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "message": "สร้างใบงานสำเร็จ",
            "request_id": new_req_id.0,
            "req_code": req_code,
            "responsible_dept_id": subject_info.responsible_dept_id
        })),
    ))
}



pub async fn get_dashboard_stats(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DashboardStats>, ApiError> {
    let user_id: i32 = claims.sub.parse().unwrap_or(0);
    let role = claims.role.as_str();

    // ดึง department_id เพื่อใช้กรองกรณีเป็น Agent/Manager
    let user_info = sqlx::query!("SELECT department_id FROM users WHERE id = $1", user_id)
        .fetch_optional(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    let department_id = user_info.and_then(|u| u.department_id).unwrap_or(0);

    // SQL สำหรับนับแยกตามสถานะ โดยใช้ Timezone Asia/Bangkok เพื่อความแม่นยำ
    let stats = sqlx::query!(
        r#"
        SELECT 
            COUNT(DISTINCT r.id) FILTER (
                WHERE 
                -- 1. งานที่รอคนๆ นี้อนุมัติโดยตรง
                EXISTS (
                    SELECT 1 FROM request_approvals ra 
                    WHERE ra.request_id = r.id 
                    AND ra.status_id = 2 
                    AND (
                        ra.approver_id = $3 
                        OR (
                            ra.approver_id IS NULL 
                            AND ra.approval_type = 'RECEIVER_DEPT' 
                            AND rt.responsible_dept_id = $2
                        )
                    )
                )
                -- 2. งานที่รอรับเข้าแผนก (งานหลักหรืองานย่อย)
                OR (
                    r.status_id IN (1, 8) 
                    AND (rt.responsible_dept_id = $2 OR EXISTS (SELECT 1 FROM request_sub_tasks rst WHERE rst.request_id = r.id AND rst.responsible_dept_id = $2))
                    AND $1 IN ('agent', 'manager')
                )
            ) as pending,
            COUNT(DISTINCT r.id) FILTER (WHERE r.status_id = 3) as in_progress,
            COUNT(DISTINCT r.id) FILTER (WHERE r.status_id = 9) as waiting_verify,
            COUNT(DISTINCT r.id) FILTER (WHERE (r.status_id = 4 OR r.status_id = 9) AND (r.actual_finish_date AT TIME ZONE 'Asia/Bangkok')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date) as completed_today
        FROM requests r
        LEFT JOIN users u ON r.requester_id = u.id
        LEFT JOIN m_subjects s ON r.subject_id = s.id
        LEFT JOIN m_topics t ON s.topic_id = t.id
        LEFT JOIN m_request_types rt ON t.type_id = rt.id
        WHERE r.is_deleted = FALSE
        AND (
            $1 = 'admin' -- Admin เห็นทั้งหมด
            OR (
                $1 IN ('agent', 'manager') AND (
                    rt.responsible_dept_id = $2
                    OR EXISTS (SELECT 1 FROM request_sub_tasks rst WHERE rst.request_id = r.id AND rst.responsible_dept_id = $2)
                    OR u.department_id = $2
                    OR EXISTS (
                        SELECT 1 FROM request_approvals ra 
                        WHERE ra.request_id = r.id AND ra.approver_id = $3
                    )
                )
            )
            OR r.requester_id = $3
        )
        "#,
        role,           // $1
        department_id,  // $2
        user_id         // $3
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok(Json(DashboardStats {
        pending: stats.pending.unwrap_or(0),
        in_progress: stats.in_progress.unwrap_or(0),
        waiting_verify: stats.waiting_verify.unwrap_or(0),
        completed_today: stats.completed_today.unwrap_or(0),
    }))
}

#[derive(serde::Deserialize)]
pub struct DailyStatsFilter {
    pub days: Option<i32>,
}

pub async fn get_daily_stats(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<DailyStatsFilter>,
) -> Result<Json<Vec<DailyStat>>, ApiError> {
    let user_id: i32 = claims.sub.parse().unwrap_or(0);
    let role = claims.role.as_str();
    let days = filter.days.unwrap_or(30);

    let user_info = sqlx::query!("SELECT department_id FROM users WHERE id = $1", user_id)
        .fetch_optional(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    let department_id = user_info.and_then(|u| u.department_id).unwrap_or(0);

    // SQL สำหรับดึงสถิติรายวัน (Timezone Aware)
    let query = r#"
        WITH date_series AS (
            SELECT generate_series(
                (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date - ($1 || ' day')::interval,
                (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date,
                '1 day'::interval
            )::date as stat_date
        )
        SELECT 
            TO_CHAR(ds.stat_date, 'YYYY-MM-DD') as date,
            COUNT(DISTINCT r1.id) as requests,
            COUNT(DISTINCT r2.id) as completed
        FROM date_series ds
        LEFT JOIN requests r1 ON (r1.request_date AT TIME ZONE 'Asia/Bangkok')::date = ds.stat_date AND r1.is_deleted = FALSE
            AND (
                $2 = 'admin'
                OR (EXISTS (
                    SELECT 1 FROM m_subjects s 
                    JOIN m_topics t ON s.topic_id = t.id 
                    JOIN m_request_types rt ON t.type_id = rt.id 
                    LEFT JOIN users u ON r1.requester_id = u.id
                    WHERE s.id = r1.subject_id 
                    AND (
                        rt.responsible_dept_id = $3 
                        OR EXISTS (SELECT 1 FROM request_sub_tasks rst WHERE rst.request_id = r1.id AND rst.responsible_dept_id = $3)
                        OR u.department_id = $3
                        OR EXISTS (
                            SELECT 1 FROM request_approvals ra 
                            WHERE ra.request_id = r1.id AND ra.approver_id = $4
                        )
                    )
                    AND $2 IN ('agent', 'manager')
                ))
                OR r1.requester_id = $4
            )
        LEFT JOIN requests r2 ON (r2.actual_finish_date AT TIME ZONE 'Asia/Bangkok')::date = ds.stat_date AND r2.is_deleted = FALSE
            AND r2.status_id IN (4, 9)
            AND (
                $2 = 'admin'
                OR (EXISTS (
                    SELECT 1 FROM m_subjects s 
                    JOIN m_topics t ON s.topic_id = t.id 
                    JOIN m_request_types rt ON t.type_id = rt.id 
                    LEFT JOIN users u ON r2.requester_id = u.id
                    WHERE s.id = r2.subject_id 
                    AND (
                        rt.responsible_dept_id = $3 
                        OR EXISTS (SELECT 1 FROM request_sub_tasks rst WHERE rst.request_id = r2.id AND rst.responsible_dept_id = $3)
                        OR u.department_id = $3
                        OR EXISTS (
                            SELECT 1 FROM request_approvals ra 
                            WHERE ra.request_id = r2.id AND ra.approver_id = $4
                        )
                    )
                    AND $2 IN ('agent', 'manager')
                ))
                OR r2.requester_id = $4
            )
        GROUP BY ds.stat_date
        ORDER BY ds.stat_date ASC
    "#;

    let stats = sqlx::query_as::<_, DailyStat>(query)
        .bind(days)            // $1
        .bind(role)            // $2
        .bind(department_id)    // $3
        .bind(user_id)          // $4
        .fetch_all(&pool)
        .await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok(Json(stats))
}

pub async fn get_requests(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<RequestFilter>,
) -> Result<Json<PaginatedResponse<RequestItem>>, ApiError> {

    let user_id: i32 = claims.sub.parse().unwrap_or(0);
    let role = claims.role.as_str();
    let user_info = sqlx::query!("SELECT department_id FROM users WHERE id = $1", user_id)
        .fetch_optional(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    let department_id = user_info.and_then(|u| u.department_id).unwrap_or(0);

    let filter = params.filter.unwrap_or_else(|| "dept".to_string());
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(10).max(1).min(100); 
    let offset = (page - 1) * limit;

    // --- 1. สร้าง Query ดึงข้อมูล (Requests) ---
    let mut query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
        r#"
        SELECT 
            r.id, r.req_code, 
            r.requester_id, u1.name AS requester_name, 
            r.subject_id, s.name AS subject_name, t.name AS topic_name, rt.name AS type_name,
            rt.responsible_dept_id,
            r.phone_number, r.requirement, r.description, r.file_url,  
            r.request_date, r.recorded_by, u3.name AS recorded_by_name,
            r.status_id, ms.name_th AS status_name, ms.badge_variant AS status_variant, ms.color_class AS status_color,
            r.plan_start_date, r.plan_finish_date, r.actual_start_date, r.actual_finish_date,
            (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'id', st.id,
                        'request_id', st.request_id,
                        'responsible_dept_id', st.responsible_dept_id,
                        'department_name', d2.name,
                        'status_id', st.status_id,
                        'status_name', ams2.name_th,
                        'status_variant', ams2.badge_variant,
                        'status_color', ams2.color_class,
                        'description', st.description,
                        'plan_start_date', st.plan_start_date,
                        'plan_finish_date', st.plan_finish_date,
                        'assignees', (
                            SELECT COALESCE(json_agg(
                                json_build_object(
                                    'id', u_sub.id,
                                    'name', u_sub.name,
                                    'phone_number', u_sub.phone_number,
                                    'position', u_sub.position
                                )
                            ), '[]')
                            FROM sub_task_assignees sta
                            JOIN users u_sub ON sta.assignee_id = u_sub.id
                            WHERE sta.sub_task_id = st.id
                        )
                    )
                ), '[]')
                FROM request_sub_tasks st
                LEFT JOIN m_departments d2 ON st.responsible_dept_id = d2.id
                LEFT JOIN m_status ams2 ON st.status_id = ams2.id
                WHERE st.request_id = r.id
            ) AS sub_tasks,
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
        "#
    );

    // --- 2. สร้าง Query นับจำนวนทั้งหมด (Total Count) ---
    let mut count_builder: QueryBuilder<Postgres> = QueryBuilder::new(
        "SELECT COUNT(DISTINCT r.id) FROM requests r 
         LEFT JOIN m_subjects s ON r.subject_id = s.id 
         LEFT JOIN m_topics t ON s.topic_id = t.id 
         LEFT JOIN m_request_types rt ON t.type_id = rt.id 
         LEFT JOIN users u1 ON r.requester_id = u1.id
         WHERE r.is_deleted = FALSE"
    );

    // 🛡️ Logic การเข้าถึงข้อมูล (เดิม)
    let permission_sql = match (role, filter.as_str()) {
        ("admin", "all") => "".to_string(),
        (_, "me") => format!(" AND r.requester_id = {}", user_id),
        (_, "dept_tasks") | ("agent", "all") | ("manager", "all") => 
            format!(" AND (rt.responsible_dept_id = {} OR EXISTS (SELECT 1 FROM request_sub_tasks rst WHERE rst.request_id = r.id AND rst.responsible_dept_id = {}))", department_id, department_id),
        (_, "my_tasks") => 
            format!(" AND (EXISTS (SELECT 1 FROM request_assignees ra WHERE ra.request_id = r.id AND ra.assignee_id = {}) OR EXISTS (SELECT 1 FROM request_sub_tasks rst JOIN sub_task_assignees sta ON rst.id = sta.sub_task_id WHERE rst.request_id = r.id AND sta.assignee_id = {}))", user_id, user_id),
        _ => format!(" AND u1.department_id = {}", department_id),
    };

    query_builder.push(&permission_sql);
    count_builder.push(&permission_sql);

    // 🔍 3. เพิ่มตัวกรอง Dynamic (Search, Status, Date)
    if let Some(search) = &params.search {
        if !search.is_empty() {
            let search_pattern = format!("%{}%", search.to_lowercase());
            query_builder.push(" AND (LOWER(r.req_code) LIKE ");
            query_builder.push_bind(search_pattern.clone());
            query_builder.push(" OR LOWER(r.description) LIKE ");
            query_builder.push_bind(search_pattern.clone());
            query_builder.push(" OR LOWER(s.name) LIKE ");
            query_builder.push_bind(search_pattern.clone());
            query_builder.push(")");

            count_builder.push(" AND (LOWER(r.req_code) LIKE ");
            count_builder.push_bind(search_pattern.clone());
            count_builder.push(" OR LOWER(r.description) LIKE ");
            count_builder.push_bind(search_pattern.clone());
            count_builder.push(" OR LOWER(s.name) LIKE ");
            count_builder.push_bind(search_pattern.clone());
            count_builder.push(")");
        }
    }

    if let Some(status_ids_str) = &params.status_ids {
        if !status_ids_str.is_empty() {
            let ids: Vec<i32> = status_ids_str.split(',').filter_map(|s| s.parse().ok()).collect();
            if !ids.is_empty() {
                query_builder.push(" AND r.status_id = ANY(");
                query_builder.push_bind(ids.clone());
                query_builder.push(")");
                
                count_builder.push(" AND r.status_id = ANY(");
                count_builder.push_bind(ids);
                count_builder.push(")");
            }
        }
    }

    if let Some(type_ids_str) = &params.type_ids {
        if !type_ids_str.is_empty() {
            let ids: Vec<i32> = type_ids_str.split(',').filter_map(|s| s.parse().ok()).collect();
            if !ids.is_empty() {
                query_builder.push(" AND rt.id = ANY(");
                query_builder.push_bind(ids.clone());
                query_builder.push(")");

                count_builder.push(" AND rt.id = ANY(");
                count_builder.push_bind(ids);
                count_builder.push(")");
            }
        }
    }

    if let Some(req_name) = &params.requester_name {
        if !req_name.is_empty() {
            let name_pattern = format!("%{}%", req_name.to_lowercase());
            query_builder.push(" AND LOWER(u1.name) LIKE ");
            query_builder.push_bind(name_pattern.clone());
            count_builder.push(" AND LOWER(u1.name) LIKE ");
            count_builder.push_bind(name_pattern);
        }
    }

    if let Some(start_date) = &params.start_date {
        if !start_date.is_empty() {
            query_builder.push(" AND r.request_date >= ");
            query_builder.push_bind(start_date);
            query_builder.push("::TIMESTAMPTZ"); 
            count_builder.push(" AND r.request_date >= ");
            count_builder.push_bind(start_date);
            count_builder.push("::TIMESTAMPTZ"); 
        }
    }

    if let Some(end_date) = &params.end_date {
        if !end_date.is_empty() {
            let end_date_full = format!("{} 23:59:59", end_date);
            query_builder.push(" AND r.request_date <= ");
            query_builder.push_bind(end_date_full.clone());
            query_builder.push("::TIMESTAMPTZ"); 
            count_builder.push(" AND r.request_date <= ");
            count_builder.push_bind(end_date_full);
            count_builder.push("::TIMESTAMPTZ"); 
        }
    }

    // 4. สั่งรัน Query นับจำนวน
    let total_records: i64 = count_builder.build_query_as::<(i64,)>().fetch_one(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?.0;

    // 5. สั่งรัน Query ดึงข้อมูลพร้อม Pagination
    query_builder.push(" ORDER BY r.request_date DESC LIMIT ");
    query_builder.push_bind(limit);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);

    let requests = query_builder.build_query_as::<RequestItem>().fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    let total_pages = (total_records as f64 / limit as f64).ceil() as i64;

    Ok(Json(PaginatedResponse {
        data: requests,
        total_records,
        total_pages,
        current_page: page,
        limit,
    }))
}

pub async fn get_request(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
) -> Result<Json<RequestItem>, ApiError> {
    Ok(Json(get_request_by_id(&pool, id).await?))
}

pub async fn update_request(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
    Json(payload): Json<UpdateRequest>,
) -> Result<Json<RequestItem>, ApiError> {
    let subject_info = sqlx::query!(
        r#"SELECT s.requires_approval, s.requires_receiver_approval, rt.responsible_dept_id FROM m_subjects s JOIN m_topics t ON s.topic_id = t.id JOIN m_request_types rt ON t.type_id = rt.id WHERE s.id = $1"#,
        payload.subject_id
    ).fetch_one(&pool).await.map_err(|_| ApiError::NotFound("ไม่พบข้อมูล".to_string()))?;

    let new_status_id = if subject_info.requires_approval.unwrap_or(false) || subject_info.requires_receiver_approval { 2 } else { 1 };

    let mut tx = pool.begin().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    sqlx::query(r#"UPDATE requests SET subject_id = $1, description = $2, phone_number = $3, requirement = $4, status_id = $5 WHERE id = $6"#)
        .bind(payload.subject_id).bind(&payload.description).bind(&payload.phone_number).bind(&payload.requirement).bind(new_status_id).bind(id)
        .execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    sqlx::query("DELETE FROM request_approvals WHERE request_id = $1").bind(id).execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    let mut current_step = 1;
    if subject_info.requires_approval.unwrap_or(false) {
        if let Some(apps) = &payload.approvers {
            for app in apps {
                sqlx::query("INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id) VALUES ($1, $2, $3, $4, $5)")
                    .bind(id).bind(app.approver_id).bind(app.step).bind(&app.approval_type).bind(if app.step == 1 { 2 } else { 7 })
                    .execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
                current_step = app.step + 1;
            }
        }
    }

    if subject_info.requires_receiver_approval {
        sqlx::query("INSERT INTO request_approvals (request_id, approve_step, approval_type, status_id) VALUES ($1, $2, 'RECEIVER_DEPT', $3)")
            .bind(id).bind(current_step).bind(if current_step == 1 { 2 } else { 7 })
            .execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    }

    tx.commit().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok(Json(get_request_by_id(&pool, id).await?))
}

pub async fn delete_request(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<i32>,
) -> Result<StatusCode, ApiError> {
    let request_data = sqlx::query!("SELECT requester_id FROM requests WHERE id = $1 AND is_deleted = FALSE", id)
        .fetch_optional(&pool).await?.ok_or_else(|| ApiError::NotFound(format!("ไม่พบคำขอ ID: {}", id)))?;

    if claims.role != "admin" && request_data.requester_id != claims.sub.parse().unwrap_or(0) {
        return Err(ApiError::Forbidden("คุณไม่มีสิทธิ์".to_string()));
    }

    sqlx::query!("UPDATE requests SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1", id).execute(&pool).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn upload_request_files(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
    mut multipart: Multipart,
) -> Result<Json<RequestItem>, ApiError> {
    let _check = sqlx::query!("SELECT id FROM requests WHERE id = $1", id).fetch_optional(&pool).await.map_err(ApiError::from)?
        .ok_or_else(|| ApiError::NotFound(format!("ไม่พบคำขอ ID: {}", id)))?;

    let mut uploaded_urls = Vec::new();
    while let Some(field) = multipart.next_field().await.map_err(|e| ApiError::BadRequest(e.to_string()))? {
        let file_name = field.file_name().unwrap_or("").to_string();
        if file_name.is_empty() { continue; }
        let ext = file_name.split('.').last().unwrap_or("").to_lowercase();
        let unique_name = format!("{}.{}", Uuid::new_v4(), ext);
        let save_path = format!("uploads/{}", unique_name);
        let data = field.bytes().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        let mut file = File::create(&save_path).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        file.write_all(&data).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        uploaded_urls.push(format!("/uploads/{}", unique_name));
    }

    if !uploaded_urls.is_empty() {
        sqlx::query("UPDATE requests SET file_url = CONCAT_WS(',', NULLIF(file_url, ''), $1) WHERE id = $2")
            .bind(&uploaded_urls.join(",")).bind(id).execute(&pool).await?;
    }

    Ok(Json(get_request_by_id(&pool, id).await?))
}

pub async fn get_master_types(State(pool): State<PgPool>) -> Result<Json<Vec<MasterRequestType>>, ApiError> {
    Ok(Json(sqlx::query_as::<_, MasterRequestType>("SELECT id, name, description, responsible_dept_id FROM m_request_types WHERE del_flag = FALSE ORDER BY id ASC").fetch_all(&pool).await?))
}

pub async fn get_master_topics(State(pool): State<PgPool>, Path(type_id): Path<i32>) -> Result<Json<Vec<MasterTopic>>, ApiError> {
    Ok(Json(sqlx::query_as::<_, MasterTopic>("SELECT id, type_id, name FROM m_topics WHERE type_id = $1 AND del_flag = FALSE ORDER BY id ASC").bind(type_id).fetch_all(&pool).await?))
}

pub async fn get_master_subjects(State(pool): State<PgPool>, Path(topic_id): Path<i32>) -> Result<Json<Vec<MasterSubject>>, ApiError> {
    Ok(Json(sqlx::query_as::<_, MasterSubject>("SELECT id, topic_id, name, is_other, requires_approval, requires_receiver_approval FROM m_subjects WHERE topic_id = $1 AND del_flag = FALSE ORDER BY id ASC").bind(topic_id).fetch_all(&pool).await?))
}

pub async fn delete_request_files(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<i32>,
    Json(payload): Json<DeleteFilesPayload>
) -> Result<Json<RequestItem>, ApiError> {
    let record = sqlx::query!("SELECT requester_id, file_url FROM requests WHERE id = $1 AND is_deleted = FALSE", id)
        .fetch_optional(&pool).await?.ok_or_else(|| ApiError::NotFound("ไม่พบ".to_string()))?;

    if claims.role != "admin" && record.requester_id != claims.sub.parse().unwrap_or(0) {
        return Err(ApiError::Forbidden("คุณไม่มีสิทธิ์".to_string()));
    }

    let mut current_files: Vec<String> = record.file_url.unwrap_or_default().split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    for file_path in payload.files_to_delete {
        let db_path = if file_path.starts_with('/') { file_path.clone() } else { format!("/{}", file_path) };
        if current_files.contains(&db_path) {
            let clean = db_path.trim_start_matches('/');
            if clean.starts_with("uploads/") && !clean.contains("..") { let _ = std::fs::remove_file(clean); }
            current_files.retain(|f| f != &db_path);
        }
    }

    sqlx::query!("UPDATE requests SET file_url = $1 WHERE id = $2", if current_files.is_empty() { None } else { Some(current_files.join(",")) }, id).execute(&pool).await?;

    Ok(Json(get_request_by_id(&pool, id).await?))
}

pub async fn get_pending_approvals(State(pool): State<PgPool>, Extension(claims): Extension<Claims>, Query(filter): Query<RequestFilter>) -> Result<(StatusCode, Json<ApprovalPaginatedResponse<PendingApprovalResponse>>), ApiError> {
    let approver_id: i32 = claims.sub.parse().unwrap_or(0);
    let role = claims.role.clone(); 
    let page = filter.page.unwrap_or(1);
    let limit = filter.limit.unwrap_or(10);
    let target_status = if filter.filter.as_deref().unwrap_or("pending") == "waiting" { 7 } else { 2 };
    let user_info = sqlx::query!("SELECT department_id FROM users WHERE id = $1", approver_id).fetch_optional(&pool).await?;
    let department_id = user_info.and_then(|u| u.department_id).unwrap_or(0); 
    
    let query_base = r#"FROM request_approvals a LEFT JOIN m_status ms ON a.status_id = ms.id JOIN requests r ON a.request_id = r.id LEFT JOIN users u ON r.requester_id = u.id LEFT JOIN m_departments ud ON u.department_id = ud.id LEFT JOIN m_subjects s ON r.subject_id = s.id LEFT JOIN m_topics t ON s.topic_id = t.id LEFT JOIN m_request_types rt ON t.type_id = rt.id WHERE a.status_id IN (2, 7) AND r.status_id NOT IN (4, 5) AND ((a.approver_id = $1) OR (a.approver_id IS NULL AND a.approval_type = 'RECEIVER_DEPT' AND ($2 = 'admin' OR (($2 = 'agent' OR $2 = 'manager') AND $3 = rt.responsible_dept_id))) OR (a.approval_type = 'MD' AND $2 = 'admin'))"#;
    
    let counts = sqlx::query_as::<_, (i64, i64)>(&format!("SELECT COUNT(*) FILTER (WHERE a.status_id = 2), COUNT(*) FILTER (WHERE a.status_id = 7) {}", query_base))
        .bind(approver_id).bind(&role).bind(department_id).fetch_one(&pool).await?;
    
    let total_records = if target_status == 2 { counts.0 } else { counts.1 };
    
    let query = format!(r#"SELECT a.id as approval_id, r.id as request_id, r.req_code, r.phone_number, s.name as subject_name, t.name as topic_name, rt.name as type_name, r.requirement, r.description, r.file_url, u.name as requester_name, ud.name as requester_department, a.approve_step, r.request_date, a.status_id, ms.name_th AS status_name, ms.badge_variant AS status_variant, ms.color_class AS status_color, (SELECT COALESCE(json_agg(json_build_object('step', ra2.approve_step, 'approver_id', ra2.approver_id, 'approver_name', u2.name, 'approval_type', ra2.approval_type, 'status_id', ra2.status_id, 'status_name', ams.name_th, 'comment', ra2.comment, 'action_date', ra2.action_date) ORDER BY ra2.action_date ASC, ra2.id ASC), '[]') FROM request_approvals ra2 LEFT JOIN users u2 ON ra2.approver_id = u2.id LEFT JOIN m_status ams ON ra2.status_id = ams.id WHERE ra2.request_id = r.id) AS approvals {} AND a.status_id = $4 ORDER BY r.request_date ASC LIMIT $5 OFFSET $6"#, query_base);
    
    let list = sqlx::query_as::<_, PendingApprovalResponse>(&query).bind(approver_id).bind(&role).bind(department_id).bind(target_status).bind(limit).bind((page - 1) * limit).fetch_all(&pool).await?;
    
    Ok((StatusCode::OK, Json(ApprovalPaginatedResponse { data: list, total_records, total_pages: (total_records as f64 / limit as f64).ceil() as i64, current_page: page, limit, pending_count: counts.0, waiting_count: counts.1 })))
}

pub async fn process_approval(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(approval_id): Path<i32>,
    Json(payload): Json<ApprovalActionPayload>
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    let current_user_id = claims.sub.parse::<i32>().unwrap_or(0);
    let mut tx = pool.begin().await?;
    let info = sqlx::query!(r#"SELECT a.request_id, a.approve_step FROM request_approvals a WHERE a.id = $1"#, approval_id).fetch_one(&mut *tx).await?;
    
    if payload.action == "APPROVE" || payload.action == "FORWARD" {
        sqlx::query!( "UPDATE request_approvals SET status_id = 6, comment = $1, action_date = NOW(), approver_id = $2 WHERE id = $3", payload.comment, current_user_id, approval_id).execute(&mut *tx).await?;
        if payload.action == "FORWARD" {
            sqlx::query!("INSERT INTO request_approvals (request_id, approve_step, approval_type, status_id, approver_id) VALUES ($1, $2, 'MD', 2, $3)", info.request_id, info.approve_step + 1, payload.forward_to_id).execute(&mut *tx).await?;
            sqlx::query!("UPDATE requests SET status_id = 10 WHERE id = $1", info.request_id).execute(&mut *tx).await?;
        } else {
            let next_step = info.approve_step + 1;
            let next_app = sqlx::query!("SELECT id FROM request_approvals WHERE request_id = $1 AND approve_step = $2", info.request_id, next_step).fetch_optional(&mut *tx).await?;
            if next_app.is_some() {
                sqlx::query!("UPDATE request_approvals SET status_id = 2 WHERE request_id = $1 AND approve_step = $2", info.request_id, next_step).execute(&mut *tx).await?;
                sqlx::query!("UPDATE requests SET status_id = $1 WHERE id = $2", if next_step == 2 { 8 } else { 2 }, info.request_id).execute(&mut *tx).await?;
            } else { 
                sqlx::query!("UPDATE requests SET status_id = 1 WHERE id = $1", info.request_id).execute(&mut *tx).await?; 
            }
        }
    } else {
        sqlx::query!("UPDATE request_approvals SET status_id = 5, comment = $1, action_date = NOW(), approver_id = $2 WHERE id = $3", payload.comment, current_user_id, approval_id).execute(&mut *tx).await?;
        sqlx::query!("UPDATE requests SET status_id = 5 WHERE id = $1", info.request_id).execute(&mut *tx).await?;
        sqlx::query!("UPDATE request_approvals SET status_id = 5, comment = 'ยกเลิกเนื่องจากสเตปก่อนหน้าไม่อนุมัติ' WHERE request_id = $1 AND approve_step > $2", info.request_id, info.approve_step).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "สำเร็จ" }))))
}

pub async fn get_department_approvers(State(pool): State<PgPool>, Extension(claims): Extension<Claims>) -> Result<(StatusCode, Json<Vec<UserResponse>>), ApiError> {
    let user_id: i32 = claims.sub.parse().unwrap_or(0);
    let approvers = sqlx::query_as::<_, UserResponse>(r#"SELECT u.id, u.employee_code, u.username, u.name, u.email, u.role, u.position, u.phone_number, u.department_id, d.name as department FROM users u LEFT JOIN m_departments d ON u.department_id = d.id WHERE u.role = 'manager' AND (u.department_id = (SELECT department_id FROM users WHERE id = $1) OR u.department_id = 8)"#).bind(user_id).fetch_all(&pool).await?;
    Ok((StatusCode::OK, Json(approvers)))
}

async fn get_request_by_id(pool: &PgPool, id: i32) -> Result<RequestItem, ApiError> {
    let query = r#"
        SELECT 
            r.id, r.req_code, 
            r.requester_id, u1.name AS requester_name, 
            r.subject_id, s.name AS subject_name, t.name AS topic_name, rt.name AS type_name,
            rt.responsible_dept_id,
            r.phone_number, r.requirement, r.description, r.file_url,  
            r.request_date, r.recorded_by, u3.name AS recorded_by_name,
            r.status_id, ms.name_th AS status_name, ms.badge_variant AS status_variant, ms.color_class AS status_color,
            r.plan_start_date, r.plan_finish_date, r.actual_start_date, r.actual_finish_date,
            (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'id', st.id,
                        'request_id', st.request_id,
                        'responsible_dept_id', st.responsible_dept_id,
                        'department_name', d2.name,
                        'status_id', st.status_id,
                        'status_name', ams2.name_th,
                        'status_variant', ams2.badge_variant,
                        'status_color', ams2.color_class,
                        'description', st.description,
                        'plan_start_date', st.plan_start_date,
                        'plan_finish_date', st.plan_finish_date,
                        'assignees', (
                            SELECT COALESCE(json_agg(
                                json_build_object(
                                    'id', u_sub.id,
                                    'name', u_sub.name,
                                    'phone_number', u_sub.phone_number,
                                    'position', u_sub.position
                                )
                            ), '[]')
                            FROM sub_task_assignees sta
                            JOIN users u_sub ON sta.assignee_id = u_sub.id
                            WHERE sta.sub_task_id = st.id
                        )
                    )
                ), '[]')
                FROM request_sub_tasks st
                LEFT JOIN m_departments d2 ON st.responsible_dept_id = d2.id
                LEFT JOIN m_status ams2 ON st.status_id = ams2.id
                WHERE st.request_id = r.id
            ) AS sub_tasks,
            (SELECT COALESCE(json_agg(json_build_object('id', u4.id, 'name', u4.name, 'position', u4.position, 'email', u4.email, 'phone_number', u4.phone_number)), '[]') FROM request_assignees ra2 LEFT JOIN users u4 ON ra2.assignee_id = u4.id WHERE ra2.request_id = r.id) AS assignees,
            (SELECT COALESCE(json_agg(json_build_object('step', ra.approve_step, 'approver_id', ra.approver_id, 'approver_name', u2.name, 'approval_type', ra.approval_type, 'status_id', ra.status_id, 'status_name', ams.name_th, 'comment', ra.comment, 'action_date', ra.action_date) ORDER BY ra.action_date ASC, ra.id ASC), '[]') FROM request_approvals ra LEFT JOIN users u2 ON ra.approver_id = u2.id LEFT JOIN m_status ams ON ra.status_id = ams.id WHERE ra.request_id = r.id) AS approvals
        FROM requests r
        LEFT JOIN m_status ms ON r.status_id = ms.id
        LEFT JOIN users u1 ON r.requester_id = u1.id
        LEFT JOIN m_subjects s ON r.subject_id = s.id
        LEFT JOIN m_topics t ON s.topic_id = t.id
        LEFT JOIN m_request_types rt ON t.type_id = rt.id
        LEFT JOIN users u3 ON r.recorded_by = u3.id
        WHERE r.id = $1 AND r.is_deleted = FALSE
    "#;
    let item = sqlx::query_as::<_, RequestItem>(query).bind(id).fetch_optional(pool).await?.ok_or_else(|| ApiError::NotFound(format!("ไม่พบคำขอ ID: {}", id)))?;
    Ok(item)
}
