"use client";

/**
 * BoqReviewScreen — Human-in-the-Loop review for AI/OCR-extracted Bills of
 * Quantities from scanned (often Arabic) government tenders.
 *
 * Design goals: SPEED + ACCURACY.
 *  - Split-screen: scanned source (zoom/pan) on the left, an Excel-grade editable
 *    grid on the right, so the reviewer compares value-against-source at a glance.
 *  - Confidence-driven triage: low-confidence cells are tinted so the eye lands on
 *    exactly what the model was unsure about. Editing a cell marks it human-verified
 *    (confidence → 1.0), so the warning clears and the "remaining" counter ticks down.
 *  - Keyboard-first: click-to-edit, Tab/Shift+Tab horizontal, Enter vertical,
 *    Esc to deselect — never touch the mouse for a clean page.
 *  - RTL-aware: the Arabic Description column renders and edits right-to-left.
 *
 * Self-contained with mock data, but `initialRows` / `documentUrl` are props so
 * this drops straight onto real extraction output → deterministic pricing engine.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  Save,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  FileWarning,
  Sparkles,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/* ────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/** A single extracted value plus the model's confidence in it (0..1). */
export interface Cell<T = string | number> {
  value: T;
  /** 1.0 once a human has verified/edited the cell. */
  confidence: number;
}

export interface BoqRow {
  id: string;
  itemNo: Cell<string>;
  description: Cell<string>; // Arabic — RTL
  unit: Cell<string>;
  quantity: Cell<number>;
  rate: Cell<number>;
}

type ColKey = "itemNo" | "description" | "unit" | "quantity" | "rate";

interface ColDef {
  key: ColKey;
  label: string;
  type: "text" | "number";
  rtl?: boolean;
  align: "left" | "right" | "center";
  /** Tailwind width hint for the column. */
  widthClass: string;
}

const COLUMNS: ColDef[] = [
  { key: "itemNo", label: "Item No", type: "text", align: "left", widthClass: "w-24" },
  { key: "description", label: "Description (الوصف)", type: "text", rtl: true, align: "right", widthClass: "min-w-[280px]" },
  { key: "unit", label: "Unit", type: "text", align: "center", widthClass: "w-20" },
  { key: "quantity", label: "Quantity", type: "number", align: "right", widthClass: "w-28" },
  { key: "rate", label: "Rate", type: "number", align: "right", widthClass: "w-28" },
];

const LOW = 0.85; // amber threshold
const CRIT = 0.6; // red threshold

