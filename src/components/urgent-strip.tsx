"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BoatDocument,
  demoDocuments,
  getExpiryStatus,
} from "@/lib/documents";
import { CrewMember, crewIssue, demoCrew } from "@/lib/crew";
import {
  getServiceDueStatus,
  type OwnedAssets,
} from "@/lib/owned-assets";
import { getWarrantyStatus } from "@/lib/products";
import { formatVnd } from "@/lib/format";
import { AlertIcon, ClockIcon, ChevronRightIcon } from "@/components/icons";

/*
  Việc cần làm ngay — one urgent strip spanning ALL pillars, not just giấy tờ.
  Reads the SAME localStorage the feature screens write, hydrates after mount
  (no read during render → no SSR mismatch), and renders nothing when there is
  nothing urgent so the home screen stays calm.
*/

// ── pillar storage keys (mirror the feature screens) ─────────────
const DOC_KEY = "forfish.documents.v1";
const MAINT_KEY = "forfish.maintenance.v1";
const CREW_KEY = "forfish.crew.v1";

// ── maintenance shape + status (replicated from maintenance-reminders.tsx) ──
interface MaintenanceEntry {
  id: string;
  item: string;
  lastDone: string; // ISO date
  intervalDays: number;
  note?: string;
}

const MAINT_SOON_DAYS = 7;

function daysUntil(isoDate: string, today: Date): number {
  const target = new Date(isoDate + "T00:00:00Z");
  const base = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((target.getTime() - base) / 86_400_000);
}

function maintDueDate(entry: MaintenanceEntry): string {
  const d = new Date(entry.lastDone + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + entry.intervalDays);
  return d.toISOString().slice(0, 10);
}

type MaintLevel = "overdue" | "soon" | "ok";
function maintStatus(
  entry: MaintenanceEntry,
  today: Date,
): { level: MaintLevel; days: number; label: string } {
  const days = daysUntil(maintDueDate(entry), today);
  if (days < 0)
    return { level: "overdue", days, label: `Quá hạn ${Math.abs(days)} ngày` };
  if (days === 0) return { level: "soon", days, label: "Đến hạn hôm nay" };
  if (days <= MAINT_SOON_DAYS)
    return { level: "soon", days, label: `Còn ${days} ngày` };
  return { level: "ok", days, label: `Còn ${days} ngày` };
}

// ── generic localStorage loader (mirrors each screen's loadX) ────
function loadStored<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
  } catch {
    // corrupt storage — fall through to demo seed
  }
  return seed;
}

// ── unified urgent item ──────────────────────────────────────────
type Tone = "danger" | "warn";
type Pillar = "giay_to" | "bao_duong" | "ban_thuyen" | "sdvico";

interface UrgentItem {
  id: string;
  label: string;
  status: string;
  tone: Tone;
  pillar: Pillar;
  href: string;
  /** signed days until due/expiry; lower = sooner. */
  days: number;
}

const PILLAR_TAG: Record<Pillar, { tag: string; href: string }> = {
  giay_to: { tag: "Giấy tờ", href: "/tau" },
  bao_duong: { tag: "Bảo dưỡng", href: "/tau" },
  ban_thuyen: { tag: "Bạn thuyền", href: "/nguoi" },
  sdvico: { tag: "SDVICO", href: "/tau" },
};

/** Nhắc từ đồ SDVICO đồng bộ: nợ/cước chờ đóng, bảo hành sắp hết, kỳ dịch vụ. */
function sdvicoUrgent(assets: OwnedAssets, today: Date): UrgentItem[] {
  const items: UrgentItem[] = [];
  const todayIso = today.toISOString().slice(0, 10);

  for (const p of assets.payments) {
    const overdue = p.dueOn != null && p.dueOn < todayIso;
    items.push({
      id: `sdv-pay-${p.orderCode}`,
      label: `Khoản ${formatVnd(p.amountVnd)} — đơn ${p.orderCode}`,
      status: overdue ? "Nợ quá hạn, đóng sớm" : "Chờ thanh toán",
      tone: overdue ? "danger" : "warn",
      pillar: "sdvico",
      href: "/tau",
      days: p.dueOn ? daysUntil(p.dueOn, today) : 0,
    });
  }

  for (const pr of assets.products) {
    const s = getWarrantyStatus(pr, today);
    if (s.level === "expired" || s.level === "soon") {
      items.push({
        id: `sdv-wr-${pr.id}`,
        label: pr.name,
        status: s.label,
        tone: s.level === "expired" ? "danger" : "warn",
        pillar: "sdvico",
        href: "/tau",
        days: s.days ?? 0,
      });
    }
  }

  for (const sv of assets.services) {
    const s = getServiceDueStatus(sv, today);
    if (s.level === "overdue" || s.level === "soon") {
      items.push({
        id: `sdv-svc-${sv.id}`,
        label: sv.name,
        status: s.label,
        tone: s.level === "overdue" ? "danger" : "warn",
        pillar: "sdvico",
        href: "/tau",
        days: s.days ?? 0,
      });
    }
  }

  return items;
}

