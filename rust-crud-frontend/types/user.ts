// types/user.ts

export interface User {
  id: number;
  username: string | null;      // ใช้ | null เทียบเท่ากับ Option<String> ใน Rust
  name: string;
  email: string;
  role: string;                 // "user", "worker", "admin"
  position: string | null;
  is_approver: boolean;         // ท่าไม้ตาย! แค่ติ๊กเป็น true คนนี้ก็จะสามารถเป็นคนอนุมัติได้
  department_id: number | null; // สังกัดแผนกไหน (สำคัญมาก เอาไว้จับคู่กับ target_department_id)
}