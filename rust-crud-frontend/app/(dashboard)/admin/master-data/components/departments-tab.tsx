"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";

import {
  RiAddLine,
  RiEditLine,
  RiDeleteBin7Line,
  RiLoader4Line,
  RiBuildingLine,
  RiInboxArchiveLine,
  RiSearchLine,
  RiDownloadLine,
  RiUploadLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";

const departmentSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อแผนก"),
});
type DepartmentFormValues = z.infer<typeof departmentSchema>;

export default function DepartmentsTab() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "" },
  });

  const loadDepartments = async () => {
    try {
      setIsLoading(true);
      const res = await fetchApi<any[]>("/manage/master/departments");
      setDepartments(Array.isArray(res) ? res : []);
    } catch (error: any) {
      toast.error("โหลดข้อมูลแผนกไม่สำเร็จ: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const filteredDepartments = departments.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddNew = () => {
    setEditingId(null);
    form.reset({ name: "" });
    setIsDialogOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    form.reset({ name: item.name });
    setIsDialogOpen(true);
  };

  const handleExport = () => {
    if (departments.length === 0) {
      toast.error("ไม่มีข้อมูลให้ Export");
      return;
    }
    const exportData = departments.map((d) => ({
      ID: d.id,
      ชื่อแผนก: d.name,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Departments");
    XLSX.writeFile(workbook, "master_departments.xlsx");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          id: row["ID"] ? parseInt(row["ID"]) : null, // 🆕 แมพ ID จาก Excel
          name: String(row["ชื่อแผนก"] || "").trim(),
        })).filter(item => item.name !== "");

        if (payload.length === 0) {
          toast.error("ไม่พบข้อมูลในไฟล์ หรือรูปแบบคอลัมน์ไม่ถูกต้อง (ต้องการคอลัมน์ 'ID' และ 'ชื่อแผนก')");
          return;
        }

        await fetchApi("/manage/master/departments/import", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(`นำเข้าและอัปเดตข้อมูลแผนก ${payload.length} รายการสำเร็จ`);
        loadDepartments();
      } catch (error: any) {
        toast.error("นำเข้าข้อมูลไม่สำเร็จ: " + (error.message || "รูปแบบไฟล์ไม่ถูกต้อง"));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const onSubmit = async (data: DepartmentFormValues) => {
    setIsSaving(true);
    try {
      if (editingId) {
        // 🌟 แก้ไข: ส่ง PUT ไปที่ URL ที่มี ID
        await fetchApi(`/manage/master/departments/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        toast.success("อัปเดตข้อมูลแผนกสำเร็จ");
      } else {
        // 🌟 เพิ่มใหม่: ส่ง POST
        await fetchApi("/manage/master/departments", {
          method: "POST",
          body: JSON.stringify(data),
        });
        toast.success("เพิ่มแผนกสำเร็จ");
      }
      setIsDialogOpen(false);
      loadDepartments();
    } catch (error: any) {
      toast.error(error.message || "บันทึกไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`คุณต้องการลบแผนก "${name}" ใช่หรือไม่?`)) return;
    try {
      await fetchApi(`/manage/master/departments/${id}`, { method: "DELETE" });
      toast.success("ลบแผนกสำเร็จ");
      loadDepartments();
    } catch (error: any) {
      toast.error(error.message || "ไม่สามารถลบแผนกได้");
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 font-sans">
      <Card className="shadow-sm border-border rounded-xl overflow-hidden bg-card w-full">
        <CardHeader className="border-b border-border bg-muted/20 dark:bg-muted/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
            <CardTitle className="text-lg font-bold text-foreground">
              จัดการแผนก (Departments)
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx, .xls" className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="shrink-0 bg-background hover:bg-muted">
                <RiUploadLine className="h-4 w-4 mr-1.5" /> Import
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0 bg-background hover:bg-muted">
                <RiDownloadLine className="h-4 w-4 mr-1.5" /> Export
              </Button>
              <Button onClick={handleAddNew} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
                <RiAddLine className="h-4 w-4 mr-1" /> เพิ่มแผนกใหม่
              </Button>
            </div>
          </div>
          
          <div className="mt-4 relative w-full md:w-72">
            <RiSearchLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อแผนก..."
              className="pl-9 h-9 bg-background border-border text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[600px]">
            <Table>
              <TableHeader className="bg-muted/50 dark:bg-muted/20">
                <TableRow className="border-border">
                  <TableHead className="w-24 pl-6 text-muted-foreground text-center">ID</TableHead>
                  <TableHead className="text-muted-foreground">ชื่อแผนก</TableHead>
                  <TableHead className="text-right pr-6 w-32 text-muted-foreground">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center">
                      <RiLoader4Line className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-48 text-center text-muted-foreground">
                      <RiInboxArchiveLine className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p>ไม่พบข้อมูลแผนก</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDepartments.map((dept) => (
                    <TableRow key={dept.id} className="border-border hover:bg-muted/40 transition-colors">
                      <TableCell className="pl-6 font-mono text-xs text-muted-foreground text-center">
                        {dept.id}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-primary/5 rounded-md">
                            <RiBuildingLine className="h-4 w-4 text-primary" />
                          </div>
                          {dept.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100/50" onClick={() => handleEdit(dept)}>
                            <RiEditLine className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100/50" onClick={() => handleDelete(dept.id, dept.name)}>
                            <RiDeleteBin7Line className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border font-sans">
          <DialogHeader>
            <DialogTitle className="text-xl text-foreground">
              {editingId ? "แก้ไขข้อมูลแผนก" : "เพิ่มแผนกใหม่"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-foreground">ชื่อแผนก <span className="text-destructive">*</span></Label>
              <Input
                {...form.register("name")}
                placeholder="เช่น แผนกไอที, แผนกซ่อมบำรุง"
                className="bg-background border-border text-foreground focus-visible:ring-primary"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            
            <DialogFooter className="pt-4 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-background hover:bg-muted">
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSaving ? <RiLoader4Line className="animate-spin h-4 w-4 mr-2" /> : "บันทึก"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
