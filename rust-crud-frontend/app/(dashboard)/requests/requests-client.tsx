"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";
import {
  RiAddLine,
  RiLoader4Line,
  RiFileList3Line,
  RiInformationLine,
  RiUserLine,
  RiCommunityLine,
  RiExternalLinkLine,
  RiImageLine,
  RiEarthLine,
  RiCheckLine,
  RiCloseLine,
  RiArticleLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { RequestHoverCard } from "@/components/shared/RequestHoverCard";
import { RequestDetailSheet } from "@/components/shared/RequestDetailSheet";
import { TaskFilterBar, FilterValues } from "@/components/shared/TaskFilterBar";

// 🌟 นำเข้า Component สำหรับทำ Modal ตรวจรับงาน
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

interface PaginatedResponse<T> {
  data: T[];
  total_records: number;
  total_pages: number;
  current_page: number;
  limit: number;
}

interface HelpdeskRequest {
  id: number;
  req_code: string;
  requester_name: string | null;
  subject_name: string | null;
  topic_name: string | null;
  type_name: string | null;
  requirement: string | null;
  description: string;
  file_url: string | null;
  request_date: string;
  status_id: number;
  status_name: string;
  status_variant: string | null;
  status_color: string | null;
  approvals?: any[];
}

export default function RequestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [requests, setRequests] = useState<HelpdeskRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          return JSON.parse(userStr).role || "user";
        } catch (e) { return "user"; }
      }
    }
    return "user";
  });

  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [selectedRequest, setSelectedRequest] =
    useState<HelpdeskRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 🌟 อ่านค่าจาก URL โดยตรง
  const currentFilter = searchParams.get("filter") || "dept";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  // 🆕 Filter States
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    status_ids: [],
    type_ids: [],
    requester_name: "",
    start_date: "",
    end_date: "",
  });

  // 🌟 State สำหรับระบบตรวจรับงาน (UAT)
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [verifyType, setVerifyType] = useState<"approve" | "reject" | null>(null);
  const [verifyRemark, setVerifyRemark] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const isAdmin = userRole === "admin" || userRole === "agent";

  const loadRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      
      let url = `/requests?filter=${currentFilter}&page=${currentPage}&limit=10`;
      
      if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
      if (filters.status_ids && filters.status_ids.length > 0) url += `&status_ids=${filters.status_ids.join(",")}`;
      if (filters.type_ids && filters.type_ids.length > 0) url += `&type_ids=${filters.type_ids.join(",")}`;
      if (filters.requester_name) url += `&requester_name=${encodeURIComponent(filters.requester_name)}`;
      if (filters.start_date) url += `&start_date=${filters.start_date}`;
      if (filters.end_date) url += `&end_date=${filters.end_date}`;

      const data = await fetchApi<PaginatedResponse<HelpdeskRequest>>(url, { method: "GET" });
      
      setRequests(data.data || []);
      setTotalPages(data.total_pages || 1);
      setTotalRecords(data.total_records || 0);
    } catch (error: any) {
      toast.error("ดึงข้อมูลไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  }, [currentFilter, currentPage, filters]);

  const refreshRequestData = async () => {
    if (!selectedRequest) return;
    try {
      const updatedReq = await fetchApi<HelpdeskRequest>(`/requests/${selectedRequest.id}`);
      setSelectedRequest(updatedReq);
      setRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
    } catch (error) {
      console.error("Failed to refresh request data");
    }
  };

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleTabChange = (value: string) => {
    router.push(`/requests?filter=${value}&page=1`);
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    router.push(`/requests?filter=${currentFilter}&page=${pageNumber}`);
  };

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
          </PaginationItem>,
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
        </PaginationItem>,
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
          </PaginationItem>,
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
        </PaginationItem>,
      );
    }
    return items;
  };

  const getStatusBadge = (req: HelpdeskRequest) => {
    return (
      <StatusBadge
        statusId={req.status_id}
        statusName={req.status_name}
        statusColor={req.status_color}
        statusVariant={req.status_variant}
      />
    );
  };

  const openDetails = (e: React.MouseEvent, req: HelpdeskRequest) => {
    e.stopPropagation();
    setSelectedRequest(req);
    setIsDialogOpen(true);
  };

  const handleVerifySubmit = async () => {
    if (!selectedRequest) return;

    if (verifyType === "reject" && !verifyRemark.trim()) {
      toast.error("กรุณาระบุเหตุผลในการตีกลับงานให้ช่างแก้ไข");
      return;
    }

    setIsVerifying(true);
    try {
      await fetchApi(`/tasks/${selectedRequest.id}/verify`, {
        method: "POST",
        body: JSON.stringify({
          is_approved: verifyType === "approve",
          remark: verifyRemark.trim() || undefined,
        }),
      });

      toast.success(
        verifyType === "approve"
          ? "ตรวจรับงานสำเร็จ ปิดใบงานเรียบร้อย"
          : "ส่งตีกลับงานให้ช่างแก้ไขเรียบร้อย",
      );

      setIsVerifyDialogOpen(false);
      setVerifyRemark("");
      setIsDialogOpen(false); 
      loadRequests(); 
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <RiArticleLine className="h-8 w-8 text-primary" />
            รายการใบงาน
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentFilter === "me"
              ? "รายการที่คุณแจ้งซ่อมไว้ทั้งหมด"
              : currentFilter === "all"
                ? "ภาพรวมรายการแจ้งซ่อมทั้งหมดในระบบ"
                : "รายการแจ้งซ่อมทั้งหมดภายในแผนกของคุณ"}
          </p>
        </div>

        <Button
          className="shadow-sm shrink-0"
          onClick={() => router.push("/requests/create")}
        >
          <RiAddLine className="mr-2 h-4 w-4" />
          เปิดใบงานใหม่
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Tabs
            value={currentFilter}
            onValueChange={handleTabChange}
            className="w-full sm:w-auto"
          >
            <TabsList>
              {isAdmin && (
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <RiEarthLine className="h-4 w-4" /> งานทั้งหมด
                </TabsTrigger>
              )}
              <TabsTrigger value="dept" className="flex items-center gap-2">
                <RiCommunityLine className="h-4 w-4" /> งานในแผนก
              </TabsTrigger>
              <TabsTrigger value="me" className="flex items-center gap-2">
                <RiUserLine className="h-4 w-4" /> งานของฉัน
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="w-full sm:max-w-md lg:max-w-xl">
            <TaskFilterBar onFilterChange={setFilters} />
          </div>
        </div>

        <Card className="rounded-xl overflow-hidden border shadow-sm flex flex-col">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-30">รหัสใบงาน</TableHead>
                <TableHead className="min-w-[300px]">หัวข้อปัญหา</TableHead>
                <TableHead>ผู้แจ้ง</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">วันที่แจ้ง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <RiLoader4Line className="h-8 w-8 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <RiFileList3Line className="h-12 w-12 mb-2 text-muted-foreground/50" />
                      <p>ไม่มีข้อมูลใบงาน</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow
                    key={req.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/requests/${req.id}`)}
                  >
                    <TableCell className="font-medium">
                      <button
                        onClick={(e) => openDetails(e, req)}
                        className="text-primary hover:text-blue-600 hover:underline flex items-center gap-1 transition-colors relative z-10"
                      >
                        {req.req_code}
                        <RiExternalLinkLine className="h-3.5 w-3.5 opacity-50" />
                      </button>
                    </TableCell>

                    <TableCell className="whitespace-normal py-3">
                      <div className="flex flex-col">
                        <RequestHoverCard request={req}>
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

                    <TableCell>{req.requester_name}</TableCell>
                    <TableCell>{getStatusBadge(req)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(req.request_date).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      น.
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {!isLoading && requests.length > 0 && (
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
      </div>

      <RequestDetailSheet
        isOpen={isDialogOpen}
        onClose={setIsDialogOpen}
        request={selectedRequest}
        onRefresh={refreshRequestData}
        footerActions={
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedRequest?.status_id === 9 && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setVerifyType("reject");
                      setIsVerifyDialogOpen(true);
                    }}
                  >
                    <RiCloseLine className="h-4 w-4 mr-1" /> ตีกลับให้แก้ไข
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      setVerifyType("approve");
                      setIsVerifyDialogOpen(true);
                    }}
                  >
                    <RiCheckLine className="h-4 w-4 mr-1" /> ตรวจรับผ่าน
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                ปิดหน้าต่าง
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                onClick={() => router.push(`/requests/${selectedRequest?.id}`)}
              >
                <RiExternalLinkLine className="h-4 w-4 mr-2" />
                จัดการใบงานแบบเต็ม
              </Button>
            </div>
          </div>
        }
      />

      <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
        <DialogContent className="sm:max-w-md font-sans">
          <DialogHeader>
            <DialogTitle>
              {verifyType === "approve" ? "ยืนยันการตรวจรับงาน" : "ตีกลับงานให้แก้ไข"}
            </DialogTitle>
            <DialogDescription>
              {verifyType === "approve"
                ? "หากคุณยืนยันการตรวจรับ ระบบจะทำการปิดใบงานนี้ถือว่าเสร็จสิ้นสมบูรณ์"
                : "กรุณาระบุจุดที่ต้องการให้ช่างแก้ไข เพื่อให้ระบบส่งงานกลับไปที่สถานะกำลังดำเนินการ"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                หมายเหตุ / ข้อเสนอแนะ {verifyType === "reject" && <span className="text-destructive">*</span>}
              </label>
              <Textarea
                placeholder={verifyType === "reject" ? "ระบุสิ่งที่ต้องการให้แก้ไข..." : "ระบุข้อความตอบกลับช่าง (ถ้ามี)..."}
                value={verifyRemark}
                onChange={(e) => setVerifyRemark(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setIsVerifyDialogOpen(false)} disabled={isVerifying}>ยกเลิก</Button>
            <Button
              variant={verifyType === "approve" ? "default" : "destructive"}
              className={verifyType === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              onClick={handleVerifySubmit}
              disabled={isVerifying}
            >
              {isVerifying && <RiLoader4Line className="h-4 w-4 animate-spin mr-2" />}
              {verifyType === "approve" ? "ยืนยันและปิดงาน" : "ส่งตีกลับ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
