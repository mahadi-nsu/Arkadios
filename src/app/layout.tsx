import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell";
import { ThemeProvider } from "@/components/theme-provider";
import { themeBootstrap } from "@/lib/theme";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="arkadios-theme-init"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
