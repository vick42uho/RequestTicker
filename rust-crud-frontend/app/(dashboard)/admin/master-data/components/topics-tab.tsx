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
  RiNodeTree,
  RiInboxArchiveLine,
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
  CardDescription,
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

const topicSchema = z.object({
  type_id: z.string().min(1, "กรุณาเลือกประเภทบริการ"),
  name: z.string().min(1, "กรุณากรอกชื่อหมวดหมู่"),
});
type TopicFormValues = z.infer<typeof topicSchema>;

export default function TopicsTab() {
  const [types, setTypes] = useState<any[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [topics, setTopics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<TopicFormValues>({ resolver: zodResolver(topicSchema) });

  useEffect(() => {
    fetchApi<any[]>("/requests/master/types")
      .then(setTypes)
      .catch(() => toast.error("โหลดข้อมูลประเภทไม่สำเร็จ"));
  }, []);

  const loadTopics = async (typeId: string) => {
    if (!typeId) {
      setTopics([]);
      return;
    }
    setIsLoading(true);
    try {
      setTopics(await fetchApi<any[]>(`/requests/master/topics/${typeId}`));
    } catch (error) {
      toast.error("โหลดข้อมูลหมวดหมู่ไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTopics(selectedTypeId);
  }, [selectedTypeId]);

  const handleAddNew = () => {
    setEditingId(null);
    form.reset({ type_id: selectedTypeId, name: "" });
    setIsDialogOpen(true);
  };
  const handleEdit = (item: any) => {
    setEditingId(item.id);
    form.reset({ type_id: selectedTypeId, name: item.name });
    setIsDialogOpen(true);
  };

  const handleExport = () => {
    if (!selectedTypeId) {
      toast.error("กรุณาเลือกประเภทบริการก่อน Export");
      return;
    }
    const typeName =
      types.find((t) => t.id.toString() === selectedTypeId)?.name || "";
    const exportData = topics.map((t) => ({
      ID: t.id,
      ประเภทบริการ: typeName,
      ชื่อหมวดหมู่: t.name,
      ลบ: "N",
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Topics");
    XLSX.writeFile(workbook, `master_topics_${typeName}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTypeId) {
      toast.error("กรุณาเลือกประเภทบริการก่อน Import");
      return;
    }
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
          type_id: parseInt(selectedTypeId),
          name: row["ชื่อหมวดหมู่"],
          del_flag: row["ลบ"] === "Y",
        }));
        await fetchApi("/manage/master/topics/import", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("นำเข้าข้อมูลสำเร็จ");
        loadTopics(selectedTypeId);
      } catch (error) {
        toast.error("นำเข้าข้อมูลไม่สำเร็จ");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const onSubmit = async (data: TopicFormValues) => {
    setIsSaving(true);
    try {
      const payload = { type_id: parseInt(data.type_id), name: data.name };
      if (editingId) {
        await fetchApi(`/manage/master/topics/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await fetchApi(`/manage/master/topics`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      toast.success("บันทึกสำเร็จ");
      setIsDialogOpen(false);
      loadTopics(selectedTypeId);
    } catch (error: any) {
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`ลบหมวดหมู่ "${name}" ?`)) return;
    try {
      await fetchApi(`/manage/master/topics/${id}`, { method: "DELETE" });
      toast.success("ลบสำเร็จ");
      loadTopics(selectedTypeId);
    } catch (error: any) {
      toast.error("ลบไม่สำเร็จ");
    }
  };

  return (
    <>
      <Card className="shadow-sm border-border rounded-xl overflow-hidden bg-card">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-foreground">
              หมวดหมู่ (Topics)
            </CardTitle>
          </div>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 bg-background p-1.5 border border-border rounded-lg shadow-sm">
              <select
                className="bg-transparent h-9 pl-3 pr-8 text-sm outline-none w-full sm:w-64 text-foreground"
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
              >
                <option value="">🔍 เลือกประเภทบริการ...</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="hidden sm:block w-px h-6 bg-border"></div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedTypeId}
              >
                <RiUploadLine className="h-4 w-4 mr-1.5" /> Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!selectedTypeId}
              >
                <RiDownloadLine className="h-4 w-4 mr-1.5" /> Export
              </Button>

              <Button
                onClick={handleAddNew}
                size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={!selectedTypeId}
              >
                {" "}
                <RiAddLine className="h-4 w-4"/>
                เพิ่มหมวดหมู่
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedTypeId ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
              <RiNodeTree className="h-12 w-12 mb-3 opacity-50" />
              <p>กรุณาเลือกประเภทบริการก่อน</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="w-24 pl-6">รหัส</TableHead>
                  <TableHead>ชื่อหมวดหมู่</TableHead>
                  <TableHead className="text-right pr-6 w-32">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={3} className="h-32 text-center">
                      <RiLoader4Line className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : topics.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell
                      colSpan={3}
                      className="h-48 text-center text-muted-foreground"
                    >
                      <RiInboxArchiveLine className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>ไม่มีข้อมูล</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  topics.map((topic) => (
                    <TableRow
                      key={topic.id}
                      className="border-border hover:bg-muted/40"
                    >
                      <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                        {topic.id}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {topic.name}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-blue-600 dark:text-blue-400"
                          onClick={() => handleEdit(topic)}
                        >
                          <RiEditLine className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 dark:text-red-400"
                          onClick={() => handleDelete(topic.id, topic.name)}
                        >
                          <RiDeleteBin7Line className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-foreground">
              {editingId ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5 py-2"
          >
            <div className="space-y-2">
              <Label>ประเภทบริการ</Label>
              <div className="p-2.5 bg-muted rounded-md text-sm">
                {types.find((t) => t.id.toString() === selectedTypeId)?.name}
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                ชื่อหมวดหมู่ <span className="text-destructive">*</span>
              </Label>
              <Input {...form.register("name")} className="bg-background" />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSaving}>
                บันทึก
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
