import { Star } from "lucide-react";
import { Reveal } from "./reveal";

const testimonials = [
  {
    quote:
      "We cut our proposal turnaround from three weeks to four days. The Arabic extraction alone is worth the subscription — nothing else on the market handles bilingual RFPs like this.",
    name: "Khalid Al-Mutairi",
    title: "Bid Director",
    company: "Facilities Management Group",
    initials: "KM",
    color: "bg-blue-600",
  },
  {
    quote:
      "The compliance matrix caught two mandatory requirements our team had missed in the previous round. That's the difference between winning and being disqualified.",
    name: "Sara Haddad",
    title: "Head of Proposals",
    company: "EPC Contractor",
    initials: "SH",
    color: "bg-violet-600",
  },
  {
    quote:
      "Onboarding took an afternoon. By the end of the first week we had submitted two tenders that would normally have taken a month each. The ROI was immediate.",
    name: "Omar Farouk",
    title: "Commercial Manager",
    company: "Infrastructure Group",
    initials: "OF",
    color: "bg-emerald-600",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Testimonials
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            Built for teams that win
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <figure className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-7 shadow-sm transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                {/* Stars */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                {/* Author */}
                <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${t.color}`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.title} · {t.company}
                    </div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
