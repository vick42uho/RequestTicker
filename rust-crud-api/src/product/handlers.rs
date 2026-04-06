use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use tokio::{fs::File, io::AsyncWriteExt};
use uuid::Uuid;
use validator::Validate;

use super::models::{CreateProduct, Product, UpdateProduct};
use crate::error::ApiError;

pub async fn create_product(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateProduct>,
) -> Result<(StatusCode, Json<Product>), ApiError> {
    if let Err(e) = payload.validate() {
        return Err(ApiError::BadRequest(e.to_string()));
    }

    let query = "INSERT INTO products (name, price, quantity) VALUES ($1, $2, $3) RETURNING id, name, price, quantity, image_url, file_url";
    let product = sqlx::query_as::<_, Product>(query)
        .bind(&payload.name).bind(payload.price).bind(payload.quantity)
        .fetch_one(&pool).await?; 

    Ok((StatusCode::CREATED, Json(product)))
}

pub async fn get_products(State(pool): State<PgPool>) -> Result<Json<Vec<Product>>, ApiError> {
    let query = "SELECT id, name, price, quantity, image_url, file_url FROM products ORDER BY id ASC";
    let products = sqlx::query_as::<_, Product>(query).fetch_all(&pool).await?;
    Ok(Json(products))
}

pub async fn get_product(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
) -> Result<Json<Product>, ApiError> {
    let query = "SELECT id, name, price, quantity, image_url, file_url FROM products WHERE id = $1";
    let product = sqlx::query_as::<_, Product>(query).bind(id).fetch_optional(&pool).await?;

    match product {
        Some(p) => Ok(Json(p)),
        None => Err(ApiError::NotFound(format!("ไม่พบสินค้า ID: {}", id))),
    }
}

pub async fn update_product(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
    Json(payload): Json<UpdateProduct>,
) -> Result<Json<Product>, ApiError> {
    if let Err(e) = payload.validate() {
        return Err(ApiError::BadRequest(e.to_string()));
    }

    let query = "UPDATE products SET name = $1, price = $2, quantity = $3 WHERE id = $4 RETURNING id, name, price, quantity, image_url, file_url";
    let product = sqlx::query_as::<_, Product>(query)
        .bind(&payload.name).bind(payload.price).bind(payload.quantity).bind(id)
        .fetch_optional(&pool).await?;

    match product {
        Some(p) => Ok(Json(p)),
        None => Err(ApiError::NotFound(format!("แก้ไขไม่ได้: ไม่พบสินค้า ID: {}", id))),
    }
}

pub async fn delete_product(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
) -> Result<StatusCode, ApiError> {
    let query = "DELETE FROM products WHERE id = $1";
    let result = sqlx::query(query).bind(id).execute(&pool).await?;

    if result.rows_affected() == 0 {
        Err(ApiError::NotFound(format!("ลบไม่ได้: ไม่พบสินค้า ID: {}", id)))
    } else {
        Ok(StatusCode::NO_CONTENT)
    }
}

// === เพิ่มฟังก์ชันอัปโหลดไฟล์ ===
pub async fn upload_product_files(
    State(pool): State<PgPool>,
    Path(id): Path<i32>,
    mut multipart: Multipart,
) -> Result<Json<Product>, ApiError> {
    // 1. เช็คก่อนว่ามีสินค้านี้อยู่จริงไหม
    let check_query = "SELECT id, name, price, quantity, image_url, file_url FROM products WHERE id = $1";
    let _ = sqlx::query_as::<_, Product>(check_query).bind(id).fetch_optional(&pool).await?
        .ok_or_else(|| ApiError::NotFound(format!("ไม่พบสินค้า ID: {}", id)))?;

    // 2. วนลูปอ่านไฟล์ที่ส่งมา (รองรับการส่งมาพร้อมกันหลายไฟล์)
    while let Some(field) = multipart.next_field().await.map_err(|_| ApiError::BadRequest("อ่านไฟล์ไม่สำเร็จ".to_string()))? {
        let field_name = field.name().unwrap_or("").to_string(); // ชื่อฟิลด์จาก Postman เช่น "image" หรือ "file"
        let file_name = field.file_name().unwrap_or("").to_string(); // ชื่อไฟล์ต้นฉบับ

        if file_name.is_empty() {
            continue;
        }

        // 3. สร้างชื่อไฟล์ใหม่แบบสุ่มด้วย Uuid เพื่อป้องกันชื่อซ้ำ
        let ext = file_name.split('.').last().unwrap_or("bin");
        let new_uuid = Uuid::new_v4().to_string(); // แปลง Uuid เป็น String แก้ Error แล้ว
        let unique_name = format!("{}.{}", new_uuid, ext);
        let save_path = format!("uploads/{}", unique_name); // จะเซฟไว้ในโฟลเดอร์ uploads

        // 4. อ่านข้อมูลไฟล์และเขียนลงดิสก์
        let data = field.bytes().await.map_err(|_| ApiError::InternalServerError("ไม่สามารถอ่านข้อมูลไฟล์ได้".to_string()))?;
        let mut file = File::create(&save_path).await.map_err(|_| ApiError::InternalServerError("สร้างไฟล์บนเซิร์ฟเวอร์ไม่ได้".to_string()))?;
        file.write_all(&data).await.map_err(|_| ApiError::InternalServerError("บันทึกไฟล์ไม่สำเร็จ".to_string()))?;

        let url = format!("/uploads/{}", unique_name);

        // 5. อัปเดตที่อยู่ไฟล์ลง Database ตามประเภทที่ส่งมา
        if field_name == "image" {
            sqlx::query("UPDATE products SET image_url = $1 WHERE id = $2")
                .bind(&url).bind(id).execute(&pool).await?;
        } else if field_name == "file" {
            sqlx::query("UPDATE products SET file_url = $1 WHERE id = $2")
                .bind(&url).bind(id).execute(&pool).await?;
        }
    }

    // 6. ดึงข้อมูลสินค้าที่อัปเดตแล้วส่งกลับไปให้ดู
    let fetch_query = "SELECT id, name, price, quantity, image_url, file_url FROM products WHERE id = $1";
    let updated_product = sqlx::query_as::<_, Product>(fetch_query).bind(id).fetch_one(&pool).await?;

    Ok(Json(updated_product))
}