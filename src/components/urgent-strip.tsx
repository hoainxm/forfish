"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BoatDocument, getExpiryStatus } from "@/lib/documents";
import { CrewMember, crewIssue } from "@/lib/crew";
import {
  getServiceDueStatus,
  type OwnedAssets,
} from "@/lib/owned-assets";
import { getWarrantyStatus } from "@/lib/products";
import { formatVnd } from "@/lib/format";
import { loadBoats } from "@/lib/boats";
import { loadAssignments } from "@/lib/sdvico-assign";
import { readUserList } from "@/lib/user-list-store";
import {
  SOON_DAYS_SERVICE,
  addDaysIso,
  daysUntil,
  todayIsoVN,
} from "@/lib/days";
import { useTodayVN } from "@/lib/use-today";
import { useSdvicoAssets } from "@/lib/use-sdvico-assets";
import { readToken } from "@/lib/device-token-store";
import { useOnline } from "@/lib/use-online";
import { AlertIcon, ClockIcon, ChevronRightIcon } from "@/components/icons";

/*
  Việc cần làm ngay — one urgent strip spanning ALL pillars, not just giấy tờ.
  Reads the SAME localStorage the feature screens write, hydrates after mount
  (no read during render → no SSR mismatch), and renders nothing when there is
  nothing urgent so the home screen stays calm.

  2026-08-18 (audit thông báo): ngày theo lịch VN + ngưỡng chung (lib/days.ts),
  "hôm nay" tính lại khi app được đưa ra trước (S1), xếp theo NGÀY THẬT cho mọi
  loại (S3), đồ SDVICO qua hook cache dùng chung (S2), kho đọc hỏng coi như
  rỗng chứ không sập (T1).
*/

// ── pillar storage keys (mirror the feature screens) ─────────────
const DOC_KEY = "forfish.documents.v1";
const MAINT_KEY = "forfish.maintenance.v1";
const CREW_KEY = "forfish.crew.v1";

// ── maintenance shape + status ────────────────────────────────────
// nợ: trần = 4 dòng phân nhánh chép từ maintenance-reminders.tsx (getDueStatus),
// nâng cấp = tách logic thuần sang src/lib/maintenance.ts rồi import ở cả 2 nơi
// (không import component tab Dịch vụ vào Trang chủ để khỏi kéo cả tab vào bundle).
interface MaintenanceEntry {
  id: string;
  item: string;
  lastDone: string; // ISO date
  intervalDays: number;
  note?: string;
}

type MaintLevel = "overdue" | "soon" | "ok";
function maintStatus(
  entry: MaintenanceEntry,
  today: Date,
): { level: MaintLevel; days: number; label: string } {
  const days = daysUntil(addDaysIso(entry.lastDone, entry.intervalDays), today);
  if (days < 0)
    return { level: "overdue", days, label: `Quá hạn ${Math.abs(days)} ngày` };
  if (days === 0) return { level: "overdue", days, label: "Đến hạn hôm nay" };
  if (days <= SOON_DAYS_SERVICE)
    return { level: "soon", days, label: `Còn ${days} ngày` };
  return { level: "ok", days, label: `Còn ${days} ngày` };
}

// ── localStorage loader — KHÔNG seed demo, đọc hỏng / không phải mảng = rỗng ──
function loadStored<T>(key: string): T[] {
  const r = readUserList<T>(key);
  return r.ok && Array.isArray(r.list) ? r.list : [];
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
  /** tên tàu của việc này — chỉ set khi có >1 tàu (ba-spec 08 R6) */
  boatLabel?: string;
}

/** Bối cảnh tàu để gắn nhãn "việc của tàu nào" (R6). */
interface BoatCtx {
  /** có >1 tàu mới gắn nhãn (1 tàu thì nhãn thừa) */
  multi: boolean;
  /** boatId → tên tàu */
  nameOf: (boatId?: string) => string | undefined;
  /** id-món SDVICO → boatId đã gán */
  assign: Record<string, string>;
}

// deep-link ?tab= — nhắc việc rơi ĐÚNG tab, không rớt vào tab đầu (roadmap
// hội đồng UX 2026-06-11; Tabs đọc param trong ui/tabs.tsx)
const PILLAR_TAG: Record<Pillar, { tag: string; href: string }> = {
  giay_to: { tag: "Giấy tờ", href: "/tau?tab=giay-to" },
  bao_duong: { tag: "Bảo dưỡng", href: "/tau?tab=dich-vu" },
  ban_thuyen: { tag: "Bạn thuyền", href: "/nguoi" },
  sdvico: { tag: "SDVICO", href: "/tau?tab=dich-vu" },
};

/** Nhắc từ đồ SDVICO đồng bộ: nợ QUÁ HẠN, bảo hành sắp hết, kỳ dịch vụ.
 *  Nợ chưa tới hạn KHÔNG vào dải khẩn (chính sách 2026-08-18: không băng màu,
 *  chỉ hiện ở thẻ tab Dịch vụ). Export cho test. */
export function sdvicoUrgent(
  assets: OwnedAssets,
  today: Date,
  boat: BoatCtx,
): UrgentItem[] {
  const items: UrgentItem[] = [];
  const todayIso = todayIsoVN(today);
  // nhãn tàu cho 1 món SDVICO theo gán; chưa gán = của chung (không nhãn)
  const labelFor = (assetId: string) =>
    boat.multi ? boat.nameOf(boat.assign[assetId]) : undefined;

  for (const p of assets.payments) {
    if (p.dueOn == null || p.dueOn >= todayIso) continue;
    items.push({
      id: `sdv-pay-${p.orderCode}`,
      label: `Khoản ${formatVnd(p.amountVnd)} — đơn ${p.orderCode}`,
      status: "Nợ quá hạn, đóng sớm",
      tone: "danger",
      pillar: "sdvico",
      href: PILLAR_TAG.sdvico.href,
      days: daysUntil(p.dueOn, today),
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
        href: PILLAR_TAG.sdvico.href,
        days: s.days ?? 0,
        boatLabel: labelFor(pr.id),
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
        href: PILLAR_TAG.sdvico.href,
        days: s.days ?? 0,
        boatLabel: labelFor(sv.id),
      });
    }
  }

  return items;
}

