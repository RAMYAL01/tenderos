import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import { getOrCreatePreferences } from "@/lib/email/preferences";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { org, member } = await getAuthContext();
  const prefs = await getOrCreatePreferences(org.id, member.id);

  return (
    <>
      <PageHeader
        title="Email notifications"
        description="Choose which emails you'd like to receive. These settings are personal to you."
      />
      <NotificationPreferencesForm initial={prefs} />
    </>
  );
}
