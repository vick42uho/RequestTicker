import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  RiFileList3Line,
  RiUserLine,
  RiTimeLine,
  RiInformationLine,
  RiAttachmentLine,
  RiUserSharedLine,
  RiCheckLine,
  RiCloseLine,
  RiFocus3Line,
  RiPhoneLine,
  RiFileTextLine,
  RiFilePdfLine,
  RiFileWordLine,
  RiFileExcelLine,
  RiFileZipLine,
  RiImageLine,
  RiPlayCircleLine,
  RiCheckboxCircleLine,
  RiCalendarLine,
  RiArrowRightSLine,
  RiBuildingLine,
  RiMapPinLine,
  RiTimerLine,
  RiFlagLine,
  RiUserAddLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";

// --- Helper function สำหรับจัดการไอคอนไฟล์แนบ (รองรับ Dark Mode) ---
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

// --- Helper สำหรับ format วันที่ ---
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

// --- Helper คำนวณระยะเวลา ---
function calculateDuration(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "-";
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) return `${diffDays} วัน ${diffHours} ชม.`;
  if (diffHours > 0) return `${diffHours} ชม. ${diffMinutes} นาที`;
  return `${diffMinutes} นาที`;
}

interface RequestDetailSheetProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  request: any;
  footerActions?: React.ReactNode;
}

