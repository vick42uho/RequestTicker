use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, http::StatusCode, Json};
use jsonwebtoken::{encode, EncodingKey, Header};
use sqlx::PgPool;
use std::time::{SystemTime, UNIX_EPOCH};
use validator::Validate;

use super::models::{AuthResponse, Claims, LoginUser, RegisterUser, UserResponse};
use crate::error::ApiError;

// Function to get JWT secret from environment variable
pub fn get_jwt_secret() -> Vec<u8> {
    std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "my_super_secret_key_12345!".to_string())
        .into_bytes()
}

// === ฟังก์ชัน 1: สมัครสมาชิก (Register) ===
pub async fn register(
    State(pool): State<PgPool>,
    Json(payload): Json<RegisterUser>,
) -> Result<(StatusCode, Json<UserResponse>), ApiError> {
    if let Err(e) = payload.validate() {
        return Err(ApiError::BadRequest(e.to_string()));
    }

    let exists: (i64,) = sqlx::query_as(
        "SELECT count(*) FROM users WHERE email = $1 OR username = $2"
    )
    .bind(&payload.email)
    .bind(&payload.username)
    .fetch_one(&pool).await?;

    if exists.0 > 0 {
        return Err(ApiError::BadRequest("อีเมล หรือ Username นี้มีผู้ใช้งานแล้ว".to_string()));
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(payload.password.as_bytes(), &salt)
        .map_err(|_| ApiError::InternalServerError("เข้ารหัสผ่านไม่สำเร็จ".to_string()))?
        .to_string();

    let query = r#"
        WITH inserted_user AS (
            INSERT INTO users (username, name, email, password_hash, role, position, department_id, phone_number, employee_code)
            VALUES ($1, $2, $3, $4, 'user', $5, $6, $7, $8)
            RETURNING id, username, name, email, role, position, department_id, phone_number, employee_code
        )
        SELECT u.*, d.name as department
        FROM inserted_user u
        LEFT JOIN m_departments d ON u.department_id = d.id
    "#;

    let user = sqlx::query_as::<_, UserResponse>(query)
        .bind(&payload.username)
        .bind(&payload.name)
        .bind(&payload.email)
        .bind(&password_hash)
        .bind(&payload.position)
        .bind(payload.department_id)
        .bind(&payload.phone_number) 
        .bind(None::<String>) // employee_code (default null for register)
        .fetch_one(&pool).await?;

    Ok((StatusCode::CREATED, Json(user)))
}

// === ฟังก์ชัน 2: เข้าสู่ระบบ (Login) ===
pub async fn login(
    State(pool): State<PgPool>,
    Json(payload): Json<LoginUser>,
) -> Result<Json<AuthResponse>, ApiError> {
    if let Err(e) = payload.validate() {
        return Err(ApiError::BadRequest(e.to_string()));
    }

    #[derive(sqlx::FromRow)]
    struct UserWithAuth {
        id: i32, 
        employee_code: Option<String>,
        username: Option<String>, 
        name: String, 
        email: String, 
        password_hash: String,
        role: String, 
        position: Option<String>, 
        department_id: Option<i32>,
        phone_number: Option<String>, 
        department: Option<String>,
    }

    let user_query = r#"
        SELECT u.id, u.employee_code, u.username, u.name, u.email, u.password_hash, u.role, u.position, u.department_id, u.phone_number, d.name as department 
        FROM users u
        LEFT JOIN m_departments d ON u.department_id = d.id
        WHERE (u.email = $1 OR u.username = $1 OR u.employee_code = $1) AND u.is_active = TRUE
    "#;
    
    let user = sqlx::query_as::<_, UserWithAuth>(user_query)
        .bind(&payload.username_or_email) 
        .fetch_optional(&pool).await?
        .ok_or_else(|| ApiError::BadRequest("Username/Email/รหัสพนักงาน หรือรหัสผ่านไม่ถูกต้อง".to_string()))?; 

    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|_| ApiError::InternalServerError("ระบบตรวจสอบรหัสผ่านขัดข้อง".to_string()))?;
    
    if Argon2::default().verify_password(payload.password.as_bytes(), &parsed_hash).is_err() {
        return Err(ApiError::BadRequest("Username/Email/รหัสพนักงาน หรือรหัสผ่านไม่ถูกต้อง".to_string()));
    }

    let expiration = SystemTime::now()
        .duration_since(UNIX_EPOCH).unwrap().as_secs() as usize + (24 * 3600); 

    let claims = Claims {
        sub: user.id.to_string(),
        role: user.role.clone(),
        exp: expiration,
        department_id: user.department_id, 
    };

    let secret = get_jwt_secret();
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(&secret))
        .map_err(|_| ApiError::InternalServerError("สร้าง Token ไม่สำเร็จ".to_string()))?;

    let user_response = UserResponse {
        id: user.id, 
        employee_code: user.employee_code,
        username: user.username, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        position: user.position, 
        department_id: user.department_id,
        phone_number: user.phone_number,
        department: user.department,
    };

    Ok(Json(AuthResponse { token, user: user_response }))
}

// === ฟังก์ชัน 3: ดึงรายชื่อผู้อนุมัติ ===
pub async fn get_approvers(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<UserResponse>>, ApiError> {
    
    let query = r#"
        SELECT u.id, u.employee_code, u.username, u.name, u.email, u.role, u.position, u.department_id, u.phone_number, d.name as department 
        FROM users u
        LEFT JOIN m_departments d ON u.department_id = d.id
        WHERE u.is_active = TRUE AND u.role = 'manager'
        ORDER BY u.name ASC
    "#;

    let approvers = sqlx::query_as::<_, UserResponse>(query)
        .fetch_all(&pool)
        .await?;

    Ok(Json(approvers))
}
