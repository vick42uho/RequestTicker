"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Assignee {
  id: number;
  name: string;
  avatar_url: string | null;
}

interface AvatarGroupProps {
  assignees: Assignee[];
  maxAvatars?: number;
}

export function AvatarGroup({ assignees, maxAvatars = 3 }: AvatarGroupProps) {
  if (!assignees || assignees.length === 0) {
    return <span className="text-xs text-muted-foreground italic">ยังไม่ได้รับมอบหมาย</span>;
  }

  const visibleAssignees = assignees.slice(0, maxAvatars);
  const hiddenCount = assignees.length - maxAvatars;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center -space-x-2">
        {visibleAssignees.map((assignee) => (
          <Tooltip key={assignee.id}>
            <TooltipTrigger asChild>
              <Avatar className="h-7 w-7 border-2 border-background cursor-pointer">
                <AvatarImage src={assignee.avatar_url || undefined} alt={assignee.name} />
                <AvatarFallback className="text-[10px]">
                  {assignee.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm font-medium">{assignee.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {hiddenCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-7 w-7 border-2 border-background cursor-pointer">
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                  +{hiddenCount}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm font-medium">และอีก {hiddenCount} คน</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