export function RequestDetailSheet({
  isOpen,
  onClose,
  request,
  footerActions,
}: RequestDetailSheetProps) {
  if (!request) return null;

  const startTaskInfo = request.approvals?.find(
    (app: any) => app.approval_type === "START_TASK"
  );
  const closeTaskInfo = request.approvals?.find(
    (app: any) => app.approval_type === "CLOSE_TASK"
  );
  const actualFinishDate = closeTaskInfo?.action_date || request.actual_finish_date;
  const hasTaskInfo = startTaskInfo || actualFinishDate;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 flex flex-col h-full bg-background border-l"
      >
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
                    รายละเอียดใบงาน{" "}
                  </SheetTitle>
                  <p className="text-sm font-medium text-primary">
                    {request.req_code}
                  </p>
                </div>
              </div>
          
              <div>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-0 px-2.5 py-1 text-xs font-medium rounded-md",
                    request.status_color || "bg-muted text-muted-foreground"
                  )}
                >
                  {request.status_name}
                </Badge>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* ================= Body Content ================= */}
        <div className="px-5 py-5 overflow-y-auto flex-1 space-y-6">
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
                    {request.requester_name}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <RiPhoneLine className="h-3 w-3" />
                    {request.phone_number || request.requester_phone || "-"}
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
                    {formatDate(request.request_date)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {request.request_date
                      ? new Date(request.request_date).toLocaleString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}{" "}
                    น.
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
                  {request.type_name}
                </span>
                <RiArrowRightSLine className="h-4 w-4 text-muted-foreground/50" />
                <span className="text-foreground font-medium">
                  {request.topic_name}
                </span>
                <RiArrowRightSLine className="h-4 w-4 text-muted-foreground/50" />
                <span className="text-primary font-medium">
                  {request.subject_name}
                </span>
              </div>
            </div>
          </section>

          {/* === กลุ่มที่ 3: การดำเนินงาน (คนรับงาน + วันเริ่ม-จบ) === */}
          {hasTaskInfo && (
            <>
              <Separator className="bg-border/60" />
              <section className="bg-muted/40 dark:bg-muted/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <RiTimerLine className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium uppercase tracking-wide">
                    การดำเนินงาน
                  </span>
                  {startTaskInfo && actualFinishDate && (
                    <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-500/10 border dark:border-emerald-500/20 px-2 py-0.5 rounded">
                      ใช้เวลา{" "}
                      {calculateDuration(
                        startTaskInfo.action_date,
                        actualFinishDate
                      )}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* คนรับงาน */}
                  {request.assignees && request.assignees.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <RiUserSharedLine className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] text-muted-foreground">
                          ผู้รับผิดชอบ
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {request.assignees.map(
                            (assignee: any, idx: number) => (
                              <div
                                key={assignee.id}
                                className="flex items-center gap-1.5"
                              >
                                <Avatar className="w-5 h-5">
                                  <AvatarFallback className="text-[8px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                                    {assignee.name?.substring(0, 1)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium flex items-center gap-1 text-foreground">
                                  {assignee.name} <RiPhoneLine className="h-3 w-3 text-muted-foreground" /><p className="text-xs text-muted-foreground">{assignee.phone_number}</p>
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* วันเริ่ม - วันจบ */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {startTaskInfo && (
                      <div className="flex items-start gap-2">
                        <div className="h-6 w-6 rounded bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <RiPlayCircleLine className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            เริ่มงาน
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {formatDateTime(startTaskInfo.action_date)}
                          </p>
                        </div>
                      </div>
                    )}
                    {request.plan_finish_date && (
                      <div className="flex items-start gap-2">
                        <div className="h-6 w-6 rounded bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <RiCalendarLine className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            ประมาณการเสร็จ
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {formatDateTime(request.plan_finish_date)}
                          </p>
                        </div>
                      </div>
                    )}
                    {actualFinishDate && (
                      <div className="flex items-start gap-2">
                        <div className="h-6 w-6 rounded bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <RiCheckboxCircleLine className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            เสร็จสิ้น
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {formatDateTime(actualFinishDate)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* หมายเหตุปิดงาน */}
                  {closeTaskInfo?.comment && (
                    <div className="mt-2 text-xs bg-background dark:bg-background/50 p-2.5 rounded border border-border/60">
                      <span className="text-muted-foreground">หมายเหตุ:</span>{" "}
                      <span className="text-foreground">
                        {closeTaskInfo.comment}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* === กลุ่มที่ 4: รายละเอียดอาการ === */}
          <section>
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <RiInformationLine className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wide">
                รายละเอียดอาการ / ปัญหา
              </span>
            </div>
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {request.description || "ไม่มีรายละเอียด"}
            </div>
          </section>

          {/* === กลุ่มที่ 5: สิ่งที่ต้องการเพิ่มเติม === */}
          {request.requirement && (
            <section className="bg-amber-50/50 dark:bg-amber-500/5 rounded-lg p-3 border border-amber-100 dark:border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 mb-2">
                <RiFileList3Line className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">
                  สิ่งที่ต้องการเพิ่มเติม
                </span>
              </div>
              <div className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">
                {request.requirement}
              </div>
            </section>
          )}

          {/* === กลุ่มที่ 6: ไฟล์แนบ === */}
          {request.file_url && (
            <section>
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <RiAttachmentLine className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">
                  ไฟล์แนบ
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {request.file_url
                  .split(",")
                  .map((fileUrl: string, index: number) => {
                    const fileName =
                      fileUrl.split("/").pop() || `ไฟล์ ${index + 1}`;
                    const { Icon, color, bg } = getFileDisplayInfo(fileName);
                    const baseUrl = (
                      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
                    ).replace(/\/$/, "");

                    return (
                      <a
                        key={index}
                        href={`${baseUrl}/${fileUrl.replace(/^\//, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80 border dark:border-border/50",
                          bg,
                          color
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate max-w-[150px]">
                          {fileName}
                        </span>
                      </a>
                    );
                  })}
              </div>
            </section>
          )}

          {/* === กลุ่มที่ 7: สายการอนุมัติ (Timeline) === */}
          {request.approvals && request.approvals.length > 0 && (
            <>
              <Separator className="bg-border/60" />
              <section>
                <div className="flex items-center gap-2 text-muted-foreground mb-4">
                  <RiTimeLine className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium uppercase tracking-wide">
                    ประวัติการดำเนินงาน
                  </span>
                </div>

                <div className="relative pl-4 space-y-4 before:absolute before:inset-y-1 before:left-[5px] before:w-px before:bg-border">
                  {request.approvals.map((app: any, idx: number) => {
                    const statId = app.status_id;
                    const isApproved = statId
                      ? statId === 4 || statId === 6 || statId === 10
                      : [
                          "อนุมัติ",
                          "เสร็จสิ้น",
                          "รับงานแล้ว",
                          "ปิดงาน",
                        ].includes(app.status_name);
                    const isRejected = statId
                      ? statId === 5
                      : ["ไม่อนุมัติ", "ยกเลิก"].includes(app.status_name);
                    const isInProgress = statId
                      ? statId === 3
                      : ["กำลังดำเนินการ"].includes(app.status_name);
                    const isWaiting = statId
                      ? [1, 2, 7, 8].includes(statId)
                      : ["รออนุมัติ", "รอคิว"].includes(app.status_name);

                    let dotColor = "bg-muted-foreground/30 dark:bg-muted-foreground/50";
                    if (isApproved) dotColor = "bg-green-500 dark:bg-green-500";
                    else if (isRejected) dotColor = "bg-red-500 dark:bg-red-500";
                    else if (isInProgress) dotColor = "bg-blue-500 dark:bg-blue-500";
                    else if (isWaiting) dotColor = "bg-amber-500 dark:bg-amber-500";

                    let statusColor = "text-muted-foreground";
                    if (isApproved) statusColor = "text-green-600 dark:text-green-400";
                    else if (isRejected) statusColor = "text-red-600 dark:text-red-400";
                    else if (isInProgress) statusColor = "text-blue-600 dark:text-blue-400";
                    else if (isWaiting) statusColor = "text-amber-600 dark:text-amber-400";

                    return (
                      <div key={idx} className="relative">
                        {/* Dot */}
                        <div
                          className={cn(
                            "absolute -left-[13px] top-1.5 h-2 w-2 rounded-full ring-2 ring-background",
                            dotColor
                          )}
                        />

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {app.approver_name || (
                                <span className="text-muted-foreground italic">
                                  รอผู้รับผิดชอบ
                                </span>
                              )}
                            </p>
                            <span
                              className={cn(
                                "text-xs font-medium shrink-0",
                                statusColor
                              )}
                            >
                              {app.status_name}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {app.action_date
                              ? formatDateTime(app.action_date)
                              : "รอดำเนินการ"}
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
            </>
          )}
        </div>

        {/* ================= Footer ================= */}
        <SheetFooter className="px-5 py-4 border-t bg-muted/30 dark:bg-muted/10 flex sm:justify-end gap-2">
          {footerActions}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}