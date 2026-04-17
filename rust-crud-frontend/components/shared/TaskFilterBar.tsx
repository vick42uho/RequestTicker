"use client";

import * as React from "react";
import {
  RiSearchLine,
  RiFilter3Line,
  RiCalendarLine,
  RiCloseCircleLine,
  RiRefreshLine,
} from "@remixicon/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { fetchApi } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";

export interface FilterValues {
  search: string;
  status_ids: string[];
  type_ids: string[];
  requester_name: string;
  start_date: string;
  end_date: string;
}

interface TaskFilterBarProps {
  onFilterChange: (filters: FilterValues) => void;
  initialFilters?: Partial<FilterValues>;
  placeholder?: string;
}

export function TaskFilterBar({
  onFilterChange,
  initialFilters,
  placeholder = "ค้นหาจากรหัสใบงาน หรือรายละเอียด...",
}: TaskFilterBarProps) {
  const [search, setSearch] = React.useState(initialFilters?.search || "");
  const [statusIds, setStatusIds] = React.useState<string[]>(initialFilters?.status_ids || []);
  const [typeIds, setTypeIds] = React.useState<string[]>(initialFilters?.type_ids || []);
  const [requesterName, setRequesterName] = React.useState(initialFilters?.requester_name || "");
  const [startDate, setStartDate] = React.useState(initialFilters?.start_date || "");
  const [endDate, setEndDate] = React.useState(initialFilters?.end_date || "");
  
  const [statuses, setStatuses] = React.useState<any[]>([]);
  const [requestTypes, setRequestTypes] = React.useState<any[]>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);
  
  // 🛡️ ป้องกันการทำงานซ้ำซ้อนตอน Mount
  const isFirstRender = React.useRef(true);
  const debouncedSearchTimer = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    loadStatuses();
    loadRequestTypes();
  }, []);

  const loadStatuses = async () => {
    try {
      const data = await fetchApi<any[]>("/manage/master/statuses");
      setStatuses(data || []);
    } catch (error) {
      console.error("Failed to load statuses");
    }
  };

  const loadRequestTypes = async () => {
    try {
      const data = await fetchApi<any[]>("/requests/master/types");
      setRequestTypes(data || []);
    } catch (error) {
      console.error("Failed to load request types");
    }
  };

  // 🌟 ฟังก์ชันส่งค่ากลับที่รวม Logic ทั้งหมด
  const notifyChange = React.useCallback((
    currentSearch: string, 
    currentStatusIds: string[], 
    currentTypeIds: string[],
    currentRequester: string,
    currentStart: string, 
    currentEnd: string
  ) => {
    onFilterChange({
      search: currentSearch,
      status_ids: currentStatusIds,
      type_ids: currentTypeIds,
      requester_name: currentRequester,
      start_date: currentStart,
      end_date: currentEnd,
    });
  }, [onFilterChange]);

  // 🔍 จัดการ Search (Debounced)
  React.useEffect(() => {
    if (isFirstRender.current) return;

    if (debouncedSearchTimer.current) clearTimeout(debouncedSearchTimer.current);
    
    debouncedSearchTimer.current = setTimeout(() => {
      notifyChange(search, statusIds, typeIds, requesterName, startDate, endDate);
    }, 500);

    return () => {
      if (debouncedSearchTimer.current) clearTimeout(debouncedSearchTimer.current);
    };
  }, [search, requesterName, notifyChange]);

  // ⚙️ จัดการ Filter อื่นๆ (Immediate)
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // ถ้าไม่ใช่การพิมพ์ค้นหา (ซึ่งมี debounce จัดการอยู่แล้ว) ให้ส่งค่าทันที
    notifyChange(search, statusIds, typeIds, requesterName, startDate, endDate);
  }, [statusIds, typeIds, startDate, endDate, notifyChange]);

  const clearFilters = () => {
    setSearch("");
    setStatusIds([]);
    setTypeIds([]);
    setRequesterName("");
    setStartDate("");
    setEndDate("");
  };

  const toggleStatus = (id: string) => {
    setStatusIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleType = (id: string) => {
    setTypeIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const activeFiltersCount = [
    statusIds.length > 0,
    typeIds.length > 0,
    requesterName !== "",
    startDate !== "",
    endDate !== "",
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 w-full bg-background/50 p-1 rounded-xl font-sans">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            className="pl-9 bg-background border-muted-foreground/20 focus-visible:ring-primary h-10 rounded-lg text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <RiCloseCircleLine className="h-4 w-4" />
            </button>
          )}
        </div>

        <Popover open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="h-10 gap-2 border-muted-foreground/20 rounded-lg relative text-sm"
            >
              <RiFilter3Line className="h-4 w-4" />
              <span className="hidden sm:inline">ตัวกรอง</span>
              {activeFiltersCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-primary text-primary-foreground text-[10px] rounded-full">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">ตัวกรองขั้นสูง</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-muted-foreground hover:text-primary"
                  onClick={clearFilters}
                >
                  <RiRefreshLine className="h-3 w-3 mr-1" />
                  ล้างค่า
                </Button>
              </div>

              {/* สถานะ (Multiple) */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                  สถานะใบงาน <span>{statusIds.length > 0 ? `(${statusIds.length})` : ""}</span>
                </label>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 max-h-32 overflow-y-auto p-1 border rounded-md">
                  {statuses.map((s) => (
                    <div key={s.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`status-${s.id}`} 
                        checked={statusIds.includes(s.id.toString())}
                        onCheckedChange={() => toggleStatus(s.id.toString())}
                      />
                      <label htmlFor={`status-${s.id}`} className="text-xs cursor-pointer truncate">{s.name_th}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* ประเภทงาน (Multiple) */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                  ประเภทงาน <span>{typeIds.length > 0 ? `(${typeIds.length})` : ""}</span>
                </label>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 max-h-32 overflow-y-auto p-1 border rounded-md">
                  {requestTypes.map((t) => (
                    <div key={t.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`type-${t.id}`} 
                        checked={typeIds.includes(t.id.toString())}
                        onCheckedChange={() => toggleType(t.id.toString())}
                      />
                      <label htmlFor={`type-${t.id}`} className="text-xs cursor-pointer truncate">{t.name}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">ชื่อผู้แจ้ง</label>
                <div className="relative">
                  <Input 
                    placeholder="ค้นหาชื่อ..." 
                    className="h-9 text-xs pl-8" 
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                  />
                  <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">จากวันที่</label>
                  <div className="relative">
                    <Input 
                      type="date" 
                      className="h-9 text-xs pl-8" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <RiCalendarLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">ถึงวันที่</label>
                  <div className="relative">
                    <Input 
                      type="date" 
                      className="h-9 text-xs pl-8" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                    <RiCalendarLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
