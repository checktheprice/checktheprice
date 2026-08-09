/**
 * Matcher regression tests. Run with:
 *   node --import tsx scripts/test-match.ts
 * Exits non-zero on any failure.
 */
import { buildSignature, isSameProduct } from "../src/lib/compare/match";

let pass = 0;
let fail = 0;
function expectMatch(name: string, refTitle: string, candTitle: string, want: boolean) {
  const got = isSameProduct(buildSignature(refTitle), candTitle);
  if (got === want) {
    pass++;
    console.log("PASS", name);
  } else {
    fail++;
    console.log("FAIL", name, `-> got ${got}, want ${want}`);
  }
}

// Real Amazon/Flipkart titles for the same ZEBRONICS Juke Bar 9900 soundbar.
const JUKE_AMAZON =
  "ZEBRONICS Juke BAR 9900 Soundbar, 725 Watts, DTS X, Dolby Atmos, with Wired Subwoofer & Satellites, 5.2.4 Channel, USB, RGB LED, Wireless UHF Mic, Deep Bass";
const JUKE_FLIPKART =
  "ZEBRONICS Juke Bar 9900 (SBSPK C3) DTS X, Dolby Atmos, 2x Wireless Subwoofer & Satellites 725 W Bluetooth Soundbar";
const JUKE_5100 = "ZEBRONICS Juke BAR 5100 Soundbar, 525 Watts, Dolby Atmos, 5.1 Channel";

// Real Amazon title with a compatibility tail; real Flipkart wall-charger title.
const ADAPTOR_AMAZON =
  "Samsung Original 25W USB Type-C Travel Adaptor Without Cable for Google Pixel, Xiaomi, Motorola, iPhone, Samsung Galaxy Tab S/A Series, Galaxy S10/M54/M55/A80/A";
const WALL_CHARGER_FLIPKART = "Samsung 25 W Adaptive Fast Charging 3 A Wall Charger for Mobile";

// --- Required regressions -------------------------------------------------

expectMatch(
  "Juke Bar 9900: Amazon ref vs Flipkart title -> MATCH",
  JUKE_AMAZON,
  JUKE_FLIPKART,
  true,
);
expectMatch(
  "Juke Bar 9900: Flipkart ref vs Amazon title -> MATCH",
  JUKE_FLIPKART,
  JUKE_AMAZON,
  true,
);
expectMatch("Juke Bar 9900 vs Juke Bar 5100 -> NO MATCH", JUKE_AMAZON, JUKE_5100, false);
expectMatch(
  "725 Watts vs 725 W treated as same variant",
  "Boat Soundbar 725 Watts",
  "Boat Soundbar 725 W",
  true,
);
expectMatch(
  "725 Watt vs 725W treated as same variant",
  "Boat Soundbar 725 Watt",
  "Boat Soundbar 725W",
  true,
);
expectMatch(
  "Travel Adaptor vs Wall Charger wording -> NO MATCH (Rule 6 kept at 55%)",
  ADAPTOR_AMAZON,
  WALL_CHARGER_FLIPKART,
  false,
);
expectMatch(
  "compat-list phone models are not mandatory tokens (identical wording matches)",
  ADAPTOR_AMAZON,
  "Samsung Original 25W USB Type C Travel Adaptor Without Cable",
  true,
);
{
  const sig = buildSignature(ADAPTOR_AMAZON);
  const leaked = ["s10", "m54", "m55", "a80"].filter((m) => sig.models.includes(m));
  if (leaked.length === 0) {
    pass++;
    console.log("PASS compat-list models excluded from reference signature");
  } else {
    fail++;
    console.log("FAIL compat-list models leaked into signature:", leaked);
  }
}
{
  const sig = buildSignature(JUKE_FLIPKART);
  const ok =
    sig.models.includes("9900") && !sig.models.includes("2x") && !sig.models.includes("c3");
  if (ok) {
    pass++;
    console.log("PASS genuine model 9900 kept; feature token 2x / parenthetical c3 not mandatory");
  } else {
    fail++;
    console.log("FAIL Juke Bar signature models:", sig.models);
  }
}

// --- Pre-existing strictness must be preserved -----------------------------

const S24 = "Samsung Galaxy S24 5G (Marble Gray, 8GB, 256GB Storage)";
expectMatch("S24: genuine listing -> MATCH", S24, "Samsung Galaxy S24 5G 256GB 8GB RAM Gray", true);
expectMatch("S24 vs S23 -> NO MATCH", S24, "Samsung Galaxy S23 5G 8GB 256GB", false);
expectMatch("S24 vs 128GB variant -> NO MATCH", S24, "Samsung Galaxy S24 5G 8GB 128GB", false);
expectMatch("S24 vs back cover -> NO MATCH", S24, "Back Cover for Samsung Galaxy S24 5G", false);
expectMatch(
  "S24 vs tempered glass -> NO MATCH",
  S24,
  "Tempered Glass compatible with Galaxy S24",
  false,
);
expectMatch("wrong brand -> NO MATCH", S24, "OnePlus Galaxy-style S24 5G 8GB 256GB Gray", false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
