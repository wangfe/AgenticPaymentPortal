import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="p-5">
        <div>
          <div className="mono text-[11px] text-muted-foreground">CONFIG</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">Demo Settings</div>
          <div className="mt-1 text-sm text-muted-foreground">
            These toggles simulate enterprise controls: gradual delegation, audit exports, and circuit breakers.
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="font-medium">Gradual delegation</div>
            <div className="mt-1 text-sm text-muted-foreground">Switch between recommend-only and limited auto-execution.</div>
            <div className="mt-4 flex items-center justify-between">
              <div className="mono text-xs text-muted-foreground">AUTO-EXEC (LOW RISK)</div>
              <Switch
                defaultChecked
                onCheckedChange={(v) => toast.message("Updated", { description: v ? "Auto-exec enabled" : "Auto-exec disabled" })}
              />
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-medium">Circuit breaker</div>
            <div className="mt-1 text-sm text-muted-foreground">If anomaly spikes, automatically degrade to manual approvals.</div>
            <div className="mt-4 flex items-center justify-between">
              <div className="mono text-xs text-muted-foreground">AUTO-DEGRADE</div>
              <Switch
                defaultChecked
                onCheckedChange={(v) => toast.message("Updated", { description: v ? "Auto-degrade on" : "Auto-degrade off" })}
              />
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-medium">Audit export</div>
            <div className="mt-1 text-sm text-muted-foreground">Export audit events for compliance review (mock).</div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => toast.success("Exported", { description: "Mock audit export generated." })}
              >
                Export audit log
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-medium">Policy replay</div>
            <div className="mt-1 text-sm text-muted-foreground">Simulate policy changes on historical data (mock).</div>
            <div className="mt-4">
              <Button
                onClick={() => toast.message("Replay queued", { description: "Running replay on last 7 days (mock)." })}
              >
                Run replay
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
