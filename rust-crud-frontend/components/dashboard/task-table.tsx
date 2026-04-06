"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { RequestItem } from "@/types/request"
import { StatusBadge } from "@/components/shared/status-badge"
import { format } from "date-fns"
import { th } from "date-fns/locale"

interface TaskTableProps {
  data: RequestItem[]
  loading?: boolean
  onView?: (request: RequestItem) => void
}

export function TaskTable({ data, loading, onView }: TaskTableProps) {
  const columns: ColumnDef<RequestItem>[] = [
    // ... rest of columns remain the same ...
    {
      accessorKey: "req_code",
      header: "รหัสใบงาน",
      cell: ({ row }) => <span className="font-medium">{row.original.req_code}</span>,
    },
    {
      accessorKey: "subject_name",
      header: "หัวข้อ",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.subject_name}</span>
          <span className="text-muted-foreground text-xs">{row.original.type_name}</span>
        </div>
      ),
    },
    {
      accessorKey: "requester_name",
      header: "ผู้แจ้ง",
    },
    {
      accessorKey: "status_name",
      header: "สถานะ",
      cell: ({ row }) => (
        <StatusBadge 
          statusId={row.original.status_id}
          statusName={row.original.status_name}
          statusVariant={row.original.status_variant}
          statusColor={row.original.status_color}
        />
      ),
    },
    {
      accessorKey: "request_date",
      header: "วันที่แจ้ง",
      cell: ({ row }) => {
        const date = new Date(row.original.request_date)
        return format(date, "dd MMM yy HH:mm", { locale: th })
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onView?.(row.original)}
        >
          ดูรายละเอียด
        </Button>
      ),
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (loading) {
    return <div className="p-4 text-center">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                ไม่พบข้อมูลใบงาน
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
