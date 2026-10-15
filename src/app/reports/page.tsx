import { Suspense } from "react";
import { Reports } from "@/features/reports";
export const metadata = { title: "Reports" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Reports />
    </Suspense>
  );
}
