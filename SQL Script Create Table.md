-- ==========================================================
-- 1. Master Data Tables (ตารางข้อมูลหลัก)
-- ==========================================================

-- m_departments: แผนก
CREATE TABLE m_departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    del_flag BOOLEAN DEFAULT FALSE
);

-- m_request_types: ประเภทคำขอหลัก
CREATE TABLE m_request_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    responsible_dept_id INTEGER REFERENCES m_departments(id),
    del_flag BOOLEAN DEFAULT FALSE
);

-- m_topics: หัวข้อหลัก
CREATE TABLE m_topics (
    id SERIAL PRIMARY KEY,
    type_id INTEGER NOT NULL REFERENCES m_request_types(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    del_flag BOOLEAN DEFAULT FALSE
);

-- m_subjects: หัวข้อย่อย (รายละเอียดปัญหา)
CREATE TABLE m_subjects (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES m_topics(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    requires_approval BOOLEAN DEFAULT FALSE,
    requires_receiver_approval BOOLEAN DEFAULT FALSE,
    is_other BOOLEAN DEFAULT FALSE,
    del_flag BOOLEAN DEFAULT FALSE
);

-- m_status: สถานะใบงาน (พร้อมข้อมูลเริ่มต้น)
CREATE TABLE m_status (
    id SERIAL PRIMARY KEY,
    name_th VARCHAR(255) NOT NULL,
    badge_variant VARCHAR(50),
    color_class VARCHAR(255)
);

INSERT INTO m_status (id, name_th, badge_variant, color_class) VALUES
(1, 'รอดำเนินการ', 'secondary', 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 border-yellow-200'),
(2, 'รออนุมัติ', 'outline', 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-500 border-orange-200'),
(3, 'กำลังดำเนินการ', 'outline', 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200'),
(4, 'เสร็จสิ้น', 'outline', 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200'),
(5, 'ไม่อนุมัติ / ยกเลิก', 'destructive', 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200'),
(6, 'อนุมัติแล้ว', 'outline', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-500 border-emerald-200'),
(7, 'รอคิว', 'outline', 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200'),
(8, 'รอผู้รับงานอนุมัติ', 'warning', 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500 border-amber-200'),
(9, 'รอการตรวจรับ', 'outline', 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200'),
(10, 'รอผู้อนุมัติร่วม', 'default', 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200');

-- ==========================================================
-- 2. Transaction & User Tables (ตารางข้อมูลผู้ใช้และใบงาน)
-- ==========================================================

-- users: ข้อมูลผู้ใช้งาน
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE,
    username VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user', -- admin, technician, user
    position VARCHAR(255),
    department_id INTEGER REFERENCES m_departments(id),
    is_active BOOLEAN DEFAULT TRUE
);

-- สร้าง Admin เริ่มต้น (password: admin123 - ตัวอย่าง hash)
INSERT INTO users (username, name, email, role, is_active) 
VALUES ('admin', 'System Administrator', 'admin@example.com', 'admin', TRUE);

-- requests: ตารางหลักใบงาน
CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    req_code VARCHAR(50) NOT NULL UNIQUE,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    subject_id INTEGER NOT NULL REFERENCES m_subjects(id),
    phone_number VARCHAR(50),
    requirement VARCHAR(255),
    description TEXT NOT NULL,
    file_url TEXT,
    status_id INTEGER REFERENCES m_status(id) DEFAULT 1,
    approver_id INTEGER REFERENCES users(id),
    recorded_by INTEGER NOT NULL REFERENCES users(id),
    request_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    start_date TIMESTAMPTZ,
    plan_start_date TIMESTAMPTZ,
    plan_finish_date TIMESTAMPTZ,
    actual_start_date TIMESTAMPTZ,
    actual_finish_date TIMESTAMPTZ,
    resolution_note TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP
);

-- request_assignees: ตารางเก็บข้อมูลผู้รับผิดชอบงาน
CREATE TABLE request_assignees (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    assignee_id INTEGER NOT NULL REFERENCES users(id),
    assigned_by INTEGER NOT NULL REFERENCES users(id),
    assigned_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- request_approvals: ตารางประวัติการอนุมัติและการดำเนินการ
CREATE TABLE request_approvals (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    approver_id INTEGER REFERENCES users(id),
    status_id INTEGER REFERENCES m_status(id),
    approve_step INTEGER NOT NULL DEFAULT 1,
    approval_type VARCHAR(50), -- e.g., 'DEPARTMENT', 'RECEIVER', 'START_TASK', 'CLOSE_TASK'
    comment TEXT,
    action_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);