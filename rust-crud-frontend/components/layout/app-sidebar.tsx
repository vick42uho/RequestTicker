"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import {
  IconHelp,
  IconSearch,
  IconInnerShadowTop,
} from "@tabler/icons-react"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavMain } from "./nav-main"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"
import { MENU_CONFIG } from "@/config/menu-config" // 🌟 นำเข้า Config

const navSecondary = [
  { title: "คู่มือการใช้งาน", url: "#", icon: IconHelp },
  { title: "ค้นหา", url: "#", icon: IconSearch },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [userData, setUserData] = useState({
    name: "Loading...",
    email: "",
    avatar: "/avatars/shadcn.jpg",
    role: "user",
  });

  const [filteredNav, setFilteredNav] = useState<any[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUserData(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    const isAgent = userData.role === "admin" || userData.role === "agent";
    const isAdmin = userData.role === "admin";
    const isManager = userData.role === "manager" || userData.role === "admin";

    // 🌟 กรองเมนูแบบ Dynamic
    const filtered = MENU_CONFIG.filter(item => {
      if (item.url === "/approvals") return isManager;
      if (item.url === "/tasks") return isAgent || isManager;
      if (item.url === "#" || item.url === "/admin") return isAdmin;
      return true;
    }).map(item => ({
      ...item,
      // ปรับแต่ง URL เฉพาะกิจตาม Role
      url: item.url === "/requests" 
        ? (isAgent ? "/requests?filter=all" : "/requests?filter=me") 
        : item.url
    }));

    setFilteredNav(filtered);
  }, [userData]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="p-1.5">
              <Link href="/">
                <IconInnerShadowTop className="size-5" />
                <span className="text-base font-semibold">System Requests</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={filteredNav} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      <NavUser user={userData} />
    </Sidebar>
  )
}