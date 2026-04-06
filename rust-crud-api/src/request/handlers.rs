use axum::{
    extract::{Multipart, Path, State, Extension, Query},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
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
    // 🌟 ปรับปรุง: นับจำนวน "สิ่งที่ต้องจัดการ" (Pending) ให้ตรงกับหน้ารายการรอพิจารณา (approvals/pending)
    // โดยนับจากงานที่มีคิวรอผู้อนุมัติคนนี้อยู่ (status_id = 2) 
    // และรวมงานที่ค้างในแผนกตัวเอง (status_id = 1, 8) หากเป็น Agent
    let stats = sqlx::query!(
        r#"
        SELECT 
            COUNT(DISTINCT r.id) FILTER (
                WHERE 
                -- 1. งานที่รอคนๆ นี้อนุมัติโดยตรง (สอดคล้องกับหน้า Pending Approvals)
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
                -- 2. งานที่รอรับเข้าแผนก (ถ้าเป็น Agent/Manager แผนกที่รับผิดชอบ)
                OR (
                    r.status_id IN (1, 8) 
                    AND rt.responsible_dept_id = $2
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
                    rt.responsible_dept_id = $2   -- งานที่แผนกตัวเองต้องทำ
                    OR u.department_id = $2       -- งานที่คนในแผนกตัวเองแจ้ง
                    OR EXISTS (                    -- งานที่ตัวเองเกี่ยวข้องในสายอนุมัติ
                        SELECT 1 FROM request_approvals ra 
                        WHERE ra.request_id = r.id AND ra.approver_id = $3
                    )
                )
            )
            OR r.requester_id = $3 -- ทุกคนเห็นงานที่ตัวเองแจ้ง
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
    
    // 🌟 1. ดึง department_id ของผู้ใช้งานปัจจุบันมารอไว้เลย
    let user_info = sqlx::query!("SELECT department_id FROM users WHERE id = $1", user_id)
        .fetch_optional(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    let department_id = user_info.and_then(|u| u.department_id).unwrap_or(0);

    // ตั้งค่าตัวกรองและ Pagination
    let filter = params.filter.unwrap_or_else(|| "dept".to_string());
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(5).max(1).min(100); 
    let offset = (page - 1) * limit;

let base_sql = r#"
        SELECT 
            r.id, r.req_code, 
            r.requester_id, u1.name AS requester_name, 
            r.subject_id, s.name AS subject_name, t.name AS topic_name, rt.name AS type_name,
            r.phone_number, r.requirement, r.description, r.file_url,  
            r.request_date, r.recorded_by, u3.name AS recorded_by_name,
            r.status_id, ms.name_th AS status_name, ms.badge_variant AS status_variant, ms.color_class AS status_color,
            
            -- 🌟 1. เพิ่ม 4 ฟิลด์เวลาตรงนี้ (ป้องกัน error missing column)
            r.plan_start_date,
            r.plan_finish_date,
            r.actual_start_date,
            r.actual_finish_date,

            -- 🌟 2. เพิ่มก้อน JSON ของ assignees ตรงนี้!
            (
                SELECT COALESCE(json_agg(
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
    "#;

    let total_records: i64;
    let requests: Vec<RequestItem>;

    // 🌟 2. แยก Logic สิทธิ์การเข้าถึงอย่างชัดเจน (Dynamic Routing)
    if role == "admin" && filter == "all" {
        // 🚨 เคสที่ 1: Admin ขอดู "ทั้งหมด" (เห็นทั้งบริษัท - ไม่มีเงื่อนไขแผนก)
        let count_query = "SELECT COUNT(*) FROM requests WHERE is_deleted = FALSE";
        let count_result: (i64,) = sqlx::query_as(count_query).fetch_one(&pool).await.unwrap_or((0,));
        total_records = count_result.0;

        let query = format!("{} WHERE r.is_deleted = FALSE ORDER BY r.request_date DESC LIMIT $1 OFFSET $2", base_sql);
        requests = sqlx::query_as::<_, RequestItem>(&query)
            .bind(limit).bind(offset)
            .fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    } else if role == "agent" && filter == "all" {
        // 🎯 เคสที่ 2: Agent ขอดู "ทั้งหมด" (เห็นเฉพาะงานที่ "แผนกตัวเองรับผิดชอบ" - Dynamic Routing)
        let count_query = "
            SELECT COUNT(*) FROM requests r 
            LEFT JOIN m_subjects s ON r.subject_id = s.id
            LEFT JOIN m_topics t ON s.topic_id = t.id
            LEFT JOIN m_request_types rt ON t.type_id = rt.id
            WHERE r.is_deleted = FALSE AND rt.responsible_dept_id = $1
        ";
        let count_result: (i64,) = sqlx::query_as(count_query).bind(department_id).fetch_one(&pool).await.unwrap_or((0,));
        total_records = count_result.0;

        let query = format!("{} WHERE r.is_deleted = FALSE AND rt.responsible_dept_id = $1 ORDER BY r.request_date DESC LIMIT $2 OFFSET $3", base_sql);
        requests = sqlx::query_as::<_, RequestItem>(&query)
            .bind(department_id).bind(limit).bind(offset)
            .fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    } else if filter == "me" {
        // 👤 เคสที่ 3: ขอดู "งานที่ฉันเป็นคนแจ้ง" (ทุกคนดูได้)
        let count_query = "SELECT COUNT(*) FROM requests WHERE is_deleted = FALSE AND requester_id = $1";
        let count_result: (i64,) = sqlx::query_as(count_query).bind(user_id).fetch_one(&pool).await.unwrap_or((0,));
        total_records = count_result.0;

        let query = format!("{} WHERE r.is_deleted = FALSE AND r.requester_id = $1 ORDER BY r.request_date DESC LIMIT $2 OFFSET $3", base_sql);
        requests = sqlx::query_as::<_, RequestItem>(&query)
            .bind(user_id).bind(limit).bind(offset)
            .fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    // 🟢 === แทรก 2 บล็อกนี้เพิ่มเข้าไป สำหรับหน้า Tasks === 🟢
    } else if filter == "dept_tasks" {
        // 🛠️ แท็บ "งานทั้งหมดของแผนก" -> ดึงเฉพาะงานที่ถูกส่งมาให้แผนกของเราจัดการ
        let count_query = "
            SELECT COUNT(*) FROM requests r 
            LEFT JOIN m_subjects s ON r.subject_id = s.id
            LEFT JOIN m_topics t ON s.topic_id = t.id
            LEFT JOIN m_request_types rt ON t.type_id = rt.id
            WHERE r.is_deleted = FALSE AND rt.responsible_dept_id = $1
        ";
        let count_result: (i64,) = sqlx::query_as(count_query).bind(department_id).fetch_one(&pool).await.unwrap_or((0,));
        total_records = count_result.0;

        let query = format!("{} WHERE r.is_deleted = FALSE AND rt.responsible_dept_id = $1 ORDER BY r.request_date DESC LIMIT $2 OFFSET $3", base_sql);
        requests = sqlx::query_as::<_, RequestItem>(&query)
            .bind(department_id).bind(limit).bind(offset)
            .fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    } else if filter == "my_tasks" {
        // 🛠️ แท็บ "งานของฉัน" -> ดึงเฉพาะงานที่มีชื่อเราถูกแอดไว้ในตาราง request_assignees
        let count_query = "
            SELECT COUNT(*) FROM requests r 
            WHERE r.is_deleted = FALSE 
            AND EXISTS (SELECT 1 FROM request_assignees ra WHERE ra.request_id = r.id AND ra.assignee_id = $1)
        ";
        let count_result: (i64,) = sqlx::query_as(count_query).bind(user_id).fetch_one(&pool).await.unwrap_or((0,));
        total_records = count_result.0;

        let query = format!("{} WHERE r.is_deleted = FALSE AND EXISTS (SELECT 1 FROM request_assignees ra WHERE ra.request_id = r.id AND ra.assignee_id = $1) ORDER BY r.request_date DESC LIMIT $2 OFFSET $3", base_sql);
        requests = sqlx::query_as::<_, RequestItem>(&query)
            .bind(user_id).bind(limit).bind(offset)
            .fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    // 🟢 ============================================== 🟢

    } else {
        // 🏢 เคสที่ 4: ขอดู "งานของคนในแผนกฉันที่แจ้งเข้ามา" (ค่าเริ่มต้น / dept)
        let count_query = "
            SELECT COUNT(*) FROM requests r 
            LEFT JOIN users u1 ON r.requester_id = u1.id 
            WHERE r.is_deleted = FALSE AND u1.department_id = $1
        ";
        let count_result: (i64,) = sqlx::query_as(count_query).bind(department_id).fetch_one(&pool).await.unwrap_or((0,));
        total_records = count_result.0;

        let query = format!("{} WHERE r.is_deleted = FALSE AND u1.department_id = $1 ORDER BY r.request_date DESC LIMIT $2 OFFSET $3", base_sql);
        requests = sqlx::query_as::<_, RequestItem>(&query)
            .bind(department_id).bind(limit).bind(offset)
            .fetch_all(&pool).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    }

    // คำนวณจำนวนหน้าทั้งหมด
    let total_pages = (total_records as f64 / limit as f64).ceil() as i64;

    let response = PaginatedResponse {
        data: requests,
        total_records,
        total_pages,
        current_page: page,
        limit,
    };

    Ok(Json(response))
}

pub async fn get_request(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
) -> Result<Json<RequestItem>, ApiError> {
    
    // 🌟 เรียกใช้ฟังก์ชันที่สร้างไว้ (ซึ่งข้างในมี SQL JOIN และเช็ค is_deleted เรียบร้อยแล้ว)
    let request_item = get_request_by_id(&pool, id).await?;

    Ok(Json(request_item))
}

pub async fn update_request(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
    Json(payload): Json<UpdateRequest>,
) -> Result<Json<RequestItem>, ApiError> {
    
    // 🌟 1. ดึงเงื่อนไขการอนุมัติ "ทั้ง 2 ฝั่ง" ตาม subject_id ใหม่ที่อัปเดตเข้ามา
    let subject_info = sqlx::query!(
        r#"
        SELECT 
            s.requires_approval, 
            s.requires_receiver_approval, 
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
    
    // (ใส่ unwrap_or เผื่อไว้ในกรณีที่ฐานข้อมูลไม่ได้เซ็ตเป็น Not Null นะครับ)
    let req_receiver_approval = subject_info.requires_receiver_approval;

    // 🌟 2. คำนวณสถานะตั้งต้นให้ใบงาน (เหมือนที่ทำใน create_request)
    let new_status_id = if req_approval || req_receiver_approval { 2 } else { 1 };

    let mut tx = pool.begin().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    // 🌟 3. อัปเดตข้อมูลใบงานหลักลงตาราง requests
    let update_query = r#"
        UPDATE requests 
        SET subject_id = $1, description = $2, phone_number = $3, requirement = $4, status_id = $5 
        WHERE id = $6
    "#;
    
    sqlx::query(update_query)
        .bind(payload.subject_id)
        .bind(&payload.description)
        .bind(&payload.phone_number)
        .bind(&payload.requirement)
        .bind(new_status_id) 
        .bind(id)
        .execute(&mut *tx).await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    // 🌟 4. ล้างไพ่! ลบคิวอนุมัติเก่าทิ้งทั้งหมด (ทั้ง PRE และ RECEIVER_DEPT)
    sqlx::query("DELETE FROM request_approvals WHERE request_id = $1")
        .bind(id)
        .execute(&mut *tx).await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    // ===============================================
    // 🌟 5. สร้างคิวการอนุมัติใหม่ (Dynamic Routing)
    // ===============================================
    let mut current_step = 1;

    // 🟡 5.1 คิวอนุมัติ "ฝั่งผู้แจ้ง" (ถ้ามี)
    if req_approval {
        if let Some(apps) = &payload.approvers {
            for app in apps {
                let step_status_id = if app.step == 1 { 2 } else { 7 };
                
                sqlx::query(
                    "INSERT INTO request_approvals (request_id, approver_id, approve_step, approval_type, status_id) VALUES ($1, $2, $3, $4, $5)"
                )
                .bind(id)
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

    // 🟢 5.2 คิวอนุมัติ "ฝั่งผู้รับงาน" (ถ้ามี) - ระบบจะปั้นคิวนี้ต่อท้ายให้เอง!
    if req_receiver_approval {
        let step_status_id = if current_step == 1 { 2 } else { 7 };

        sqlx::query(
            "INSERT INTO request_approvals (request_id, approve_step, approval_type, status_id) VALUES ($1, $2, 'RECEIVER_DEPT', $3)"
        )
        .bind(id)
        .bind(current_step) // ต่อคิวตามตัวนับล่าสุด
        .bind(step_status_id)
        .execute(&mut *tx).await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    }

    // ยืนยันการบันทึก
    tx.commit().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    let updated_request = get_request_by_id(&pool, id).await?;
    Ok(Json(updated_request))
}

pub async fn delete_request(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>, // ใช้ Extension ดึงข้อมูลคนลบ
    Path(id): Path<i32>,
) -> Result<StatusCode, ApiError> {
    
    // 🛡️ 1. เช็คสิทธิ์: ต้องเป็นเจ้าของ หรือเป็น Admin/IT
    let request_data = sqlx::query!(
        "SELECT requester_id FROM requests WHERE id = $1 AND is_deleted = FALSE", 
        id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| ApiError::NotFound(format!("ไม่พบคำขอ ID: {}", id)))?;

    let current_user_id: i32 = claims.sub.parse().unwrap_or(0);
    let is_admin = claims.role == "admin" || claims.role == "it";

    if !is_admin && request_data.requester_id != current_user_id {
        return Err(ApiError::Forbidden("คุณไม่มีสิทธิ์ลบคำขอของผู้อื่น".to_string()));
    }

    // 🗑️ 2. Soft Delete: อัปเดต flag แทนการ DELETE
    sqlx::query!(
        "UPDATE requests SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1",
        id
    )
    .execute(&pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// === ระบบอัปโหลดหลายไฟล์ (Multi-file upload) และกรองชนิดไฟล์ ===
pub async fn upload_request_files(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
    mut multipart: Multipart,
) -> Result<Json<RequestItem>, ApiError> {
    // 1. เช็คก่อนว่ามีคำขอนี้อยู่จริงไหม
    let check_query = "SELECT id FROM requests WHERE id = $1";
    let _ = sqlx::query(check_query).bind(id).fetch_optional(&pool).await?
        .ok_or_else(|| ApiError::NotFound(format!("ไม่พบคำขอ ID: {}", id)))?;

    let allowed_extensions = vec!["pdf", "xls", "xlsx", "doc", "docx", "ppt", "pptx", "jpg", "jpeg", "png"];
    
    // สร้าง Array ว่างๆ ไว้เก็บ URL ของไฟล์ที่อัปโหลดผ่าน
    let mut uploaded_urls: Vec<String> = Vec::new();

    // 2. วนลูปอ่านทุกไฟล์ที่ส่งเข้ามา
    while let Some(field) = multipart.next_field().await.map_err(|_| ApiError::BadRequest("อ่านไฟล์ไม่สำเร็จ".to_string()))? {
        let field_name = field.name().unwrap_or("").to_string();
        let file_name = field.file_name().unwrap_or("").to_string();

        // ตรวจสอบว่าส่งมาใน key ชื่อ "files" หรือ "file" และต้องมีชื่อไฟล์
        if file_name.is_empty() || (field_name != "files" && field_name != "file") {
            continue;
        }

        let ext = file_name.split('.').last().unwrap_or("").to_lowercase();
        
        if !allowed_extensions.contains(&ext.as_str()) {
            return Err(ApiError::BadRequest(format!("ไม่อนุญาตให้อัปโหลดไฟล์ .{} (รองรับ pdf, excel, word, ppt, jpg, png)", ext)));
        }

        let new_uuid = Uuid::new_v4().to_string();
        let unique_name = format!("{}.{}", new_uuid, ext);
        let save_path = format!("uploads/{}", unique_name);

        let data = field.bytes().await.map_err(|_| ApiError::InternalServerError("ไม่สามารถอ่านข้อมูลไฟล์ได้".to_string()))?;
        let mut file = File::create(&save_path).await.map_err(|_| ApiError::InternalServerError("สร้างไฟล์ไม่ได้".to_string()))?;
        file.write_all(&data).await.map_err(|_| ApiError::InternalServerError("บันทึกไฟล์ไม่สำเร็จ".to_string()))?;

        // ดัน URL ของไฟล์นี้เก็บไว้ใน Array ก่อน
        uploaded_urls.push(format!("/uploads/{}", unique_name));
    }

    // 3. ถ้ามีไฟล์ถูกอัปโหลด ให้นำมาต่อกันด้วยลูกน้ำ แล้วอัปเดตลง Database ทีเดียว!
    if !uploaded_urls.is_empty() {
        let joined_urls = uploaded_urls.join(","); // ผลลัพธ์: "/url1.png,/url2.pdf"
        
        // ใช้ CONCAT_WS เพื่อนำไฟล์ใหม่ไปต่อท้ายไฟล์เดิม (ในกรณีที่มีการอัปโหลดเพิ่มทีหลัง)
        let update_query = "
            UPDATE requests 
            SET file_url = CONCAT_WS(',', NULLIF(file_url, ''), $1) 
            WHERE id = $2
        ";
        sqlx::query(update_query)
            .bind(&joined_urls)
            .bind(id)
            .execute(&pool)
            .await?;
    }

    let updated_request = get_request_by_id(&pool, id).await?;

    Ok(Json(updated_request))
}

// === ดึงข้อมูล Master: ประเภทคำขอ ===
pub async fn get_master_types(State(pool): State<PgPool>) -> Result<Json<Vec<MasterRequestType>>, ApiError> {
    let query = "SELECT id, name, description, responsible_dept_id FROM m_request_types WHERE del_flag = FALSE ORDER BY id ASC";
    
    let types = sqlx::query_as::<_, MasterRequestType>(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        
    Ok(Json(types))
}

// === ดึงข้อมูล Master: หัวข้อ (อิงตาม ประเภทคำขอ) ===
pub async fn get_master_topics(
    State(pool): State<PgPool>,
    Path(type_id): Path<i32>,
) -> Result<Json<Vec<MasterTopic>>, ApiError> {
    let query = "SELECT id, type_id, name FROM m_topics WHERE type_id = $1 AND del_flag = FALSE ORDER BY id ASC";
    let topics = sqlx::query_as::<_, MasterTopic>(query).bind(type_id).fetch_all(&pool).await?;
    Ok(Json(topics))
}

// === ดึงข้อมูล Master: เรื่อง (อิงตาม หัวข้อ) ===
pub async fn get_master_subjects(
    State(pool): State<PgPool>,
    Path(topic_id): Path<i32>,
) -> Result<Json<Vec<MasterSubject>>, ApiError> {
    let query = "SELECT id, topic_id, name, is_other, requires_approval, requires_receiver_approval FROM m_subjects WHERE topic_id = $1 AND del_flag = FALSE ORDER BY id ASC";
    let subjects = sqlx::query_as::<_, MasterSubject>(query).bind(topic_id).fetch_all(&pool).await?;
    Ok(Json(subjects))
}

pub async fn delete_request_files(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<i32>,
    Json(payload): Json<DeleteFilesPayload>,
) -> Result<Json<RequestItem>, ApiError> {
    
    // 🛡️ 1. เช็คสิทธิ์คนลบไฟล์
    let record = sqlx::query!(
        "SELECT requester_id, file_url FROM requests WHERE id = $1 AND is_deleted = FALSE", 
        id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("ไม่พบคำขอนี้".to_string()))?;

    let current_user_id: i32 = claims.sub.parse().unwrap_or(0);
    let is_admin = claims.role == "admin" || claims.role == "it";

    if !is_admin && record.requester_id != current_user_id {
        return Err(ApiError::Forbidden("คุณไม่มีสิทธิ์ลบไฟล์ในคำขอของผู้อื่น".to_string()));
    }

    // 2. จัดการเรื่องไฟล์ (Hard Delete ของจริง)
    let mut current_files: Vec<String> = record.file_url
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    for file_path in payload.files_to_delete {
        let db_file_path = if file_path.starts_with('/') { file_path.clone() } else { format!("/{}", file_path) };

        if current_files.contains(&db_file_path) {
            let clean_path = db_file_path.trim_start_matches('/'); 
            
            // 🛡️ [SECURITY CHECK] ตรวจสอบว่าไฟล์อยู่ในโฟลเดอร์ uploads เท่านั้น และไม่มี ..
            if !clean_path.starts_with("uploads/") || clean_path.contains("..") {
                continue; // ข้ามไฟล์ที่พยายามเจาะระบบ
            }

            // 🚨 ลบไฟล์ออกจากเครื่องจริง
            let _ = std::fs::remove_file(clean_path);
            current_files.retain(|f| f != &db_file_path);
        }
    }

    // 3. อัปเดต Database
    let new_file_url = if current_files.is_empty() { None } else { Some(current_files.join(",")) };
    
    sqlx::query!("UPDATE requests SET file_url = $1 WHERE id = $2", new_file_url, id)
        .execute(&pool)
        .await?;

    // 4. ดึงข้อมูลล่าสุดส่งกลับ (ก๊อปปี้ SQL SELECT ที่มี JOIN m_status มาวางตรงนี้)
    let updated_request = get_request_by_id(&pool, id).await?; 
    Ok(Json(updated_request))
}



// 🟢 API 1: ดึงรายการใบงานที่รอหัวหน้าคนนี้อนุมัติ
pub async fn get_pending_approvals(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<RequestFilter>, // 🆕 รับ Query Params สำหรับ Pagination
) -> Result<(StatusCode, Json<ApprovalPaginatedResponse<PendingApprovalResponse>>), ApiError> {
    
    let approver_id: i32 = claims.sub.parse().unwrap_or(0);
    let role = claims.role.clone(); 
    
    // 1. จัดการเรื่อง Pagination
    let page = filter.page.unwrap_or(1);
    let limit = filter.limit.unwrap_or(10);
    let offset = (page - 1) * limit;

    // 🌟 รับค่า Filter Tab (ถ้าไม่ส่งมา ให้เป็น pending)
    let current_tab = filter.filter.as_deref().unwrap_or("pending");
    let target_status = if current_tab == "waiting" { 7 } else { 2 };

    // 🌟 1. ดึง department_id ของคนที่ล็อกอินอยู่
    let user_info = sqlx::query!(
        "SELECT department_id FROM users WHERE id = $1",
        approver_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    let department_id = user_info.and_then(|u| u.department_id).unwrap_or(0); 

    // 🌟 2. ดึงข้อมูลใบงานที่รออนุมัติ (Dynamic Routing)
    let query_base = r#"
        FROM request_approvals a
        LEFT JOIN m_status ms ON a.status_id = ms.id
        JOIN requests r ON a.request_id = r.id
        LEFT JOIN users u ON r.requester_id = u.id
        LEFT JOIN m_departments ud ON u.department_id = ud.id 
        LEFT JOIN m_subjects s ON r.subject_id = s.id
        LEFT JOIN m_topics t ON s.topic_id = t.id
        LEFT JOIN m_request_types rt ON t.type_id = rt.id
        WHERE a.status_id IN (2, 7)
        AND r.status_id NOT IN (4, 5)
        AND (
            (a.approver_id = $1)  
            OR 
            (
                a.approver_id IS NULL 
                AND a.approval_type = 'RECEIVER_DEPT' 
                AND (
                    $2 = 'admin' 
                    OR (
                        $2 IN ('agent', 'manager') 
                        AND $3 = rt.responsible_dept_id 
                    )
                )
            ) 
            OR
            (a.approval_type = 'MD' AND $2 = 'admin') 
        )
    "#;

    // นับจำนวนแยกตามสถานะ (Pending vs Waiting)
    let counts_query = format!(
        "SELECT 
            COUNT(*) FILTER (WHERE a.status_id = 2) as pending_count,
            COUNT(*) FILTER (WHERE a.status_id = 7) as waiting_count
        {}", 
        query_base
    );

    let counts = sqlx::query_as::<_, (i64, i64)>(&counts_query)
        .bind(approver_id)
        .bind(&role)
        .bind(department_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    let pending_total = counts.0;
    let waiting_total = counts.1;

    // เลือกใช้ total_records ตาม Tab ที่เลือก
    let total_records = if target_status == 2 { pending_total } else { waiting_total };

    // ดึงข้อมูลจริง (กรองตาม status_id ที่ต้องการ)
    let query = format!(r#"
        SELECT 
            a.id as approval_id, r.id as request_id, r.req_code,r.phone_number,
            s.name as subject_name, t.name as topic_name, rt.name as type_name,
            r.requirement, r.description, r.file_url, u.name as requester_name,
            ud.name as requester_department, 
            a.approve_step, r.request_date,
            a.status_id, ms.name_th AS status_name, ms.badge_variant AS status_variant, ms.color_class AS status_color,
            
            (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'approve_step', ra2.approve_step,
                        'approver_name', COALESCE(u2.name, 'ไม่ระบุชื่อ'),
                        'status_name', ams.name_th,
                        'action_date', ra2.action_date,
                        'comment', ra2.comment
                    ) ORDER BY ra2.approve_step ASC
                ), '[]')
                FROM request_approvals ra2
                LEFT JOIN users u2 ON ra2.approver_id = u2.id
                LEFT JOIN m_status ams ON ra2.status_id = ams.id
                WHERE ra2.request_id = r.id
            ) AS approvals
        {} AND a.status_id = $4
        ORDER BY r.request_date ASC
        LIMIT $5 OFFSET $6
    "#, query_base);

    let pending_list = sqlx::query_as::<_, PendingApprovalResponse>(&query)
        .bind(approver_id)      // $1
        .bind(role)             // $2
        .bind(department_id)    // $3 
        .bind(target_status)    // $4
        .bind(limit)            // $5
        .bind(offset)           // $6
        .fetch_all(&pool)
        .await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    let total_pages = (total_records as f64 / limit as f64).ceil() as i64;

    Ok((StatusCode::OK, Json(ApprovalPaginatedResponse {
        data: pending_list,
        total_records,
        total_pages,
        current_page: page,
        limit,
        pending_count: pending_total,
        waiting_count: waiting_total,
    })))
}

// 🟢 API 2: จัดการเมื่อหัวหน้ากด "อนุมัติ" หรือ "ไม่อนุมัติ"
pub async fn process_approval(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(approval_id): Path<i32>,
    Json(payload): Json<ApprovalActionPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {

    let current_user_id = claims.sub.parse::<i32>().unwrap_or(0);
    let mut tx = pool.begin().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    // 1. ดึงข้อมูลใบงานและ step ปัจจุบัน
    let info = sqlx::query!(
        r#"
        SELECT a.request_id, a.approve_step 
        FROM request_approvals a
        WHERE a.id = $1
        "#,
        approval_id
    ).fetch_one(&mut *tx).await.map_err(|_| ApiError::NotFound("ไม่พบข้อมูลการอนุมัติ".to_string()))?;

    let req_id = info.request_id;
    let current_step = info.approve_step;

    if payload.action == "APPROVE" || payload.action == "FORWARD" {
        // 1. อัปเดตคิวปัจจุบันให้เป็น "อนุมัติแล้ว" 
        sqlx::query!(
            "UPDATE request_approvals SET status_id = 6, comment = $1, action_date = NOW(), approver_id = $2 WHERE id = $3",
            payload.comment, current_user_id, approval_id
        )
        .execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

        if payload.action == "FORWARD" {
            let next_step = current_step + 1;
            
            // ✅ โค้ดใหม่ เอายัดใส่ approver_id โดยตรงเลย
            sqlx::query!(
                "INSERT INTO request_approvals (request_id, approve_step, approval_type, status_id, approver_id) VALUES ($1, $2, 'MD', 2, $3)",
                req_id, 
                next_step, 
                payload.forward_to_id // 🌟 รับค่า ID (16) มาใส่ตรงนี้
            ).execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

            // เปลี่ยนสถานะใบงานหลักเป็น "รอผู้บริหารอนุมัติ" (เบอร์ 10)
            sqlx::query!("UPDATE requests SET status_id = 10 WHERE id = $1", req_id)
                .execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
        } else {
            // 🌟 กรณี "อนุมัติ" ปกติ (เหมือนเดิม)
            let next_step = current_step + 1;
            let next_app = sqlx::query!("SELECT id FROM request_approvals WHERE request_id = $1 AND approve_step = $2", req_id, next_step)
                .fetch_optional(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

            if next_app.is_some() {
                // ปลุกคิวต่อไป (ถ้ามี)
                sqlx::query!("UPDATE request_approvals SET status_id = 2 WHERE request_id = $1 AND approve_step = $2", req_id, next_step)
                    .execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
                
                if next_step == 2 {
                    sqlx::query!("UPDATE requests SET status_id = 8 WHERE id = $1", req_id).execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
                } else {
                    sqlx::query!("UPDATE requests SET status_id = 2 WHERE id = $1", req_id).execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
                }
            } else {
                // ถ้าไม่มีแล้ว -> เป็นรอดำเนินการ
                sqlx::query!("UPDATE requests SET status_id = 1 WHERE id = $1", req_id).execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
            }
        }

    } else {
        // กรณี: ไม่อนุมัติ (REJECT)
        
        // 1. อัปเดตประวัติการพิจารณาคิวนี้ ให้เป็น "ไม่อนุมัติ / ยกเลิก" (เบอร์ 5)
        sqlx::query!(
            "UPDATE request_approvals SET status_id = 6, comment = $1, action_date = NOW(), approver_id = $2 WHERE id = $3",
            payload.comment, current_user_id, approval_id
        ).execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

        // 2. อัปเดตสถานะใบงานหลัก ให้เป็น "ไม่อนุมัติ / ยกเลิก" (เบอร์ 5)
        sqlx::query!("UPDATE requests SET status_id = 5 WHERE id = $1", req_id)
            .execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

        // 3. (เพิ่มใหม่) สั่งยกเลิกคิวของคนที่รออยู่ข้างหลังทั้งหมดให้เป็นเบอร์ 5 ไปด้วยเลย!
        sqlx::query!(
            "UPDATE request_approvals SET status_id = 5, comment = 'ยกเลิกเนื่องจากสเตปก่อนหน้าไม่อนุมัติ' WHERE request_id = $1 AND approve_step > $2", 
            req_id, current_step
        ).execute(&mut *tx).await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;
    }

    tx.commit().await.map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "บันทึกการพิจารณาสำเร็จ" }))))
}

pub async fn get_department_approvers(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
) -> Result<(StatusCode, Json<Vec<UserResponse>>), ApiError> {
    
    // 1. ดึง ID ของคนที่กำลังใช้งานระบบจาก Token
    let user_id: i32 = claims.sub.parse().map_err(|_| {
        ApiError::InternalServerError("Token ไม่ถูกต้อง".to_string())
    })?;

    // 2. ดึงผู้อนุมัติที่อยู่ "แผนกเดียวกัน" (และดึง CEO แผนก 8 มาเผื่อด้วย)
    let query = r#"
        SELECT 
            u.id, u.username, u.name, u.email, u.role, u.position, u.phone_number, u.department_id,
            d.name as department
        FROM users u
        LEFT JOIN m_departments d ON u.department_id = d.id
        WHERE u.role = 'manager' 
        AND (
            u.department_id = (SELECT department_id FROM users WHERE id = $1)
            OR u.department_id = 8 
        )
    "#;

    let approvers = sqlx::query_as::<_, UserResponse>(query)
        .bind(user_id)
        .fetch_all(&pool).await
        .map_err(|e| ApiError::InternalServerError(e.to_string()))?;

    Ok((StatusCode::OK, Json(approvers)))
}

// เพิ่มไว้ล่างสุดของไฟล์ handlers.rs
async fn get_request_by_id(pool: &PgPool, id: i32) -> Result<RequestItem, ApiError> {
    let query = r#"
        SELECT 
            r.id, r.req_code, 
            r.requester_id, u1.name AS requester_name, 
            r.subject_id, s.name AS subject_name, t.name AS topic_name, rt.name AS type_name,
            r.phone_number, r.requirement, r.description, r.file_url,  
            r.request_date, r.recorded_by, u3.name AS recorded_by_name,
            r.status_id, ms.name_th AS status_name, ms.badge_variant AS status_variant, ms.color_class AS status_color,
            
            -- 🌟 1. เพิ่ม 4 ฟิลด์เวลาที่นี่
            r.plan_start_date,
            r.plan_finish_date,
            r.actual_start_date,
            r.actual_finish_date,

            -- 🌟 2. เพิ่ม Sub-query ของผู้รับผิดชอบ (assignees)
            (
                SELECT COALESCE(json_agg(
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

            -- 🌟 3. Sub-query ของผู้อนุมัติ (approvals) เหมือนเดิม
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
        WHERE r.id = $1 AND r.is_deleted = FALSE
    "#;

    let item = sqlx::query_as::<_, RequestItem>(query)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("ไม่พบคำขอ ID: {}", id)))?;

    Ok(item)
}


