use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};

use crate::user::handlers::get_jwt_secret;
use crate::user::models::Claims;

pub async fn auth(mut req: Request, next: Next) -> Result<Response, StatusCode> {
    // 1. ดึง Header "Authorization" จากฝั่งผู้ใช้
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    // 2. ตรวจสอบว่ามีคำว่า "Bearer " นำหน้า Token หรือไม่
    let auth_header = match auth_header {
        Some(h) if h.starts_with("Bearer ") => h,
        _ => return Err(StatusCode::UNAUTHORIZED), // ไม่มีตั๋ว หรือตั๋วผิดรูปแบบ -> ไล่กลับไป (401)
    };

    // 3. ตัดคำว่า "Bearer " ออก (เอาเฉพาะตัวอักษร Token ล้วนๆ)
    let token = &auth_header[7..];

    // 4. ถอดรหัส Token ด้วยกุญแจลับของเรา
    let secret = get_jwt_secret();
    let token_data = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(&secret),
        &Validation::default(),
    ) {
        Ok(data) => data,
        Err(_) => return Err(StatusCode::UNAUTHORIZED), // ตั๋วปลอม หรือหมดอายุ -> ไล่กลับไป (401)
    };

    // 5. แอบฝังข้อมูล User (Claims) ใส่กระเป๋าของ Request ไว้!
    // เพื่อให้ฟังก์ชันปลายทาง (เช่น สร้าง Request) หยิบไปใช้ได้เลยว่าใครเป็นคนยิง API มา
    req.extensions_mut().insert(token_data.claims);

    // 6. ปล่อยให้ผ่านประตูไปทำงานต่อได้
    Ok(next.run(req).await)
}
