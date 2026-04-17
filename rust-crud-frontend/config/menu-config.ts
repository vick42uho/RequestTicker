import {
  IconDashboard,
  IconTicket,
  IconChecklist,
  IconTools,
  IconSettings,
  type Icon,
} from "@tabler/icons-react"

export interface MenuItem {
  title: string
  url: string
  icon?: Icon
  items?: {
    title: string
    url: string
  }[]
}

export const MENU_CONFIG: MenuItem[] = [
  {
    title: "หน้าหลัก (Dashboard)",
    url: "/",
    icon: IconDashboard,
  },
  {
    title: "รายการใบงาน",
    url: "/requests",
    icon: IconTicket,
  },
  {
    title: "รอฉันอนุมัติ",
    url: "/approvals",
    icon: IconChecklist,
  },
  {
    title: "คลังงาน",
    url: "/tasks",
    icon: IconTools,
  },
  {
    title: "จัดการระบบ (Admin)",
    url: "#",
    icon: IconSettings,
    items: [
      {
        title: "จัดการผู้ใช้งาน",
        url: "/admin",
      },
      {
        title: "จัดการให้คะแนน",
        url: "/admin/rating",
      },
      {
        title: "ตั้งค่าข้อมูลพื้นฐาน",
        url: "/admin/master-data",
      },
    ],
  },
]

// 🌟 ฟังก์ชันหาชื่อเมนูจาก URL สำหรับ Breadcrumb (หาได้ทั้งเมนูหลักและเมนูย่อย)
export function getTitleByPath(path: string): string | null {
  const cleanPath = path.split('?')[0] // ตัดพวก ?filter=... ออกก่อนเทียบ

  for (const item of MENU_CONFIG) {
    if (item.url === cleanPath) return item.title
    if (item.items) {
      const subItem = item.items.find((sub) => sub.url === cleanPath)
      if (subItem) return subItem.title
    }
  }
  return null
}