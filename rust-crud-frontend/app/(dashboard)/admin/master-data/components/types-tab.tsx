"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";

import { RiAddLine, RiEditLine, RiDeleteBin7Line, RiLoader4Line, RiInboxArchiveLine, RiDownloadLine, RiUploadLine, RiSearchLine, RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
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

    // Filter and Pagination State
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const form = useForm<TypeFormValues>({
        resolver: zodResolver(typeSchema),
        defaultValues: { name: "", description: "", responsible_dept_id: "" },
    });

    const loadTypes = async () => {
        try {
            setIsLoading(true);
            const res = await fetchApi<any[]>("/requests/master/types");
            setTypes(Array.isArray(res) ? res : []); 
            setCurrentPage(1); // Reset to page 1 when data reloads
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

    // Filter logic
    const filteredTypes = types.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Pagination logic
    const totalPages = Math.ceil(filteredTypes.length / pageSize);
    const paginatedTypes = filteredTypes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
        <div className="space-y-4 w-full min-w-0 max-w-full">
            <Card className="border-border shadow-sm w-full bg-card">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 gap-4 w-full border-b border-border bg-muted/20 dark:bg-muted/10">
                    <div className="flex flex-col space-y-2 w-full md:w-auto">
                        <CardTitle className="text-lg font-bold shrink-0 text-foreground">ประเภทบริการ (Types)</CardTitle>
                        <div className="relative w-full md:w-64">
                            <RiSearchLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="ค้นหาประเภทบริการ..."
                                className="pl-9 h-9 w-full bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary shadow-sm"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx, .xls" className="hidden" />
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="shrink-0 bg-background hover:bg-muted text-foreground">
                            <RiUploadLine className="mr-1.5 h-4 w-4" /> Import
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0 bg-background hover:bg-muted text-foreground">
                            <RiDownloadLine className="mr-1.5 h-4 w-4" /> Export
                        </Button>
                        <Button onClick={handleAdd} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
                            <RiAddLine className="h-4 w-4 mr-1" /> เพิ่มประเภท
                        </Button>
                    </div>
                </CardHeader>
                
                <CardContent className="p-0 overflow-x-auto w-full">
                    <div className="min-w-[800px]">
                        {isLoading ? (
                            <div className="flex justify-center p-8"><RiLoader4Line className="animate-spin h-8 w-8 text-primary" /></div>
                        ) : filteredTypes.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground"><RiInboxArchiveLine className="mx-auto h-12 w-12 opacity-40 dark:opacity-20 mb-3" /><p>ไม่พบข้อมูลประเภทบริการ</p></div>
                        ) : (
                            <>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 dark:bg-muted/20 border-border hover:bg-transparent">
                                        <TableHead className="w-[50px] font-semibold text-center pl-6 text-muted-foreground">ID</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground">ชื่อประเภท</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground">รายละเอียด</TableHead>
                                        <TableHead className="font-semibold text-center text-muted-foreground">แผนกรับผิดชอบ</TableHead>
                                        <TableHead className="text-right font-semibold pr-6 w-32 text-muted-foreground">จัดการ</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedTypes.map((type) => (
                                        <TableRow key={type.id} className="hover:bg-muted/40 dark:hover:bg-muted/10 transition-colors border-border">
                                            <TableCell className="text-center text-muted-foreground pl-6 font-mono text-xs">{type.id}</TableCell>
                                            <TableCell className="font-medium text-foreground">{type.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{type.description || "-"}</TableCell>
                                            <TableCell className="text-center">
                                                {/* ปรับสี Badge โหมดมืดให้คมชัด */}
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100/50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                                    {getDeptName(type.responsible_dept_id)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2 pr-6">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30" onClick={() => handleEdit(type)}><RiEditLine className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100/50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30" onClick={() => handleDelete(type.id, type.name)}><RiDeleteBin7Line className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card">
                                    <p className="text-sm text-muted-foreground">
                                        แสดง {((currentPage - 1) * pageSize) + 1} ถึง {Math.min(currentPage * pageSize, filteredTypes.length)} จาก {filteredTypes.length} รายการ
                                    </p>
                                    <div className="flex items-center space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="bg-background text-foreground hover:bg-muted">
                                            <RiArrowLeftSLine className="h-4 w-4 mr-1" /> ก่อนหน้า
                                        </Button>
                                        <div className="flex items-center px-2 text-sm font-medium text-foreground">
                                            หน้า {currentPage} จาก {totalPages}
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="bg-background text-foreground hover:bg-muted">
                                            ถัดไป <RiArrowRightSLine className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md bg-card border-border">
                    <DialogHeader><DialogTitle className="text-xl text-foreground">{editingId ? "แก้ไขประเภท" : "เพิ่มประเภท"}</DialogTitle></DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">
                        <div className="space-y-2"><Label className="text-foreground">ชื่อประเภท <span className="text-destructive">*</span></Label><Input {...form.register("name")} className="bg-background border-border text-foreground focus-visible:ring-primary" /></div>
                        <div className="space-y-2"><Label className="text-foreground">คำอธิบาย</Label><Textarea {...form.register("description")} className="bg-background border-border text-foreground focus-visible:ring-primary resize-none" rows={3} /></div>

                        <div className="space-y-2">
                            <Label className="text-foreground">แผนกที่รับผิดชอบตะกร้างาน <span className="text-destructive">*</span></Label>
                            <Select onValueChange={(val) => form.setValue("responsible_dept_id", val)} value={form.watch("responsible_dept_id")}>
                                <SelectTrigger className="bg-background border-border text-foreground focus:ring-primary">
                                    <SelectValue placeholder="เลือกแผนกที่รับผิดชอบ" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground">
                                    {departments.map(dept => (
                                        <SelectItem key={dept.id} value={dept.id.toString()} className="hover:bg-muted focus:bg-muted cursor-pointer">{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.responsible_dept_id && (
                                <p className="text-xs text-destructive">{form.formState.errors.responsible_dept_id.message}</p>
                            )}
                        </div>

                        <DialogFooter className="pt-4 border-t border-border mt-6">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-background hover:bg-muted text-foreground">ยกเลิก</Button>
                            <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground">{isSaving ? <RiLoader4Line className="animate-spin h-4 w-4 mr-2" /> : "บันทึก"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
