import { Suspense } from "react";
import { Workload } from "@/features/workload";
export const metadata = { title: "Team Workload" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Workload />
    </Suspense>
  );
}
