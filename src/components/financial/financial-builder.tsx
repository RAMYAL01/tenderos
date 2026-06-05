"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShieldCheck, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  computeBreakdown,
  lineTotal,
  formatMoney,
  CATEGORY_LABELS,
  type CostLineInput,
} from "@/lib/financial/calculate";
import {
  addCostLine,
  deleteCostLine,
  updateAssumptions,
} from "@/lib/actions/financial";
import type { CostCategory } from "@prisma/client";

interface LineRow extends CostLineInput {
  id: string;
  itemRef: string | null;
  description: string;
  unit: string | null;
  source: string | null;
}

interface Props {
  financialId: string;
  currency: string;
  assumptions: {
    overheadPct: number;
    contingencyPct: number;
    profitMarginPct: number;
    vatPct: number;
  };
  lines: LineRow[];
}

const CATEGORIES: CostCategory[] = [
  "LABOR",
  "EQUIPMENT",
  "MATERIAL",
  "SUBCONTRACTOR",
  "TRANSPORT",
  "OTHER_DIRECT",
];

const CAT_COLORS: Record<CostCategory, string> = {
  LABOR: "text-blue-600 bg-blue-50 dark:bg-blue-950",
  EQUIPMENT: "text-violet-600 bg-violet-50 dark:bg-violet-950",
  MATERIAL: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950",
  SUBCONTRACTOR: "text-amber-600 bg-amber-50 dark:bg-amber-950",
  TRANSPORT: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950",
  OTHER_DIRECT: "text-slate-600 bg-slate-100 dark:bg-slate-800",
};

