"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, Mail, MapPin, Clock, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { respondToConnection } from "@/lib/actions/marketplace";
import type { ConnectionRow } from "@/lib/data/marketplace";

export function ConnectionsList({ rows, canRespond }: { rows: ConnectionRow[]; canRespond: boolean }) {
  const incoming = rows.filter((r) => r.direction === "incoming" && r.status === "PENDING");
  const connected = rows.filter((r) => r.status === "ACCEPTED");
  const outgoing = rows.filter((r) => r.direction === "outgoing" && r.status === "PENDING");
  const declined = rows.filter((r) => r.status === "DECLINED");

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <Inbox className="h-7 w-7" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">No connections yet</h3>
        <p className="max-w-sm text-sm text-slate-500">
          Requests you send and receive in the directory will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-6">
      {incoming.length > 0 && (
        <Section title="Requests to you" count={incoming.length}>
          {incoming.map((r) => (
            <IncomingCard key={r.connectionId} row={r} canRespond={canRespond} />
          ))}
        </Section>
      )}

      {connected.length > 0 && (
        <Section title="Connected partners" count={connected.length}>
          {connected.map((r) => (
            <ConnectedCard key={r.connectionId} row={r} />
          ))}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section title="Requests you sent" count={outgoing.length}>
          {outgoing.map((r) => (
            <SimpleCard key={r.connectionId} row={r} trailing={<Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Awaiting response</Badge>} />
          ))}
        </Section>
      )}

      {declined.length > 0 && (
        <Section title="Declined" count={declined.length}>
          {declined.map((r) => (
            <SimpleCard key={r.connectionId} row={r} muted trailing={<Badge variant="outline">Declined</Badge>} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title} <span className="text-slate-400">({count})</span>
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function OrgLine({ row }: { row: ConnectionRow }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-slate-900 dark:text-white">{row.otherName}</p>
      {row.otherCountry && (
        <p className="inline-flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3 w-3" />
          {row.otherCountry}
        </p>
      )}
    </div>
  );
}

const cardCls =
  "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";

function IncomingCard({ row, canRespond }: { row: ConnectionRow; canRespond: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<"ACCEPTED" | "DECLINED" | null>(null);

  function respond(accept: boolean) {
    start(async () => {
      const res = await respondToConnection({ connectionId: row.connectionId, accept });
      if (!res.success) {
        toast({ title: "Couldn't respond", description: res.error, variant: "destructive" });
        return;
      }
      setDone(accept ? "ACCEPTED" : "DECLINED");
      toast({
        title: accept ? "Connected" : "Request declined",
        description: accept ? `You and ${row.otherName} can now see each other's contact.` : undefined,
      });
      router.refresh();
    });
  }

  return (
    <div className={cardCls}>
      <div className="flex items-start justify-between gap-3">
        <OrgLine row={row} />
        {done && <Badge variant={done === "ACCEPTED" ? "default" : "outline"}>{done === "ACCEPTED" ? "Connected" : "Declined"}</Badge>}
      </div>
      {row.message && (
        <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
          “{row.message}”
        </p>
      )}
      {!done && (
        <div className="mt-3 flex gap-2">
          {canRespond ? (
            <>
              <Button size="sm" onClick={() => respond(true)} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => respond(false)} disabled={pending}>
                <X className="h-4 w-4" />
                Decline
              </Button>
            </>
          ) : (
            <p className="text-xs text-slate-400">A manager can accept or decline this request.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectedCard({ row }: { row: ConnectionRow }) {
  return (
    <div className={cardCls}>
      <div className="flex items-start justify-between gap-3">
        <OrgLine row={row} />
        <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600">Connected</Badge>
      </div>
      {row.contactEmail ? (
        <a
          href={`mailto:${row.contactEmail}`}
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <Mail className="h-4 w-4" />
          {row.contactEmail}
        </a>
      ) : (
        <p className="mt-3 text-xs text-slate-400">This partner hasn&apos;t added a contact email yet.</p>
      )}
    </div>
  );
}

function SimpleCard({ row, trailing, muted }: { row: ConnectionRow; trailing: React.ReactNode; muted?: boolean }) {
  return (
    <div className={muted ? `${cardCls} opacity-70` : cardCls}>
      <div className="flex items-center justify-between gap-3">
        <OrgLine row={row} />
        {trailing}
      </div>
    </div>
  );
}
