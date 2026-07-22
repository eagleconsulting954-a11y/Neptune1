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
import "./password-reset.css";
import "./decision-dashboard.css";
import "./package-pricing.css";
import "./psychology-landing.css";
import "./duty-workflow.css";
import "./ev-future.css";

export const metadata: Metadata = {
  title: "Neptune — Vessel Command CRM & Maritime Intelligence",
  description: "Neptune helps captains and fleet operators protect the vessel, crew, and schedule with accountable workflows, decision alerts, package-specific access, maritime intelligence, and future EV vessel development programs."
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
