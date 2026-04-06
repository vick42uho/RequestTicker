"use client"

import Link from "next/link"
// 🌟 นำเข้า IconChevronRight เพิ่มเติมสำหรับทำลูกศรชี้ลง
import { IconCirclePlusFilled, IconMail, IconChevronRight, type Icon } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
// 🌟 นำเข้า Collapsible สำหรับทำ Dropdown
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    isActive?: boolean
    // 🌟 เพิ่มการรองรับ items (เมนูย่อย) ใน Typescript
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        
        {/* === ส่วนปุ่ม สร้างใบงาน (Quick Create) ของเดิมของพี่ === */}
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              asChild 
              tooltip="สร้างใบงานใหม่"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
            >
              <Link href="/requests/create">
                <IconCirclePlusFilled />
                <span>เปิดใบงานใหม่</span>
              </Link>
            </SidebarMenuButton>
            
            {/* <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <IconMail />
              <span className="sr-only">Inbox</span>
            </Button> */}
          </SidebarMenuItem>
        </SidebarMenu>

        {/* === ส่วนเมนูหลักที่รับมาจาก AppSidebar === */}
        <SidebarMenu>
          {items.map((item) => {
            
            // 🌟 เช็คว่าถ้ามีเมนูย่อย ให้แสดงแบบ Dropdown (Collapsible)
            if (item.items && item.items.length > 0) {
              return (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={item.isActive}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={item.title}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        {/* ลูกศรจะหมุน 90 องศาเวลากดกางเมนู */}
                        <IconChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild>
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            }

            // 🌟 ถ้าไม่มีเมนูย่อย ก็แสดงเป็นปุ่มลิงก์ปกติ
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
        
      </SidebarGroupContent>
    </SidebarGroup>
  )
}