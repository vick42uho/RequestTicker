# Rust CRUD System (Full-Stack)

โปรเจคนี้เป็นระบบจัดการข้อมูล (CRUD) แบบ Full-Stack ที่พัฒนาด้วย Rust ในส่วนของ Backend และ Next.js ในส่วนของ Frontend โดยเน้นความเร็ว ความปลอดภัย และ UI ที่ทันสมัย

## 🏗️ โครงสร้างโปรเจค

- **`rust-crud-api/`**: ส่วนของ Backend พัฒนาด้วยภาษา Rust
- **`rust-crud-frontend/`**: ส่วนของ Frontend พัฒนาด้วย Next.js (App Router)
- **`SQL Script Create Table.md`**: ไฟล์สคริปต์ SQL สำหรับสร้างฐานข้อมูล PostgreSQL

## 🛠️ Tech Stack

### Backend (Rust)
- **Framework**: [Axum](https://github.com/tokio-rs/axum) (Web framework ที่รันบน Tokio)
- **Runtime**: [Tokio](https://tokio.rs/) (Asynchronous runtime)
- **Database**: [PostgreSQL](https://www.postgresql.org/) พร้อม [SQLx](https://github.com/launchbadge/sqlx) (Type-safe SQL)
- **Authentication**: JWT (JSON Web Token) และ Argon2 สำหรับการ Hash รหัสผ่าน
- **Validation**: Validator crate สำหรับตรวจสอบความถูกต้องของข้อมูล
- **Features**: ระบบจัดการไฟล์อัปโหลด (Static files), CORS, และ Error handling แบบรวมศูนย์

### Frontend (Next.js)
- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router) + [React 19+](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) + [Shadcn/UI](https://ui.shadcn.com/)
- **State & Form**: React Hook Form + Zod (Schema Validation)
- **Components**: Radix UI, Lucide React, TanStack Table (Data Table), และ Recharts (Dashboard Charts)
- **Icons**: Tabler Icons และ Remix Icon

## 📋 ฟีเจอร์หลักของระบบ

1. **User Management**: ระบบสมาชิก, การเข้าสู่ระบบ (Login/Signup) และการจัดการบทบาท (Roles: Admin, Agent, User, Manager)
2. **Request System**: ระบบส่งคำขอ (Tickets) พร้อมแนบไฟล์ภาพหรือเอกสาร
3. **Task Management**: การมอบหมายงานและติดตามสถานะงาน
4. **Approval Workflow**: ระบบอนุมัติคำขอตามลำดับขั้น (Department, Receiver approval)
5. **Dashboard**: แสดงสถิติข้อมูลในรูปแบบกราฟ (Interactive Charts) และตารางข้อมูล
6. **Master Data**: การจัดการข้อมูลพื้นฐาน เช่น แผนก (Departments), ประเภทคำขอ (Request Types), และหัวข้อปัญหา (Topics/Subjects)

## 🚀 วิธีการเริ่มใช้งาน

### 1. การตั้งค่าฐานข้อมูล (Database)
- ใช้ PostgreSQL และรันสคริปต์จากไฟล์ `SQL Script Create Table.md` เพื่อสร้างตารางข้อมูลและข้อมูลเริ่มต้น (Master data)

### 2. Backend (rust-crud-api)
- เข้าไปที่โฟลเดอร์: `cd rust-crud-api`
- สร้างไฟล์ `.env` และกำหนดค่า `DATABASE_URL`
- รันโปรเจค:
  ```bash
  cargo watch -c -w src -x run
  ```

### 3. Frontend (rust-crud-frontend)
- เข้าไปที่โฟลเดอร์: `cd rust-crud-frontend`
- ติดตั้ง dependencies:
  ```bash
  bun install  # หรือ npm install
  ```
- รันโปรเจค:
  ```bash
  bun dev      # หรือ npm run dev
  ```

---
© 2024 Project 2568 - Rust & Next.js CRUD API
