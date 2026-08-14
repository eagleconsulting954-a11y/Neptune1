import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { StatusClient } from "@/components/StatusClient";

export default function StatusPage() {
  return <div className="psych-landing"><SiteHeader /><main className="section"><div className="container" style={{ maxWidth: 1000 }}><div className="psych-section-intro"><div><p className="eyebrow">Service status</p><h1>Neptune platform health</h1></div><p>Current application and database health, checked directly from the deployed platform.</p></div><StatusClient /><div style={{ marginTop: 18 }}><Link className="btn" href="/trust">Security & trust overview</Link></div></div></main></div>;
}
