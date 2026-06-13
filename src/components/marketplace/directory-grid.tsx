"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, MapPin, Users, CheckCircle2, Clock, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { requestConnection } from "@/lib/actions/marketplace";
import type { DirectoryCard } from "@/lib/data/marketplace";

export function DirectoryGrid({ cards, canConnect }: { cards: DirectoryCard[]; canConnect: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<DirectoryCard | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cards;
    return cards.filter(
      (c) =>
        c.displayName.toLowerCase().includes(needle) ||
        (c.blurb ?? "").toLowerCase().includes(needle) ||
        c.capabilities.some((x) => x.toLowerCase().includes(needle)) ||
        c.sectors.some((x) => x.toLowerCase().includes(needle)) ||
        (c.country ?? "").toLowerCase().includes(needle)
    );
  }, [cards, q]);

  return (
    <div className="px-6 py-6">
      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, capability, sector, country…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">No partners match your search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <PartnerCard key={c.orgId} card={c} canConnect={canConnect} onConnect={() => setTarget(c)} />
          ))}
        </div>
      )}

      <ConnectDialog
        card={target}
        onClose={() => setTarget(null)}
        onDone={() => {
          setTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function PartnerCard({
  card,
  canConnect,
  onConnect,
}: {
  card: DirectoryCard;
  canConnect: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900 dark:text-white">{card.displayName}</h3>
          {card.displayNameAr && (
            <p
              className="truncate text-xs text-slate-400"
              dir="rtl"
              style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
            >
              {card.displayNameAr}
            </p>
          )}
        </div>
        <StateBadge state={card.connection.state} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {card.country && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {card.country}
          </span>
        )}
        {card.employeeBand && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {card.employeeBand}
          </span>
        )}
      </div>

      {card.blurb && <p className="mt-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{card.blurb}</p>}

      {(card.sectors.length > 0 || card.capabilities.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.sectors.slice(0, 4).map((s) => (
            <Badge key={`s-${s}`} variant="secondary" className="text-[11px]">
              {s}
            </Badge>
          ))}
          {card.capabilities.slice(0, 4).map((c) => (
            <Badge key={`c-${c}`} variant="outline" className="text-[11px]">
              {c}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-4 flex-1" />
      <CardCta state={card.connection.state} canConnect={canConnect} onConnect={onConnect} />
    </div>
  );
}

function StateBadge({ state }: { state: DirectoryCard["connection"]["state"] }) {
  if (state === "connected")
    return (
      <Badge className="shrink-0 gap-1 bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> Connected
      </Badge>
    );
  if (state === "outgoing")
    return (
      <Badge variant="secondary" className="shrink-0 gap-1">
        <Clock className="h-3 w-3" /> Pending
      </Badge>
    );
  if (state === "incoming")
    return (
      <Badge className="shrink-0 gap-1 bg-blue-600 hover:bg-blue-600">
        <Handshake className="h-3 w-3" /> Wants to connect
      </Badge>
    );
  return null;
}

function CardCta({
  state,
  canConnect,
  onConnect,
}: {
  state: DirectoryCard["connection"]["state"];
  canConnect: boolean;
  onConnect: () => void;
}) {
  if (state === "connected")
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/marketplace/connections">View contact</Link>
      </Button>
    );
  if (state === "incoming")
    return (
      <Button size="sm" asChild>
        <Link href="/marketplace/connections">Respond to request</Link>
      </Button>
    );
  if (state === "outgoing")
    return (
      <Button variant="outline" size="sm" disabled>
        Request sent
      </Button>
    );
  // none | declined
  if (!canConnect)
    return <p className="text-xs text-slate-400">A manager can request a connection.</p>;
  return (
    <Button size="sm" onClick={onConnect}>
      <Handshake className="h-4 w-4" />
      {state === "declined" ? "Request again" : "Request connection"}
    </Button>
  );
}

function ConnectDialog({
  card,
  onClose,
  onDone,
}: {
  card: DirectoryCard | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function send() {
    if (!card) return;
    start(async () => {
      const res = await requestConnection({ addresseeOrgId: card.orgId, message: message.trim() || null });
      if (!res.success) {
        toast({ title: "Couldn't send request", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Request sent", description: `${card.displayName} will see your request in their inbox.` });
      setMessage("");
      onDone();
    });
  }

  return (
    <Dialog open={card !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a connection</DialogTitle>
          <DialogDescription>
            Introduce your firm to {card?.displayName}. Once they accept, you&apos;ll each see the other&apos;s contact
            details.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional note — e.g. the kind of tenders or JV you have in mind."
          rows={4}
          maxLength={1000}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Handshake className="h-4 w-4" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
