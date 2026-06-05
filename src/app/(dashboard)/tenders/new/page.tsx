import { PageHeader } from "@/components/ui/page-header";
import { NewTenderForm } from "@/components/tenders/new-tender-form";
import { getAuthContext, hasRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "New Tender" };

export default async function NewTenderPage() {
  const { member } = await getAuthContext();

  // Writers and above can create tenders
  if (!hasRole(member.role, "WRITER")) {
    redirect("/tenders");
  }

  return (
    <>
      <PageHeader
        title="Create New Tender"
        description="Set up your bid project and upload the RFP documents to get started."
      />
      <div className="p-6">
        <NewTenderForm />
      </div>
    </>
  );
}
