import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, Tag, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDeals, calcDiscount } from "@/lib/deals";
import {
  DISCOUNT_RANGES,
  inDiscountRange,
  type DiscountRangeId,
} from "@/lib/discount-ranges";

const WHATSAPP_URL =
  "https://whatsapp.com/channel/0029VafqnsWLI8YWYB5LNj3u";

const links = [
  { label: "Home", to: "/" as const, hash: undefined },
  { label: "Latest Deals", to: "/" as const, hash: "deals" },
  { label: "About Us", to: "/about" as const, hash: undefined },
  { label: "Contact Us", to: "/contact" as const, hash: undefined },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [mobileDiscountOpen, setMobileDiscountOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["deals"],
    queryFn: fetchDeals,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const deals = data?.deals ?? [];

  const counts = DISCOUNT_RANGES.reduce<Record<DiscountRangeId, number>>(
    (acc, r) => {
      acc[r.id] = deals.filter((d) =>
        inDiscountRange(calcDiscount(d.mrp, d.onlinePrice), r.id),
      ).length;
      return acc;
    },
    {} as Record<DiscountRangeId, number>,
  );

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
          <li>
            <Link
              to="/"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/"
              hash="categories"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              Categories
            </Link>
          </li>
          <li
            className="relative"
            onMouseEnter={() => setDiscountOpen(true)}
            onMouseLeave={() => setDiscountOpen(false)}
          >
            <button
              type="button"
              onClick={() => setDiscountOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              aria-haspopup="menu"
              aria-expanded={discountOpen}
            >
              Discount <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {discountOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-white shadow-lg"
              >
                {DISCOUNT_RANGES.map((r) => (
                  <Link
                    key={r.id}
                    to="/"
                    search={{ discount: r.id }}
                    hash="deals"
                    onClick={() => setDiscountOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-sm text-foreground/90 hover:bg-muted"
                  >
                    <span>{r.label}</span>
                    {data && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground/70">
                        {counts[r.id]}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </li>
          <li>
            <Link
              to="/"
              hash="deals"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              Latest Deals
            </Link>
          </li>
          <li>
            <Link
              to="/about"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              About Us
            </Link>
          </li>
          <li>
            <Link
              to="/contact"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              Contact Us
            </Link>
          </li>
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
            <li>
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-2 text-sm font-medium text-foreground/90 hover:bg-muted"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                to="/"
                hash="categories"
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-2 text-sm font-medium text-foreground/90 hover:bg-muted"
              >
                Categories
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setMobileDiscountOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-foreground/90 hover:bg-muted"
                aria-expanded={mobileDiscountOpen}
              >
                <span>Discount</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    mobileDiscountOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {mobileDiscountOpen && (
                <ul className="ml-3 mt-1 border-l border-border pl-2">
                  {DISCOUNT_RANGES.map((r) => (
                    <li key={r.id}>
                      <Link
                        to="/"
                        search={{ discount: r.id }}
                        hash="deals"
                        onClick={() => {
                          setOpen(false);
                          setMobileDiscountOpen(false);
                        }}
                        className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-foreground/80 hover:bg-muted"
                      >
                        <span>{r.label}</span>
                        {data && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground/70">
                            {counts[r.id]}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
            {links.slice(1).map((l) => (
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