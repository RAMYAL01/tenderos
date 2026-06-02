import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Root page — redirects authenticated users to /dashboard,
 * unauthenticated users to /sign-in.
 *
 * The full marketing landing page will be added in a later step.
 */
export default async function RootPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  } else {
    redirect("/sign-in");
  }
}
