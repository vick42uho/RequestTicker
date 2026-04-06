"use client";

import { RiSettings3Line, RiFolderSettingsLine, RiNodeTree, RiPriceTag3Line } from "@remixicon/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TypesTab from "./components/types-tab";
import TopicsTab from "./components/topics-tab";
import SubjectsTab from "./components/subjects-tab";

// Import Components ที่เราแยกไว้


export default function MasterDataAdminPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 bg-background min-h-screen">
      {/* 🟢 Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <RiSettings3Line className="h-7 w-7" />
            </div>
            จัดการข้อมูลพื้นฐาน
          </h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
            ตั้งค่าโครงสร้างประเภทบริการ (Types), หมวดหมู่ (Topics) และหัวข้อปัญหา (Subjects) รวมถึงกำหนดสายอนุมัติของแต่ละเรื่อง
          </p>
        </div>
      </div>

      {/* 🟢 Tabs Section */}
      <Tabs defaultValue="types" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-xl w-full sm:w-auto overflow-x-auto flex justify-start">
          <TabsTrigger value="types" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
            <RiFolderSettingsLine className="h-4 w-4" /> ประเภทบริการ (Types)
          </TabsTrigger>
          <TabsTrigger value="topics" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
            <RiNodeTree className="h-4 w-4" /> หมวดหมู่ (Topics)
          </TabsTrigger>
          <TabsTrigger value="subjects" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
            <RiPriceTag3Line className="h-4 w-4" /> หัวข้อปัญหา (Subjects)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="focus-visible:outline-none"><TypesTab /></TabsContent>
        <TabsContent value="topics" className="focus-visible:outline-none"><TopicsTab /></TabsContent>
        <TabsContent value="subjects" className="focus-visible:outline-none"><SubjectsTab /></TabsContent>
      </Tabs>
    </div>
  );
}