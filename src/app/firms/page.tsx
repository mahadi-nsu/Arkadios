import { Suspense } from "react";
import { Firms } from "@/features/firms";
export const metadata = { title: "Firm Partners" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Firms />
    </Suspense>
  );
}
