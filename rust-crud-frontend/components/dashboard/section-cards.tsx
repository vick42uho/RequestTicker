import { IconTicket, IconLoader, IconCheck, IconAlertCircle } from "@tabler/icons-react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SectionCardsProps {
  stats: {
    pending: number;
    inProgress: number;
    waitingVerify: number;
    completedToday: number;
  }
}

export function SectionCards({ stats }: SectionCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card bg-orange-50/50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardDescription className="text-orange-700 dark:text-orange-400 font-medium">รออนุมัติ</CardDescription>
          <IconAlertCircle className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardHeader className="pt-0">
          <CardTitle className="text-2xl font-bold tabular-nums text-orange-900 dark:text-orange-100">
            {stats.pending}
          </CardTitle>
          <p className="text-xs text-orange-600/80 dark:text-orange-400/60 mt-1">ใบงานที่รอหัวหน้าอนุมัติ</p>
        </CardHeader>
      </Card>

      <Card className="@container/card bg-blue-50/50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardDescription className="text-blue-700 dark:text-blue-400 font-medium">กำลังดำเนินการ</CardDescription>
          <IconLoader className="h-4 w-4 text-blue-600 animate-spin-slow" />
        </CardHeader>
        <CardHeader className="pt-0">
          <CardTitle className="text-2xl font-bold tabular-nums text-blue-900 dark:text-blue-100">
            {stats.inProgress}
          </CardTitle>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/60 mt-1">งานที่ช่างกำลังดำเนินการอยู่</p>
        </CardHeader>
      </Card>

      <Card className="@container/card bg-purple-50/50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardDescription className="text-purple-700 dark:text-purple-400 font-medium">รอตรวจรับ</CardDescription>
          <IconTicket className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardHeader className="pt-0">
          <CardTitle className="text-2xl font-bold tabular-nums text-purple-900 dark:text-purple-100">
            {stats.waitingVerify}
          </CardTitle>
          <p className="text-xs text-purple-600/80 dark:text-purple-400/60 mt-1">งานที่เสร็จแล้ว รอผู้แจ้งยืนยัน</p>
        </CardHeader>
      </Card>

      <Card className="@container/card bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardDescription className="text-emerald-700 dark:text-emerald-400 font-medium">เสร็จสิ้นวันนี้</CardDescription>
          <IconCheck className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardHeader className="pt-0">
          <CardTitle className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
            {stats.completedToday}
          </CardTitle>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/60 mt-1">ใบงานที่ปิดสำเร็จในวันนี้</p>
        </CardHeader>
      </Card>
    </div>
  )
}
