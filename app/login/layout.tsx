import Link from "next/link";
import type { ReactNode } from "react";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}<div style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 90 }}><Link className="btn" href="/sso">Enterprise SSO</Link></div></>;
}
