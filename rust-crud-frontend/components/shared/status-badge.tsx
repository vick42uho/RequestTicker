import React from "react";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  statusId: number;
  statusName: string;
  statusColor?: string | null;
  statusVariant?: string | null;
  className?: string;
}

// 🌟 สถานะและสี (Fallback)
const STATUS_STYLES: Record<number, string> = {
  1: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800", // รออนุมัติ
  2: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800", // รอรับงาน
  3: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800", // กำลังดำเนินการ
  4: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800", // เสร็จสิ้น / อนุมัติ
  5: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800", // ยกเลิก / ไม่อนุมัติ
  6: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800", // อนุมัติแล้ว
  7: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800", // รอตรวจสอบ
  8: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800", // แก้ไขงาน
  10: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700", // ร่าง
};

export function StatusBadge({ statusId, statusName, statusColor, statusVariant, className }: StatusBadgeProps) {
  // 🌟 ใช้สีจาก Local Map เพื่อความชัวร์ (แก้ปัญหา Tailwind Purge) หรือใช้จาก DB ถ้าไม่มีใน Map
  const dbColorClass = STATUS_STYLES[statusId] || statusColor || "bg-gray-100 text-gray-800 border-gray-200";
  
  return (
    <Badge 
      variant={(statusVariant as any) || "outline"} 
      className={`${dbColorClass} border shadow-none font-normal ${className || ""}`}
    >
      {statusName || "ไม่ทราบสถานะ"}
    </Badge>
  );
}