export function FinancialBuilder({ financialId, currency, assumptions, lines }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Live assumptions (persisted on blur)
  const [a, setA] = useState(assumptions);

  // New-line draft
  const [draft, setDraft] = useState({
    category: "MATERIAL" as CostCategory,
    itemRef: "",
    description: "",
    unit: "",
    quantity: "",
    unitRate: "",
    source: "",
  });

  const breakdown = useMemo(
    () =>
      computeBreakdown(
        lines.map((l) => ({
          category: l.category,
          quantity: Number(l.quantity),
          unitRate: Number(l.unitRate),
        })),
        a
      ),
    [lines, a]
  );

  function saveAssumptions(next: typeof a) {
    startTransition(async () => {
      const res = await updateAssumptions(financialId, { ...next, currency });
      if (!res.success) toast({ title: res.error ?? "Failed to save", variant: "destructive" });
      else router.refresh();
    });
  }

  function handleAdd() {
    if (!draft.description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const res = await addCostLine(financialId, {
        category: draft.category,
        itemRef: draft.itemRef || undefined,
        description: draft.description,
        unit: draft.unit || undefined,
        quantity: parseFloat(draft.quantity) || 0,
        unitRate: parseFloat(draft.unitRate) || 0,
        source: draft.source || undefined,
      });
      if (!res.success) {
        toast({ title: res.error ?? "Failed to add line", variant: "destructive" });
        return;
      }
      setDraft({ category: draft.category, itemRef: "", description: "", unit: "", quantity: "", unitRate: "", source: "" });
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteCostLine(id);
      if (!res.success) toast({ title: res.error ?? "Failed to delete", variant: "destructive" });
      else router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      {/* ── LEFT: cost lines ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* No-AI assurance */}
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>No AI pricing.</strong> Every figure below is calculated only
            from the rates you enter. The AI never sets or estimates a price.
          </span>
        </div>

        {/* Add line */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-3">
              <Label className="text-xs">Category</Label>
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as CostCategory })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Ref</Label>
              <Input className="h-9 text-sm" placeholder="2.1" value={draft.itemRef} onChange={(e) => setDraft({ ...draft, itemRef: e.target.value })} />
            </div>
            <div className="col-span-2 sm:col-span-5">
              <Label className="text-xs">Description</Label>
              <Input className="h-9 text-sm" placeholder="e.g. HVAC preventive maintenance" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Unit</Label>
              <Input className="h-9 text-sm" placeholder="hr / m² / ls" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <Label className="text-xs">Quantity</Label>
              <Input className="h-9 text-sm tabular-nums" type="number" min="0" step="any" placeholder="0" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <Label className="text-xs">Unit Rate ({currency})</Label>
              <Input className="h-9 text-sm tabular-nums" type="number" min="0" step="any" placeholder="0.00" value={draft.unitRate} onChange={(e) => setDraft({ ...draft, unitRate: e.target.value })} />
            </div>
            <div className="sm:col-span-4">
              <Label className="text-xs">Source (provenance)</Label>
              <Input className="h-9 text-sm" placeholder="Vendor quote #A-203" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button onClick={handleAdd} disabled={pending} className="h-9 w-full gap-1.5">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Lines table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Rate</th>
                <th className="px-3 py-2.5 text-right">Line Total</th>
                <th className="w-8 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">
                    No cost lines yet. Add BOQ items, labor, equipment, and material rates above.
                  </td>
                </tr>
              )}
              {lines.map((l) => (
                <tr key={l.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${CAT_COLORS[l.category]}`}>
                      {CATEGORY_LABELS[l.category]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {l.itemRef && <span className="mr-1.5 text-slate-400">{l.itemRef}</span>}
                      {l.description}
                    </div>
                    {l.source && <div className="text-[11px] text-slate-400">{l.source}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                    {Number(l.quantity).toLocaleString()} {l.unit ?? ""}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                    {Number(l.unitRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900 dark:text-white">
                    {lineTotal(l).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => handleDelete(l.id)} className="text-slate-300 transition-colors hover:text-red-500" aria-label="Delete line">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── RIGHT: assumptions + breakdown ─────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Assumptions */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Assumptions</h3>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["overheadPct", "Overhead %"],
              ["contingencyPct", "Contingency %"],
              ["profitMarginPct", "Profit / Markup %"],
              ["vatPct", "VAT %"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number" min="0" step="any"
                  className="h-9 text-sm tabular-nums"
                  value={a[key]}
                  onChange={(e) => setA({ ...a, [key]: parseFloat(e.target.value) || 0 })}
                  onBlur={() => saveAssumptions(a)}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
            <Save className="h-3 w-3" /> Saved automatically on change
          </p>
        </div>

        {/* Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Cost Breakdown</h3>

          <div className="space-y-1.5 text-sm">
            {breakdown.byCategory.map((c) => (
              <Row key={c.category} label={CATEGORY_LABELS[c.category]} value={formatMoney(c.amount, currency)} muted />
            ))}
            <Divider />
            <Row label="Direct Cost" value={formatMoney(breakdown.directCost, currency)} bold />
            <Row label={`Overhead (${a.overheadPct}%)`} value={formatMoney(breakdown.overhead, currency)} muted />
            <Row label={`Contingency (${a.contingencyPct}%)`} value={formatMoney(breakdown.contingency, currency)} muted />
            <Divider />
            <Row label="Cost Before Profit" value={formatMoney(breakdown.costBeforeProfit, currency)} />
            <Row label={`Profit (${a.profitMarginPct}%)`} value={formatMoney(breakdown.profit, currency)} muted />
            <Divider />
            <Row label="Net Bid Price" value={formatMoney(breakdown.netPrice, currency)} bold />
            <Row label={`VAT (${a.vatPct}%)`} value={formatMoney(breakdown.vat, currency)} muted />
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-gradient-to-br from-slate-900 to-[#0c1a35] px-4 py-3">
            <span className="text-sm font-medium text-blue-200">Total Price</span>
            <span className="text-lg font-bold tabular-nums text-white">{formatMoney(breakdown.totalPrice, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-500" : "text-slate-700 dark:text-slate-300"}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold text-slate-900 dark:text-white" : muted ? "text-slate-500" : "text-slate-700 dark:text-slate-300"}`}>{value}</span>
    </div>
  );
}
function Divider() {
  return <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />;
}
