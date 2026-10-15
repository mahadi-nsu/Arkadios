import { Suspense } from "react";
import { Projects } from "@/features/projects";
export const metadata = { title: "Projects" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Projects />
    </Suspense>
  );
}
