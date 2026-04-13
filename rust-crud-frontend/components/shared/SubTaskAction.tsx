"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  RiMore2Fill,
  RiUserAddLine,
  RiCalendarLine,
  RiDeleteBinLine,
  RiPhoneLine,
} from "@remixicon/react";
import { taskService } from "@/lib/services/task-service";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// --- Helper Functions ---
function formatForInput(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ==========================================
// Dialog สำหรับเลือกผู้รับผิดชอบงานย่อย
// ==========================================
interface SubTaskMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  subTask: any;
  requestId: number;
  onRefresh?: () => void;
}

function SubTaskMemberDialog({ isOpen, onClose, subTask, requestId, onRefresh }: SubTaskMemberDialogProps) {
  const [agents, setAgents] = React.useState<any[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && subTask) {
      loadAgents();
      setSelectedIds(subTask.assignees?.map((a: any) => a.id) || []);
    }
  }, [isOpen, subTask]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await taskService.getAgentsByDept(subTask.responsible_dept_id);
      setAgents(data);
    } catch (error) {
      toast.error("ไม่สามารถโหลดรายชื่อคนในแผนกได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await taskService.assignSubTaskMembers(requestId, subTask.id, selectedIds);
      toast.success("มอบหมายผู้รับผิดชอบสำเร็จ");
      onRefresh?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>มอบหมายผู้รับผิดชอบ - แผนก{subTask?.department_name}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-1 max-h-[350px] overflow-y-auto pr-2">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>
          ) : agents.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">ไม่พบรายชื่อช่างในแผนกนี้</p>
          ) : (
            <TooltipProvider>
              {agents.map(agent => (
                <div 
                  key={agent.id} 
                  className="flex items-center space-x-3 p-3 rounded-xl hover:bg-primary/5 transition-all cursor-pointer group" 
                  onClick={() => toggleMember(agent.id)}
                >
                  <Checkbox 
                    checked={selectedIds.includes(agent.id)} 
                    onCheckedChange={() => toggleMember(agent.id)} 
                    className="data-[state=checked]:bg-primary"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-10 w-10 border-2 border-transparent group-hover:border-primary/20 transition-all">
                        <AvatarFallback className="text-xs bg-muted font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                          {agent.name?.substring(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex flex-col gap-1">
                      <p className="font-bold">{agent.name}</p>
                      {agent.phone_number && (
                        <p className="text-[10px] flex items-center gap-1 opacity-90">
                          <RiPhoneLine className="h-3 w-3" /> {agent.phone_number}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <div className="flex-1">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">{agent.name}</p>
                    <p className="text-[11px] text-muted-foreground">{agent.position || "เจ้าหน้าที่"}</p>
                  </div>
                </div>
              ))}
            </TooltipProvider>
          )}
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || loading} className="bg-primary shadow-md">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            ยืนยันรายชื่อ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Dialog สำหรับแก้ไขงานย่อย (กำหนดแผนงาน)
// ==========================================
interface EditSubTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  subTask: any;
  requestId: number;
  onRefresh?: () => void;
}

