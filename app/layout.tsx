import type { Metadata } from "next";
import "./globals.css";
import "./admin-logo.css";
import "./dashboard-admin-link.css";
import "./real-data.css";

export const metadata: Metadata = {
  title: "Neptune — Vessel Command CRM & Analytics",
  description: "A premium vessel command, delegation, maintenance, safety, compliance, CRM, and analytics platform."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
