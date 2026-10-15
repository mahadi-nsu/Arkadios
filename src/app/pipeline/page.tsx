import { Suspense } from "react";
import { Pipeline } from "@/features/pipeline";
export const metadata = { title: "Lifecycle Pipeline" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Pipeline />
    </Suspense>
  );
}