function EditSubTaskDialog({ isOpen, onClose, subTask, requestId, onRefresh }: EditSubTaskDialogProps) {
  const [description, setDescription] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [finishDate, setFinishDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && subTask) {
      setDescription(subTask.description || "");
      setStartDate(formatForInput(subTask.plan_start_date));
      setFinishDate(formatForInput(subTask.plan_finish_date));
    }
  }, [isOpen, subTask]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await taskService.updateSubTaskStatus(requestId, subTask.id, {
        status_id: subTask.status_id,
        description,
        plan_start_date: startDate ? new Date(startDate).toISOString() : undefined,
        plan_finish_date: finishDate ? new Date(finishDate).toISOString() : undefined
      });
      toast.success("บันทึกแผนงานเรียบร้อย");
      onRefresh?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>วางแผนการดำเนินงาน - แผนก{subTask?.department_name}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">วันที่เริ่มงาน</Label>
              <Input type="datetime-local" className="h-9 text-xs" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">วันที่คาดว่าจะเสร็จ</Label>
              <Input type="datetime-local" className="h-9 text-xs" value={finishDate} onChange={(e) => setFinishDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">รายละเอียดงาน / โน้ตเพิ่มเติม</Label>
            <Textarea 
              className="md:text-xs min-h-[80px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            บันทึกแผนงาน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// เมนูจัดการหลัก (Main Component to Export)
// ==========================================
interface SubTaskActionProps {
  requestId: number;
  subTask: any;
  currentUser: any;
  requestOwnerId: number;
  mainResponsibleDeptId?: number;
  onRefresh?: () => void;
}

export function SubTaskAction({ 
  requestId, 
  subTask, 
  currentUser, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  requestOwnerId, 
  mainResponsibleDeptId,
  onRefresh 
}: SubTaskActionProps) {
  const [loading, setLoading] = React.useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  
  const isResponsibleDept = currentUser?.department_id === subTask.responsible_dept_id;
  const isAdmin = currentUser?.role === "admin";
  const isAgentOrManager = currentUser?.role === "agent" || currentUser?.role === "manager";
  const isMainDeptStaff = isAgentOrManager && currentUser?.department_id === mainResponsibleDeptId;

  // 🛡️ สิทธิ์ในการจัดการ: เป็น Admin หรือเป็น Agent/Manager ของแผนกที่รับงานย่อยนั้น
  const canManage = isAdmin || (isAgentOrManager && isResponsibleDept);
  
  // 🛡️ สิทธิ์ในการลบ: เป็น Admin OR เป็น Agent/Manager ของแผนกเจ้าของงานหลักเท่านั้น
  const canDelete = (isAdmin || isMainDeptStaff) && subTask.status_id === 1;

  const handleUpdateStatus = async (statusId: number) => {
    try {
      setLoading(true);
      await taskService.updateSubTaskStatus(requestId, subTask.id, {
        status_id: statusId,
        description: subTask.description,
        plan_start_date: subTask.plan_start_date,
        plan_finish_date: subTask.plan_finish_date,
      });
      toast.success("อัปเดตสถานะงานสำเร็จ");
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || "อัปเดตไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("คุณต้องการยกเลิกงานย่อยนี้ใช่หรือไม่?")) return;
    try {
      setLoading(true);
      await taskService.deleteSubTask(requestId, subTask.id);
      toast.success("ยกเลิกงานย่อยสำเร็จ");
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || "ลบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  if (!canManage && !canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RiMore2Fill className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 text-sm">
          {canManage && (
            <>
              <DropdownMenuItem onClick={() => setIsMemberDialogOpen(true)}>
                <RiUserAddLine className="h-4 w-4 mr-2 text-primary" />
                ระบุผู้รับผิดชอบงาน
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                <RiCalendarLine className="h-4 w-4 mr-2 text-primary" />
                กำหนดวันที่ / แผนงาน
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleUpdateStatus(1)}>
                <div className="h-2 w-2 rounded-full bg-yellow-500 mr-2" />
                รอดำเนินการ
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdateStatus(3)}>
                <div className="h-2 w-2 rounded-full bg-blue-500 mr-2" />
                กำลังดำเนินการ
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdateStatus(4)}>
                <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                เสร็จสิ้น
              </DropdownMenuItem>
            </>
          )}
          {canDelete && (
            <>
              {(canManage && canDelete) && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive text-sm font-medium">
                <RiDeleteBinLine className="h-4 w-4 mr-2" />
                ยกเลิกงานย่อย
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SubTaskMemberDialog 
        isOpen={isMemberDialogOpen} 
        onClose={() => setIsMemberDialogOpen(false)} 
        subTask={subTask} 
        requestId={requestId} 
        onRefresh={onRefresh} 
      />

      <EditSubTaskDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        subTask={subTask}
        requestId={requestId}
        onRefresh={onRefresh}
      />
    </>
  );
}
