import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, Tag } from "lucide-react";

const WHATSAPP_URL =
  "https://whatsapp.com/channel/0029VafqnsWLI8YWYB5LNj3u";

const links = [
  { label: "Home", to: "/" as const, hash: undefined },
  { label: "Categories", to: "/" as const, hash: "categories" },
  { label: "Latest Deals", to: "/" as const, hash: "deals" },
  { label: "About Us", to: "/about" as const, hash: undefined },
  { label: "Contact Us", to: "/contact" as const, hash: undefined },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-0 z-30 w-full border-b bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Tag className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-bold tracking-tight">
            CheckThePrice
          </span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.label}>
              <Link
                to={l.to}
                hash={l.hash}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#1ebe5d]"
          >
            🔥 Join WhatsApp
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t bg-white md:hidden">
          <ul className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            {links.map((l) => (
              <li key={l.label}>
                <Link
                  to={l.to}
                  hash={l.hash}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2 text-sm font-medium text-foreground/90 hover:bg-muted"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-md bg-[#25D366] px-2 py-2 text-center text-sm font-bold text-white"
              >
                🔥 Join WhatsApp Channel
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}