import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { useMemo, useState } from "react";
import { auditByEntityId, intentReceipts, mandates, paymentFailures, repairActionsByFailureId } from "@/lib/mockData";
import { daysUntil, formatIso, formatMoney } from "@/lib/format";
import type { AuditEvent, PaymentFailure, RepairAction } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Copy, ShieldAlert, Wand2 } from "lucide-react";

function priorityBadge(p: PaymentFailure["priority"]) {
  if (p === "p0") return <Badge variant="destructive">P0</Badge>;
  if (p === "p1") return <Badge variant="secondary">P1</Badge>;
  return <Badge variant="outline">P2</Badge>;
}

function actorBadge(f: PaymentFailure) {
  if (f.actorType === "human") return <Badge variant="outline">Human</Badge>;
  return (
    <Badge className="bg-sidebar-primary/20 text-sidebar-primary-foreground border border-sidebar-primary/30">
      Agent
    </Badge>
  );
}

function riskBadge(risk: RepairAction["risk"]) {
  if (risk === "high") return <Badge variant="destructive">High risk</Badge>;
  if (risk === "medium") return <Badge variant="secondary">Medium</Badge>;
  return <Badge variant="outline">Low</Badge>;
}

function getMandate(id?: string) {
  if (!id) return undefined;
  return mandates.find((m) => m.id === id);
}

function getIntent(id?: string) {
  if (!id) return undefined;
  return intentReceipts.find((r) => r.id === id);
}

