import { Suspense } from "react";
import RequestsClient from "./requests-client";
import { RiLoader4Line } from "@remixicon/react";

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><RiLoader4Line className="h-8 w-8 animate-spin text-primary" /></div>}>
      <RequestsClient />
    </Suspense>
  );
}
