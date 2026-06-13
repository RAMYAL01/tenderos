import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext, hasRole } from "@/lib/auth";
import { getConnections } from "@/lib/data/marketplace";
import { MarketplaceSubnav } from "@/components/marketplace/marketplace-subnav";
import { ConnectionsList } from "@/components/marketplace/connections-list";

export const metadata = { title: "Marketplace connections" };

export default async function MarketplaceConnectionsPage() {
  const { org, member } = await getAuthContext();
  const rows = await getConnections(org.id);
  const incoming = rows.filter((c) => c.direction === "incoming" && c.status === "PENDING").length;
  const canRespond = hasRole(member.role, "MANAGER");

  return (
    <div>
      <PageHeader
        title="Connections"
        description="Requests you've sent and received, and the partners you're connected with."
      />
      <MarketplaceSubnav incoming={incoming} />
      <ConnectionsList rows={rows} canRespond={canRespond} />
    </div>
  );
}
