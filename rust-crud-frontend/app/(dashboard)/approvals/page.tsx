"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";
import {
    RiCheckLine,
    RiCloseLine,
    RiLoader4Line,
    RiFileList3Line,
    RiInformationLine,
    RiExternalLinkLine,
    RiImageLine,
    RiUserLine,
    RiTimeLine,
    RiTimeFill,
    RiUserAddLine,
    RiAlarmWarningLine,
    RiUserSharedLine,
    RiVerifiedBadgeLine
} from "@remixicon/react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RequestHoverCard } from "@/components/shared/RequestHoverCard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { 
    RiFilePdfLine, 
    RiFileWordLine, 
    RiFileExcelLine, 
    RiFileZipLine, 
    RiFileTextLine,
    RiArrowRightSLine,
    RiCalendarLine,
    RiAttachmentLine,
    RiCheckboxCircleLine,
    RiPlayCircleLine,
    RiTimerLine,
    RiFlagLine
} from "@remixicon/react";

// --- Helpers ---

function getFileDisplayInfo(fileName: string) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return { Icon: RiFilePdfLine, color: "text-red-500 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10" };
      case "doc":
      case "docx":
        return { Icon: RiFileWordLine, color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10" };
      case "xls":
      case "xlsx":
        return {
          Icon: RiFileExcelLine,
          color: "text-green-500 dark:text-emerald-400",
          bg: "bg-green-50 dark:bg-emerald-500/10",
        };
      case "zip":
      case "rar":
        return {
          Icon: RiFileZipLine,
          color: "text-amber-500 dark:text-amber-400",
          bg: "bg-amber-50 dark:bg-amber-500/10",
        };
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return {
          Icon: RiImageLine,
          color: "text-purple-500 dark:text-purple-400",
          bg: "bg-purple-50 dark:bg-purple-500/10",
        };
      default:
        return { Icon: RiFileTextLine, color: "text-gray-500 dark:text-gray-400", bg: "bg-gray-50 dark:bg-gray-500/10" };
    }
}

function formatDate(dateStr: string) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
}
  
function formatDateTime(dateStr: string) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
}

// --- Types ---

interface ApproverUser {
    id: number;
    name: string;
    department?: string;
}

interface ApprovalStep {
    approve_step: number; 
    approver_name: string | null;
    status_name: string;
    action_date?: string | null;
    comment?: string | null;
}

interface PendingApproval {
    approval_id: number;
    request_id: number;
    req_code: string;
    subject_name: string | null;
    topic_name: string | null;
    type_name: string | null;
    requirement: string | null;
    description: string;
    file_url: string | null;
    requester_name: string | null;
    requester_department: string | null; // 🌟 เพิ่มฟิลด์ชื่อแผนกผู้แจ้ง
    approve_step: number;
    request_date: string;
    status_id: number;
    status_name: string;
    status_variant: string | null;
    status_color: string | null;
    approvals?: ApprovalStep[];
}

interface PaginatedResponse<T> {
    data: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
    limit: number;
    pending_count?: number;
    waiting_count?: number;
}

type ActionType = "APPROVE" | "REJECT" | "FORWARD";

// --- Sub-Components ---

