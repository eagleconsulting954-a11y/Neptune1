import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="Neptune home"><span className="brand-mark" aria-hidden="true">✦</span><span>NEPTUNE<small>Vessel Command CRM</small></span></Link>
        <nav className="nav" aria-label="Primary navigation">
          <Link href="/#platform">Platform</Link>
          <Link href="/#modules">Modules</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/admin">Admin</Link>
          <Link href="/login">Login</Link>
          <Link className="btn gold" href="/signup">Start trial</Link>
        </nav>
      </div>
    </header>
  );
}
