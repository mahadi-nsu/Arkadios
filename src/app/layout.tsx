import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell";
export const metadata: Metadata = {
  title: {
    default: "Command Center · Arkadios Home Office",
    template: "%s · Arkadios Home Office",
  },
  description:
    "One connected workspace for every partnership. Coordinate firms, people, workflows, and the next clear step.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
