import type { Metadata } from "next";
import "./globals.css";
import "./admin-logo.css";
import "./dashboard-admin-link.css";
import "./real-data.css";
import "./demo.css";
import "./maritime-intelligence.css";

export const metadata: Metadata = {
  title: "Neptune — Vessel Command CRM & Maritime Intelligence",
  description: "A premium vessel command, maritime weather, ocean forecast, port intelligence, bunkering, MRCC, CRM, and analytics platform."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
