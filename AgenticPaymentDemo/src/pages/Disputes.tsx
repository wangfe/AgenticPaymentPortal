import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { auditByEntityId, disputeCases, evidenceByDisputeId, intentReceipts, mandates } from "@/lib/mockData";
import { daysUntil, formatIso, formatMoney } from "@/lib/format";
import type { AuditEvent, DisputeCase, EvidenceItem } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { FileDown, FileText, ShieldAlert, Sparkles, UploadCloud } from "lucide-react";

function statusBadge(s: DisputeCase["status"]) {
  if (s === "open") return <Badge variant="outline">Open</Badge>;
  if (s === "needs_review") return <Badge variant="secondary">Needs review</Badge>;
  if (s === "submitted") return <Badge className="bg-sidebar-primary/20 text-sidebar-primary-foreground border border-sidebar-primary/30">Submitted</Badge>;
  if (s === "won") return <Badge>Won</Badge>;
  return <Badge variant="destructive">Lost</Badge>;
}

function reasonBadge(cat: DisputeCase["reasonCategory"]) {
  const label = cat.replaceAll("_", " ");
  if (cat === "fraud") return <Badge variant="destructive">{label}</Badge>;
  if (cat === "not_received") return <Badge variant="secondary">{label}</Badge>;
  return <Badge variant="outline">{label}</Badge>;
}

function getMandate(id?: string) {
  if (!id) return undefined;
  return mandates.find((m) => m.id === id);
}

function getIntent(id?: string) {
  if (!id) return undefined;
  return intentReceipts.find((r) => r.id === id);
}

