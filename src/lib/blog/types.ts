import type { ReactNode } from "react";

export interface PostMeta {
  slug: string;
  title: string;
  description: string; // meta description + article lead-in
  excerpt: string; // short card excerpt
  category: string;
  date: string; // ISO (YYYY-MM-DD)
  readingMinutes: number;
  tags: string[];
}

export interface Post {
  meta: PostMeta;
  Body: () => ReactNode;
}
