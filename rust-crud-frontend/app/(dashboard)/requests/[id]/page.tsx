"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";

import {
  RiArrowLeftLine,
  RiSave3Line,
  RiLoader4Line,
  RiInformationLine,
  RiUploadCloud2Line,
  RiCloseCircleLine,
  RiFileList3Line,
  RiCalendarEventLine,
  RiDownload2Line,
  RiDeleteBin7Line,
  RiUserSharedLine,
  RiAddLine,
  RiAttachment2
} from "@remixicon/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const editSchema = z.object({
  subject_id: z.string().min(1, "กรุณาเลือกหัวข้อปัญหา"),
  phone_number: z.string().min(3, "กรุณากรอกเบอร์โทรศัพท์"),
  requirement: z.string().optional(),
  description: z.string().min(1, "กรุณาระบุรายละเอียดปัญหา"),
});
type EditFormValues = z.infer<typeof editSchema>;

export default function RequestEditPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params.id;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [data, setData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // States หมวดหมู่
  const [types, setTypes] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [approvers, setApprovers] = useState<any[]>([]);

  const [selectedType, setSelectedType] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedSubjectObj, setSelectedSubjectObj] = useState<any | null>(null);

  const [approvalSteps, setApprovalSteps] = useState<any[]>([]);

  // States จัดการไฟล์
  const [existingFiles, setExistingFiles] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  // State ยกเลิกใบงาน
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCanceling, setIsCanceling] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema)
  });

  // 🌟 โหลดข้อมูลทั้งหมดเมื่อเปิดหน้า
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) setCurrentUser(JSON.parse(userStr));

    const loadData = async () => {
      try {
        setIsFetchingData(true);
        const [reqData, typesRes, approversRes] = await Promise.all([
          fetchApi<any>(`/requests/${requestId}`),
          fetchApi<any[]>("/requests/master/types"),
          fetchApi<any[]>("/requests/approvers/department")
        ]);

        setData(reqData);
        setTypes(typesRes);
        setApprovers(approversRes);

        // เติมฟิลด์ Text
        setValue("phone_number", reqData.phone_number || "");
        setValue("requirement", reqData.requirement || "");
        setValue("description", reqData.description || "");

        // 🌟 จำลองการโหลด Dropdown กลับมา (แก้ให้แมตช์ได้ชัวร์ 100%)
        if (Array.isArray(typesRes)) {
          const matchedType = typesRes.find(t => 
            (t.name || t.name_th || t.type_name || "").toString().trim() === (reqData.type_name || "").trim()
          );

          if (matchedType) {
            setSelectedType(matchedType.id.toString());
            const topicsRes = await fetchApi<any[]>(`/requests/master/topics/${matchedType.id}`);
            setTopics(topicsRes);

            const matchedTopic = topicsRes.find(t => 
              (t.name || t.name_th || t.topic_name || "").toString().trim() === (reqData.topic_name || "").trim()
            );

            if (matchedTopic) {
              setSelectedTopic(matchedTopic.id.toString());
              const subjectsRes = await fetchApi<any[]>(`/requests/master/subjects/${matchedTopic.id}`);
              setSubjects(subjectsRes);

              // 🌟 ค้นหา Subject (ใช้ ID ตรงๆ แม่นยำที่สุด)
              const matchedSubject = subjectsRes.find(s => s.id === reqData.subject_id);
              
              if (matchedSubject) {
                setSelectedSubjectObj(matchedSubject);
                setValue("subject_id", matchedSubject.id.toString());
              }
            }
          }
        }

        // 🌟 เติมสายการอนุมัติเดิม (ดึงมาเฉพาะ PRE-WORK)
        if (reqData.approvals && reqData.approvals.length > 0) {
          // กรองเอาเฉพาะ PRE-WORK (หรือถ้า API ไม่ได้ส่ง approval_type มา ก็หยวนๆ ให้โชว์ไปก่อน)
          const preWorkApprovals = reqData.approvals.filter(
            (app: any) => !app.approval_type || app.approval_type === "PRE-WORK"
          );

          if (preWorkApprovals.length > 0) {
            const updatedApprovers = [...approversRes];

const steps = preWorkApprovals.map((app: any, idx: number) => {
              let approverId = app.approver_id ? app.approver_id.toString() : "";

              // 🌟 กรณีที่ 1: มี ID ส่งมาจาก API (เช่น 20, 21 ตาม JSON ของพี่)
              if (approverId) {
                // เช็คว่าใน Dropdown มีคนๆ นี้ให้เลือกไหม?
                const exists = updatedApprovers.find(a => a.id.toString() === approverId);
                if (!exists) {
                  // 🚨 ถ้าไม่มี (เช่น ย้ายแผนกไปแล้ว) ให้ดันชื่อเก่ากลับเข้าไปในตัวเลือก เพื่อให้โชว์บนจอได้!
                  updatedApprovers.push({
                    id: approverId,
                    name: app.approver_name || `(ไม่มีชื่อ ID: ${approverId})`
                  });
                }
              } 
              // 🌟 กรณีที่ 2: ไม่มี ID ส่งมา (มีแค่ชื่อ หรือเป็นคิวว่าง)
              else if (app.approver_name) {
                const matchedApp = updatedApprovers.find(a =>
                  (a.name || "").trim() === (app.approver_name || "").trim()
                );

                if (matchedApp) {
                  approverId = matchedApp.id.toString();
                } else {
                  approverId = `temp-${idx}`;
                  updatedApprovers.push({
                    id: approverId,
                    name: app.approver_name
                  });
                }
              }

              return {
                id: Date.now() + idx,
                approver_id: approverId
              };
            });

             

            setApprovers(updatedApprovers);
            setApprovalSteps(steps);
          } else {
            // ถ้ามีแต่ POST-WORK ไม่มี PRE-WORK เลย
            setApprovalSteps([{ id: Date.now(), approver_id: "" }]);
          }
        } else {
          setApprovalSteps([{ id: Date.now(), approver_id: "" }]);
        }

        if (reqData.file_url) {
          setExistingFiles(reqData.file_url.split(',').filter((f: string) => f.trim() !== ""));
        }
      } catch (error) {
        toast.error("ไม่สามารถโหลดข้อมูลใบงานได้");
      } finally {
        setIsFetchingData(false);
      }
    };

    if (requestId) loadData();
  }, [requestId, setValue]);

  // 🌟 เช็คสิทธิ์การแก้ไข (admin แก้ไขได้หมด, agent ยกเลิกได้อย่างเดียว)
  const isOwner = currentUser?.id === data?.requester_id;
  const isAdmin = currentUser?.role === "admin";
  const isAgent = currentUser?.role === "agent";

  const isPendingOrWaiting = data?.status_id === 1 || data?.status_id === 2;
  const hasBeenActedUpon = data?.approvals && data.approvals.some((app: any) => app.action_date !== null);

  // สิทธิ์การแก้ไข: Admin หรือ เจ้าของ (ถ้ายังไม่ถูกดำเนินการ)
  const canEdit = isAdmin || (isOwner && isPendingOrWaiting && !hasBeenActedUpon);
  // สิทธิ์การยกเลิก: Admin, Agent หรือ เจ้าของ (ถ้ายังไม่ถูกดำเนินการ)
  const canCancel = isAdmin || isAgent || (isOwner && isPendingOrWaiting && !hasBeenActedUpon);

  // --- จัดการ Dropdown ---
  const handleTypeChange = async (val: string) => {
    setSelectedType(val); setSelectedTopic(""); setValue("subject_id", ""); setSelectedSubjectObj(null);
    setTopics([]); setSubjects([]); setApprovalSteps([{ id: Date.now(), approver_id: "" }]);
    if (val) setTopics(await fetchApi<any[]>(`/requests/master/topics/${val}`));
  };

  const handleTopicChange = async (val: string) => {
    setSelectedTopic(val); setValue("subject_id", ""); setSelectedSubjectObj(null);
    setSubjects([]); setApprovalSteps([{ id: Date.now(), approver_id: "" }]);
    if (val) setSubjects(await fetchApi<any[]>(`/requests/master/subjects/${val}`));
  };

  const handleSubjectChange = (val: string) => {
    setValue("subject_id", val);
    setSelectedSubjectObj(subjects.find(s => s.id.toString() === val) || null);
    setApprovalSteps([{ id: Date.now(), approver_id: "" }]);
  };

  const addApprovalStep = () => setApprovalSteps([...approvalSteps, { id: Date.now(), approver_id: "" }]);
  const removeApprovalStep = (id: number) => setApprovalSteps(approvalSteps.filter(step => step.id !== id));
  const updateApprovalStep = (id: number, val: string) => setApprovalSteps(approvalSteps.map(step => step.id === id ? { ...step, approver_id: val } : step));

  // --- จัดการไฟล์ ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setNewFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };
  const removeNewFile = (idx: number) => setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  const removeExistingFile = async (fileUrl: string) => {
    if (!confirm("ยืนยันการลบไฟล์นี้?")) return;
    try {
      await fetchApi(`/requests/${requestId}/files`, { method: "DELETE", body: JSON.stringify({ files_to_delete: [fileUrl] }) });
      setExistingFiles(prev => prev.filter(f => f !== fileUrl));
      toast.success("ลบไฟล์สำเร็จ");
    } catch (e: any) { toast.error("ลบไฟล์ไม่สำเร็จ"); }
  };

  // 🌟 บันทึกการแก้ไข
  const onSubmit = async (formData: EditFormValues) => {
    const validApprovers = approvalSteps.filter(s => s.approver_id !== "");
    if (selectedSubjectObj?.requires_approval && validApprovers.length === 0) {
      return toast.error("กรุณาระบุผู้อนุมัติอย่างน้อย 1 ท่าน");
    }

    setIsLoading(true);
    try {
      const payload = {
        subject_id: parseInt(formData.subject_id),
        description: formData.description,
        phone_number: formData.phone_number,
        requirement: formData.requirement,
        status_id: data.status_id,
        // 🚨 ส่งเฉพาะ PRE-WORK ไปให้ Backend อัปเดต
        approvers: selectedSubjectObj?.requires_approval && validApprovers.length > 0
          ? validApprovers.map((step, index) => ({
            // ถ้าเป็น temp ID (เช่นคนลาออก) จะแปลงเป็น NaN แต่ในที่นี้เราบังคับให้เลือกคนที่มีอยู่จริงตอนกด Submit ได้
            approver_id: parseInt(step.approver_id),
            step: index + 1,
            approval_type: "PRE-WORK"
          })).filter(app => !isNaN(app.approver_id)) // กรอง temp-id ทิ้งกันเหนียว
          : null,
      };

      await fetchApi<any>(`/requests/${requestId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (newFiles.length > 0) {
        const fileData = new FormData();
        newFiles.forEach((file) => fileData.append("files", file));
        const token = localStorage.getItem("token");
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'}/requests/${requestId}/files`, {
          method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: fileData,
        });
      }

      toast.success("อัปเดตใบงานเรียบร้อยแล้ว");
      router.push("/requests");
      router.refresh();
    } catch (error: any) {
      toast.error("ผิดพลาด: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelReason.trim()) return toast.error("กรุณาระบุเหตุผล");

    setIsCanceling(true); // 🌟 เปิดสถานะ Loading
    try {
      await fetchApi(`/requests/${requestId}`, { method: "DELETE", body: JSON.stringify({ reason: cancelReason }) });
      toast.success("ยกเลิกใบงานแล้ว");
      setIsCancelDialogOpen(false); 
      router.push("/requests");
      router.refresh();
    } catch (e: any) {
      toast.error("ผิดพลาด: " + e.message);
    } finally {
      setIsCanceling(false); // 🌟 ปิดสถานะ Loading เสมอ
    }
  };

  if (isFetchingData) return <div className="p-10 text-center"><RiLoader4Line className="h-8 w-8 animate-spin mx-auto text-primary" /></div>;
  if (!data) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto mb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-secondary/50">
            <RiArrowLeftLine className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-mira flex items-center gap-2">
              รายละเอียดใบงาน <span className="text-muted-foreground text-lg font-normal">#{data.req_code}</span>
              <Badge variant={(data.status_variant as any) || "outline"} className={data.status_color || ""}>{data.status_name}</Badge>
            </h1>
          </div>
        </div>
        {canCancel && (
          <Button variant="destructive" onClick={() => setIsCancelDialogOpen(true)} className="shadow-sm">
            <RiDeleteBin7Line className="h-4 w-4 mr-2" /> ยกเลิกใบงาน
          </Button>
        )}
      </div>

      {!canEdit && (
        <Alert className="mb-6 bg-amber-50 border-amber-200 text-amber-800">
          <RiInformationLine className="h-5 w-5" />
          <AlertDescription>
            {isAgent && !isAdmin 
              ? "คุณเข้าถึงในฐานะ Agent สามารถกดยกเลิกใบงานได้เท่านั้น ไม่สามารถแก้ไขรายละเอียดได้"
              : "ใบงานนี้กำลังถูกดำเนินการ หรือผ่านการพิจารณาไปแล้ว ไม่สามารถแก้ไขได้"}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <RiFileList3Line className="h-5 w-5 text-primary" /> หมวดหมู่ที่แจ้ง
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ประเภทบริการ <span className="text-destructive">*</span></Label>
                    <Select value={selectedType} onValueChange={handleTypeChange} disabled={!canEdit}>
                      <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                      <SelectContent>
                        {types.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>หมวดหมู่ปัญหา <span className="text-destructive">*</span></Label>
                    <Select value={selectedTopic} onValueChange={handleTopicChange} disabled={!canEdit || !selectedType}>
                      <SelectTrigger><SelectValue placeholder="เลือกหมวดหมู่" /></SelectTrigger>
                      <SelectContent>
                        {topics.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>หัวข้อเรื่อง <span className="text-destructive">*</span></Label>
                  <Select value={selectedSubjectObj?.id.toString() || ""} onValueChange={handleSubjectChange} disabled={!canEdit || !selectedTopic}>
                    <SelectTrigger><SelectValue placeholder="เลือกหัวข้อเรื่อง" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.subject_id && <p className="text-sm text-destructive">{errors.subject_id.message}</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4"><CardTitle className="text-lg">รายละเอียด</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>สิ่งที่ต้องการเพิ่มเติม</Label>
                  <Input {...register("requirement")} disabled={!canEdit} className={!canEdit ? "bg-muted disabled:opacity-100" : ""} />
                </div>
                <div className="space-y-2">
                  <Label>อธิบายรายละเอียดปัญหา <span className="text-destructive">*</span></Label>
                  <Textarea {...register("description")} disabled={!canEdit} className={`min-h-[150px] ${!canEdit ? "bg-muted disabled:opacity-100" : ""}`} />
                  {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4"><CardTitle className="text-lg">ข้อมูลติดต่อและการอนุมัติ</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>เบอร์โทรศัพท์ <span className="text-destructive">*</span></Label>
                  <Input {...register("phone_number")} disabled={!canEdit} className={!canEdit ? "bg-muted disabled:opacity-100" : ""} />
                </div>

                {selectedSubjectObj && (
                  <div className="pt-4 border-t border-dashed">
                    {selectedSubjectObj.requires_approval ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-orange-600">
                          <RiUserSharedLine className="h-4 w-4" />
                          <span className="text-sm font-semibold">สายการอนุมัติ (ตามลำดับ)</span>
                        </div>
                        <div className="space-y-3">
                          {approvalSteps.map((step, index) => (
                            <div key={step.id} className="flex items-end gap-2">
                              <div className="space-y-1 flex-1">
                                <Label className="text-xs text-muted-foreground">ลำดับที่ {index + 1}</Label>
                                <Select value={step.approver_id} onValueChange={(val) => updateApprovalStep(step.id, val)} disabled={!canEdit}>
                                  <SelectTrigger className="border-orange-200"><SelectValue placeholder="เลือกผู้อนุมัติ" /></SelectTrigger>
                                  <SelectContent>
                                    {approvers.map(app => (
                                      <SelectItem key={app.id} value={app.id.toString()}>{app.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {canEdit && approvalSteps.length > 1 && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeApprovalStep(step.id)} className="text-muted-foreground hover:text-destructive">
                                  <RiDeleteBin7Line className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        {canEdit && (
                          <Button type="button" variant="outline" size="sm" onClick={addApprovalStep} className="w-full border-dashed border-orange-200 text-orange-600">
                            <RiAddLine className="h-4 w-4 mr-1" /> เพิ่มผู้อนุมัติลำดับถัดไป
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Alert className="bg-green-50/50 border-green-200 text-green-800 p-3">
                        <RiInformationLine className="h-4 w-4" color="#166534" />
                        <AlertDescription className="text-xs ml-2 font-medium">ไม่ต้องผ่านการอนุมัติ</AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4"><CardTitle className="text-lg">ไฟล์แนบ</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {existingFiles.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <Label className="text-xs text-muted-foreground">ไฟล์ที่แนบไว้แล้ว:</Label>
                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {existingFiles.map((fileUrl, idx) => (
                        <li key={idx} className="flex items-center justify-between p-2 text-sm border rounded-lg bg-muted/20">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <RiAttachment2 className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[150px]">{fileUrl.split('/').pop()}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a href={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '')}/${fileUrl.replace(/^\//, '')}`} target="_blank" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                              <RiDownload2Line className="h-4 w-4" />
                            </a>
                            {canEdit && (
                              <button type="button" onClick={() => removeExistingFile(fileUrl)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded">
                                <RiCloseCircleLine className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {canEdit && (
                  <>
                    <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-muted/10">
                      <RiUploadCloud2Line className="w-6 h-6 mb-1 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">อัปโหลดไฟล์เพิ่ม</p>
                      <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
                    </label>
                    {newFiles.length > 0 && (
                      <ul className="space-y-2 mt-4">
                        {newFiles.map((file, idx) => (
                          <li key={idx} className="flex items-center justify-between p-2 text-sm border rounded bg-emerald-50 text-emerald-800">
                            <span className="truncate max-w-[200px]">{file.name}</span>
                            <button type="button" onClick={() => removeNewFile(idx)}><RiCloseCircleLine className="w-5 h-5 text-destructive" /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center justify-end gap-4 pt-6 mt-6 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()} className="w-32">ยกเลิก</Button>
            <Button type="submit" size="lg" disabled={isLoading} className="w-40">
              {isLoading ? <><RiLoader4Line className="animate-spin mr-2 h-5 w-5" /> กำลังบันทึก...</> : <><RiSave3Line className="mr-2 h-5 w-5" /> บันทึกการแก้ไข</>}
            </Button>
          </div>
        )}
      </form>

      {/* Popup Dialog ยกเลิกใบงาน */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <RiCloseCircleLine className="h-5 w-5" /> ยืนยันยกเลิกใบงาน
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>โปรดระบุเหตุผล <span className="text-destructive">*</span></Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="พิมพ์เหตุผลที่นี่..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>ปิดหน้าต่าง</Button>
            <Button variant="destructive" onClick={handleCancelRequest} disabled={isCanceling}>
              {isCanceling ? "กำลังยกเลิก..." : "ยืนยันการยกเลิก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}