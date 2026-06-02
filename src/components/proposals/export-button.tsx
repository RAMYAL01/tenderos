"use client";

import { useState } from "react";
import {
  Download, FileText, Printer, Loader2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

interface ExportButtonProps {
  proposalId: string;
  proposalTitle: string;
  language: string;
}

export function ExportButton({ proposalId, proposalTitle, language }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<string | null>(null);

  const isBilingual = language === "BILINGUAL";

  async function handleExport(format: "docx" | "bilingual_docx" | "pdf") {
    setIsExporting(true);
    setExportFormat(format);

    try {
      const res = await fetch(`/api/proposals/${proposalId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Export failed");
      }

      if (data.type === "print_url") {
        // Open print view in new tab
        window.open(data.url, "_blank");
        toast({ title: "Print view opened", description: "Use Ctrl+P / Cmd+P to save as PDF" });
        return;
      }

      if (data.type === "download" && data.downloadUrl) {
        // Trigger download
        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.download = data.filename ?? `${proposalTitle}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({
          title: "Export complete ✓",
          description: `${data.filename} downloaded`,
        });
      }
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          className="h-7 gap-1.5 text-xs"
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleExport("docx")}
          disabled={isExporting}
          className="gap-2 text-xs"
        >
          <FileText className="h-3.5 w-3.5 text-blue-500" />
          Word Document (.docx)
          {exportFormat === "docx" && isExporting && (
            <Loader2 className="ml-auto h-3 w-3 animate-spin" />
          )}
        </DropdownMenuItem>

        {isBilingual && (
          <DropdownMenuItem
            onClick={() => handleExport("bilingual_docx")}
            disabled={isExporting}
            className="gap-2 text-xs"
          >
            <FileText className="h-3.5 w-3.5 text-violet-500" />
            Bilingual Word (EN + AR)
            {exportFormat === "bilingual_docx" && isExporting && (
              <Loader2 className="ml-auto h-3 w-3 animate-spin" />
            )}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleExport("pdf")}
          disabled={isExporting}
          className="gap-2 text-xs"
        >
          <Printer className="h-3.5 w-3.5 text-red-500" />
          Print / Save as PDF
          {exportFormat === "pdf" && isExporting && (
            <Loader2 className="ml-auto h-3 w-3 animate-spin" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
