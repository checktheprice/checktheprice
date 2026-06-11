import { Link } from "@tanstack/react-router";

const links = [
  { label: "About Us", to: "/about" as const },
  { label: "Contact Us", to: "/contact" as const },
  { label: "Disclaimer", to: "/disclaimer" as const },
  { label: "Affiliate Disclosure", to: "/affiliate-disclosure" as const },
  { label: "Privacy Policy", to: "/privacy" as const },
  { label: "Terms & Conditions", to: "/terms" as const },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-10 border-t bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            {links.map((l) => (
              <li key={l.label}>
                <Link
                  to={l.to}
                  className="text-foreground/80 hover:text-foreground hover:underline"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          <strong>Affiliate Disclosure:</strong> CheckThePrice participates in
          affiliate programs including Amazon Associates. We may earn a
          commission from qualifying purchases made through links on this site
          at no extra cost to you.
        </p>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          © {year} CheckThePrice. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}