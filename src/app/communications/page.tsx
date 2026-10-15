import { Suspense } from "react";
import { Communications } from "@/features/communications";
export const metadata = { title: "Communications" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Communications />
    </Suspense>
  );
}
