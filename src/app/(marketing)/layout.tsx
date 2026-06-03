/**
 * Marketing layout — clean, no sidebar, no auth required.
 * Used for: landing page, pricing, about, legal pages.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {children}
    </div>
  );
}
