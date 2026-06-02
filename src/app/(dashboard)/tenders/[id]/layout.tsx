import { TenderNav } from "./tender-nav";

export default function TenderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <div className="flex flex-col">
      <TenderNav tenderId={params.id} />
      {children}
    </div>
  );
}
