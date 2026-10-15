import { Suspense } from "react";
import { Documents } from "@/features/documents";
export const metadata = { title: "Documents" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Documents />
    </Suspense>
  );
}