export default function RepairPage({ id }: { id?: string }) {
  const [location, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [localAudit, setLocalAudit] = useState<Record<string, AuditEvent[]>>({});

  const failures = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = paymentFailures
      .filter((f) => f.status !== "fixed")
      .sort((a, b) => (a.priority === b.priority ? b.createdAt.localeCompare(a.createdAt) : a.priority.localeCompare(b.priority)));

    if (!q) return list;
    return list.filter((f) => {
      return (
        f.id.toLowerCase().includes(q) ||
        f.customer.email.toLowerCase().includes(q) ||
        f.merchant.name.toLowerCase().includes(q) ||
        f.order.id.toLowerCase().includes(q) ||
        f.decline.code.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const selectedId = id ?? failures[0]?.id;
  const selected = failures.find((f) => f.id === selectedId);

  const actions = selected ? repairActionsByFailureId[selected.id] ?? [] : [];
  const audit = selected
    ? [...(auditByEntityId[selected.id] ?? []), ...(localAudit[selected.id] ?? [])].sort((a, b) => b.at.localeCompare(a.at))
    : [];

  return (
    <AppShell>
      <div className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mono text-[11px] text-muted-foreground">MVP / PAYMENT REPAIR</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">Failure Queue</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Explainable repair recommendations, mandate gates, and auditable actions.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email, failure id, order id, decline code…"
              className="w-full md:w-[360px]"
            />
            <Button
              variant="outline"
              onClick={() => toast.message("Coming soon", { description: "Batch triage actions are mocked in this demo." })}
            >
              Batch triage
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[460px_1fr]">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div className="mono text-[11px] text-muted-foreground">OPEN FAILURES</div>
              <div className="mono text-[11px] text-muted-foreground">{failures.length} items</div>
            </div>

            <div className="max-h-[66vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Signals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failures.map((f) => {
                    const active = f.id === selectedId;
                    return (
                      <TableRow
                        key={f.id}
                        className={cn("cursor-pointer", active && "bg-accent")}
                        onClick={() => setLocation(`/repair/${f.id}`)}
                      >
                        <TableCell className="mono text-xs">{f.id}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{f.customer.email}</div>
                          <div className="text-xs text-muted-foreground">{f.merchant.name} · {f.decline.code}</div>
                        </TableCell>
                        <TableCell className="text-sm">{formatMoney(f.money.amount, f.money.currency)}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          {priorityBadge(f.priority)}
                          {actorBadge(f)}
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
              <div className="p-8 text-sm text-muted-foreground">No failure selected.</div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-border/60">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mono text-[11px] text-muted-foreground">CASE</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <div className="text-lg font-semibold">{selected.id}</div>
                        {priorityBadge(selected.priority)}
                        {actorBadge(selected)}
                        <Badge variant="outline" className="mono text-[10px]">
                          {selected.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {selected.decline.type.toUpperCase()} · {selected.decline.code} — {selected.decline.message}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(selected.id).catch(() => {});
                          toast.success("Copied case id");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                      <Button
                        onClick={() => toast.message("Coming soon", { description: "Live PSP actions are mocked in this demo." })}
                      >
                        <Wand2 className="h-4 w-4" />
                        Run playbook
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <Tabs defaultValue="recommendations">
                    <TabsList className="bg-background/40 border border-border/60">
                      <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                      <TabsTrigger value="governance">Governance</TabsTrigger>
                      <TabsTrigger value="audit">Audit trail</TabsTrigger>
                    </TabsList>

                    <TabsContent value="recommendations" className="mt-4">
                      <div className="grid gap-3">
                        {actions.map((a) => (
                          <Card key={a.id} className="p-4">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="font-medium">{a.label}</div>
                                  {riskBadge(a.risk)}
                                  {a.requiresApproval ? (
                                    <Badge variant="secondary" className="mono text-[10px]">APPROVAL</Badge>
                                  ) : (
                                    <Badge variant="outline" className="mono text-[10px]">AUTO-OK</Badge>
                                  )}
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">{a.rationale}</div>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                  <Badge variant="outline" className="mono text-[10px]">
                                    +{a.expectedUpliftPct}% expected uplift
                                  </Badge>
                                  <Badge variant="outline" className="mono text-[10px]">
                                    {a.expectedCostDeltaPct >= 0 ? "+" : ""}{a.expectedCostDeltaPct}% cost delta
                                  </Badge>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant={a.requiresApproval ? "secondary" : "default"}
                                  onClick={() => {
                                    const event: AuditEvent = {
                                      id: crypto.randomUUID(),
                                      at: new Date().toISOString(),
                                      actor: { type: "human", displayName: "ops@merchant.com" },
                                      kind: a.requiresApproval ? "APPROVED" : "EXECUTED",
                                      summary: a.requiresApproval
                                        ? `Approved action: ${a.label}`
                                        : `Executed action: ${a.label}`,
                                      details: { actionId: a.id },
                                    };
                                    setLocalAudit((prev) => ({
                                      ...prev,
                                      [selected.id]: [event, ...(prev[selected.id] ?? [])],
                                    }));
                                    toast.success(a.requiresApproval ? "Approved" : "Executed", {
                                      description: a.label,
                                    });
                                  }}
                                >
                                  {a.requiresApproval ? (
                                    <Clock className="h-4 w-4" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                  {a.requiresApproval ? "Approve" : "Execute"}
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}

                        {actions.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No recommendations for this case.</div>
                        ) : null}
                      </div>
                    </TabsContent>

                    <TabsContent value="governance" className="mt-4">
                      <GovernancePanel failure={selected} />
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
                                  <TableCell className="text-sm">
                                    {e.actor.displayName}
                                    {e.actor.type === "agent" ? (
                                      <span className="mono text-[10px] text-muted-foreground"> · agent</span>
                                    ) : null}
                                  </TableCell>
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

        <div className="mt-4 text-xs text-muted-foreground">
          Tip: this demo emphasizes governance primitives for agent-initiated payments (agent identity, mandate, intent receipt, step-up).
        </div>
      </div>
    </AppShell>
  );
}

function GovernancePanel({ failure }: { failure: PaymentFailure }) {
  const mandate = getMandate(failure.mandateId);
  const intent = getIntent(failure.intentReceiptId);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mono text-[11px] text-muted-foreground">AGENT IDENTITY</div>
            <div className="mt-1 font-medium">{failure.actorType === "agent" ? "Agent" : "Human"}</div>
            {failure.actorType === "agent" && failure.agent ? (
              <div className="mt-2 text-sm text-muted-foreground">
                <div className="mono">{failure.agent.vendor} · {failure.agent.agentId}</div>
                <div className="mono">v{failure.agent.version} · {failure.agent.runtime} · {failure.agent.keyId}</div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">No agent identity recorded.</div>
            )}
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
            <div className="mono text-[10px] text-muted-foreground">SCHEMA</div>
            <div className="mono text-[10px]">agent_id / vendor / version / runtime / key_id</div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mono text-[11px] text-muted-foreground">MANDATE GATE</div>
        {mandate ? (
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium">{mandate.id}</div>
              <Badge variant="outline" className="mono text-[10px]">v{mandate.version}</Badge>
              <Badge variant="secondary" className="mono text-[10px]">{mandate.scope.frequency.toUpperCase()}</Badge>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Principal: {mandate.principal.displayName} · Cap: {formatMoney(mandate.scope.maxAmountMinor, mandate.scope.currency)} · Expires in {daysUntil(mandate.scope.expiresAt)}d
            </div>
            <div className="mt-3 grid gap-2 text-xs">
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
                <span className="mono">Allowlist (merchants)</span>
                <span className="mono">{mandate.scope.merchantAllowlist.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
                <span className="mono">Step-up if amount over</span>
                <span className="mono">{formatMoney(mandate.riskThresholds.stepUpIfAmountOverMinor, mandate.scope.currency)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4 mt-0.5" />
            No mandate linked. For agentic payments, this reduces dispute defensibility.
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mono text-[11px] text-muted-foreground">INTENT RECEIPT</div>
        {intent ? (
          <div className="mt-2">
            <div className="font-medium">{intent.id}</div>
            <div className="mt-1 text-sm text-muted-foreground">Order: {intent.summary.orderId} · {formatMoney(intent.summary.amount.amount, intent.summary.amount.currency)}</div>
            <div className="mt-2 rounded-md border border-border/60 bg-background/40 p-3 text-sm">
              {intent.decisionSummary}
            </div>
            <div className="mt-2 text-xs text-muted-foreground mono">Hashed fields: {intent.fieldsHashed.join(", ")}</div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">No intent receipt recorded.</div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mono text-[11px] text-muted-foreground">STEP-UP STATUS</div>
        <div className="mt-2">
          {failure.stepUp ? (
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
              <div className="text-sm">
                <div className="font-medium">{failure.stepUp.status.replaceAll("_", " ")}</div>
                <div className="mono text-[10px] text-muted-foreground">{failure.stepUp.method ?? "-"}</div>
              </div>
              <Badge variant={failure.stepUp.status === "pending" ? "secondary" : "outline"}>
                {failure.stepUp.status}
              </Badge>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No step-up record.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
