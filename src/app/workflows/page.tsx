import { Suspense } from "react";
import { Workflows } from "@/features/workflows";
export const metadata = { title: "Workflows & SOPs" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Workflows />
    </Suspense>
  );
}
