import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  RiInformationLine,
  RiFileList3Line,
  RiPhoneLine,
  RiPriceTag3Line,
  RiTimeLine,
  RiUserLine,
} from "@remixicon/react";

interface RequestHoverCardProps {
  request: any; // ควรเปลี่ยน any เป็น Type RequestItem ที่คุณมี
  children: React.ReactNode;
}

export function RequestHoverCard({ request, children }: RequestHoverCardProps) {
  if (!request) return <>{children}</>;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>

      <HoverCardContent
        side="top"
        align="start"
        className="w-[360px] p-0 shadow-2xl border-border/60 bg-popover overflow-hidden rounded-xl z-50"
      >
        {/* Header แถบสีด้านบน */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 border-b border-border/50 flex justify-between items-center z-10 relative">
          <div className="flex items-center gap-2">
            <RiPriceTag3Line className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold tracking-wider text-primary uppercase">
              {request.req_code}
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] px-2 py-0 h-5 border-none shadow-sm ${request.status_color || "bg-muted text-muted-foreground"}`}
          >
            {request.status_name}
          </Badge>
        </div>

        {/* 🌟 พื้นที่สำหรับ Scroll (เหมือนต้นฉบับ) */}
        <ScrollArea className="h-72 w-full">
          <div className="p-5 space-y-4 wrap-break-word">
            {/* ข้อมูลผู้แจ้ง (เพิ่มความพรีเมียมด้วย Avatar และเบอร์โทรชัดๆ) */}
            {/* <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-lg border border-border/50">
              <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${request.requester_name}&backgroundColor=e2e8f0`} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {request.requester_name?.substring(0, 2) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">
                  {request.requester_name || "ไม่ระบุชื่อผู้แจ้ง"}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="text-blue-600 dark:text-blue-400">
                    <RiPhoneLine className="h-3.5 w-3.5" />
                  </div>
                  {request.phone_number ? (
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {request.phone_number}
                    </span>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">ไม่มีเบอร์ติดต่อ</span>
                  )}
                </div>
              </div>
            </div> */}

            {/* รายละเอียดอาการ (เหมือนต้นฉบับ แต่ไม่มี line-clamp) */}
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2 leading-none">
                <RiFileList3Line className="h-4 w-4 text-primary" />
                รายละเอียดอาการ
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-background p-3 rounded-md border border-border/40">
                {request.description || "-"}
              </p>
            </div>

            {/* ความต้องการเพิ่มเติม (เหมือนต้นฉบับ) */}
            {request.requirement && (
              <div className="pt-3 mt-3 border-t border-border">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-500 mb-2 leading-none flex items-center gap-1.5">
                  <RiInformationLine className="h-3.5 w-3.5" />{" "}
                  สิ่งที่ต้องการเพิ่มเติม
                </h4>
                <p className="text-sm text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md border border-amber-200 dark:border-amber-900/50 whitespace-pre-wrap leading-relaxed">
                  {request.requirement}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer ของการ์ด */}
        <div className="px-4 py-3 border-t bg-muted/10 text-xs flex flex-wrap items-center justify-between gap-3">
          {/* ฝั่งซ้าย: ข้อมูลผู้แจ้ง (ชื่อ + เบอร์) */}
          <div className="flex items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <RiUserLine className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">
                {request.requester_name || "ไม่ระบุชื่อผู้แจ้ง"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <RiPhoneLine className="h-3.5 w-3.5" />
              {request.phone_number ? (
                <span className="font-medium text-foreground">
                  {request.phone_number}
                </span>
              ) : (
                <span className="italic text-muted-foreground/70 text-[11px]">
                  ไม่มีเบอร์ติดต่อ
                </span>
              )}
            </div>
          </div>

          {/* ฝั่งขวา: เวลาที่แจ้ง */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <RiTimeLine className="h-3.5 w-3.5" />
            <span>
              {new Date(request.request_date).toLocaleString("th-TH", {
                day: "2-digit",
                month: "short",
                year: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              น.
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
