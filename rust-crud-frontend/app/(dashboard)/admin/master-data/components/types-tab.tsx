"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";

import { RiAddLine, RiEditLine, RiDeleteBin7Line, RiLoader4Line, RiInboxArchiveLine, RiDownloadLine, RiUploadLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; 
import * as XLSX from "xlsx";

const typeSchema = z.object({
    name: z.string().min(1, "กรุณากรอกชื่อประเภทบริการ"),
    description: z.string().optional(),
    responsible_dept_id: z.string().min(1, "กรุณาเลือกแผนกรับผิดชอบ"),
});
type TypeFormValues = z.infer<typeof typeSchema>;

export default function TypesTab() {
    const [types, setTypes] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]); 
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<TypeFormValues>({
        resolver: zodResolver(typeSchema),
        defaultValues: { name: "", description: "", responsible_dept_id: "" },
    });

    const loadTypes = async () => {
        try {
            setIsLoading(true);
            const res = await fetchApi<any[]>("/requests/master/types");
            setTypes(Array.isArray(res) ? res : []); 
        } catch (error) {
            toast.error("ดึงข้อมูลประเภทบริการไม่สำเร็จ");
        } finally {
            setIsLoading(false);
        }
    };

    const loadDepartments = async () => {
        try {
            const res = await fetchApi<any[]>("/manage/master/departments");
            setDepartments(Array.isArray(res) ? res : []);
        } catch (error) {
            toast.error("ดึงข้อมูลแผนกไม่สำเร็จ");
        }
    };

    useEffect(() => { 
        loadTypes(); 
        loadDepartments(); 
    }, []);

    const handleAdd = () => {
        setEditingId(null);
        form.reset({ name: "", description: "", responsible_dept_id: "" });
        setIsDialogOpen(true);
    };

    const handleEdit = (type: any) => {
        setEditingId(type.id);
        form.reset({
            name: type.name,
            description: type.description || "",
            responsible_dept_id: type.responsible_dept_id ? type.responsible_dept_id.toString() : ""
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`ยืนยันการลบประเภท "${name}"?`)) return;
        try {
            await fetchApi(`/manage/master/types/${id}`, { method: "DELETE" });
            toast.success("ลบข้อมูลสำเร็จ");
            loadTypes();
        } catch (error) {
            toast.error("ไม่สามารถลบข้อมูลได้");
        }
    };

    const handleExport = () => {
        const exportData = types.map(t => ({
            "ID": t.id,
            "ชื่อประเภท": t.name,
            "คำอธิบาย": t.description || "",
            "แผนกรับผิดชอบ": getDeptName(t.responsible_dept_id),
            "ลบ": "N"
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Types");
        XLSX.writeFile(workbook, "master_types.xlsx");
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
                const payload = data.map((row: any) => {
                    const dept = departments.find(d => d.name === row["แผนกรับผิดชอบ"]);
                    return {
                        id: row["ID"] ? parseInt(row["ID"]) : null,
                        name: row["ชื่อประเภท"],
                        description: row["คำอธิบาย"],
                        responsible_dept_id: dept ? dept.id : 0,
                        del_flag: row["ลบ"] === "Y"
                    };
                });
                await fetchApi("/manage/master/types/import", { method: "POST", body: JSON.stringify(payload) });
                toast.success("นำเข้าข้อมูลสำเร็จ");
                loadTypes();
            } catch (error) {
                toast.error("นำเข้าข้อมูลไม่สำเร็จ");
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsBinaryString(file);
    };

    const onSubmit = async (data: TypeFormValues) => {
        try {
            setIsSaving(true);
            const payload = JSON.stringify({
                ...data,
                responsible_dept_id: parseInt(data.responsible_dept_id)
            });

            if (editingId) {
                await fetchApi(`/manage/master/types/${editingId}`, { method: "PUT", body: payload });
                toast.success("อัปเดตข้อมูลสำเร็จ");
            } else {
                await fetchApi("/manage/master/types", { method: "POST", body: payload });
                toast.success("เพิ่มข้อมูลสำเร็จ");
            }
            setIsDialogOpen(false);
            loadTypes();
        } catch (error) {
            toast.error("บันทึกข้อมูลไม่สำเร็จ");
        } finally {
            setIsSaving(false);
        }
    };

    const getDeptName = (id: number) => departments.find(d => d.id === id)?.name || "ไม่ระบุ";

    return (
        <div className="space-y-4">
            <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 gap-4">
                    <CardTitle className="text-lg font-bold">ประเภทบริการ (Types)</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx, .xls" className="hidden" />
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <RiUploadLine className="mr-2 h-4 w-4" /> Import
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <RiDownloadLine className="mr-2 h-4 w-4" /> Export
                        </Button>
                        <Button onClick={handleAdd} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            <RiAddLine className="h-4 w-4" /> เพิ่มประเภท
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8"><RiLoader4Line className="animate-spin h-8 w-8 text-muted-foreground" /></div>
                    ) : types.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground"><RiInboxArchiveLine className="mx-auto h-12 w-12 opacity-20 mb-3" /><p>ยังไม่มีข้อมูลประเภทบริการ</p></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[50px] font-semibold text-center">ID</TableHead>
                                    <TableHead className="font-semibold">ชื่อประเภท</TableHead>
                                    <TableHead className="font-semibold">รายละเอียด</TableHead>
                                    <TableHead className="font-semibold text-center">แผนกรับผิดชอบ</TableHead>
                                    <TableHead className="text-right font-semibold">จัดการ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {types.map((type) => (
                                    <TableRow key={type.id} className="hover:bg-muted/30">
                                        <TableCell className="text-center text-muted-foreground">{type.id}</TableCell>
                                        <TableCell className="font-medium">{type.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{type.description || "-"}</TableCell>
                                        <TableCell className="text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                {getDeptName(type.responsible_dept_id)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 dark:text-blue-400" onClick={() => handleEdit(type)}><RiEditLine className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 dark:text-red-400" onClick={() => handleDelete(type.id, type.name)}><RiDeleteBin7Line className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md bg-card border-border">
                    <DialogHeader><DialogTitle className="text-xl text-foreground">{editingId ? "แก้ไขประเภท" : "เพิ่มประเภท"}</DialogTitle></DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">
                        <div className="space-y-2"><Label>ชื่อประเภท <span className="text-destructive">*</span></Label><Input {...form.register("name")} className="bg-background" /></div>
                        <div className="space-y-2"><Label>คำอธิบาย</Label><Textarea {...form.register("description")} className="bg-background resize-none" rows={3} /></div>

                        <div className="space-y-2">
                            <Label>แผนกที่รับผิดชอบตะกร้างาน <span className="text-destructive">*</span></Label>
                            <Select onValueChange={(val) => form.setValue("responsible_dept_id", val)} value={form.watch("responsible_dept_id")}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="เลือกแผนกที่รับผิดชอบ" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map(dept => (
                                        <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.responsible_dept_id && (
                                <p className="text-xs text-destructive">{form.formState.errors.responsible_dept_id.message}</p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving ? <RiLoader4Line className="animate-spin h-4 w-4 mr-2" /> : "บันทึก"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