const ApprovalTimeline = ({ flow }: { flow: ApprovalStep[] }) => {
    if (!flow || flow.length === 0) return <div className="text-xs text-muted-foreground italic p-4">ไม่พบข้อมูลลำดับการอนุมัติ</div>;

    const groupedFlow = flow.reduce((acc, curr) => {
        const stepNum = curr.approve_step;
        if (!acc[stepNum]) acc[stepNum] = [];
        acc[stepNum].push(curr);
        return acc;
    }, {} as Record<number, ApprovalStep[]>);

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-bold flex items-center gap-1.5 px-1 text-foreground mb-4">
                <RiUserSharedLine className="text-orange-500 h-4 w-4" /> สถานะการดำเนินงาน
            </h4>
            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border before:to-transparent">

                {Object.entries(groupedFlow).map(([stepNum, approvers]) => {

                    const isAllApproved = approvers.every(a => ["อนุมัติ", "รับงานแล้ว", "เสร็จสิ้น"].includes(a.status_name));
                    const isAnyRejected = approvers.some(a => ["ไม่อนุมัติ", "ยกเลิก"].includes(a.status_name));
                    const isAnyWaiting = approvers.some(a => ["รออนุมัติ", "รอคิว"].includes(a.status_name));

                    let stepBg = "bg-muted text-muted-foreground border-background";
                    let StepIcon = <span className="text-xs font-bold">{stepNum}</span>;

                    if (isAnyRejected) {
                        stepBg = "bg-red-500 text-white border-red-100 dark:border-red-900";
                        StepIcon = <RiCloseLine size={18} />;
                    } else if (isAllApproved) {
                        stepBg = "bg-emerald-500 text-white border-emerald-100 dark:border-emerald-900";
                        StepIcon = <RiCheckLine size={18} />;
                    } else if (isAnyWaiting) {
                        stepBg = "bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.5)] border-amber-100 dark:border-amber-900";
                        StepIcon = <RiTimeFill size={18} className="animate-pulse" />;
                    }

                    return (
                        <div key={stepNum} className="relative flex items-start gap-4">
                            <div className={`absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border-4 z-10 ${stepBg}`}>
                                {StepIcon}
                            </div>

                            <div className="ml-12 flex-1 pt-1 space-y-2.5">
                                <h5 className="text-sm font-bold text-foreground">ขั้นตอนที่ {stepNum}</h5>

                                <div className="space-y-2">
                                    {approvers.map((app, idx) => {
                                        const isAppApproved = ["อนุมัติ", "รับงานแล้ว", "เสร็จสิ้น"].includes(app.status_name);
                                        const isAppRejected = ["ไม่อนุมัติ", "ยกเลิก"].includes(app.status_name);
                                        const isAppWaiting = ["รออนุมัติ", "รอคิว"].includes(app.status_name);

                                        return (
                                            <div key={idx} className="bg-background border border-border p-3.5 rounded-xl shadow-sm">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-semibold text-sm ${(!isAppApproved && !isAppRejected && !isAppWaiting) ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                                                            {app.approver_name || "รอผู้รับผิดชอบดำเนินการ"}
                                                        </span>
                                                        {approvers.length > 1 && (
                                                            <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4 bg-purple-500/10 text-purple-600 border-purple-200">
                                                                อนุมัติร่วม
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className={`text-[11px] font-bold 
                                                        ${isAppApproved ? 'text-emerald-600 dark:text-emerald-400' :
                                                            isAppWaiting ? 'text-amber-600 dark:text-amber-400' :
                                                                isAppRejected ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                                                        {app.status_name}
                                                    </span>
                                                </div>

                                                {app.action_date && (
                                                    <div className="text-[10px] text-muted-foreground mt-1.5 font-medium">
                                                        <RiTimeLine className="inline h-3 w-3 mr-1 mb-0.5" />
                                                        {new Date(app.action_date).toLocaleString('th-TH')}
                                                    </div>
                                                )}

                                                {app.comment && (
                                                    <div className="mt-2 text-xs bg-muted/40 p-2.5 rounded-md text-muted-foreground border-l-2 border-primary wrap-break-word">
                                                        <span className="font-semibold text-foreground mr-1">หมายเหตุ:</span>
                                                        {app.comment}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Main Page Component ---

function ApprovalsInnerContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [approvals, setApprovals] = useState<PendingApproval[]>([]);
    const [approverList, setApproverList] = useState<ApproverUser[]>([]);
    const [selectedApproverId, setSelectedApproverId] = useState<string>("");

    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const [selectedApp, setSelectedApp] = useState<PendingApproval | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [actionPrompt, setActionPrompt] = useState<{ id: number, action: ActionType } | null>(null);
    const [comment, setComment] = useState("");

    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [waitingCount, setWaitingCount] = useState(0);

    const currentTab = searchParams.get("tab") || "pending";
    const currentPage = parseInt(searchParams.get("page") || "1", 10);

    const loadApprovers = useCallback(async () => {
        try {
            const users = await fetchApi<ApproverUser[]>("/users/approvers");
            setApproverList(users || []);
        } catch (error) {
            console.error("ดึงข้อมูลรายชื่อผู้อนุมัติไม่ได้", error);
        }
    }, []);

    const loadApprovals = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetchApi<PaginatedResponse<PendingApproval>>(`/requests/approvals/pending?filter=${currentTab}&page=${currentPage}&limit=10`);

            const enrichedData = (res.data || []).map(item => ({
                ...item,
                approvals: item.approvals && item.approvals.length > 0 ? item.approvals : [
                    { approve_step: item.approve_step, approver_name: "ดึงข้อมูลจากระบบ...", status_name: "รอโหลดข้อมูล" }
                ] as ApprovalStep[]
            }));

            setApprovals(enrichedData);
            setTotalPages(res.total_pages || 1);
            setTotalRecords(res.total_records || 0);
            setPendingCount(res.pending_count || 0);
            setWaitingCount(res.waiting_count || 0);
        } catch (error: any) {
            toast.error("ดึงข้อมูลไม่สำเร็จ: " + (error.message || "เกิดข้อผิดพลาด"));
            setApprovals([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentTab, currentPage]);

    useEffect(() => {
        loadApprovers();
        loadApprovals();
    }, [loadApprovers, loadApprovals]);

    const handleTabChange = (value: string) => {
        router.push(`/approvals?tab=${value}&page=1`);
    };

    const goToPage = (pageNumber: number) => {
        if (pageNumber < 1 || pageNumber > totalPages) return;
        router.push(`/approvals?tab=${currentTab}&page=${pageNumber}`);
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

    const handleAction = async (approvalId: number, action: ActionType) => {
        if ((action === "REJECT" || action === "FORWARD") && !comment.trim()) {
            toast.error(action === "REJECT" ? "กรุณาระบุเหตุผลที่ปฏิเสธ" : "กรุณาระบุเหตุผลในการส่งต่อ");
            return;
        }

        if (action === "FORWARD" && !selectedApproverId) {
            toast.error("กรุณาเลือกผู้อนุมัติที่จะส่งต่อ");
            return;
        }

        try {
            setProcessingId(approvalId);
            await fetchApi(`/requests/approvals/${approvalId}/action`, {
                method: "PUT",
                body: JSON.stringify({
                    action,
                    comment: comment.trim(),
                    forward_to_id: action === "FORWARD" ? parseInt(selectedApproverId) : null
                }),
            });

            toast.success(
                action === "APPROVE" ? "อนุมัติรายการสำเร็จ" :
                    action === "REJECT" ? "ปฏิเสธรายการสำเร็จ" : "ส่งต่อเรื่องสำเร็จ"
            );

            setIsDetailOpen(false);
            setActionPrompt(null);
            setComment("");
            setSelectedApproverId("");
            loadApprovals();
        } catch (error: any) {
            toast.error("ทำรายการไม่สำเร็จ: " + (error.message || "เกิดข้อผิดพลาด"));
        } finally {
            setProcessingId(null);
        }
    };

    const getFileFullUrl = (path: string) => {
        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");
        if (path.startsWith('http')) return path;
        return `${baseUrl}/${path.replace(/^\//, '')}`;
    };

    const pendingTasks = approvals.filter(app => app.status_id === 2);
    const waitingTasks = approvals.filter(app => app.status_id === 7);

    const renderTable = (tasks: PendingApproval[], isActionable: boolean) => (
        <Card className="border border-border shadow-sm rounded-lg overflow-hidden bg-card flex flex-col">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow className="border-border">
                        <TableHead className="w-30">รหัสใบงาน</TableHead>
                        <TableHead className="w-75">รายละเอียดปัญหา</TableHead>
                        <TableHead>ผู้แจ้ง</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead className="text-right">วันที่แจ้ง</TableHead>
                        <TableHead className="text-center w-[220px]">จัดการ</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={6} className="h-40 text-center"><RiLoader4Line className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                    ) : tasks.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-64 text-center">
                                <div className="flex flex-col items-center justify-center text-muted-foreground">
                                    <RiFileList3Line className="h-12 w-12 mb-2 opacity-30" />
                                    <p>{isActionable ? "ตะกร้าว่างเปล่า ไม่มีรายการรออนุมัติ" : "ไม่มีใบงานที่กำลังรอคิว"}</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        tasks.map((app) => (
                            <TableRow key={app.approval_id} className="hover:bg-muted/30 border-border">
                                <TableCell className="font-medium">
                                    <button
                                        onClick={() => { setSelectedApp(app); setComment(""); setIsDetailOpen(true); }}
                                        className="text-primary hover:underline flex items-center gap-1"
                                    >
                                        {app.req_code} <RiExternalLinkLine className="h-3 w-3 opacity-50" />
                                    </button>
                                </TableCell>
                                <TableCell className="py-3">
                                    <RequestHoverCard request={app}>
                                        <div className="cursor-pointer truncate max-w-70 font-semibold group-hover:text-primary transition-colors">
                                            {app.subject_name || "ไม่ระบุหัวข้อ"}
                                            {app.requirement && ` : ${app.requirement}`}
                                        </div>
                                    </RequestHoverCard>
                                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                                        <span className="bg-muted px-1.5 py-0.5 rounded text-foreground/70">{app.type_name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm font-medium">{app.requester_name}</TableCell>
                                <TableCell>
                                    <Badge className={`${app.status_color || ""} shadow-sm font-medium`} variant={(app.status_variant as any) || "outline"}>
                                        {app.status_name}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">
                                    {app.request_date ? new Date(app.request_date).toLocaleString("th-TH", { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-"} น.
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1.5">
                                        {isActionable ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-900 dark:text-purple-400 dark:hover:bg-purple-900/30 shadow-sm"
                                                    onClick={() => { setComment(""); setActionPrompt({ id: app.approval_id, action: "FORWARD" }); }}>
                                                    ส่งต่อ
                                                </Button>

                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                                    onClick={() => { setComment(""); setActionPrompt({ id: app.approval_id, action: "APPROVE" }); }}>
                                                    อนุมัติ
                                                </Button>
                                                <Button size="sm" variant="destructive" className="shadow-sm"
                                                    onClick={() => { setComment(""); setActionPrompt({ id: app.approval_id, action: "REJECT" }); }}>
                                                    <RiCloseLine className="h-4 w-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground bg-muted/50 font-normal py-1">
                                                <RiAlarmWarningLine className="h-3 w-3 mr-1" /> หลับรอคิว
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

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
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 w-full text-foreground animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <RiVerifiedBadgeLine className="h-8 w-8 text-primary" />
                รายการรอพิจารณา
              </h1>
            </div>
          </div>
                    <p className="text-muted-foreground mt-1">จัดการใบงานและผู้อนุมัติร่วมในระบบ</p>
                </div>
            </header>

            <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="pending" className="flex gap-2">
                        🚨 ต้องดำเนินการ
                        {pendingCount > 0 && <Badge variant="destructive" className="ml-1 px-1.5 py-0 h-5">{pendingCount}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="waiting" className="flex gap-2">
                        💤 รอคิวก่อนหน้า
                        {waitingCount > 0 && <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5">{waitingCount}</Badge>}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-0">
                    {renderTable(pendingTasks, true)}
                </TabsContent>

                <TabsContent value="waiting" className="mt-0">
                    {renderTable(waitingTasks, false)}
                </TabsContent>
            </Tabs>

            <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 flex flex-col h-full bg-background border-l shadow-2xl">
                    {selectedApp && (
                        <>
                            {/* ================= Header ================= */}
                            <div className="border-b bg-muted/30 dark:bg-muted/10">
                                <SheetHeader className="text-left space-y-0 py-4">
                                    <div className="flex items-start justify-between gap-3 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center shrink-0">
                                                <RiFileList3Line className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <SheetTitle className="text-base font-semibold text-foreground">
                                                    พิจารณาใบงาน
                                                </SheetTitle>
                                                <p className="text-sm font-medium text-primary">
                                                    {selectedApp.req_code}
                                                </p>
                                            </div>
                                        </div>
                                    
                                        <div>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "border-0 px-2.5 py-1 text-xs font-medium rounded-md",
                                                    selectedApp.status_color || "bg-muted text-muted-foreground"
                                                )}
                                            >
                                                {selectedApp.status_name}
                                            </Badge>
                                        </div>
                                    </div>
                                </SheetHeader>
                            </div>

                            {/* ================= Body Content ================= */}
                            <div className="px-5 py-5 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                                
                                {/* 🌟 ส่วนที่ 1: ข้อมูลผู้แจ้งและหมวดหมู่ (เหมือน RequestDetailSheet) */}
                                <section className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* --- ผู้แจ้งเรื่อง --- */}
                                        <div>
                                            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                                                <RiUserLine className="h-3.5 w-3.5" />
                                                <span className="text-[11px] font-medium uppercase tracking-wide">
                                                    ผู้แจ้งเรื่อง
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium text-foreground">
                                                    {selectedApp.requester_name}
                                                </span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    ({selectedApp.requester_department || "-"})
                                                </span>
                                            </div>
                                        </div>

                                        {/* --- วันที่แจ้ง --- */}
                                        <div>
                                            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                                                <RiCalendarLine className="h-3.5 w-3.5" />
                                                <span className="text-[11px] font-medium uppercase tracking-wide">
                                                    วันที่แจ้ง
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium text-foreground">
                                                    {formatDate(selectedApp.request_date)}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {selectedApp.request_date ? new Date(selectedApp.request_date).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-"} น.
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <RiFlagLine className="h-3.5 w-3.5" />
                                            <span className="text-[11px] font-medium uppercase tracking-wide">
                                                หมวดหมู่ปัญหา
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1 text-sm">
                                            <span className="text-foreground font-medium">
                                                {selectedApp.type_name}
                                            </span>
                                            <RiArrowRightSLine className="h-4 w-4 text-muted-foreground/50" />
                                            <span className="text-foreground font-medium">
                                                {selectedApp.topic_name}
                                            </span>
                                            <RiArrowRightSLine className="h-4 w-4 text-muted-foreground/50" />
                                            <span className="text-primary font-medium">
                                                {selectedApp.subject_name}
                                            </span>
                                        </div>
                                    </div>
                                </section>

                                <Separator className="bg-border/60" />

                                {/* 🌟 ส่วนที่ 2: รายละเอียดอาการ */}
                                <section>
                                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                        <RiInformationLine className="h-3.5 w-3.5" />
                                        <span className="text-[11px] font-medium uppercase tracking-wide">
                                            รายละเอียดอาการ / ปัญหา
                                        </span>
                                    </div>
                                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                        {selectedApp.description || "ไม่มีรายละเอียดระบุไว้"}
                                    </div>
                                </section>

                                {/* 🌟 ส่วนที่ 3: สิ่งที่ต้องการเพิ่มเติม */}
                                {selectedApp.requirement && (
                                    <section className="bg-amber-50/50 dark:bg-amber-500/5 rounded-lg p-3 border border-amber-100 dark:border-amber-500/20">
                                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 mb-2">
                                            <RiFileList3Line className="h-3.5 w-3.5" />
                                            <span className="text-[11px] font-medium uppercase tracking-wide">
                                                สิ่งที่ต้องการเพิ่มเติม
                                            </span>
                                        </div>
                                        <div className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">
                                            {selectedApp.requirement}
                                        </div>
                                    </section>
                                )}

                                {/* 🌟 ส่วนที่ 4: ไฟล์แนบ */}
                                {selectedApp.file_url && (
                                    <section>
                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <RiAttachmentLine className="h-3.5 w-3.5" />
                                            <span className="text-[11px] font-medium uppercase tracking-wide">
                                                ไฟล์แนบ
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedApp.file_url.split(",").map((fileUrl, index) => {
                                                const fileName = fileUrl.split("/").pop() || `ไฟล์ ${index + 1}`;
                                                const { Icon, color, bg } = getFileDisplayInfo(fileName);
                                                return (
                                                    <a
                                                        key={index}
                                                        href={getFileFullUrl(fileUrl)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={cn(
                                                            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80 border dark:border-border/50",
                                                            bg,
                                                            color
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                        <span className="truncate max-w-[150px]">{fileName}</span>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                <Separator className="bg-border/60" />

                                {/* 🌟 ส่วนที่ 5: สายการอนุมัติ (Timeline เหมือน RequestDetailSheet) */}
                                {selectedApp.approvals && selectedApp.approvals.length > 0 && (
                                    <section>
                                        <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                            <RiTimeLine className="h-3.5 w-3.5" />
                                            <span className="text-[11px] font-medium uppercase tracking-wide">
                                                ประวัติการดำเนินงาน
                                            </span>
                                        </div>

                                        <div className="relative pl-4 space-y-4 before:absolute before:inset-y-1 before:left-[5px] before:w-px before:bg-border">
                                            {selectedApp.approvals.map((app, idx) => {
                                                const statId = (app as any).status_id;
                                                const isApproved = ["อนุมัติ", "เสร็จสิ้น", "รับงานแล้ว", "ปิดงาน"].includes(app.status_name) || statId === 6 || statId === 4;
                                                const isRejected = ["ไม่อนุมัติ", "ยกเลิก"].includes(app.status_name) || statId === 5;
                                                const isWaiting = ["รออนุมัติ", "รอคิว"].includes(app.status_name) || [2, 7, 8].includes(statId);

                                                let dotColor = "bg-muted-foreground/30 dark:bg-muted-foreground/50";
                                                if (isApproved) dotColor = "bg-green-500";
                                                else if (isRejected) dotColor = "bg-red-500";
                                                else if (isWaiting) dotColor = "bg-amber-500";

                                                let statusColor = "text-muted-foreground";
                                                if (isApproved) statusColor = "text-green-600 dark:text-green-400";
                                                else if (isRejected) statusColor = "text-red-600 dark:text-red-400";
                                                else if (isWaiting) statusColor = "text-amber-600 dark:text-amber-400";

                                                return (
                                                    <div key={idx} className="relative">
                                                        <div className={cn("absolute -left-[13px] top-1.5 h-2 w-2 rounded-full ring-2 ring-background", dotColor)} />
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="text-sm font-medium text-foreground">
                                                                    {app.approver_name || <span className="text-muted-foreground italic">รอผู้รับผิดชอบ</span>}
                                                                </p>
                                                                <span className={cn("text-xs font-medium shrink-0", statusColor)}>
                                                                    {app.status_name}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                {app.action_date ? formatDateTime(app.action_date) : "รอดำเนินการ"}
                                                            </p>
                                                            {app.comment && (
                                                                <p className="text-xs text-foreground/80 mt-1 bg-muted/30 dark:bg-muted/20 p-2 rounded">
                                                                    {app.comment}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {/* 🌟 ส่วนที่ 6: ช่องใส่ความเห็นสำหรับผู้อนุมัติ (คงไว้เหมือนเดิม) */}
                                {selectedApp.status_id === 2 && (
                                    <>
                                        <Separator className="bg-border/60" />
                                        <div className="bg-muted/10 p-4 rounded-xl border border-border">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-sm font-bold text-foreground">ความเห็นของคุณ</label>
                                                <span className="text-[10px] text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full">* บังคับกรอกถ้ากดปฏิเสธ</span>
                                            </div>
                                            <textarea
                                                className="w-full min-h-[100px] p-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                placeholder="พิมพ์หมายเหตุ หรือ เหตุผลในการส่งต่อ/ปฏิเสธ..."
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <SheetFooter className="px-5 py-4 border-t bg-muted/30 dark:bg-muted/10 flex flex-wrap sm:justify-end gap-2 shrink-0 z-10">
                                <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="w-full sm:w-auto">
                                    ปิด
                                </Button>
                                {selectedApp.status_id === 2 && (
                                    <>
                                        <Button variant="destructive" className="w-full sm:w-auto shadow-sm" onClick={() => handleAction(selectedApp.approval_id, "REJECT")} disabled={processingId !== null}>
                                            {processingId === selectedApp.approval_id ? <RiLoader4Line className="animate-spin h-4 w-4" /> : "ปฏิเสธ"}
                                        </Button>

                                        <Button className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white shadow-sm" onClick={() => setActionPrompt({ id: selectedApp.approval_id, action: "FORWARD" })} disabled={processingId !== null}>
                                            ส่งต่อเรื่อง
                                        </Button>

                                        <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={() => handleAction(selectedApp.approval_id, "APPROVE")} disabled={processingId !== null}>
                                            {processingId === selectedApp.approval_id ? <RiLoader4Line className="animate-spin h-4 w-4 mr-1" /> : <RiCheckLine className="h-5 w-5 mr-1" />}
                                            อนุมัติใบงาน
                                        </Button>
                                    </>
                                )}
                            </SheetFooter>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <Dialog open={!!actionPrompt} onOpenChange={(open) => !open && setActionPrompt(null)}>
                <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-xl bg-background border-border shadow-xl">
                    <div className={`p-5 border-b border-border flex items-center gap-3 
                        ${actionPrompt?.action === "APPROVE" ? "bg-emerald-500/5" : actionPrompt?.action === "FORWARD" ? "bg-purple-500/5" : "bg-red-500/5"}`}>
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 
                            ${actionPrompt?.action === "APPROVE" ? "bg-emerald-500/20 text-emerald-600" : actionPrompt?.action === "FORWARD" ? "bg-purple-500/20 text-purple-600" : "bg-red-500/20 text-red-600"}`}>
                            {actionPrompt?.action === "APPROVE" ? <RiCheckLine className="h-5 w-5" /> : actionPrompt?.action === "FORWARD" ? <RiUserAddLine className="h-5 w-5" /> : <RiCloseLine className="h-5 w-5" />}
                        </div>
                        <DialogTitle className="text-lg font-bold">
                            {actionPrompt?.action === "APPROVE" ? "ยืนยันการอนุมัติ" : actionPrompt?.action === "FORWARD" ? "ส่งต่อใบงานให้ผู้อนุมัติร่วม" : "ยืนยันการปฏิเสธ"}
                        </DialogTitle>
                    </div>

                    <div className="p-5 space-y-4">
                        {actionPrompt?.action === "FORWARD" && (
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold flex justify-between">
                                    เลือกผู้อนุมัติร่วม <span className="text-red-500">*</span>
                                </Label>
                                <Select onValueChange={setSelectedApproverId} value={selectedApproverId}>
                                    <SelectTrigger className="w-full bg-background">
                                        <SelectValue placeholder="เลือกรายชื่อ..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {approverList.length > 0 ? (
                                            approverList.map((user) => (
                                                <SelectItem key={user.id} value={user.id.toString()}>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{user.name}</span>
                                                        {user.department && <span className="text-[10px] text-muted-foreground">{user.department}</span>}
                                                    </div>
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <div className="p-2 text-xs text-center text-muted-foreground">ไม่พบรายชื่อผู้อนุมัติในระบบ</div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold flex justify-between">
                                ความเห็นเพิ่มเติม {(actionPrompt?.action === "REJECT" || actionPrompt?.action === "FORWARD") && <span className="text-red-500">* บังคับกรอก</span>}
                            </Label>
                            <textarea
                                className="w-full min-h-[100px] p-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder={actionPrompt?.action === "FORWARD" ? "ระบุเหตุผลที่ชงเรื่องต่อ..." : "พิมพ์เหตุผลที่นี่..."}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                autoFocus={actionPrompt?.action !== "FORWARD"}
                            />
                        </div>
                    </div>

                    <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setActionPrompt(null)}>ยกเลิก</Button>
                        <Button
                            variant={actionPrompt?.action === "REJECT" ? "destructive" : "default"}
                            className={actionPrompt?.action === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : actionPrompt?.action === "FORWARD" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
                            onClick={() => actionPrompt && handleAction(actionPrompt.id, actionPrompt.action)}
                            disabled={processingId === actionPrompt?.id}
                        >
                            {processingId === actionPrompt?.id ? <RiLoader4Line className="h-4 w-4 animate-spin mr-1" /> : ""}
                            {actionPrompt?.action === "FORWARD" ? "ยืนยันและส่งต่อ" : "ยืนยัน"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function ApprovalsPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><RiLoader4Line className="h-8 w-8 animate-spin text-primary" /></div>}>
            <ApprovalsInnerContent />
        </Suspense>
    );
}
