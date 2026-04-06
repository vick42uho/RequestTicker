import { Suspense } from "react";
import TasksClient from "./tasks-client";
import { RiLoader4Line } from "@remixicon/react";

export const dynamic = "force-dynamic";

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><RiLoader4Line className="h-8 w-8 animate-spin text-primary" /></div>}>
      <TasksClient />
    </Suspense>
  );
}
