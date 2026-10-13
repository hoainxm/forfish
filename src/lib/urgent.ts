// Trục 3 + 4 — VIỆC SẮP ĐẾN HẠN (giấy tờ · bảo dưỡng · bạn thuyền · đồ SDVICO).
//
// Tách khỏi `components/urgent-strip.tsx` (2026-10-13) để HAI chỗ đọc chung
// MỘT luật: dải khẩn Trang chủ và bản tin mở đầu của chế độ Đang chạy
// (`lib/nav-voice/opening.ts`). Hai bản chép là hai câu khác nhau về cùng một
// tờ giấy. Thuần trừ `loadStored` (đọc localStorage, hỏng = rỗng, không ném).

import { BoatDocument, getExpiryStatus } from "@/lib/documents";
import { CrewMember, crewIssue } from "@/lib/crew";
import { getServiceDueStatus, type OwnedAssets } from "@/lib/owned-assets";
import { getWarrantyStatus } from "@/lib/products";
import { formatVnd } from "@/lib/format";
import { readUserList } from "@/lib/user-list-store";
import { SOON_DAYS_SERVICE, addDaysIso, daysUntil, todayIsoVN } from "@/lib/days";

// ── pillar storage keys (mirror the feature screens) ─────────────
const DOC_KEY = "forfish.documents.v1";
const MAINT_KEY = "forfish.maintenance.v1";
const CREW_KEY = "forfish.crew.v1";

// ── maintenance shape + status ────────────────────────────────────
// nợ: trần = 4 dòng phân nhánh chép từ maintenance-reminders.tsx (getDueStatus),
// nâng cấp = tách logic thuần sang src/lib/maintenance.ts rồi import ở cả 2 nơi
// (không import component tab Dịch vụ vào Trang chủ để khỏi kéo cả tab vào bundle).
export interface MaintenanceEntry {
  id: string;
  item: string;
  lastDone: string; // ISO date
  intervalDays: number;
  note?: string;
}

type MaintLevel = "overdue" | "soon" | "ok";
export function maintStatus(
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
export type Tone = "danger" | "warn";
export type Pillar = "giay_to" | "bao_duong" | "ban_thuyen" | "sdvico";

export interface UrgentItem {
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
export interface BoatCtx {
  /** có >1 tàu mới gắn nhãn (1 tàu thì nhãn thừa) */
  multi: boolean;
  /** boatId → tên tàu */
  nameOf: (boatId?: string) => string | undefined;
  /** id-món SDVICO → boatId đã gán */
  assign: Record<string, string>;
}

// deep-link ?tab= — nhắc việc rơi ĐÚNG tab, không rớt vào tab đầu (roadmap
// hội đồng UX 2026-06-11; Tabs đọc param trong ui/tabs.tsx)
export const PILLAR_TAG: Record<Pillar, { tag: string; href: string }> = {
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

export function computeUrgent(today: Date, boat: BoatCtx): UrgentItem[] {
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

