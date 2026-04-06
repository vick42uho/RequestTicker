use axum::{routing::{get, post}, Router};
use sqlx::PgPool;
use super::handlers::{create_product, delete_product, get_product, get_products, update_product, upload_product_files};

pub fn create_router(pool: PgPool) -> Router {
    Router::new()
        .route("/", get(get_products).post(create_product))
        .route("/:id", get(get_product).put(update_product).delete(delete_product))
        // เพิ่มเส้นทางสำหรับอัปโหลดไฟล์ ผูกกับ ID สินค้า
        .route("/:id/upload", post(upload_product_files))
        .with_state(pool)
}