"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";

import {
  RiUserAddLine,
  RiEditLine,
  RiLoader4Line,
  RiDownloadLine,
  RiUploadLine,
  RiSearchLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiIdCardLine,
  RiFilter3Line,
  RiRefreshLine,
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

// 🌟 Schema สำหรับ Validation
const userSchema = z
  .object({
    employee_code: z.string().optional().or(z.literal("")),
    name: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล"),
    username: z.string().optional().or(z.literal("")),
    email: z
      .string()
      .email("รูปแบบอีเมลไม่ถูกต้อง")
      .optional()
      .or(z.literal("")),
    role: z.string().min(1, "กรุณาเลือกสิทธิ์"),
    department_id: z.string().optional(),
    position: z.string().optional(),
    password: z.string().optional(),
    phone_number: z.string().optional(),
    is_active: z.boolean(),
  })
  .refine(
    (data) => {
      const hasUser = data.username && data.username.trim() !== "";
      const hasEmail = data.email && data.email.trim() !== "";
      return hasUser || hasEmail;
    },
    {
      message: "ต้องกรอก Username หรือ Email อย่างน้อย 1 อย่างเพื่อใช้เข้าระบบ",
      path: ["username"],
    },
  );

type UserFormValues = z.infer<typeof userSchema>;

export default function UsersAdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 State สำหรับการค้นหาและแบ่งหน้า
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // 🌟 State สำหรับ Filters ใหม่
  const [filterDept, setFilterDept] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🌟 Debounce ค้นหา
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); 
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // สร้าง Query String สำหรับ Filters
      let query = `/manage/master/users?page=${page}&limit=${limit}&search=${debouncedSearch}`;
      if (filterDept) query += `&department_id=${filterDept}`;
      if (filterRole) query += `&role=${filterRole}`;

      const [usersRes, deptsRes] = await Promise.all([
        fetchApi<any>(query),
        fetchApi<any[]>("/manage/master/departments"),
      ]);
      
      setUsers(usersRes.data || []);
      setTotalPages(usersRes.total_pages || 1);
      setTotalRecords(usersRes.total_records || 0);
      setDepartments(deptsRes || []);
    } catch (error) {
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, debouncedSearch, filterDept, filterRole]);

  // ฟังก์ชันล้างตัวกรอง
  const clearFilters = () => {
    setSearch("");
    setFilterDept("");
    setFilterRole("");
    setPage(1);
  };

  const handleExport = async () => {
    try {
      toast.loading("กำลังเตรียมข้อมูลทั้งหมด...");
      const res = await fetchApi<any>("/manage/master/users?limit=10000");
      const allData = res.data || [];

      const exportData = allData.map((u: any) => ({
        "รหัสพนักงาน": u.employee_code || "",
        "ชื่อ-นามสกุล": u.name,
        Username: u.username || "",
        อีเมล: u.email,
        เบอร์โทรศัพท์: u.phone_number || "",
        ตำแหน่ง: u.position || "",
        แผนก: u.department_name || "",
        สิทธิ์ผู้ใช้งาน: u.role,
        สถานะ: u.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
      XLSX.writeFile(workbook, `users_list_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss();
      toast.success("Export ข้อมูลสำเร็จ");
    } catch (error) {
      toast.dismiss();
      toast.error("Export ข้อมูลไม่สำเร็จ");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const payload = data.map((row: any) => {
          const deptName = row["แผนก"];
          const dept = departments.find((d) => d.name === deptName);

          return {
            employee_code: row["รหัสพนักงาน"] ? String(row["รหัสพนักงาน"]) : null,
            name: row["ชื่อ-นามสกุล"] ? String(row["ชื่อ-นามสกุล"]) : "",
            username: row["Username"] ? String(row["Username"]) : null,
            email: row["อีเมล"] ? String(row["อีเมล"]) : "",
            password: row["รหัสผ่าน"] ? String(row["รหัสผ่าน"]) : "123456",
            role: row["สิทธิ์ผู้ใช้งาน"] ? String(row["สิทธิ์ผู้ใช้งาน"]) : "user",
            department_id: dept ? dept.id : null,
            position: row["ตำแหน่ง"] ? String(row["ตำแหน่ง"]) : null,
            phone_number: row["เบอร์โทรศัพท์"] ? String(row["เบอร์โทรศัพท์"]) : null,
            is_active: row["สถานะ"] === "ปิดใช้งาน" ? false : true,
          };
        });

        await fetchApi("/manage/master/users/import", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        toast.success(`นำเข้าผู้ใช้งาน ${payload.length} รายการสำเร็จ`);
        loadData();
      } catch (error: any) {
        toast.error("เกิดข้อผิดพลาด: " + (error.message || "รูปแบบไฟล์ไม่ถูกต้อง"));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      employee_code: "",
      name: "",
      username: "",
      email: "",
      role: "user",
      department_id: "",
      position: "",
      password: "",
      phone_number: "",
      is_active: true,
    },
  });

  const handleAddNew = () => {
    setEditingId(null);
    form.reset({
      employee_code: "",
      name: "",
      username: "",
      email: "",
      role: "user",
      department_id: "",
      position: "",
      password: "",
      phone_number: "",
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (user: any) => {
    setEditingId(user.id);
    form.reset({
      employee_code: user.employee_code || "",
      name: user.name,
      username: user.username || "",
      email: user.email || "",
      role: user.role,
      department_id: user.department_id ? user.department_id.toString() : "",
      position: user.position || "",
      password: "",
      phone_number: user.phone_number || "",
      is_active: user.is_active,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: UserFormValues) => {
    try {
      const payload = {
        ...data,
        department_id: data.department_id ? parseInt(data.department_id) : null,
      };

      if (editingId) {
        await fetchApi(`/manage/master/users/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("อัปเดตข้อมูลสำเร็จ");
      } else {
        await fetchApi(`/manage/master/users`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("เพิ่มข้อมูลสำเร็จ");
      }
      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            จัดการผู้ใช้งาน (Users)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            จัดการรายชื่อพนักงานและกำหนดสิทธิ์การใช้งาน ({totalRecords} รายการ)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-9 px-3">
            <RiUploadLine className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" onClick={handleExport} className="h-9 px-3">
            <RiDownloadLine className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={() => handleAddNew()} className="h-9 px-4 shadow-sm">
            <RiUserAddLine className="mr-2 h-4 w-4" /> เพิ่มผู้ใช้งาน
          </Button>
        </div>
      </div>

      {/* 🌟 Filters Section */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm mb-1">
          <RiFilter3Line className="h-4 w-4" /> ตัวกรองข้อมูล (Filters)
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ค้นหาชื่อ, รหัสพนักงาน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 border-slate-200 bg-white"
            />
          </div>

          {/* Department Filter */}
          <select
            value={filterDept}
            onChange={(e) => { setFilterDept(e.target.value); setPage(1); }}
            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          >
            <option value="">ทุกแผนก</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          >
            <option value="">ทุกสิทธิ์การใช้งาน</option>
            <option value="user">User</option>
            <option value="manager">Manager</option>
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>

          {/* Clear Filters Button */}
          <Button 
            variant="ghost" 
            onClick={clearFilters}
            className="h-10 text-slate-500 hover:text-slate-900"
          >
            <RiRefreshLine className="mr-2 h-4 w-4" /> ล้างตัวกรอง
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="text-sm text-slate-500">
          แสดงรายการที่ {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} จากทั้งหมด {totalRecords}
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="pl-6 w-32 text-slate-500 uppercase text-[11px] font-bold">รหัสพนักงาน</TableHead>
                <TableHead className="text-slate-500 uppercase text-[11px] font-bold">พนักงาน</TableHead>
                <TableHead className="text-slate-500 uppercase text-[11px] font-bold">ข้อมูลล็อกอิน</TableHead>
                <TableHead className="text-slate-500 uppercase text-[11px] font-bold">ตำแหน่ง / แผนก</TableHead>
                <TableHead className="text-center text-slate-500 uppercase text-[11px] font-bold">สิทธิ์</TableHead>
                <TableHead className="text-center text-slate-500 uppercase text-[11px] font-bold">สถานะ</TableHead>
                <TableHead className="text-right pr-6 text-slate-500 uppercase text-[11px] font-bold">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <RiLoader4Line className="animate-spin h-8 w-8 mx-auto text-primary opacity-50" />
                    <p className="text-sm text-slate-400 mt-2">กำลังโหลดข้อมูล...</p>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-slate-400 italic">
                    ไม่พบข้อมูลผู้ใช้งานที่ตรงตามเงื่อนไข
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <RiIdCardLine className="h-4 w-4 text-slate-400" />
                        <span className="font-mono text-xs font-semibold text-slate-600">{user.employee_code || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-700">{user.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-primary text-sm italic">
                        {user.username ? `@${user.username}` : "-"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-600">{user.position || "-"}</div>
                      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                        {user.department_name || "ไม่ระบุแผนก"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-medium text-[10px] uppercase">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {user.is_active ? (
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50 shadow-none text-[10px] uppercase font-bold">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-400 border-slate-200 bg-slate-50 shadow-none text-[10px] uppercase font-bold">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(user)}
                        className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5"
                      >
                        <RiEditLine className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="text-sm text-slate-500">
          หน้า <span className="font-semibold text-slate-700">{page}</span> จากทั้งหมด <span className="font-semibold text-slate-700">{totalPages}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
            className="h-8 border-slate-200"
          >
            <RiArrowLeftSLine className="h-4 w-4 mr-1" /> ก่อนหน้า
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : (page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i);
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className={`h-8 w-8 p-0 ${page === pageNum ? "shadow-md" : "border-slate-200"}`}
                  disabled={isLoading}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isLoading}
            className="h-8 border-slate-200"
          >
            ถัดไป <RiArrowRightSLine className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้ใหม่"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>รหัสพนักงาน (Employee ID)</Label>
              <div className="relative">
                <RiIdCardLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input {...form.register("employee_code")} className="pl-10 h-10" placeholder="เช่น EMP001" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ชื่อ - นามสกุล <span className="text-red-500">*</span></Label>
                <Input {...form.register("name")} className="h-10" />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-500">{(form.formState.errors.name as any).message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>ตำแหน่ง (Position)</Label>
                <Input {...form.register("position")} className="h-10" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input {...form.register("username")} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label>อีเมล <span className="text-red-500">*</span></Label>
                <Input type="email" {...form.register("email")} className="h-10" />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-500">{(form.formState.errors.email as any).message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{editingId ? "รีเซ็ตรหัสผ่านใหม่" : "รหัสผ่านเริ่มต้น"}</Label>
                <Input
                  type="password"
                  {...form.register("password")}
                  className="h-10"
                  placeholder={editingId ? "ปล่อยว่างไว้ถ้าไม่ต้องการเปลี่ยน" : "ค่าเริ่มต้นคือ 123456"}
                />
              </div>
              <div className="space-y-2">
                <Label>เบอร์โทร</Label>
                <Input {...form.register("phone_number")} className="h-10" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>แผนกต้นสังกัด</Label>
                <select
                  {...form.register("department_id")}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>สิทธิ์การใช้งานระบบ (Role)</Label>
                <select
                  {...form.register("role")}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="pt-3 mt-2 border-t border-slate-100">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  {...form.register("is_active")}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="is_active" className="cursor-pointer text-slate-600 font-medium">
                  เปิดใช้งานบัญชีนี้ (Active)
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="px-8">บันทึกข้อมูล</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
