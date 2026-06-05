"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function ExportFinancialButton({ financialId }: { financialId: string }) {
  const [loading, setLoading] = useState(false);

  async function exportDocx() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/financial/${financialId}/export`);
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Export failed" }));
        throw new Error(error ?? "Export failed");
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") ?? "";
      const match = dispo.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? "Financial_Proposal.docx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Financial proposal exported", description: filename });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={exportDocx} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Export DOCX
    </Button>
  );
}
