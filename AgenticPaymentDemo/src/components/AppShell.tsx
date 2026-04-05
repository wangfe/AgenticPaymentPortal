import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Shield, Wrench, Scale, Activity, Settings } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Wrench;
  comingSoon?: boolean;
};

const nav: NavItem[] = [
  { href: "/repair", label: "Payment Repair", icon: Wrench },
  { href: "/disputes", label: "Disputes", icon: Scale },
  { href: "/signals", label: "Signals", icon: Activity, comingSoon: true },
  { href: "/governance", label: "Governance", icon: Shield, comingSoon: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid">
      <div className="mx-auto max-w-[1480px] px-4 py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="vignette rounded-xl bg-card text-card-foreground border border-border/60">
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm mono text-muted-foreground">CONTROL PLANE</div>
                  <div className="text-lg font-semibold tracking-tight">Agentic Payments</div>
                </div>
                <div className="h-9 w-9 rounded-lg bg-sidebar-primary/20 border border-sidebar-primary/30" />
              </div>

              <div className="mt-4 space-y-1">
                {nav.map((item) => {
                  const active = location === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.comingSoon ? location : item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                        "hover:bg-accent hover:text-accent-foreground",
                        active && "bg-accent text-accent-foreground",
                        item.comingSoon && "opacity-70 cursor-not-allowed"
                      )}
                      onClick={(e) => {
                        if (item.comingSoon) e.preventDefault();
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.comingSoon ? (
                        <span className="mono text-[10px] text-muted-foreground">SOON</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-6 rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="mono text-[10px] text-muted-foreground">DEMO MODE</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Mock data only. Actions create audit events locally.
                </div>
              </div>
            </div>
          </aside>

          <main className="vignette rounded-xl bg-card text-card-foreground border border-border/60 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
