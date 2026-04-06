"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";

import { RiAddLine, RiEditLine, RiDeleteBin7Line, RiLoader4Line, RiPriceTag3Line, RiInboxArchiveLine, RiDownloadLine, RiUploadLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

const subjectSchema = z.object({
  topic_id: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  name: z.string().min(1, "กรุณากรอกชื่อหัวข้อปัญหา"),
  requires_approval: z.boolean(),
  requires_receiver_approval: z.boolean(), 
});
type SubjectFormValues = z.infer<typeof subjectSchema>;

export default function SubjectsTab() {
  const [types, setTypes] = useState<any[]>([]);
  const [typeId, setTypeId] = useState<string>(""); 
  const [topics, setTopics] = useState<any[]>([]); 
  const [topicId, setTopicId] = useState<string>(""); 
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SubjectFormValues>({ 
    resolver: zodResolver(subjectSchema), 
    defaultValues: { topic_id: "", name: "", requires_approval: false, requires_receiver_approval: false } 
  });

  useEffect(() => { 
    fetchApi<any[]>("/requests/master/types").then(res => setTypes((res as any) || [])); 
  }, []);
  
  useEffect(() => { 
    setTopicId(""); 
    if(typeId) {
        fetchApi<any[]>(`/requests/master/topics/${typeId}`).then(res => setTopics((res as any) || []));
    } else {
        setTopics([]);
    }
  }, [typeId]);

  const loadSubjects = async () => {
    if (!topicId) { setSubjects([]); return; }
    setIsLoading(true);
    try { 
        const res = await fetchApi<any[]>(`/requests/master/subjects/${topicId}`); 
        setSubjects((res as any) || []);
    } 
    catch (error) { toast.error("โหลดข้อมูลหัวข้อปัญหาไม่สำเร็จ"); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadSubjects(); }, [topicId]);

  const handleAddNew = () => { 
    setEditingId(null); 
    form.reset({ topic_id: topicId, name: "", requires_approval: false, requires_receiver_approval: false }); 
    setIsDialogOpen(true); 
  };
  
  const handleEdit = (item: any) => { 
    setEditingId(item.id); 
    form.reset({ 
      topic_id: topicId, 
      name: item.name, 
      requires_approval: item.requires_approval,
      requires_receiver_approval: item.requires_receiver_approval || false
    }); 
    setIsDialogOpen(true); 
  };

  const handleExport = () => {
    if (!topicId) { toast.error("กรุณาเลือกหมวดหมู่ก่อน Export"); return; }
    const typeName = types.find(t => t.id.toString() === typeId)?.name || "";
    const topicName = topics.find(t => t.id.toString() === topicId)?.name || "";
    
    const exportData = subjects.map(s => ({
      "ID": s.id,
      "ประเภทบริการ": typeName,
      "หมวดหมู่": topicName,
      "ชื่อหัวข้อปัญหา": s.name,
      "อนุมัติฝั่งผู้แจ้ง": s.requires_approval ? "Y" : "N",
      "อนุมัติฝั่งผู้รับงาน": s.requires_receiver_approval ? "Y" : "N",
      "ลบ": "N"
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subjects");
    XLSX.writeFile(workbook, `master_subjects_${topicName}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!topicId) { toast.error("กรุณาเลือกหมวดหมู่ก่อน Import"); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        const payload = data.map((row: any) => ({
          id: row["ID"] ? parseInt(row["ID"]) : null,
          topic_id: parseInt(topicId),
          name: row["ชื่อหัวข้อปัญหา"],
          requires_approval: row["อนุมัติฝั่งผู้แจ้ง"] === "Y",
          requires_receiver_approval: row["อนุมัติฝั่งผู้รับงาน"] === "Y",
          del_flag: row["ลบ"] === "Y"
        }));
        await fetchApi("/manage/master/subjects/import", { method: "POST", body: JSON.stringify(payload) });
        toast.success("นำเข้าข้อมูลสำเร็จ");
        loadSubjects();
      } catch (error) {
        toast.error("นำเข้าข้อมูลไม่สำเร็จ");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };
  
  const onSubmit = async (data: SubjectFormValues) => {
    setIsSaving(true);
    try {
      const payload = { 
          topic_id: parseInt(data.topic_id), 
          name: data.name, 
          requires_approval: data.requires_approval,
          requires_receiver_approval: data.requires_receiver_approval
      };

      if (editingId) { 
          await fetchApi(`/manage/master/subjects/${editingId}`, { method: "PUT", body: JSON.stringify(payload) }); 
      } else { 
          await fetchApi(`/manage/master/subjects`, { method: "POST", body: JSON.stringify(payload) }); 
      }

      toast.success("บันทึกสำเร็จ"); 
      setIsDialogOpen(false); 
      loadSubjects();
    } catch (error: any) { 
        toast.error("บันทึกไม่สำเร็จ"); 
    } finally { 
        setIsSaving(false); 
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`ลบหัวข้อปัญหา "${name}" ?`)) return;
    try { 
        await fetchApi(`/manage/master/subjects/${id}`, { method: "DELETE" }); 
        toast.success("ลบสำเร็จ"); 
        loadSubjects(); 
    } 
    catch (error: any) { toast.error("ลบไม่สำเร็จ"); }
  };

  return (
    <>
      <Card className="shadow-sm border-border rounded-xl overflow-hidden bg-card">
        <CardHeader className="border-b border-border bg-muted/20">
        <div className="space-y-1 flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-foreground">หัวข้อปัญหา (Subjects)</CardTitle>
             {/* ให้อยู่ขวาสุด */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx, .xls" className="hidden" />
                <Button variant="outline" size="sm"  onClick={() => fileInputRef.current?.click()} disabled={!topicId}>
                  <RiUploadLine className="h-4 w-4 mr-1.5" /> Import
                </Button>
                <Button variant="outline" size="sm"  onClick={handleExport} disabled={!topicId}>
                  <RiDownloadLine className="h-4 w-4 mr-1.5" /> Export
                </Button>
                <Button onClick={handleAddNew} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"  disabled={!topicId}><RiAddLine className=" h-4 w-4" /> เพิ่มหัวข้อปัญหา</Button>
                </div>
              
            </div>
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
            
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-background p-1.5 border border-border rounded-lg shadow-sm w-full xl:w-auto">
              <select className="bg-transparent h-9 px-3 text-sm w-full sm:w-48 text-foreground outline-none" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">1. เลือกประเภทบริการ</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="hidden sm:block w-px h-6 bg-border"></div>
              <select className="bg-transparent h-9 px-3 text-sm w-full sm:w-48 text-foreground outline-none disabled:opacity-50" value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!typeId}>
                <option value="">2. เลือกหมวดหมู่</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="hidden sm:block w-px h-6 bg-border"></div>
              
              
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!topicId ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/10"><RiPriceTag3Line className="h-12 w-12 mb-3 opacity-50" /><p>กรุณาเลือกประเภทและหมวดหมู่ตามลำดับ</p></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="w-24 pl-6">รหัส</TableHead>
                  <TableHead>ชื่อหัวข้อ</TableHead>
                  <TableHead className="w-32 text-center">อนุมัติ (ผู้แจ้ง)</TableHead>
                  <TableHead className="w-32 text-center">อนุมัติ (ผู้รับงาน)</TableHead>
                  <TableHead className="text-right pr-6 w-32">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="border-border"><TableCell colSpan={5} className="h-32 text-center"><RiLoader4Line className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : subjects.length === 0 ? (
                  <TableRow className="border-border"><TableCell colSpan={5} className="h-48 text-center text-muted-foreground"><RiInboxArchiveLine className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>ไม่มีข้อมูล</p></TableCell></TableRow>
                ) : subjects.map((sub) => (
                  <TableRow key={sub.id} className="border-border hover:bg-muted/40">
                    <TableCell className="pl-6 font-mono text-xs text-muted-foreground">{sub.id}</TableCell>
                    <TableCell className="font-medium text-foreground">{sub.name}</TableCell>
                    <TableCell className="text-center">
                      {sub.requires_approval ? <Badge variant="outline" className="bg-blue-100/50 text-blue-700">ต้องอนุมัติ</Badge> : <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">ไม่ต้อง</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {sub.requires_receiver_approval ? <Badge variant="outline" className="bg-amber-100/50 text-amber-700">ต้องอนุมัติ</Badge> : <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">ไม่ต้อง</span>}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="icon" className="text-blue-600 dark:text-blue-400" onClick={() => handleEdit(sub)}><RiEditLine className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-600 dark:text-red-400" onClick={() => handleDelete(sub.id, sub.name)}><RiDeleteBin7Line className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader><DialogTitle className="text-xl text-foreground">{editingId ? "แก้ไขหัวข้อปัญหา" : "เพิ่มหัวข้อปัญหา"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>ชื่อหัวข้อปัญหา <span className="text-destructive">*</span></Label>
              <Input {...form.register("name")} className="bg-background" />
            </div>
            
            <div className="space-y-3 pt-2">
              <Label className="text-foreground font-semibold">การตั้งค่าสายอนุมัติ</Label>
              
              <div className="flex items-start space-x-3 p-3.5 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                <input type="checkbox" id="requires_approval" className="mt-0.5 w-4 h-4 rounded border-input bg-background text-primary" {...form.register("requires_approval")} />
                <Label htmlFor="requires_approval" className="cursor-pointer text-sm leading-relaxed">
                  1. อนุมัติฝั่งผู้แจ้ง (เช่น หัวหน้าแผนกผู้แจ้ง)<br/>
                  <span className="text-xs text-muted-foreground font-normal">เพื่อยืนยันความจำเป็นในการขอใช้บริการ</span>
                </Label>
              </div>

              <div className="flex items-start space-x-3 p-3.5 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                <input type="checkbox" id="requires_receiver_approval" className="mt-0.5 w-4 h-4 rounded border-input bg-background text-primary" {...form.register("requires_receiver_approval")} />
                <Label htmlFor="requires_receiver_approval" className="cursor-pointer text-sm leading-relaxed">
                  2. อนุมัติฝั่งผู้รับงาน (หัวหน้าแผนกที่รับผิดชอบตะกร้านี้)<br/>
                  <span className="text-xs text-muted-foreground font-normal">เพื่อตรวจสอบสต๊อก/งบประมาณ ก่อนแจกจ่ายงานให้ลูกน้อง</span>
                </Label>
              </div>

            </div>

            <DialogFooter className="pt-4 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? <RiLoader4Line className="animate-spin h-4 w-4 mr-2" /> : "บันทึก"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
