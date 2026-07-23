import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GlobalErrorReporter } from "@/components/GlobalErrorReporter";
import { OfflineStatus } from "@/components/OfflineStatus";
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
import "./offline.css";

export const metadata: Metadata = {
  title: "Neptune — Vessel Command CRM & Maritime Intelligence",
  description: "Neptune helps captains and fleet operators protect the vessel, crew, and schedule with accountable workflows, decision alerts, package-specific access, maritime intelligence, future EV vessel development programs, and offline ocean operations.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/neptune-app-icon.svg",
    apple: "/neptune-app-icon.svg"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Neptune"
  }
};

export const viewport: Viewport = {
  themeColor: "#071c29",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script src="/offline-runtime.js" strategy="beforeInteractive" />
        <GlobalErrorReporter />
        <OfflineStatus />
        {children}
      </body>
    </html>
  );
}
