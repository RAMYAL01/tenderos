import Link from "next/link";
import { FileSearch, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        {/* 404 visual */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
          <FileSearch className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        </div>

        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
          404 Not Found
        </p>
        <h1 className="mb-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
          Page not found
        </h1>
        <p className="mb-8 text-slate-600 dark:text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist, has been moved,
          or you don&apos;t have permission to access it.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/dashboard">
              Go to Dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="javascript:history.back()">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
