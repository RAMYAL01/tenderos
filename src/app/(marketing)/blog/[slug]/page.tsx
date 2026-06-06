import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleShell, ArticleHeader, Prose, ArticleCta } from "@/components/blog/article-kit";
import { allPostsSorted, getPostBySlug } from "@/lib/blog/posts";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

export const dynamicParams = false;

export function generateStaticParams() {
  return allPostsSorted().map((p) => ({ slug: p.meta.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const { meta } = post;
  const url = `${SITE}/blog/${meta.slug}`;
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.tags,
    alternates: { canonical: `/blog/${meta.slug}` },
    openGraph: {
      type: "article",
      url,
      title: meta.title,
      description: meta.description,
      siteName: "TenderOS",
      publishedTime: meta.date,
      tags: meta.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();
  const { meta, Body } = post;

  return (
    <ArticleShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(meta)) }}
      />
      <ArticleHeader
        category={meta.category}
        title={meta.title}
        description={meta.description}
        date={meta.date}
        readingMinutes={meta.readingMinutes}
      />
      <Prose>
        <Body />
      </Prose>
      <ArticleCta
        title="See it on your own tenders"
        subtitle="Upload a real RFP and watch TenderOS extract, price, and check it — start a 14-day free trial."
      />
    </ArticleShell>
  );
}

function articleJsonLd(meta: {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
}) {
  const url = `${SITE}/blog/${meta.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.date,
    dateModified: meta.date,
    keywords: meta.tags.join(", "),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    author: { "@type": "Organization", name: "TenderOS", url: SITE },
    publisher: { "@type": "Organization", name: "TenderOS", url: SITE },
  };
}