export default function DisputesPage({ id }: { id?: string }) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [localAudit, setLocalAudit] = useState<Record<string, AuditEvent[]>>({});

  const cases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...disputeCases].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    if (!q) return list;
    return list.filter((c) =>
      [c.id, c.customer.email, c.order.id, c.merchant.name, c.reasonCode].some((x) => x.toLowerCase().includes(q))
    );
  }, [query]);

  const selectedId = id ?? cases[0]?.id;
  const selected = cases.find((c) => c.id === selectedId);

  const evidence = selected ? evidenceByDisputeId[selected.id] ?? [] : [];
  const audit = selected
    ? [...(auditByEntityId[selected.id] ?? []), ...(localAudit[selected.id] ?? [])].sort((a, b) => b.at.localeCompare(a.at))
    : [];

  return (
    <AppShell>
      <div className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mono text-[11px] text-muted-foreground">MVP / DISPUTE AUTONOMY</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">Case Queue</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Evidence graph + pack generation with agentic authorization and intent proof.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email, case id, order, reason code…"
              className="w-full md:w-[360px]"
            />
            <Button
              variant="outline"
              onClick={() => toast.message("Coming soon", { description: "SLA automation policies are mocked in this demo." })}
            >
              SLA policies
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[460px_1fr]">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div className="mono text-[11px] text-muted-foreground">OPEN CASES</div>
              <div className="mono text-[11px] text-muted-foreground">{cases.length} items</div>
            </div>

            <div className="max-h-[66vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due</TableHead>
                    <TableHead>Case</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((c) => {
                    const active = c.id === selectedId;
                    return (
                      <TableRow
                        key={c.id}
                        className={cn("cursor-pointer", active && "bg-accent")}
                        onClick={() => setLocation(`/disputes/${c.id}`)}
                      >
                        <TableCell className="mono text-xs">{daysUntil(c.dueAt)}d</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium mono">{c.id}</div>
                          <div className="text-xs text-muted-foreground">{c.customer.email} · {c.merchant.name}</div>
                        </TableCell>
                        <TableCell className="text-sm">{formatMoney(c.money.amount, c.money.currency)}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          {reasonBadge(c.reasonCategory)}
                          {statusBadge(c.status)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            {!selected ? (
              <div className="p-8 text-sm text-muted-foreground">No case selected.</div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-border/60">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mono text-[11px] text-muted-foreground">CASE</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <div className="text-lg font-semibold mono">{selected.id}</div>
                        {reasonBadge(selected.reasonCategory)}
                        {statusBadge(selected.status)}
                        <Badge variant="outline" className="mono text-[10px]">due in {daysUntil(selected.dueAt)}d</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Reason {selected.reasonCode} · Order {selected.order.id} · {formatMoney(selected.money.amount, selected.money.currency)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => toast.message("Exported", { description: "Mock CSV export generated." })}
                      >
                        <FileDown className="h-4 w-4" />
                        Export
                      </Button>
                      <Button
                        onClick={() => {
                          const event: AuditEvent = {
                            id: crypto.randomUUID(),
                            at: new Date().toISOString(),
                            actor: { type: "agent", displayName: "Dispute Agent" },
                            kind: "EVIDENCE_GENERATED",
                            summary: "Generated evidence pack draft (including mandate + intent receipt if available).",
                          };
                          setLocalAudit((prev) => ({
                            ...prev,
                            [selected.id]: [event, ...(prev[selected.id] ?? [])],
                          }));
                          toast.success("Evidence pack draft generated");
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                        Generate pack
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <Tabs defaultValue="evidence">
                    <TabsList className="bg-background/40 border border-border/60">
                      <TabsTrigger value="evidence">Evidence</TabsTrigger>
                      <TabsTrigger value="agentic">Agentic proof</TabsTrigger>
                      <TabsTrigger value="audit">Audit trail</TabsTrigger>
                    </TabsList>

                    <TabsContent value="evidence" className="mt-4">
                      <EvidencePanel items={evidence} />
                    </TabsContent>

                    <TabsContent value="agentic" className="mt-4">
                      <AgenticProofPanel dispute={selected} />
                    </TabsContent>

                    <TabsContent value="audit" className="mt-4">
                      <Card className="p-0 overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/60">
                          <div className="mono text-[11px] text-muted-foreground">LATEST EVENTS</div>
                        </div>
                        <div className="max-h-[54vh] overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Actor</TableHead>
                                <TableHead>Event</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {audit.map((e) => (
                                <TableRow key={e.id}>
                                  <TableCell className="mono text-xs">{formatIso(e.at)}</TableCell>
                                  <TableCell className="text-sm">{e.actor.displayName}</TableCell>
                                  <TableCell className="text-sm">{e.summary}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function EvidencePanel({ items }: { items: EvidenceItem[] }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div className="mono text-[11px] text-muted-foreground">EVIDENCE GRAPH</div>
        <Badge variant="outline" className="mono text-[10px]">{items.length} nodes</Badge>
      </div>
      <div className="max-h-[56vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="mono text-xs">{it.kind}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{it.title}</div>
                  {it.notes ? <div className="text-xs text-muted-foreground">{it.notes}</div> : null}
                </TableCell>
                <TableCell className="text-sm">{it.source}</TableCell>
                <TableCell className="mono text-xs">{formatIso(it.timestamp)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function AgenticProofPanel({ dispute }: { dispute: DisputeCase }) {
  const mandate = getMandate(dispute.mandateId);
  const intent = getIntent(dispute.intentReceiptId);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="p-4">
        <div className="mono text-[11px] text-muted-foreground">WHY THIS MATTERS</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Agent-initiated disputes often fail due to missing “proof of delegation.” This panel highlights the new evidence primitives:
          mandate + intent receipt + step-up logs + tool-call audit.
        </div>
      </Card>

      <Card className="p-4">
        <div className="mono text-[11px] text-muted-foreground">AGENT IDENTITY</div>
        {dispute.actorType === "agent" && dispute.agent ? (
          <div className="mt-2">
            <div className="font-medium">{dispute.agent.vendor}</div>
            <div className="mono text-xs text-muted-foreground">{dispute.agent.agentId} · v{dispute.agent.version}</div>
            <div className="mono text-xs text-muted-foreground">{dispute.agent.runtime} · {dispute.agent.keyId}</div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">No agent identity recorded (human-initiated).</div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mono text-[11px] text-muted-foreground">MANDATE</div>
        {mandate ? (
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium">{mandate.id}</div>
              <Badge variant="outline" className="mono text-[10px]">v{mandate.version}</Badge>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Principal: {mandate.principal.displayName} · Cap: {formatMoney(mandate.scope.maxAmountMinor, mandate.scope.currency)} · Expires in {daysUntil(mandate.scope.expiresAt)}d
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4 mt-0.5" />
            Missing mandate. This weakens dispute defensibility.
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mono text-[11px] text-muted-foreground">INTENT RECEIPT</div>
        {intent ? (
          <div className="mt-2">
            <div className="font-medium">{intent.id}</div>
            <div className="mt-1 text-sm text-muted-foreground">Order: {intent.summary.orderId}</div>
            <div className="mt-2 rounded-md border border-border/60 bg-background/40 p-3 text-sm">{intent.decisionSummary}</div>
            <div className="mt-2 text-xs text-muted-foreground mono">Hashed fields: {intent.fieldsHashed.join(", ")}</div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">No intent receipt available.</div>
        )}
      </Card>
    </div>
  );
}
