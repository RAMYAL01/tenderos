"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/**
 * Upload files straight into the Knowledge Brain: browser → R2 (presigned) →
 * server extracts the text and embeds it. The original file is discarded; only
 * the extracted, searchable content is kept. PDF / DOCX / TXT.
 */
export function UploadKnowledgeButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Upload files");

  async function ingestOne(file: File): Promise<void> {
    const urlRes = await fetch("/api/knowledge/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, mimeType: file.type, fileSizeBytes: file.size }),
    });
    if (!urlRes.ok) throw new Error((await urlRes.json().catch(() => ({}))).error ?? "Could not start upload");
    const { uploadUrl, storageKey } = await urlRes.json();

    const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!putRes.ok) throw new Error("Upload to storage failed");

    const ingestRes = await fetch("/api/knowledge/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageKey, filename: file.name, mimeType: file.type, fileSizeBytes: file.size }),
    });
    if (!ingestRes.ok) throw new Error((await ingestRes.json().catch(() => ({}))).error ?? "Extraction failed");
  }

  async function handleFiles(files: FileList) {
    setBusy(true);
    const list = Array.from(files);
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setLabel(list.length > 1 ? `Extracting ${i + 1}/${list.length}…` : "Extracting…");
      try {
        await ingestOne(file);
        ok++;
      } catch (e) {
        toast({ title: `Failed: ${file.name}`, description: e instanceof Error ? e.message : "", variant: "destructive" });
      }
    }
    setBusy(false);
    setLabel("Upload files");
    if (inputRef.current) inputRef.current.value = "";
    if (ok > 0) {
      toast({ title: `${ok} file${ok === 1 ? "" : "s"} added to your Knowledge Brain` });
      router.refresh();
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
        onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
      />
      <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {label}
      </Button>
    </>
  );
}
