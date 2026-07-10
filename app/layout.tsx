import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neptune — Vessel Command CRM",
  description: "A premium vessel command, delegation, maintenance, safety, compliance, and fleet CRM platform."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
