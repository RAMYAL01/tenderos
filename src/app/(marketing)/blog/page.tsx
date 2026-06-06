import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { allPostsSorted } from "@/lib/blog/posts";
import { formatDate } from "@/components/blog/article-kit";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

export const metadata: Metadata = {
  title: "Engineering & Strategy Blog",
  description:
    "Deep dives on bidding-software architecture for MENA contractors: deterministic BOQ pricing, bilingual Arabic/English tender extraction, and zero-trust tenant isolation for bid data.",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    url: `${SITE}/blog`,
    title: "Engineering & Strategy Blog | TenderOS",
    description:
      "How we build trustworthy tender intelligence: deterministic pricing, bilingual document AI, and zero-trust security.",
    siteName: "TenderOS",
  },
};

export default function BlogIndex() {
  const posts = allPostsSorted();

  return (
    <>
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd(posts.map((p) => p.meta))) }}
      />
      <main className="pb-16">
        <header className="mx-auto max-w-4xl px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">The TenderOS Blog</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Engineering &amp; strategy for serious bidders
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            How we build trustworthy tender intelligence — the architecture behind deterministic pricing,
            bilingual document AI, and zero-trust isolation of your bid data.
          </p>
        </header>

        <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:px-6 md:grid-cols-2">
          {posts.map(({ meta }) => (
            <Link
              key={meta.slug}
              href={`/blog/${meta.slug}`}
              className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/40"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{meta.category}</p>
              <h2 className="mt-3 text-xl font-bold leading-snug tracking-tight text-slate-900 dark:text-white">
                {meta.title}
              </h2>
              <p className="mt-3 flex-1 leading-relaxed text-slate-600 dark:text-slate-400">{meta.excerpt}</p>
              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(meta.date)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {meta.readingMinutes} min read
                </span>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                Read article
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}

function blogJsonLd(posts: { slug: string; title: string; description: string; date: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "TenderOS Blog",
    url: `${SITE}/blog`,
    publisher: { "@type": "Organization", name: "TenderOS", url: SITE },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      url: `${SITE}/blog/${p.slug}`,
    })),
  };
}
