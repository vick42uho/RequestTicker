// lib/api.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

interface FetchOptions extends RequestInit {
  // เผื่อไว้ส่ง headers แบบ custom ถ้านอกเหนือจาก JSON (เช่นตอนอัปโหลดไฟล์)
  customHeaders?: HeadersInit; 
}

export async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  // 1. ดึง Token จาก localStorage (เฉพาะฝั่ง Client)
  let token = "";
  if (typeof window !== "undefined") {
    token = localStorage.getItem("token") || "";
  }

  // 2. ตั้งค่า Headers พื้นฐาน (ถ้าไม่อัปโหลดไฟล์ ให้เป็น JSON)
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...options.customHeaders,
  };

  // 3. แนบ Token เข้าไปใน Authorization Header อัตโนมัติ
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  // 4. ยิง Request ไปที่ Rust Backend
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // 5. ดักจับ Error ถ้า API ตอบกลับมาเป็น 400, 403, 404, 500
  if (!response.ok) {
    let errorMessage = `API Error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // ถ้า Backend ไม่ได้ตอบเป็น JSON
    }
    throw new Error(errorMessage);
  }

  // 6. กรณีลบข้อมูล (204 No Content) จะไม่มี JSON ให้ parse
  if (response.status === 204) {
    return null as any;
  }

  // 7. แปลงผลลัพธ์เป็น JSON ส่งกลับไปให้หน้า UI ใช้งาน
  return response.json();
}


