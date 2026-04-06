use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use validator::Validate;

#[derive(Serialize, FromRow)]
pub struct Product {
    pub id: i32,
    pub name: String,
    pub price: f64,
    pub quantity: i32,
    pub image_url: Option<String>,
    pub file_url: Option<String>,
}

#[derive(Deserialize, Validate)]
pub struct CreateProduct {
    #[validate(length(min = 1, message = "ชื่อสินค้าไม่สามารถว่างได้"))]
    pub name: String,
    #[validate(range(min = 0.0, message = "ราคาสินค้าไม่สามารถเป็นลบได้"))]
    pub price: f64,
    #[validate(range(min = 0, message = "จำนวนสินค้าไม่สามารถเป็นลบได้"))]
    pub quantity: i32,
}

#[derive(Deserialize, Validate)]
pub struct UpdateProduct {
    #[validate(length(min = 1, message = "ชื่อสินค้าไม่สามารถว่างได้"))]
    pub name: String,
    #[validate(range(min = 0.0, message = "ราคาสินค้าไม่สามารถเป็นลบได้"))]
    pub price: f64,
    #[validate(range(min = 0, message = "จำนวนสินค้าไม่สามารถเป็นลบได้"))]
    pub quantity: i32,
}