import { Suspense } from "react";
import { Settings } from "@/features/settings";
export const metadata = { title: "Settings" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Settings />
    </Suspense>
  );
}