/* ────────────────────────────────────────────────────────────────────────── */
/* Mock data — a messy Arabic BOQ extraction                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const c = <T,>(value: T, confidence = 0.97): Cell<T> => ({ value, confidence });

const MOCK_ROWS: BoqRow[] = [
  {
    id: "r1",
    itemNo: c("1.1.1"),
    description: c("أعمال الحفر للأساسات في جميع أنواع التربة", 0.94),
    unit: c("م³"),
    quantity: c(1250, 0.96),
    rate: c(45.75, 0.95),
  },
  {
    id: "r2",
    itemNo: c("2.1.4"),
    description: c("توريد وصب خرسانة عادية للميول والنظافة", 0.78), // amber
    unit: c("م³"),
    quantity: c(320.5, 0.91),
    rate: c(210.0, 0.9),
  },
  {
    id: "r3",
    itemNo: c("3.4.9", 0.82), // amber
    description: c("توريد وتركيب حديد تسليح عالي المقاومة", 0.93),
    unit: c("طن"),
    quantity: c(18.75, 0.55), // red — OCR misread "l8.75"
    rate: c(1875.33, 0.88),
  },
  {
    id: "r4",
    itemNo: c("4.2.1"),
    description: c("أعمال العزل المائي للأسطح والقواعد", 0.9),
    unit: c("م²"),
    quantity: c(940, 0.92),
    rate: c(38.2, 0.82), // amber
  },
  {
    id: "r5",
    itemNo: c("5.1.2"),
    description: c("توريد وتركيب أبواب خشبية قشرة طبيعية", 0.95),
    unit: c("عدد"),
    quantity: c(64, 0.94),
    rate: c(980.0, 0.93),
  },
  {
    id: "r6",
    itemNo: c("5.3.7"),
    description: c("دهانات بلاستيك للجدران الداخلية", 0.59), // red — smudged scan
    unit: c("م²"),
    quantity: c(3120, 0.9),
    rate: c(9.99, 0.86),
  },
  {
    id: "r7",
    itemNo: c("6.1.3"),
    description: c("توريد وتركيب تمديدات كهربائية مخفية", 0.88),
    unit: c("م.ط", 0.8), // amber
    quantity: c(2150, 0.83), // amber
    rate: c(27.4, 0.91),
  },
  {
    id: "r8",
    itemNo: c("7.2.5"),
    description: c("أعمال السباكة والصرف الصحي الكاملة", 0.92),
    unit: c("عدد"),
    quantity: c(145, 0.95),
    rate: c(410.5, 0.9),
  },
  {
    id: "r9",
    itemNo: c("8.1.1"),
    description: c("توريد وتركيب نظام تكييف مركزي", 0.9),
    unit: c("عدد"),
    quantity: c(12, 0.93),
    rate: c(15750.0, 0.48), // red — large number misread
  },
  {
    id: "r10",
    itemNo: c("9.4.2"),
    description: c("أعمال تنسيق الموقع والزراعة التجميلية", 0.81), // amber
    unit: c("م²"),
    quantity: c(1850, 0.94),
    rate: c(22.15, 0.92),
  },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function confTone(score: number): "ok" | "low" | "crit" {
  if (score < CRIT) return "crit";
  if (score < LOW) return "low";
  return "ok";
}

function cellBg(score: number, selected: boolean): string {
  const tone = confTone(score);
  if (selected) return "ring-2 ring-inset ring-blue-500 bg-white dark:bg-slate-900 z-10";
  if (tone === "crit") return "bg-red-50 dark:bg-red-950/40 hover:bg-red-100/70 dark:hover:bg-red-950/60";
  if (tone === "low") return "bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-950/60";
  return "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60";
}

function fmt(col: ColDef, v: string | number): string {
  if (col.type === "number" && typeof v === "number") {
    return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }
  return String(v);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Main component                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function BoqReviewScreen({
  initialRows = MOCK_ROWS,
  documentUrl,
  tenderName = "RFP 2026-114 · Civil Works Package — BOQ Section 3",
  onApprove,
}: {
  initialRows?: BoqRow[];
  documentUrl?: string;
  tenderName?: string;
  onApprove?: (rows: BoqRow[]) => void;
}) {
  const [rows, setRows] = useState<BoqRow[]>(initialRows);

  /* ---- grid selection / editing ---- */
  const [active, setActive] = useState<{ r: number; col: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---- saving state for the action bar ---- */
  const [busy, setBusy] = useState<null | "save" | "invalid" | "approve">(null);

  const cellOf = (r: number, col: number): Cell => {
    const row = rows[r];
    return row[COLUMNS[col].key] as Cell;
  };

  const startEdit = useCallback(
    (r: number, col: number) => {
      const cell = rows[r][COLUMNS[col].key] as Cell;
      setActive({ r, col });
      setDraft(String(cell.value));
      setEditing(true);
    },
    [rows]
  );

  const writeCell = useCallback(
    (r: number, col: number, raw: string) => {
      setRows((prev) => {
        const next = [...prev];
        const def = COLUMNS[col];
        const row = { ...next[r] };
        let value: string | number = raw;
        if (def.type === "number") {
          const parsed = parseFloat(raw.replace(/,/g, ""));
          value = Number.isFinite(parsed) ? parsed : 0;
        }
        // A human touched it → full confidence, warning clears.
        (row[def.key] as Cell) = { value, confidence: 1 };
        next[r] = row;
        return next;
      });
    },
    []
  );

  const commit = useCallback(() => {
    if (active && editing) writeCell(active.r, active.col, draft);
  }, [active, editing, draft, writeCell]);

  /** Commit current, move by (dr,dc) within bounds, and keep editing (fast entry). */
  const moveEdit = useCallback(
    (dr: number, dc: number) => {
      if (!active) return;
      writeCell(active.r, active.col, draft);
      let r = active.r + dr;
      let col = active.col + dc;
      if (col < 0) {
        col = COLUMNS.length - 1;
        r -= 1;
      } else if (col > COLUMNS.length - 1) {
        col = 0;
        r += 1;
      }
      r = Math.max(0, Math.min(rows.length - 1, r));
      col = Math.max(0, Math.min(COLUMNS.length - 1, col));
      const cell = rows[r][COLUMNS[col].key] as Cell;
      setActive({ r, col });
      setDraft(String(cell.value));
      setEditing(true);
    },
    [active, draft, rows, writeCell]
  );

  /* keep the editor focused + text selected when it (re)mounts */
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing, active]);

  /* input keyboard model */
  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "Tab":
        e.preventDefault();
        moveEdit(0, e.shiftKey ? -1 : 1);
        break;
      case "Enter":
        e.preventDefault();
        moveEdit(e.shiftKey ? -1 : 1, 0);
        break;
      case "Escape":
        e.preventDefault();
        setEditing(false);
        requestAnimationFrame(() => gridRef.current?.focus());
        break;
    }
  }

  /* grid-level keyboard model (selected, not editing) */
  function onGridKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (editing || !active) return;
    const { r, col } = active;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      setActive({
        r: Math.max(0, Math.min(rows.length - 1, r + dr)),
        col: Math.max(0, Math.min(COLUMNS.length - 1, col + dc)),
      });
    };
    switch (e.key) {
      case "ArrowUp": move(-1, 0); break;
      case "ArrowDown": move(1, 0); break;
      case "ArrowLeft": move(0, -1); break;
      case "ArrowRight": move(0, 1); break;
      case "Tab": e.preventDefault(); move(0, e.shiftKey ? -1 : 1); break;
      case "Enter":
      case "F2":
        e.preventDefault();
        startEdit(r, col);
        break;
      default:
        // start typing → replace
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          setActive({ r, col });
          setDraft("");
          setEditing(true);
        }
    }
  }

  /* ---- progress summary ---- */
  const { lowCount, critCount } = useMemo(() => {
    let low = 0;
    let crit = 0;
    for (const row of rows) {
      for (const colDef of COLUMNS) {
        const s = (row[colDef.key] as Cell).confidence;
        if (s < CRIT) crit++;
        else if (s < LOW) low++;
      }
    }
    return { lowCount: low, critCount: crit };
  }, [rows]);
  const remaining = lowCount + critCount;
  const totalCells = rows.length * COLUMNS.length;
  const verifiedPct = Math.round(((totalCells - remaining) / totalCells) * 100);

  /* ---- actions (mock side-effects) ---- */
  async function runAction(kind: "save" | "invalid" | "approve") {
    commit();
    setBusy(kind);
    await new Promise((res) => setTimeout(res, 700));
    setBusy(null);
    if (kind === "save") {
      toast({ title: "Draft saved", description: "Your review progress is stored." });
    } else if (kind === "invalid") {
      toast({
        title: "Marked invalid — re-queued for OCR",
        description: "This page will be re-scanned with a higher-resolution pass.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Approved → Pricing engine",
        description: `${rows.length} verified line items sent to deterministic pricing.`,
      });
      onApprove?.(rows);
    }
  }

  /* ───────────────────────────── render ───────────────────────────── */
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
      <ActionBar
        tenderName={tenderName}
        remaining={remaining}
        critCount={critCount}
        lowCount={lowCount}
        verifiedPct={verifiedPct}
        busy={busy}
        onRun={runAction}
      />

      <SplitPane
        left={<DocumentViewer documentUrl={documentUrl} rows={rows} activeRow={active?.r ?? null} />}
        right={
          <DataGrid
            rows={rows}
            active={active}
            editing={editing}
            draft={draft}
            gridRef={gridRef}
            inputRef={inputRef}
            setDraft={setDraft}
            onCellClick={startEdit}
            onInputKey={onInputKey}
            onGridKey={onGridKey}
            onInputBlur={commit}
            cellOf={cellOf}
          />
        }
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Action bar                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function ActionBar({
  tenderName,
  remaining,
  critCount,
  lowCount,
  verifiedPct,
  busy,
  onRun,
}: {
  tenderName: string;
  remaining: number;
  critCount: number;
  lowCount: number;
  verifiedPct: number;
  busy: null | "save" | "invalid" | "approve";
  onRun: (k: "save" | "invalid" | "approve") => void;
}) {
  const blocked = critCount > 0; // can't price with red-flagged cells
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">BOQ Review</p>
          <h1 className="max-w-[42ch] truncate text-sm font-semibold text-slate-900 dark:text-white">
            {tenderName}
          </h1>
        </div>
      </div>

      {/* progress */}
      <div className="ml-2 hidden items-center gap-3 md:flex">
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
            style={{ width: `${verifiedPct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{verifiedPct}% verified</span>
      </div>

      {/* triage chips */}
      <div className="flex items-center gap-2">
        {critCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" /> {critCount} critical
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            remaining === 0
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          )}
        >
          {remaining === 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileWarning className="h-3.5 w-3.5" />}
          {remaining === 0 ? "All items verified" : `${remaining} low-confidence remaining`}
        </span>
      </div>

      {/* actions */}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => onRun("save")}>
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Draft
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 dark:text-red-400"
          disabled={busy !== null}
          onClick={() => onRun("invalid")}
        >
          {busy === "invalid" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Mark Invalid (Re-run OCR)
        </Button>
        <Button
          size="sm"
          disabled={busy !== null || blocked}
          title={blocked ? "Resolve critical (red) cells before pricing" : undefined}
          onClick={() => onRun("approve")}
        >
          {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Approve &amp; Send to Pricing
          {!busy && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Resizable split pane                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function SplitPane({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const [leftPct, setLeftPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.max(28, Math.min(72, pct)));
    }
    function onUp() {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1">
      <div style={{ width: `${leftPct}%` }} className="min-w-0">
        {left}
      </div>

      {/* drag handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={() => {
          dragging.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        className="group relative w-1.5 shrink-0 cursor-col-resize bg-slate-200 transition-colors hover:bg-blue-400 dark:bg-slate-800 dark:hover:bg-blue-500"
      >
        <span className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400/60 group-hover:bg-white" />
      </div>

      <div style={{ width: `${100 - leftPct}%` }} className="min-w-0">
        {right}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Left pane — scanned document viewer (zoom + pan)                             */
/* ────────────────────────────────────────────────────────────────────────── */

function DocumentViewer({
  documentUrl,
  rows,
  activeRow,
}: {
  documentUrl?: string;
  rows: BoqRow[];
  activeRow: number | null;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panning = useRef<{ x: number; y: number } | null>(null);

  const zoom = (d: number) => setScale((s) => Math.max(0.5, Math.min(3, +(s + d).toFixed(2))));
  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return; // ctrl+wheel to zoom, plain wheel scrolls
    e.preventDefault();
    zoom(e.deltaY > 0 ? -0.1 : 0.1);
  }

  return (
    <div className="flex h-full flex-col border-r border-slate-200 dark:border-slate-800">
      {/* viewer toolbar */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <span className="mr-auto inline-flex items-center gap-1.5 font-medium">
          <Hand className="h-3.5 w-3.5" /> Source · drag to pan · ⌘/Ctrl + scroll to zoom
        </span>
        <IconBtn onClick={() => zoom(-0.2)} label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </IconBtn>
        <span className="w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
        <IconBtn onClick={() => zoom(0.2)} label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </IconBtn>
        <IconBtn onClick={reset} label="Fit">
          <Maximize2 className="h-4 w-4" />
        </IconBtn>
      </div>

      {/* canvas */}
      <div
        className="relative flex-1 select-none overflow-hidden bg-slate-300/40 dark:bg-black/40"
        onWheel={onWheel}
        onMouseDown={(e) => {
          panning.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
        }}
        onMouseMove={(e) => {
          if (!panning.current) return;
          setOffset({ x: e.clientX - panning.current.x, y: e.clientY - panning.current.y });
        }}
        onMouseUp={() => (panning.current = null)}
        onMouseLeave={() => (panning.current = null)}
        style={{ cursor: panning.current ? "grabbing" : "grab" }}
      >
        <div
          className="absolute left-1/2 top-6 -translate-x-1/2 origin-top transition-transform duration-75"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        >
          {documentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={documentUrl} alt="Scanned tender page" className="w-[640px] shadow-2xl" draggable={false} />
          ) : (
            <ScannedDocMock rows={rows} activeRow={activeRow} />
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {children}
    </button>
  );
}

/**
 * A synthetic "scanned" Arabic BOQ page — no external asset needed, works fully
 * offline/air-gapped. Faintly skewed + sepia + a soft blur sells the scan look,
 * and it mirrors the grid rows so reviewers can visually cross-check.
 */
function ScannedDocMock({ rows, activeRow }: { rows: BoqRow[]; activeRow: number | null }) {
  return (
    <div
      className="w-[640px] bg-[#f6f1e7] p-8 text-slate-800 shadow-2xl"
      style={{ transform: "rotate(-0.5deg)", filter: "sepia(0.25) contrast(1.05)" }}
      dir="rtl"
    >
      <div className="border-b-2 border-slate-700 pb-3 text-center">
        <p className="text-lg font-bold">المملكة — وزارة الأشغال العامة</p>
        <p className="text-sm">جدول الكميات — القسم الثالث: الأعمال المدنية</p>
        <p className="mt-1 text-xs text-slate-500">مناقصة رقم 2026-114</p>
      </div>

      <table className="mt-4 w-full border-collapse text-[11px]" style={{ filter: "blur(0.3px)" }}>
        <thead>
          <tr className="bg-slate-700/10">
            <th className="border border-slate-400 px-1 py-1">البند</th>
            <th className="border border-slate-400 px-1 py-1">الوصف</th>
            <th className="border border-slate-400 px-1 py-1">الوحدة</th>
            <th className="border border-slate-400 px-1 py-1">الكمية</th>
            <th className="border border-slate-400 px-1 py-1">السعر</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              className={cn(
                "align-top",
                activeRow === i && "bg-blue-300/30 outline outline-1 outline-blue-500"
              )}
            >
              <td className="border border-slate-400 px-1 py-1 text-center font-mono">{row.itemNo.value}</td>
              <td className="border border-slate-400 px-1 py-1">{row.description.value}</td>
              <td className="border border-slate-400 px-1 py-1 text-center">{row.unit.value}</td>
              <td className="border border-slate-400 px-1 py-1 text-center font-mono">{row.quantity.value}</td>
              <td className="border border-slate-400 px-1 py-1 text-center font-mono">{row.rate.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6 text-center text-[10px] text-slate-500">
        صفحة 3 من 14 — يُعتمد من المهندس المسؤول
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Right pane — the Excel-grade data grid                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function DataGrid({
  rows,
  active,
  editing,
  draft,
  gridRef,
  inputRef,
  setDraft,
  onCellClick,
  onInputKey,
  onGridKey,
  onInputBlur,
  cellOf,
}: {
  rows: BoqRow[];
  active: { r: number; col: number } | null;
  editing: boolean;
  draft: string;
  gridRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setDraft: (v: string) => void;
  onCellClick: (r: number, col: number) => void;
  onInputKey: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onGridKey: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onInputBlur: () => void;
  cellOf: (r: number, col: number) => Cell;
}) {
  return (
    <div
      ref={gridRef}
      tabIndex={0}
      onKeyDown={onGridKey}
      className="h-full overflow-auto bg-white outline-none dark:bg-slate-900"
    >
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-20">
          <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <th className="w-10 border-b border-slate-200 px-2 py-2 text-center dark:border-slate-700">#</th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "border-b border-l border-slate-200 px-3 py-2 dark:border-slate-700",
                  col.widthClass,
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center"
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, r) => (
            <tr key={row.id} className="group">
              {/* row index */}
              <td className="border-b border-slate-100 bg-slate-50/60 px-2 py-0 text-center text-xs font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
                {r + 1}
              </td>

              {COLUMNS.map((col, ci) => {
                const cell = cellOf(r, ci);
                const isActive = active?.r === r && active?.col === ci;
                const isEditing = isActive && editing;
                const tone = confTone(cell.confidence);
                return (
                  <td
                    key={col.key}
                    onClick={() => onCellClick(r, ci)}
                    title={`Confidence: ${Math.round(cell.confidence * 100)}%`}
                    className={cn(
                      "relative h-9 cursor-text border-b border-l border-slate-100 px-3 py-0 align-middle dark:border-slate-800",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      cellBg(cell.confidence, isActive)
                    )}
                  >
                    {/* confidence accent stripe */}
                    {tone !== "ok" && !isActive && (
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 w-0.5",
                          tone === "crit" ? "bg-red-400" : "bg-amber-400"
                        )}
                      />
                    )}

                    {isEditing ? (
                      <input
                        ref={inputRef}
                        value={draft}
                        dir={col.rtl ? "rtl" : "ltr"}
                        inputMode={col.type === "number" ? "decimal" : "text"}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={onInputKey}
                        onBlur={onInputBlur}
                        className={cn(
                          "absolute inset-0 h-full w-full bg-white px-3 text-sm text-slate-900 outline-none dark:bg-slate-900 dark:text-white",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          col.rtl && "text-right font-[system-ui]"
                        )}
                      />
                    ) : (
                      <span
                        dir={col.rtl ? "rtl" : "ltr"}
                        className={cn(
                          "block truncate text-slate-800 dark:text-slate-100",
                          col.type === "number" && "font-mono tabular-nums",
                          tone === "crit" && "font-medium text-red-700 dark:text-red-300"
                        )}
                      >
                        {fmt(col, cell.value)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* legend */}
      <div className="flex items-center gap-4 border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-amber-300 bg-amber-50 dark:bg-amber-950/40" /> Low confidence (&lt; 85%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-red-300 bg-red-50 dark:bg-red-950/40" /> Critical (&lt; 60%)
        </span>
        <span className="ml-auto">Click a cell to edit · Tab / Enter to move · Esc to deselect</span>
      </div>
    </div>
  );
}
