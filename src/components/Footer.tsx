import Image from "next/image";
import Link from "next/link";
import "./Footer.css";

const FOOTER_LINKS = [
  { label: "Explore", href: "/#projects" },
  { label: "Properties", href: "/properties" },
  { label: "FAQ", href: "/#faq" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#contact" },
] as const;

export default function Footer() {
  return (
    <footer data-section="footer" className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <Image
            className="footer__logo"
            src="/ila-homes-logo.png"
            alt="ILA Homes"
            width={220}
            height={48}
            priority={false}
          />
          <p className="footer__tagline">
            Verified properties across Telangana.
          </p>
        </div>

        <nav className="footer__links" aria-label="Footer">
          {FOOTER_LINKS.map((link) =>
            link.href.startsWith("/#") || link.href.startsWith("#") ? (
              <a key={`${link.label}-${link.href}`} href={link.href}>
                {link.label}
              </a>
            ) : (
              <Link key={`${link.label}-${link.href}`} href={link.href}>
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
