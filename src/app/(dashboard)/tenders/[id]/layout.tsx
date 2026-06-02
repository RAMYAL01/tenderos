import { use } from "react";
import { TenderNav } from "./tender-nav";

export default function TenderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="flex flex-col">
      <TenderNav tenderId={id} />
      {children}
    </div>
  );
}
