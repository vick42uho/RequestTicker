"use client"

import React, { useEffect, useState } from "react"
import { SectionCards } from "@/components/dashboard/section-cards"
import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive"
import { TaskTable } from "@/components/dashboard/task-table"
import { RequestDetailSheet } from "@/components/shared/RequestDetailSheet"
import { fetchApi } from "@/lib/api"
import { RequestItem, PaginatedResponse, DashboardStats } from "@/types/request"
import { toast } from "sonner"

export default function DashboardPage() {
  const [tasks, setTasks] = useState<RequestItem[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    pending: 0,
    inProgress: 0,
    waitingVerify: 0,
    completedToday: 0
  })
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const handleViewRequest = (request: RequestItem) => {
    setSelectedRequest(request)
    setIsSheetOpen(true)
  }

  const refreshRequestData = async () => {
    if (!selectedRequest) return;
    try {
      const updatedReq = await fetchApi<RequestItem>(`/requests/${selectedRequest.id}`);
      setSelectedRequest(updatedReq);
      setTasks(prev => prev.map(t => t.id === updatedReq.id ? updatedReq : t));
    } catch (error) {
      console.error("Failed to refresh request data");
    }
  };

  useEffect(() => {
    async function loadStats() {
      try {
        setStatsLoading(true)
        const response = await fetchApi<any>("/requests/stats/summary")
        // Mapping จาก snake_case (Backend) เป็น camelCase (Frontend Interface)
        setStats({
          pending: response.pending,
          inProgress: response.in_progress,
          waitingVerify: response.waiting_verify,
          completedToday: response.completed_today
        })
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      } finally {
        setStatsLoading(false)
      }
    }

    async function loadTasks() {
      try {
        setLoading(true)
        
        // ดึง Role จาก localStorage เพื่อเลือก Filter ที่เหมาะสม
        let filter = "me"
        const storedUser = localStorage.getItem("user")
        if (storedUser) {
          const userData = JSON.parse(storedUser)
          if (userData.role === "admin" || userData.role === "agent") {
            filter = "all" 
          }
        }

        // ดึงแค่ 10 รายการล่าสุดสำหรับตาราง (สถิติดึงแยกจาก API สรุปแล้ว)
        const response = await fetchApi<PaginatedResponse<RequestItem>>(`/requests?filter=${filter}&limit=10`)
        setTasks(response.data)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        console.error("Failed to fetch tasks:", error)
        toast.error("ไม่สามารถโหลดข้อมูลใบงานได้: " + errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
    loadTasks()
  }, [])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards stats={stats} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <div className="px-4 lg:px-6">
        <h2 className="text-xl font-bold mb-4">รายการใบงานล่าสุด</h2>
        <TaskTable 
          data={tasks.slice(0, 10)} // แสดงแค่ 10 รายการล่าสุดในหน้าแรก
          loading={loading} 
          onView={handleViewRequest}
        />
      </div>

      <RequestDetailSheet 
        isOpen={isSheetOpen}
        onClose={setIsSheetOpen}
        request={selectedRequest}
        onRefresh={refreshRequestData}
      />
    </div>
  )
}