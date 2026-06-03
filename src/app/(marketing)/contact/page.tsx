import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { Reveal } from "@/components/marketing/reveal";
import { Mail, MessageSquare, Calendar, MapPin } from "lucide-react";

export const metadata = {
  title: "Contact",
  description:
    "Get in touch with the TenderOS team — sales, support, or a product demo.",
};

const channels = [
  {
    icon: Mail,
    title: "Email us",
    desc: "We reply within one business day.",
    action: "hello@tenderos.ai",
    href: "mailto:hello@tenderos.ai",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
  },
  {
    icon: Calendar,
    title: "Book a demo",
    desc: "See TenderOS on your own RFPs.",
    action: "sales@tenderos.ai",
    href: "mailto:sales@tenderos.ai",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950",
  },
  {
    icon: MessageSquare,
    title: "Support",
    desc: "Already a customer? We're here.",
    action: "support@tenderos.ai",
    href: "mailto:support@tenderos.ai",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950",
  },
];

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(59,130,246,0.1), transparent)",
            }}
          />
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                Contact
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
                Let&apos;s talk about your{" "}
                <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  next bid
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                Whether you want a product demo, have a question about pricing,
                or need a hand getting started — our team is ready to help.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="pb-20 sm:pb-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {channels.map((c, i) => {
                const Icon = c.icon;
                return (
                  <Reveal key={c.title} delay={i * 90}>
                    <a
                      href={c.href}
                      className="flex h-full flex-col items-start rounded-2xl border border-slate-100 bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className={`inline-flex rounded-xl p-3 ${c.bg}`}>
                        <Icon className={`h-6 w-6 ${c.color}`} />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                        {c.title}
                      </h3>
                      <p className="mt-1 flex-1 text-sm text-slate-600 dark:text-slate-400">
                        {c.desc}
                      </p>
                      <span className="mt-4 text-sm font-medium text-blue-600">
                        {c.action}
                      </span>
                    </a>
                  </Reveal>
                );
              })}
            </div>

            {/* Office */}
            <Reveal delay={150}>
              <div className="mt-8 flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 px-6 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
                <MapPin className="h-4 w-4 text-blue-600" />
                Serving government contractors across the GCC &amp; MENA
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
