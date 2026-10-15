import { Suspense } from "react";
import { Contacts } from "@/features/contacts";
export const metadata = { title: "Contacts" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading workspace view…</div>}
    >
      <Contacts />
    </Suspense>
  );
}
