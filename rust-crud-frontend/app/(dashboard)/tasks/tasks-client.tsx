"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";
import {
  RiLoader4Line,
  RiFileList3Line,
  RiInformationLine,
  RiUserLine,
  RiCommunityLine,
  RiTimeLine,
  RiArrowDownSLine,
  RiCheckLine,
  RiCloseLine,
  RiUserSharedLine,
  RiToolsLine,
  RiPhoneLine,
  RiCalendarCheckLine,
  RiAlertLine,
  RiPlayCircleLine,
  RiCheckDoubleLine,
  RiExternalLinkLine,
} from "@remixicon/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { RequestHoverCard } from "@/components/shared/RequestHoverCard";
import { RequestDetailSheet } from "@/components/shared/RequestDetailSheet";

// --- Interfaces ---
interface HelpdeskRequest {
  id: number;
  req_code: string;
  requester_name: string | null;
  requester_phone: string | null;
  subject_name: string | null;
  topic_name: string | null;
  type_name: string | null;
  requirement: string | null;
  description: string;
  request_date: string;
  status_id: number;
  status_name: string;
  status_variant: string | null;
  status_color: string | null;
  assignees?: any[];
  plan_start_date?: string;
  plan_finish_date?: string;
  actual_start_date?: string;
  actual_finish_date?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total_records: number;
  total_pages: number;
  current_page: number;
  limit: number;
}

function TasksInnerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 💡 สมมติค่า role ของผู้ใช้ปัจจุบัน (ใช้ของจริงจาก Auth Context ของพี่ได้เลยครับ)
  const userRole = "MANAGER";

  const [tasks, setTasks] = useState<HelpdeskRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const filterParam = searchParams.get("filter") || "dept_tasks";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const [currentFilter, setCurrentFilter] = useState(filterParam);

  const [technicians, setTechnicians] = useState<any[]>([]);

  // States สำหรับ Dialog "จัดการ"
  const [managePrompt, setManagePrompt] = useState<HelpdeskRequest | null>(
    null
  );
  const [planStartDate, setPlanStartDate] = useState("");
  const [planFinishDate, setPlanFinishDate] = useState("");
  const [actualFinishDate, setActualFinishDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States สำหรับ Sheet "รายละเอียดใบงานพรีเมียม"
  const [selectedRequest, setSelectedRequest] =
    useState<HelpdeskRequest | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  

  useEffect(() => {
    if (filterParam !== currentFilter) setCurrentFilter(filterParam);
  }, [filterParam, currentFilter]);

  const loadTechnicians = useCallback(async () => {
    try {
      const data = await fetchApi<any[]>("/tasks/dept/agents", {
        method: "GET",
      });
      setTechnicians(data || []);
    } catch (error) {
      console.error("Failed to load technicians");
    }
  }, []);

  const loadTasks = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setIsLoading(true);

        // ใช้ endpoint /requests ที่รองรับ Pagination เลขหน้าอยู่แล้ว
        const url = `/requests?filter=${currentFilter}&page=${currentPage}&limit=10`;

        const res = await fetchApi<PaginatedResponse<HelpdeskRequest>>(url, { method: "GET" });

        setTasks(res.data);
        setTotalPages(res.total_pages);
        setTotalRecords(res.total_records);
      } catch (error: any) {
        toast.error("ดึงข้อมูลไม่สำเร็จ");
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [currentFilter, currentPage]
  );

  useEffect(() => {
    loadTasks();
    loadTechnicians();
  }, [currentFilter, currentPage, loadTasks, loadTechnicians]);

  const handleTabChange = (value: string) => {
    setCurrentFilter(value);
    router.push(`/tasks?filter=${value}&page=1`);
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    router.push(`/tasks?filter=${currentFilter}&page=${pageNumber}`);
  };

  // 🌟 ฟังก์ชันสำหรับสร้างรายการหน้า (Pagination Logic)
  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              onClick={(e) => { e.preventDefault(); goToPage(i); }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            href="#"
            onClick={(e) => { e.preventDefault(); goToPage(1); }}
            isActive={currentPage === 1}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      if (currentPage > 3) {
        items.push(<PaginationItem key="ellipsis-start"><PaginationEllipsis /></PaginationItem>);
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (i === 1 || i === totalPages) continue;
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              onClick={(e) => { e.preventDefault(); goToPage(i); }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      if (currentPage < totalPages - 2) {
        items.push(<PaginationItem key="ellipsis-end"><PaginationEllipsis /></PaginationItem>);
      }

      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            href="#"
            onClick={(e) => { e.preventDefault(); goToPage(totalPages); }}
            isActive={currentPage === totalPages}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }
    return items;
  };

  // 🌟 ฟังก์ชันเปิด Sheet รายละเอียด
  const openDetails = (e: React.MouseEvent, req: HelpdeskRequest) => {
    e.stopPropagation();
    setSelectedRequest(req);
    setIsSheetOpen(true);
  };

  // 🌟 ฟังก์ชัน Auto-Save ผู้รับผิดชอบงาน
  const handleAssigneesChange = async (
    reqId: number,
    newAssigneeIds: number[]
  ) => {
    try {
      // อัปเดต UI ทันทีเพื่อความลื่นไหล
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === reqId) {
            const updatedAssignees = technicians.filter((tech) =>
              newAssigneeIds.includes(tech.id)
            );
            return { ...t, assignees: updatedAssignees };
          }
          return t;
        })
      );

      // ยิง API บันทึกอัตโนมัติ
      await fetchApi(`/tasks/${reqId}/assignees`, {
        method: "POST",
        body: JSON.stringify({ assignee_ids: newAssigneeIds }),
      });
      toast.success("บันทึกผู้รับผิดชอบอัตโนมัติ");
    } catch (error) {
      toast.error("บันทึกไม่สำเร็จ กรุณาลองใหม่");
      loadTasks(false); // Rollback UI
    }
  };

  // 🌟 เปิด Dialog จัดการ (Manage Task)
  const handleOpenManageDialog = (
    e: React.MouseEvent,
    req: HelpdeskRequest
  ) => {
    e.stopPropagation();
    setManagePrompt(req);

    setPlanStartDate(
      req.plan_start_date
        ? new Date(req.plan_start_date).toISOString().slice(0, 16)
        : ""
    );
    setPlanFinishDate(
      req.plan_finish_date
        ? new Date(req.plan_finish_date).toISOString().slice(0, 16)
        : ""
    );

    if (req.actual_start_date && !req.actual_finish_date) {
      setActualFinishDate(new Date().toISOString().slice(0, 16));
    } else {
      setActualFinishDate(
        req.actual_finish_date
          ? new Date(req.actual_finish_date).toISOString().slice(0, 16)
          : ""
      );
    }
  };

  const handleStartTask = async () => {
    if (!managePrompt) return;
    setIsSubmitting(true);
    try {
      await fetchApi(`/tasks/${managePrompt.id}/start`, {
        method: "POST",
        body: JSON.stringify({
          plan_start_date: new Date(planStartDate).toISOString(),
          plan_finish_date: new Date(planFinishDate).toISOString(),
        }),
      });
      toast.success("บันทึกรับงานและเริ่มดำเนินการเรียบร้อย!");
      setManagePrompt(null);
      loadTasks(false);
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาดในการเริ่มงาน");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseTask = async () => {
    if (!managePrompt) return;
    setIsSubmitting(true);
    try {
      await fetchApi(`/tasks/${managePrompt.id}/close`, {
        method: "POST",
        body: JSON.stringify({
          actual_finish_date: new Date(actualFinishDate).toISOString(),
        }),
      });
      toast.success("ปิดงานสำเร็จ!");
      setManagePrompt(null);
      loadTasks(false);
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาดในการปิดงาน");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <RiToolsLine className="h-8 w-8 text-primary" />
            รายการปฏิบัติงาน
          </h1>
        </div>
      </div>

      <Tabs
        value={currentFilter}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="dept_tasks" className="flex items-center gap-2">
            <RiCommunityLine className="h-4 w-4" /> งานทั้งหมดของแผนก
          </TabsTrigger>
          <TabsTrigger value="my_tasks" className="flex items-center gap-2">
            <RiUserLine className="h-4 w-4" /> งานของฉัน
          </TabsTrigger>
        </TabsList>

        <Card className="rounded-xl overflow-hidden border shadow-sm flex flex-col">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[150px]">รหัสใบงาน</TableHead>
                <TableHead>รายละเอียด / ปัญหา</TableHead>
                <TableHead className="w-[180px]">ผู้รับผิดชอบ</TableHead>
                <TableHead className="w-[160px]">กำหนดเสร็จ (SLA)</TableHead>
                <TableHead className="w-[140px]">สถานะ</TableHead>
                <TableHead className="text-right w-[100px]">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <RiLoader4Line className="h-8 w-8 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-40 text-center text-muted-foreground"
                  >
                    ไม่มีข้อมูลใบงาน
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((req) => (
                  <TableRow
                    key={req.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={(e) => openDetails(e, req)} // 🌟 คลิกแถวเปิด Sheet
                  >
                    {/* รหัสใบงาน */}
                    <TableCell className="align-top font-bold text-primary">
                      {req.req_code}
                      <div className="text-[11px] text-muted-foreground mt-1 font-normal flex items-center gap-1">
                        <RiTimeLine className="h-3 w-3" />
                        {new Date(req.request_date).toLocaleDateString("th-TH")}
                      </div>
                    </TableCell>

                    {/* รายละเอียด + Hover ข้อมูลผู้แจ้ง */}
                    <TableCell className="max-w-87.5 py-3">
                      <div className="flex flex-col">
                        <RequestHoverCard request={req}>
                          {/* สิ่งที่อยู่ตรงนี้คือ Trigger (หน้าตาข้อความในตาราง) */}
                          <div className="flex items-center gap-1.5 cursor-pointer group max-w-[300px]">
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate text-sm">
                              {req.subject_name || "ไม่ระบุหัวข้อ"}
                              {req.requirement && ` : ${req.requirement}`}
                            </span>
                            {(req.description || req.requirement) && (
                              <RiInformationLine className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                            )}
                          </div>
                        </RequestHoverCard>

                        <span className="text-[11px] font-medium text-muted-foreground mt-1 flex items-center gap-1.5">
                          <span className="bg-muted px-1.5 py-0.5 rounded text-foreground/70">
                            {req.type_name}
                          </span>
                          {req.topic_name && (
                            <>
                              <span>•</span>
                              <span>{req.topic_name}</span>
                            </>
                          )}
                        </span>
                      </div>
                    </TableCell>

                    {/* 🌟 ผู้รับผิดชอบ (Avatar Group + Auto-save) */}
                    <TableCell
                      className="align-top"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {userRole === "MANAGER" || userRole === "ADMIN" ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border min-w-[120px]">
                              <div className="flex -space-x-2 overflow-hidden">
                                {req.assignees && req.assignees.length > 0 ? (
                                  req.assignees.map((assignee) => (
                                    <HoverCard
                                      key={assignee.id}
                                      openDelay={200}
                                    >
                                      <HoverCardTrigger asChild>
                                        <Avatar className="w-8 h-8 border-2 border-background hover:z-10 transition-transform hover:scale-110">
                                          <AvatarImage
                                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${assignee.name}&backgroundColor=e2e8f0`}
                                          />
                                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                            {assignee.name
                                              .substring(0, 2)
                                              .toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                      </HoverCardTrigger>
                                      <HoverCardContent
                                        side="top"
                                        className="w-auto p-3 text-sm shadow-md z-50"
                                      >
                                        <div className="font-bold flex items-center gap-2">
                                          <RiUserLine className="w-4 h-4 text-muted-foreground" />
                                          {assignee.name}
                                        </div>
                                        <div className="text-muted-foreground flex items-center gap-2 mt-1.5">
                                          <RiPhoneLine className="w-4 h-4" />
                                          {assignee.phone_number ||
                                            "ไม่มีเบอร์โทรศัพท์"}
                                        </div>
                                      </HoverCardContent>
                                    </HoverCard>
                                  ))
                                ) : (
                                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-gray-400 hover:border-primary hover:text-primary transition-colors">
                                    <RiUserLine className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                              {(!req.assignees ||
                                req.assignees.length === 0) && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  มอบหมาย...
                                </span>
                              )}
                              {req.assignees && req.assignees.length > 0 && (
                                <span className="text-xs text-muted-foreground ml-1 font-medium bg-secondary px-1.5 py-0.5 rounded-full">
                                  {req.assignees.length} คน
                                </span>
                              )}
                            </div>
                          </PopoverTrigger>

                          <PopoverContent
                            className="w-[260px] p-0"
                            align="start"
                          >
                            <Command>
                              <CommandInput
                                placeholder="ค้นหาชื่อผู้รับผิดชอบ..."
                                className="h-9"
                              />
                              <CommandList>
                                <CommandEmpty>
                                  ไม่พบรายชื่อผู้รับผิดชอบ
                                </CommandEmpty>
                                <CommandGroup>
                                  {technicians.map((agent) => {
                                    const isSelected = req.assignees?.some(
                                      (a) => a.id === agent.id
                                    );
                                    return (
                                      <CommandItem
                                        key={agent.id}
                                        onSelect={() => {
                                          let newSelected;
                                          if (isSelected) {
                                            newSelected = (req.assignees || [])
                                              .filter((a) => a.id !== agent.id)
                                              .map((a) => a.id);
                                          } else {
                                            newSelected = [
                                              ...(req.assignees || []).map(
                                                (a) => a.id
                                              ),
                                              agent.id,
                                            ];
                                          }
                                          handleAssigneesChange(
                                            req.id,
                                            newSelected
                                          );
                                        }}
                                        className="flex items-center justify-between cursor-pointer py-2"
                                      >
                                        <div className="flex items-center gap-2">
                                          <Avatar className="w-7 h-7">
                                            <AvatarImage
                                              src={`https://api.dicebear.com/7.x/initials/svg?seed=${agent.name}&backgroundColor=e2e8f0`}
                                            />
                                            <AvatarFallback className="text-[10px]">
                                              {agent.name.substring(0, 2)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                              {agent.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                              <RiPhoneLine className="w-3 h-3" />
                                              {agent.phone_number || "-"}
                                            </span>
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <div className="bg-primary/20 text-primary p-1 rounded-full">
                                            <RiCheckLine className="w-3 h-3 font-bold" />
                                          </div>
                                        )}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="flex -space-x-2 overflow-hidden py-1">
                          {req.assignees && req.assignees.length > 0 ? (
                            req.assignees.map((assignee) => (
                              <HoverCard key={assignee.id} openDelay={200}>
                                <HoverCardTrigger asChild>
                                  <Avatar className="w-8 h-8 border-2 border-background hover:z-10 transition-transform hover:scale-110 cursor-default">
                                    <AvatarImage
                                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${assignee.name}&backgroundColor=e2e8f0`}
                                    />
                                    <AvatarFallback className="text-xs">
                                      {assignee.name
                                        .substring(0, 2)
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </HoverCardTrigger>
                                <HoverCardContent
                                  side="top"
                                  className="w-auto p-3 text-sm shadow-md z-50"
                                >
                                  <div className="font-bold flex items-center gap-2">
                                    <RiUserLine className="w-4 h-4 text-muted-foreground" />
                                    {assignee.name}
                                  </div>
                                  <div className="text-muted-foreground flex items-center gap-2 mt-1.5">
                                    <RiPhoneLine className="w-4 h-4" />
                                    {assignee.phone_number ||
                                      "ไม่มีเบอร์โทรศัพท์"}
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              - ยังไม่ระบุ -
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* กำหนดเสร็จ (SLA) */}
                    <TableCell className="align-top">
                      {req.plan_finish_date ? (
                        <div className="text-xs flex items-center gap-1 text-emerald-600 font-medium mt-1">
                          <RiCalendarCheckLine className="h-3.5 w-3.5" />
                          {new Date(req.plan_finish_date).toLocaleString(
                            "th-TH",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}{" "}
                          น.
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic mt-1 inline-block">
                          ยังไม่กำหนด
                        </span>
                      )}
                    </TableCell>

                    {/* สถานะ */}
                    <TableCell className="align-top">
                      <StatusBadge
                        statusId={req.status_id}
                        statusName={req.status_name}
                        statusColor={req.status_color}
                        statusVariant={req.status_variant}
                      />
                    </TableCell>

                    {/* จัดการ (เปิด Dialog) */}
                    <TableCell
                      className="text-right align-top"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                        onClick={(e) => handleOpenManageDialog(e, req)}
                      >
                        <RiToolsLine className="h-4 w-4 mr-1" /> จัดการ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* ส่วนแบ่งหน้า (Pagination) */}
          {!isLoading && tasks.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 bg-muted/20 border-t border-border gap-4">
              <div className="text-sm text-muted-foreground order-2 sm:order-1">
                แสดงหน้า <span className="font-medium text-foreground">{currentPage}</span> จาก <span className="font-medium text-foreground">{totalPages}</span> (รวม <span className="font-medium text-foreground">{totalRecords}</span> รายการ)
              </div>

              <div className="order-1 sm:order-2">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); goToPage(currentPage - 1); }}
                        className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {renderPaginationItems()}

                    <PaginationItem>
                      <PaginationNext 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); goToPage(currentPage + 1); }}
                        className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          )}
        </Card>
      </Tabs>

      {/* ================= 🌟 DIALOG จัดการ (รับงาน / ปิดงาน) ================= */}
      <Dialog
        open={!!managePrompt}
        onOpenChange={(open) => !open && setManagePrompt(null)}
      >
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RiToolsLine className="text-primary" />
              จัดการใบงาน:{" "}
              <span className="text-primary">{managePrompt?.req_code}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-5">
            {[2, 7, 8, 10].includes(managePrompt?.status_id || 0) ? (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-6 rounded-xl flex flex-col items-center gap-4 text-center">
                <div className="h-12 w-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                  <RiAlertLine className="h-6 w-6 text-amber-600 dark:text-amber-500 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-amber-900 dark:text-amber-100 text-lg">อยู่ระหว่างรอการอนุมัติ</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                    ใบงานนี้ยังไม่ผ่านการอนุมัติครบตามขั้นตอนของระบบ <br />
                    กรุณารอให้ผู้อนุมัติพิจารณาให้เสร็จสิ้น <br />
                    จึงจะสามารถเริ่มบันทึกเวลาปฏิบัติงานได้
                  </p>
                </div>
                <Badge className="bg-amber-500 text-white border-none px-3 py-1">
                  {managePrompt?.status_name}
                </Badge>
              </div>
            ) : !managePrompt?.actual_start_date ? (
              <>
                <div className="bg-muted/30 p-3 rounded-md border border-dashed mb-2">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <RiInformationLine className="h-4 w-4" />{" "}
                    กำหนดเวลาเพื่อเริ่มงาน
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    วันที่ประมาณการเริ่ม <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={planStartDate}
                    onChange={(e) => setPlanStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    วันที่ประมาณการเสร็จ (SLA){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={planFinishDate}
                    onChange={(e) => setPlanFinishDate(e.target.value)}
                  />
                </div>

                {planStartDate && planFinishDate && (
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 mt-4 h-10"
                    onClick={handleStartTask}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <RiLoader4Line className="animate-spin mr-2 h-5 w-5" />
                    ) : (
                      <RiPlayCircleLine className="mr-2 h-5 w-5" />
                    )}
                    รับงาน (เริ่มดำเนินการทันที)
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="bg-blue-50/50 p-4 rounded-md border border-blue-100 space-y-3">
                  <div className="flex justify-between items-center border-b border-blue-100 pb-2">
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      เวลาที่ประเมินไว้ (Plan)
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-blue-100 text-blue-700 border-none text-[10px]"
                    >
                      In Progress
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">เริ่ม:</p>
                      <p className="font-medium">
                        {new Date(managePrompt.plan_start_date!).toLocaleString(
                          "th-TH",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        เสร็จ (SLA):
                      </p>
                      <p className="font-medium text-amber-600">
                        {new Date(
                          managePrompt.plan_finish_date!
                        ).toLocaleString("th-TH", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                    <RiCheckDoubleLine className="h-4 w-4" />{" "}
                    วันที่สิ้นสุดงานจริง <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={actualFinishDate}
                    onChange={(e) => setActualFinishDate(e.target.value)}
                    className="border-emerald-200 focus-visible:ring-emerald-500"
                  />
                </div>

                {actualFinishDate && (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4 h-10"
                    onClick={handleCloseTask}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <RiLoader4Line className="animate-spin mr-2 h-5 w-5" />
                    ) : (
                      <RiCheckLine className="mr-2 h-5 w-5" />
                    )}
                    บันทึกปิดงาน
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= 🌟 SHEET ดูรายละเอียดใบงานพรีเมียม (Premium View) ================= */}
            <RequestDetailSheet 
        isOpen={isSheetOpen} 
        onClose={setIsSheetOpen} 
        request={selectedRequest}
        footerActions={
          <>
            <Button variant="outline" onClick={() => setIsSheetOpen(false)} className="w-full sm:w-auto">
              ปิดหน้าต่าง
            </Button>
            <Button
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              onClick={() => router.push(`/requests/${selectedRequest?.id}`)}
            >
              <RiExternalLinkLine className="h-4 w-4 mr-2" />
              จัดการใบงานแบบเต็ม
            </Button>
          </>
        }
      />
    </div>
  );
}

export default function TasksContent() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-center">
          <RiLoader4Line className="animate-spin h-8 w-8 mx-auto text-primary" />
        </div>
      }
    >
      <TasksInnerContent />
    </Suspense>
  );
}
