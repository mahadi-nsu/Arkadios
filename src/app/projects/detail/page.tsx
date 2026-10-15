import { Suspense } from "react";
import { ProjectDetail } from "@/features/projects";
export const metadata = { title: "Project Overview" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <ProjectDetail />
    </Suspense>
  );
}
