import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext, hasRole } from "@/lib/auth";
import { getMyProfile, getConnections } from "@/lib/data/marketplace";
import { MarketplaceSubnav } from "@/components/marketplace/marketplace-subnav";
import { ProfileForm } from "@/components/marketplace/profile-form";

export const metadata = { title: "Marketplace profile" };

export default async function MarketplaceProfilePage() {
  const { org, member } = await getAuthContext();
  // Managing the firm's public presence is an admin-level act.
  if (!hasRole(member.role, "ADMIN")) redirect("/marketplace");

  const [profile, connections] = await Promise.all([getMyProfile(org.id), getConnections(org.id)]);
  const incoming = connections.filter((c) => c.direction === "incoming" && c.status === "PENDING").length;

  return (
    <div>
      <PageHeader
        title="Your marketplace profile"
        description="How your firm appears to potential partners across the region."
      />
      <MarketplaceSubnav incoming={incoming} />
      <ProfileForm profile={profile} />
    </div>
  );
}
