"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

import { fetchApi } from "@/lib/api"

export const description = "An interactive area chart"

const chartConfig = {
  total: {
    label: "Total Tasks",
  },
  requests: {
    label: "ใบงานใหม่",
    color: "var(--primary)",
  },
  completed: {
    label: "ปิดงานแล้ว",
    color: "oklch(0.627 0.194 149.214)", // Emerald color
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")
  const [data, setData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  React.useEffect(() => {
    async function loadChartData() {
      try {
        setLoading(true)
        let days = 90
        if (timeRange === "30d") days = 30
        else if (timeRange === "7d") days = 7

        const response = await fetchApi<any[]>(`/requests/stats/daily?days=${days}`)
        setData(response)
      } catch (error) {
        console.error("Failed to fetch chart data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>สถิติใบงานย้อนหลัง</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            เปรียบเทียบจำนวนใบงานใหม่และใบงานที่ปิดสำเร็จ
          </span>
          <span className="@[540px]/card:hidden">สถิติย้อนหลัง {timeRange === "90d" ? "3 เดือน" : timeRange === "30d" ? "30 วัน" : "7 วัน"}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(value) => value && setTimeRange(value)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">3 เดือนล่าสุด</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 วันล่าสุด</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 วันล่าสุด</ToggleGroupItem>
          </ToggleGroup>
          {/* ... Select remain similar but with updated labels ... */}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="เลือกช่วงเวลา" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                3 เดือนล่าสุด
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                30 วันล่าสุด
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                7 วันล่าสุด
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</span>
            </div>
          ) : (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-requests)"
                    stopOpacity={1.0}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-requests)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-completed)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-completed)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("th-TH", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="completed"
                type="natural"
                fill="url(#fillCompleted)"
                stroke="var(--color-completed)"
                stackId="a"
              />
              <Area
                dataKey="requests"
                type="natural"
                fill="url(#fillRequests)"
                stroke="var(--color-requests)"
                stackId="a"
              />
            </AreaChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
