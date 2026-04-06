"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  RiUserSharedLine,
  RiAddLine,
  RiDeleteBin7Line
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
import { Alert, AlertDescription } from "@/components/ui/alert";


const requestSchema = z.object({
  subject_id: z.string().min(1, "กรุณาเลือกหัวข้อปัญหา"),
  phone_number: z.string().min(3, "กรุณากรอกเบอร์โทรศัพท์"),
  requirement: z.string().optional(),
  description: z.string().min(1, "กรุณาระบุรายละเอียดปัญหา"),
});

type RequestFormValues = z.infer<typeof requestSchema>;

export default function CreateRequestPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // States สำหรับ Master Data
  const [types, setTypes] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [approvers, setApprovers] = useState<any[]>([]); // 🚨 รายชื่อหัวหน้าทั้งหมด

  const [selectedType, setSelectedType] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedSubjectObj, setSelectedSubjectObj] = useState<any | null>(null);

  // 🚨 State สำหรับเก็บสายการอนุมัติ (Dynamic Steps)
  const [approvalSteps, setApprovalSteps] = useState([{ id: Date.now(), approver_id: "" }]);

  // States สำหรับไฟล์แนบ
  const [files, setFiles] = useState<File[]>([]);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema)
  });

  // โหลด Master Data ตอนเปิดหน้า
  useEffect(() => {
    fetchApi<any[]>("/requests/master/types").then(setTypes).catch(console.error);
    fetchApi<any[]>("/requests/approvers/department").then(setApprovers).catch(() => {
      toast.error("ไม่สามารถโหลดรายชื่อผู้อนุมัติได้");
    });
  }, []);

  useEffect(() => {
    if (selectedType) {
      setTopics([]);
      setSubjects([]);
      setSelectedSubjectObj(null);
      fetchApi<any[]>(`/requests/master/topics/${selectedType}`).then(setTopics);
    }
  }, [selectedType]);

  useEffect(() => {
    if (selectedTopic) {
      setSubjects([]);
      setSelectedSubjectObj(null);
      fetchApi<any[]>(`/requests/master/subjects/${selectedTopic}`).then(setSubjects);
    }
  }, [selectedTopic]);

  const selectedTypeObj = types.find(t => t.id.toString() === selectedType);

  // เมื่อเลือกหัวข้อปัญหา
  const handleSubjectChange = (val: string) => {
    const subject = subjects.find(s => s.id.toString() === val);
    setSelectedSubjectObj(subject || null);
    setValue("subject_id", val);

    // รีเซ็ตสายอนุมัติให้เหลือ 1 ช่องว่างๆ เวลาเปลี่ยนหัวข้อ
    setApprovalSteps([{ id: Date.now(), approver_id: "" }]);
  };

  // --- 🚨 ฟังก์ชันจัดการสายอนุมัติ 🚨 ---
  const addApprovalStep = () => {
    setApprovalSteps([...approvalSteps, { id: Date.now(), approver_id: "" }]);
  };

  const removeApprovalStep = (idToRemove: number) => {
    setApprovalSteps(approvalSteps.filter(step => step.id !== idToRemove));
  };

  const updateApprovalStep = (idToUpdate: number, value: string) => {
    setApprovalSteps(approvalSteps.map(step =>
      step.id === idToUpdate ? { ...step, approver_id: value } : step
    ));
  };
  // ------------------------------------

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const onSubmit = async (data: RequestFormValues) => {
    // 🚨 Validate เช็คว่าถ้าต้องอนุมัติ ห้ามมีช่องโหว่
    const validApprovers = approvalSteps.filter(s => s.approver_id !== "");

    if (selectedSubjectObj?.requires_approval && validApprovers.length === 0) {
      toast.error("กรุณาระบุผู้อนุมัติอย่างน้อย 1 ท่าน");
      return;
    }

    setIsLoading(true);
    try {
      // 🚨 เตรียม Payload ให้ตรงกับ Struct ของ Rust
      const payload = {
        ...data,
        subject_id: parseInt(data.subject_id),
        // แมปข้อมูล approvers ให้เป็น Array ของ ApproverInput
        approvers: selectedSubjectObj?.requires_approval && validApprovers.length > 0
          ? validApprovers.map((step, index) => ({
            approver_id: parseInt(step.approver_id),
            step: index + 1, // รันลำดับ 1, 2, 3 ให้เลยอัตโนมัติ
            approval_type: "PRE-WORK" // ส่งค่าเริ่มต้นไปให้ฝั่ง Backend
          }))
          : null, // ถ้าไม่ต้องอนุมัติ ส่ง null ไปเลย
      };

      const newRequest = await fetchApi<any>("/requests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (files.length > 0 && newRequest.request_id) {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));

        // 🌟 แนะนำให้ใช้ fetchApi ของพี่ได้เลยครับ (เพราะมันจัดการ Token + FormData ให้แล้ว)
        try {
          await fetchApi(`/requests/${newRequest.request_id}/files`, {
            method: "POST",
            body: formData,
          });
        } catch (fileErr) {
          toast.warning("สร้างใบงานสำเร็จ แต่มีปัญหาการอัปโหลดไฟล์");
        }
      }

      toast.success("บันทึกใบงานและสายการอนุมัติเรียบร้อยแล้ว");
      router.push("/requests");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto mb-10">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-secondary/50">
          <RiArrowLeftLine className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-mira">เปิดใบงานใหม่</h1>
          <p className="text-sm text-muted-foreground">กรอกข้อมูลปัญหาหรือข้อร้องขอที่ต้องการให้เราช่วยเหลือ</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* คอลัมน์ซ้าย: ข้อมูลหลัก */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <RiFileList3Line className="h-5 w-5 text-primary" />
                  หมวดหมู่การแจ้งปัญหา
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ประเภทบริการ <span className="text-destructive">*</span></Label>
                    <Select onValueChange={setSelectedType}>
                      <SelectTrigger><SelectValue placeholder="เลือกประเภทบริการ" /></SelectTrigger>
                      <SelectContent>
                        {types.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>หมวดหมู่ปัญหา <span className="text-destructive">*</span></Label>
                    <Select onValueChange={setSelectedTopic} disabled={!selectedType}>
                      <SelectTrigger><SelectValue placeholder="เลือกหมวดหมู่ปัญหา" /></SelectTrigger>
                      <SelectContent>
                        {topics.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedTypeObj?.description && (
                  <Alert className="bg-blue-50/50 text-blue-800 border-blue-200">
                    <RiInformationLine className="h-4 w-4" color="#1e40af" />
                    <AlertDescription className="text-sm ml-2">
                      {selectedTypeObj.description}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label>หัวข้อเรื่อง <span className="text-destructive">*</span></Label>
                  <Select onValueChange={handleSubjectChange} disabled={!selectedTopic}>
                    <SelectTrigger><SelectValue placeholder="เลือกหัวข้อเรื่องที่ต้องการแจ้ง" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.subject_id && <p className="text-sm text-destructive">{errors.subject_id.message}</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">รายละเอียด</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>สิ่งที่ต้องการเพิ่มเติม (Requirement)</Label>
                  <Input {...register("requirement")} placeholder="ระบุสิ่งที่ต้องการให้จัดการเป็นพิเศษ (ถ้ามี)" />
                </div>
                <div className="space-y-2">
                  <Label>อธิบายรายละเอียดปัญหา <span className="text-destructive">*</span></Label>
                  <Textarea {...register("description")} placeholder="อธิบายลักษณะอาการ..." className="min-h-[150px] resize-none" />
                  {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* คอลัมน์ขวา: ติดต่อและการอนุมัติ */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">ข้อมูลติดต่อและการอนุมัติ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>เบอร์โทรศัพท์ <span className="text-destructive">*</span></Label>
                  <Input {...register("phone_number")} placeholder="เช่น 081-234-5678" />
                  {errors.phone_number && <p className="text-sm text-destructive">{errors.phone_number.message}</p>}
                </div>

                {/* 🚨 โซนสายการอนุมัติแบบ Dynamic 🚨 */}
                {selectedSubjectObj && (

                  <div className="pt-4 border-t border-dashed animate-in fade-in slide-in-from-top-2">
                    <Alert className="mb-4 bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50">
                      <RiInformationLine className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-blue-800 dark:text-blue-300 text-sm ml-2">
                        <span className="font-semibold block mb-1">เส้นทางการอนุมัติใบงานนี้:</span>
                        <ul className="list-disc list-inside space-y-1">
                          {selectedSubjectObj.requires_approval ? (
                            <li>ต้องผ่านการอนุมัติจาก <span className="font-semibold underline">ของคุณ</span></li>
                          ) : (
                            <li className="text-muted-foreground line-through">ไม่ต้องขออนุมัติจากหัวหน้าของคุณ</li>
                          )}

                          {/* เช็คตัวแปรใหม่ที่เราเพิ่งเพิ่มไปใน Database */}
                          {selectedSubjectObj.requires_receiver_approval ? (
                            <li>ต้องผ่านการอนุมัติจาก <span className="font-semibold underline">ผู้รับงาน</span> ก่อนเริ่มดำเนินการ</li>
                          ) : (
                            <li className="text-muted-foreground line-through">ไม่ต้องขออนุมัติจากแผนกผู้รับงาน</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                    {selectedSubjectObj.requires_approval ? (
                      <div className="space-y-4 p-4 border rounded-xl bg-card">

                        <div className="flex items-center gap-2 text-orange-600">
                          <RiUserSharedLine className="h-4 w-4" />
                          <span className="text-sm font-semibold">เลือกผู้อนุมัติ</span>
                        </div>

                        {/* ลูปแสดงช่องเลือกผู้อนุมัติ */}
                        <div className="space-y-3">
                          {approvalSteps.map((step, index) => (
                            <div key={step.id} className="flex items-end gap-2">
                              <div className="space-y-1 flex-1">
                                <Label className="text-xs text-muted-foreground">ลำดับที่ {index + 1}</Label>
                                <Select value={step.approver_id} onValueChange={(val) => updateApprovalStep(step.id, val)}>
                                  <SelectTrigger className="border-orange-200 focus:ring-orange-500">
                                    <SelectValue placeholder="เลือกผู้อนุมัติ" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {approvers.map(app => (
                                      <SelectItem key={app.id} value={app.id.toString()}>
                                        {app.name} {app.position ? `(${app.position})` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* ปุ่มลบ (จะโชว์ก็ต่อเมื่อมีมากกว่า 1 ลำดับ) */}
                              {approvalSteps.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeApprovalStep(step.id)}
                                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  <RiDeleteBin7Line className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* ปุ่มเพิ่มลำดับอนุมัติ */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addApprovalStep}
                          className="w-full border-dashed border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                        >
                          <RiAddLine className="h-4 w-4 mr-1" /> เพิ่มผู้อนุมัติลำดับถัดไป
                        </Button>
                      </div>
                    ) : (
                      <Alert className="bg-green-50/50 border-green-200 text-green-800 p-3">
                        <RiInformationLine className="h-4 w-4" color="#166534" />
                        <AlertDescription className="text-xs ml-2 font-medium">
                          หัวข้อนี้ไม่ต้องอนุมัติ ระบบจะส่งให้ IT ดำเนินการทันที
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">ไฟล์แนบ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/50 transition-colors border-muted-foreground/30">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-muted-foreground">
                    <RiUploadCloud2Line className="w-8 h-8 mb-2" />
                    <p className="text-sm font-medium">คลิกเพื่อเลือกไฟล์ภาพ/เอกสาร</p>
                    <p className="text-xs mt-1">อัปโหลดได้หลายไฟล์</p>
                  </div>
                  <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
                </label>
                {files.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs text-muted-foreground">ไฟล์ที่เตรียมอัปโหลด ({files.length}):</Label>
                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {files.map((file, idx) => (
                        <li key={idx} className="flex items-center justify-between p-2 text-sm border rounded bg-background mb-2">
                          <span className="truncate max-w-[200px]">{file.name}</span>
                          <button type="button" onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive">
                            <RiCloseCircleLine className="w-5 h-5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-6 mt-6 border-t">
          <Button type="button" variant="outline" onClick={() => router.back()} className="w-32">ยกเลิก</Button>
          <Button type="submit" size="lg" disabled={isLoading} className="w-40">
            {isLoading ? <><RiLoader4Line className="animate-spin mr-2 h-5 w-5" /> กำลังส่ง...</> : <><RiSave3Line className="mr-2 h-5 w-5" /> สร้างใบงาน</>}
          </Button>
        </div>
      </form>
    </div>
  );
}