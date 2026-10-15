import { Suspense } from "react";
import { FirmDetail } from "@/features/firms";
export const metadata = { title: "Firm Overview" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <FirmDetail />
    </Suspense>
  );
}
