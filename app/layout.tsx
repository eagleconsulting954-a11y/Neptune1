import type { Metadata } from "next";
import { GlobalErrorReporter } from "@/components/GlobalErrorReporter";
import "./globals.css";
import "./admin-logo.css";
import "./dashboard-admin-link.css";
import "./real-data.css";
import "./demo.css";
import "./maritime-intelligence.css";
import "./trial-access.css";
import "./platform-admin.css";

export const metadata: Metadata = {
  title: "Neptune — Vessel Command CRM & Maritime Intelligence",
  description: "A premium vessel command, maritime weather, ocean forecast, port intelligence, bunkering, MRCC, CRM, analytics, enforced 14-day trial, and platform monitoring system."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlobalErrorReporter />
        {children}
      </body>
    </html>
  );
}
