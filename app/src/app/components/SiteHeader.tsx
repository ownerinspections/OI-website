import Link from "next/link";
import Image from "next/image";

export default function SiteHeader() {
  return (
    <header className="site-header" role="banner">
      <div className="site-header__inner">
        <div className="site-header__brand">
          <Link href="/" aria-label="Owner Inspections - Home" className="site-header__logoLink">
            <Image src="/ownerlogo.png" alt="Owner Inspections" width={140} height={28} className="site-header__logo" priority />
          </Link>
        </div>

        <nav className="site-header__nav" aria-label="Global Navigation">
          {/* Add items when available, minimal header keeps nav empty */}
        </nav>

        <div className="site-header__actions">
          <Link href="/login" className="btn btn--ghost">
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}


