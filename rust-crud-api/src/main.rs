pub mod error;
mod product;
mod user;
mod request;
pub mod middleware;
mod department;
pub mod manages;
pub mod tasks;

use axum::Router;
use sqlx::postgres::PgPoolOptions;
use std::env;
use tower_http::{cors::{Any, CorsLayer}, services::ServeDir};

#[tokio::main]
async fn main() {
    // 1. โหลด Environment Variables
    dotenvy::dotenv().expect("Failed to load .env file");
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // 2. เชื่อมต่อฐานข้อมูล
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");
    
    // === สร้างโฟลเดอร์ uploads อัตโนมัติถ้ายังไม่มี ===
    tokio::fs::create_dir_all("uploads").await.unwrap();
    

    // 3. ตั้งค่า CORS (ควรจำกัดเฉพาะ Origin ของ Frontend ในงานจริง)
    let cors = CorsLayer::new()
        .allow_origin(Any) // ใน Production ควรเปลี่ยน Any เป็น Origin ของ Frontend เช่น "http://localhost:3000"
        .allow_methods(Any)
        .allow_headers(Any);

    // 4. รวบรวม Router ทั้งหมดเข้าด้วยกัน
    let app = Router::new()
        .nest("/users", user::routes::create_router(pool.clone()))
        .nest("/products", product::routes::create_router(pool.clone()))
        .nest("/requests", request::routes::create_router(pool.clone()))
        .nest("/departments", department::routes::create_router(pool.clone()))
        .nest("/manage", manages::routes::create_router(pool.clone()))
        .nest("/tasks", tasks::routes::create_router(pool.clone()))
        // === สั่งให้เสิร์ฟไฟล์ทั้งหมดที่อยู่ในโฟลเดอร์ uploads ===
        .nest_service("/uploads", ServeDir::new("uploads")) 
        .layer(cors);

    // 5. เปิด Server
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001")
        .await
        .unwrap();
    println!("🔥 Server running successfully on http://127.0.0.1:3001");
    
    axum::serve(listener, app).await.unwrap();
}