function computeUrgent(today: Date, boat: BoatCtx): UrgentItem[] {
  const items: UrgentItem[] = [];
  const boatLabelOf = (boatId?: string) =>
    boat.multi ? boat.nameOf(boatId) : undefined;

  // 1. Giấy tờ — KHÔNG seed demo (hội đồng UX 2026-06-11): dải nhắc chỉ nói
  // việc THẬT người dùng tự ghi; cảnh báo đỏ giả ở màn hình đầu = mất tin.
  // Gom MỌI tàu, gắn nhãn tàu (ba-spec 08 R6 — nhắc đúng tàu nào).
  const docs = loadStored<BoatDocument & { boatId?: string }>(DOC_KEY);
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
        boatLabel: boatLabelOf(doc.boatId),
      });
    }
  }

  // 2. Bảo dưỡng
  const maint = loadStored<MaintenanceEntry & { boatId?: string }>(MAINT_KEY);
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
        boatLabel: boatLabelOf(entry.boatId),
      });
    }
  }

  // 3. Bạn thuyền — không seed demo (như trên); days = hạn gần nhất thật
  // ("chưa có bảo hiểm" = -1 theo crewIssue) — không còn -9999 (S3)
  const crew = loadStored<CrewMember>(CREW_KEY);
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
        days: s.days ?? 0,
      });
    }
  }

  return items;
}

/** sort: đỏ (danger) trước vàng (warn); trong cùng màu, ngày gần nhất trước.
 *  Export cho test. */
export function byUrgencyOrder(a: UrgentItem, b: UrgentItem): number {
  const toneRank = (t: Tone) => (t === "danger" ? 0 : 1);
  if (a.tone !== b.tone) return toneRank(a.tone) - toneRank(b.tone);
  return a.days - b.days;
}

const MAX_ROWS = 4;

export function UrgentStrip() {
  const { today } = useTodayVN();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<UrgentItem[]>([]);
  // "Còn N việc nữa" bấm là xòe đủ — không phải dòng chữ chết
  const [expanded, setExpanded] = useState(false);
  // đồ SDVICO qua cache module dùng chung với /tau (S2) — không fetch riêng,
  // và `noteResponse` bên trong hook soi được máy bị đá.
  const { status: sdvStatus, assets } = useSdvicoAssets();
  const [signedIn, setSignedIn] = useState(false);
  const online = useOnline();

  // Bối cảnh tàu để gắn nhãn "việc của tàu nào" (R6) — đọc sau mount.
  function buildBoatCtx(): BoatCtx {
    const boats = loadBoats();
    const names = new Map(boats.map((b) => [b.id, b.name] as const));
    return {
      multi: boats.length > 1,
      nameOf: (id) => (id ? names.get(id) : undefined),
      assign: loadAssignments(),
    };
  }

  // Hydrate from localStorage after mount only (avoids SSR/CSR mismatch).
  // `today` đổi (qua nửa đêm, app đưa ra trước) → tính lại.
  useEffect(() => {
    setItems(computeUrgent(today, buildBoatCtx()));
    setSignedIn(readToken() != null);
    setMounted(true);
  }, [today]);

  const sdvicoItems = useMemo(
    () => (assets ? sdvicoUrgent(assets, today, buildBoatCtx()) : []),
    [assets, today],
  );

  const all = useMemo(
    () => [...items, ...sdvicoItems].sort(byUrgencyOrder),
    [items, sdvicoItems],
  );

  if (!mounted) return null;

  /*  Không hỏi được đồ SDVICO (S2): chỉ nói khi ĐÃ đăng nhập và máy đang CÓ
      sóng mà vẫn hỏng — mất sóng thì bà con biết rồi, nhắc là "nhắc như cái
      máy" (chính sách 2026-08-18: mất sóng không phải tin). */
  const sdvicoNote = signedIn && sdvStatus === "error" && online;

  if (all.length === 0) {
    if (!sdvicoNote) return null;
    return (
      <p className="px-2 text-[0.875rem] text-foreground/65">
        Chưa hỏi được nợ/bảo hành bên SDVICO — sóng đang yếu, app sẽ thử lại.
      </p>
    );
  }

  const shown = expanded ? all : all.slice(0, MAX_ROWS);
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
                      <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 text-[0.75rem] font-bold text-foreground/70">
                        {PILLAR_TAG[item.pillar].tag}
                      </span>
                      {item.boatLabel && (
                        <span className="shrink-0 truncate rounded-md bg-navy/10 px-1.5 py-0.5 text-[0.75rem] font-bold text-navy">
                          {item.boatLabel}
                        </span>
                      )}
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
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex min-h-[3rem] w-full items-center justify-between border-t border-line bg-background px-4 text-[0.9375rem] font-bold text-sea active:bg-field"
          >
            Còn {rest} việc nữa — xem hết
            <ChevronRightIcon className="h-5 w-5 rotate-90" />
          </button>
        )}
        {sdvicoNote && (
          <p className="border-t border-line px-4 py-2 text-[0.875rem] text-foreground/65">
            Chưa hỏi được nợ/bảo hành bên SDVICO — sóng đang yếu, app sẽ thử lại.
          </p>
        )}
      </div>
    </section>
  );
}