function computeUrgent(today: Date): UrgentItem[] {
  const items: UrgentItem[] = [];

  // 1. Giấy tờ
  const docs = loadStored<BoatDocument>(DOC_KEY, demoDocuments(today));
  for (const doc of docs) {
    const s = getExpiryStatus(doc, today);
    if (s.level === "expired" || s.level === "soon") {
      items.push({
        id: `doc-${doc.id}`,
        label: doc.label,
        status: s.label,
        tone: s.level === "expired" ? "danger" : "warn",
        pillar: "giay_to",
        href: PILLAR_TAG.giay_to.href,
        days: s.days ?? 0,
      });
    }
  }

  // 2. Bảo dưỡng
  const maint = loadStored<MaintenanceEntry>(MAINT_KEY, []);
  for (const entry of maint) {
    const s = maintStatus(entry, today);
    if (s.level === "overdue" || s.level === "soon") {
      items.push({
        id: `maint-${entry.id}`,
        label: entry.item,
        status: s.label,
        tone: s.level === "overdue" ? "danger" : "warn",
        pillar: "bao_duong",
        href: PILLAR_TAG.bao_duong.href,
        days: s.days,
      });
    }
  }

  // 3. Bạn thuyền
  const crew = loadStored<CrewMember>(CREW_KEY, demoCrew(today));
  for (const m of crew) {
    const s = crewIssue(m, today);
    if (s.level === "danger" || s.level === "warn") {
      items.push({
        id: `crew-${m.id}`,
        label: m.name,
        status: s.label,
        tone: s.level === "danger" ? "danger" : "warn",
        pillar: "ban_thuyen",
        href: PILLAR_TAG.ban_thuyen.href,
        days: s.level === "danger" ? -9999 : 0,
      });
    }
  }

  return items;
}

// sort: đỏ (danger) first, then vàng (warn); within tone soonest first.
function byUrgencyOrder(a: UrgentItem, b: UrgentItem): number {
  const toneRank = (t: Tone) => (t === "danger" ? 0 : 1);
  if (a.tone !== b.tone) return toneRank(a.tone) - toneRank(b.tone);
  return a.days - b.days;
}

const MAX_ROWS = 4;

export function UrgentStrip() {
  const today = useMemo(() => new Date(), []);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<UrgentItem[]>([]);
  const [sdvicoItems, setSdvicoItems] = useState<UrgentItem[]>([]);

  // Hydrate from localStorage after mount only (avoids SSR/CSR mismatch).
  useEffect(() => {
    setItems(computeUrgent(today));
    setMounted(true);
  }, [today]);

  // Nhắc từ đồ SDVICO (đăng nhập rồi mới có) — đến sau cũng không sao.
  useEffect(() => {
    let alive = true;
    fetch("/api/me/sdvico", { signal: AbortSignal.timeout(20000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.ok && j.assets) {
          setSdvicoItems(sdvicoUrgent(j.assets as OwnedAssets, today));
        }
      })
      .catch(() => {
        // chưa đăng nhập / chưa cấu hình → chỉ nhắc đồ trên máy
      });
    return () => {
      alive = false;
    };
  }, [today]);

  const all = useMemo(
    () => [...items, ...sdvicoItems].sort(byUrgencyOrder),
    [items, sdvicoItems],
  );

  if (!mounted || all.length === 0) return null;

  const shown = all.slice(0, MAX_ROWS);
  const rest = all.length - shown.length;

  return (
    <section aria-label="Việc cần làm ngay">
      <h2 className="display mb-1.5 px-1 text-[1rem] font-bold text-navy">
        Việc cần làm ngay
      </h2>
      <div className="overflow-hidden surface">
        <ul>
          {shown.map((item, i) => {
            const Icon = item.tone === "danger" ? AlertIcon : ClockIcon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3.5 transition active:bg-background ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <span
                    className={`flex h-3 w-3 shrink-0 rounded-full ${
                      item.tone === "danger" ? "bg-danger" : "bg-warn"
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block min-w-0 truncate text-[1.125rem] font-semibold">
                        {item.label}
                      </span>
                      <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 text-[0.75rem] font-bold text-foreground/55">
                        {PILLAR_TAG[item.pillar].tag}
                      </span>
                    </span>
                    <span
                      className={`flex items-center gap-1 text-[0.9375rem] font-bold ${
                        item.tone === "danger" ? "text-danger" : "text-warn"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.status}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/30" />
                </Link>
              </li>
            );
          })}
        </ul>
        {rest > 0 && (
          <p className="border-t border-line bg-background px-4 py-2.5 text-[0.9375rem] font-bold text-foreground/60">
            Còn {rest} việc nữa
          </p>
        )}
      </div>
    </section>
  );
}
