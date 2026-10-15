import { Suspense } from "react";
import { Tasks } from "@/features/tasks";
export const metadata = { title: "Tasks" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Tasks />
    </Suspense>
  );
}
