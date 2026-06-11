import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";

const WHATSAPP_URL =
  "https://whatsapp.com/channel/0029VafqnsWLI8YWYB5LNj3u";
const EMAIL = "support.editexa@gmail.com";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact Us — CheckThePrice" },
      {
        name: "description",
        content:
          "Get in touch with CheckThePrice via email or join our WhatsApp channel for instant deal alerts.",
      },
      { property: "og:title", content: "Contact Us — CheckThePrice" },
      {
        property: "og:description",
        content:
          "Reach CheckThePrice via email or WhatsApp for deal alerts and feedback.",
      },
    ],
  }),
});

function ContactPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Contact Us
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We'd love to hear from you. Reach out via any of the channels below.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <a
          href={`mailto:${EMAIL}`}
          className="group flex items-start gap-3 rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">Email</h2>
            <p className="mt-0.5 break-all text-sm text-muted-foreground group-hover:text-foreground">
              {EMAIL}
            </p>
          </div>
        </a>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3 rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#128C7E]">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">
              WhatsApp Channel
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground group-hover:text-foreground">
              🔥 Join for instant deal alerts
            </p>
          </div>
        </a>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-foreground">
          Prefer chat? Join our WhatsApp channel.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1ebe5d]"
        >
          🔥 Join WhatsApp Channel
        </a>
      </div>
    </main>
  );
}