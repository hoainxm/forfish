"use client";

// TRỢ LÝ — GOM DỮ LIỆU MÁY MỘT LẦN MỖI CÂU HỎI (14 §5.1, §9.1).
//
// `gomSnapshot(route)` đồng bộ, KHÔNG fetch, KHÔNG ném: mỗi nguồn bọc try/catch
// riêng, hỏng → `null` của nguồn đó (khác mảng rỗng = có bản, rỗng thật).
// Chỉ đọc lib có sẵn — đây là file DUY NHẤT trong `lib/assistant` được import
// module "use client" (sea, cart, inbox, orders-cache…); lib thuần nhận
// `DeviceSnapshot` làm tham số.
//
// LUẬT RIÊNG TƯ (14 luật 6): chỉ số đếm, nhãn loại, hạn, mốc lưu. KHÔNG CCCD,
// SĐT, STK, tên thuyền viên, số giấy tờ, ghi chú tự do, toạ độ điểm ghim.
// `stripForServer` cắt thêm trước khi gửi (bỏ SĐT shop, tên tàu, cắt 3 ngày).
//
// Danh tính: `offlineIdentityPhone()` — KHÔNG cầm `user` từ `useAuthUser()`
// (identity-gate.test.ts), không gọi rememberIdentity/forgetIdentity.

import { CREW_STORAGE_KEY } from "@/components/crew-list";
import { loadDocs } from "@/components/document-vault";
import { getDueStatus, loadEntries } from "@/components/maintenance-reminders";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { PORTS } from "@/data/ports";
import { loadBoats, loadCurrentBoatId } from "@/lib/boats";
import { crewIssue, type CrewMember } from "@/lib/crew";
import { getExpiryStatus, kindLabel } from "@/lib/documents";
import { haversineKm } from "@/lib/geo";
import { loadForecast } from "@/lib/forecast-cache";
import type { FuelPrice } from "@/lib/fuel-price";
import { chuaDocIds, loadHidden, loadInbox, loadSeen, locTinAn } from "@/lib/inbox";
import { demChuaDocTrongMay } from "@/lib/kairos/chuong";
import { coHoanTacDangHien } from "@/lib/toast";
import { loadMarketCart } from "@/lib/market/cart";
import { loadCachedMarketOrders } from "@/lib/market/orders-cache";
import { offlineIdentityPhone } from "@/lib/offline-identity";
import { homeOf, loadPlaces } from "@/lib/places";
import type { LivePriceResult } from "@/lib/port-price-source";
import { loadHome } from "@/lib/region";
import { readSeaCache } from "@/lib/sea";
import { STORM_ID, STORM_NS, type StormCheck } from "@/lib/storms";
import { effectivePremiumMark, readPremiumMark, readTierMarkRaw, readTierUntilRaw } from "@/lib/tier";
import { isOffline } from "@/lib/use-online";
import { readUserList } from "@/lib/user-list-store";
import type { DeviceSnapshot, DocSummary, MaintenanceSummary, OrderSummary, SeaDaySummary } from "./types";

const NAME_MAX = 40;
export const SNAPSHOT_MAX_BYTES = 8 * 1024;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const cut = (s: string, n = NAME_MAX) => (s.length > n ? s.slice(0, n) : s);

function homeOfDevice(): DeviceSnapshot["home"] {
  const h = loadHome();
  if (h.portId) {
    const p = PORTS.find((x) => x.id === h.portId) ?? FISHING_PORTS.find((x) => x.id === h.portId);
    if (p) return { portId: p.id, portName: p.name, province: p.province ?? h.province ?? "" };
  }
  const place = homeOf(loadPlaces());
  if (place) {
    const p = PORTS.find((x) => x.name === place.name) ?? FISHING_PORTS.find((x) => x.name === place.name);
    if (p) return { portId: p.id, portName: p.name, province: p.province ?? h.province ?? "" };
  }
  return null;
}

function weatherOf(home: DeviceSnapshot["home"]): DeviceSnapshot["weather"] {
  if (!home) return null;
  const c = readSeaCache(home.portId);
  if (!c) return null;
  const days: SeaDaySummary[] = c.days.map((d) => ({
    date: d.date,
    score: d.score,
    level: d.level,
    waveMaxM: d.waveMaxM,
    waveEstimated: d.waveEstimated === true,
    windMaxKmh: d.windMaxKmh,
    gustMaxKmh: d.gustMaxKmh,
    precipMm: d.precipMm,
    wmoCode: d.wmoCode ?? null,
  }));
  return { portId: home.portId, portName: home.portName, savedAt: c.savedAt, days };
}

/** Toạ độ cảng theo id — hai danh sách, `PORTS` trước (đã kiểm với Marine API). */
function portLatLon(portId: string): { lat: number; lon: number } | null {
  const p = PORTS.find((x) => x.id === portId);
  if (p) return { lat: p.lat, lon: p.lon };
  const f = FISHING_PORTS.find((x) => x.id === portId);
  return f && f.lat != null && f.lng != null ? { lat: f.lat, lon: f.lng } : null;
}

/*  Khoảng cách bão → cảng nhà tính Ở ĐÂY, không ở `answer` (answer thuần, không
    được đọc danh sách toạ độ cảng). Bão `watch` ở Okinawa cách Quy Nhơn ~1.500
    km mà mở đầu mọi câu bằng "đừng ra khơi" thì bà con hết tin máy (P1-N3).
    Thiếu toạ độ (bản tin thiếu, hoặc chưa đặt cảng nhà) → bỏ trống, `answer`
    coi như GẦN. */
function stormOf(home: DeviceSnapshot["home"]): DeviceSnapshot["storm"] {
  const c = loadForecast<StormCheck>(STORM_NS, STORM_ID);
  if (!c) return null;
  const d = c.data;
  if (!d || !("ok" in d) || !d.ok) return { savedAt: c.savedAt, storms: [] };
  const at = home ? portLatLon(home.portId) : null;
  const storms = (d.storms ?? []).slice(0, 3).map((s) => ({
    name: cut(String(s.name ?? "")),
    kindLabel: s.kindLabel,
    windKmh: s.windKmh ?? null,
    alert: s.alert,
    lat: s.lat,
    lon: s.lon,
    ...(at && s.lat != null && s.lon != null
      ? { distanceKm: Math.round(haversineKm(at, { lat: s.lat, lon: s.lon })) }
      : {}),
  }));
  return { savedAt: c.savedAt, storms };
}

function boatOf(): { boat: DeviceSnapshot["boat"]; currentId: string | null } {
  const boats = loadBoats();
  if (boats.length === 0) return { boat: null, currentId: null };
  const cur = loadCurrentBoatId();
  const b = boats.find((x) => x.id === cur) ?? boats[0];
  return {
    boat: { name: cut(b.name), count: boats.length, names: boats.slice(0, 5).map((x) => cut(x.name)) },
    currentId: b.id,
  };
}

function docsOf(currentId: string | null, today: Date): DocSummary[] | null {
  const r = loadDocs();
  if (r.readFailed) return null;
  return r.docs
    .filter((d) => !currentId || !("boatId" in d) || (d as { boatId?: string }).boatId === currentId || !(d as { boatId?: string }).boatId)
    .map((d) => {
      const st = getExpiryStatus(d, today);
      return { label: kindLabel(d.kind), expiresOn: d.expiresOn ?? null, daysLeft: st.days, level: st.level };
    });
}

function maintenanceOf(currentId: string | null, today: Date): MaintenanceSummary[] | null {
  const r = loadEntries();
  if (r.readFailed) return null;
  return r.entries
    .filter((e) => !currentId || !e.boatId || e.boatId === currentId)
    .map((e) => {
      const st = getDueStatus(e, today);
      return { item: cut(e.item), dueOn: "", daysLeft: st.days, level: st.level };
    });
}

function crewOf(today: Date): DeviceSnapshot["crew"] {
  const r = readUserList<CrewMember>(CREW_STORAGE_KEY);
  if (!r.ok) return null;
  const list = Array.isArray(r.list) ? r.list : [];
  const issues = list.filter((m) => {
    const lv = crewIssue(m, today).level;
    return lv === "danger" || lv === "warn";
  }).length;
  return { count: list.length, issues };
}

function ordersOf(phone: string | null): DeviceSnapshot["orders"] {
  const c = loadCachedMarketOrders(phone);
  if (!c) return null;
  const items: OrderSummary[] = c.orders.slice(0, 5).map((o) => ({
    code: o.code,
    status: o.status,
    shopName: cut(o.shopName ?? ""),
    totalVnd: o.totalVnd,
    ...(o.shopPhone ? { shopPhone: o.shopPhone } : {}),
  }));
  return { savedAt: c.savedAt, items };
}

function fishPricesOf(): DeviceSnapshot["fishPrices"] {
  const c = loadForecast<LivePriceResult>("price", "port");
  if (!c?.data?.prices) return null;
  return {
    savedAt: c.savedAt,
    week: c.data.week ?? null,
    items: c.data.prices.slice(0, 12).map((p) => ({ species: cut(p.species), minVnd: p.minVnd, maxVnd: p.maxVnd })),
  };
}

function fuelOf(): DeviceSnapshot["fuel"] {
  const c = loadForecast<FuelPrice>("price", "fuel");
  if (!c?.data) return null;
  return { savedAt: c.savedAt, date: c.data.date, priceVnd: c.data.do005Zone1 };
}

/** Cùng công thức với huy hiệu "N chưa đọc" ở Trang chủ (inbox-section, TC-05): chưa có trong sổ ĐÃ THẤY + gửi trong 7 ngày,
 *  bỏ tin bà con đã ẩn. Trước đây đếm theo sổ "đã báo về máy chủ" — mất sóng cả chuyến thì số không bao giờ khớp màn. */
function inboxUnreadOf(phone: string | null, now: number): number {
  const msgs = locTinAn(loadInbox(phone), loadHidden(phone));
  if (msgs.length === 0) return 0;
  return chuaDocIds(msgs, loadSeen(phone), now).size;
}

/*  Số di động DUY NHẤT đang hiện nút Nhắn (Zalo) trên màn — thẻ tin / vựa đang mở (cơ cấu mới 2026-10-25, hợp đồng §B
    nhan_zalo). Đọc THẲNG các link `zalo.me/<số>` đang vẽ (lien-he.tsx vẽ nút Nhắn bằng link đó) thay vì bắt từng màn
    đăng ký số: màn nào có nút Nhắn là Sen Biển thấy. Có 0 hoặc ≥2 số ⇒ undefined (answer hướng dẫn chạm Nhắn). */
function soZaloDangMo(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const so = new Set<string>();
  for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="zalo.me/"]'))) {
    const m = /zalo\.me\/(\d{9,11})/.exec(a.href);
    if (m) so.add(m[1]);
    if (so.size > 1) return undefined;
  }
  return so.size === 1 ? [...so][0] : undefined;
}

/** Máy đã đăng ký chuông báo bão chưa — tra bất đồng bộ ở vỏ (service worker), ghi lại đây để snapshot đọc đồng bộ. null = chưa biết. */
let chuongBatNho: boolean | null = null;
export function nhoChuongBat(v: boolean): void {
  chuongBatNho = v;
}

function premiumOf(): boolean {
  return effectivePremiumMark(readPremiumMark(readTierMarkRaw()), readTierUntilRaw(), Date.now()) === "premium";
}

/** Gom một lần. Đồng bộ, không fetch, không ném. */
export function gomSnapshot(route: string): DeviceSnapshot {
  const now = Date.now();
  const today = new Date(now);
  const phone = safe(() => offlineIdentityPhone(), null);
  const home = safe(homeOfDevice, null);
  const { boat, currentId } = safe(boatOf, { boat: null, currentId: null });
  return {
    takenAt: now,
    route,
    online: !safe(isOffline, false),
    premium: safe(premiumOf, false),
    home,
    weather: safe(() => weatherOf(home), null),
    storm: safe(() => stormOf(home), null),
    tide: null, // nợ: bảng con nước cần file trạm đã tải + tính cực trị (tide-home-card), nối khi Trục 1 export hàm đọc trạm đã lưu đồng bộ
    boat,
    docs: safe(() => docsOf(currentId, today), null),
    maintenance: safe(() => maintenanceOf(currentId, today), null),
    crew: safe(() => crewOf(today), null),
    // nợ: giỏ chợ chỉ lưu productId (không tên) nên `titles` rỗng, câu trả lời chỉ đếm dòng — nối tên khi `forfish.mcart.v1` mang bản tra (`quote`) có tên món
    cart: safe(() => ({ lines: loadMarketCart(phone).length, titles: [] as string[] }), { lines: 0, titles: [] }),
    orders: safe(() => ordersOf(phone), null),
    fishPrices: safe(fishPricesOf, null),
    fuel: safe(fuelOf, null),
    inboxUnread: safe(() => inboxUnreadOf(phone, now), 0),
    placeNames: safe(() => loadPlaces().slice(0, 12).map((p) => cut(p.name)), []),
    // cơ cấu mới 2026-10-25 — chỉ ở client (stripForServer bỏ)
    kairosChuaDoc: safe(() => demChuaDocTrongMay(phone), 0),
    ...(safe(soZaloDangMo, undefined) ? { soZaloDangMo: safe(soZaloDangMo, undefined) } : {}),
    ...(chuongBatNho === null ? {} : { chuongBat: chuongBatNho }),
    coHoanTac: safe(coHoanTacDangHien, false),
  };
}

/* ───────────────── LỌC TRƯỚC KHI GỬI (14 §5.1, §9.1) ───────────────── */

function esc(s: string): string {
  return s.replace(/</g, "‹").replace(/>/g, "›");
}

/** Escape `<`/`>` trong MỌI chuỗi + sort key (cache máy chủ ổn định, không "đóng" được thẻ bọc). */
function scrub(v: unknown): unknown {
  if (typeof v === "string") return esc(cut(v));
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = scrub((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

/**
 * Bỏ SĐT shop, tên tàu (`boat.names`), cắt 3 ngày thời tiết, tên ≤40 ký tự,
 * ≤12 điểm, escape thẻ, sort key; ≤8 KB (vượt → bỏ dần fishPrices → tide → maintenance).
 */
export function stripForServer(s: DeviceSnapshot): DeviceSnapshot {
  const rest = { ...s };
  delete rest.soZaloDangMo; // SĐT đang hiện trên màn — CHỈ cho action client (14 luật 6: không gửi SĐT)
  const base: DeviceSnapshot = {
    ...rest,
    weather: s.weather ? { ...s.weather, days: s.weather.days.slice(0, 3) } : null,
    // Bão: giữ tên/loại/gió/mức (tin công khai), BỎ toạ độ — 13 §7.3 không gửi toạ độ,
    // và validate.ts cấm khoá lat/lon (bug UI bắt được 2026-09-06: máy có tin bão ⇒ 400).
    storm: s.storm
      ? { savedAt: s.storm.savedAt, storms: s.storm.storms.map(({ name, kindLabel, windKmh, alert }) => ({ name, kindLabel, windKmh, alert })) }
      : null,
    boat: s.boat ? { name: "", count: s.boat.count, names: [] } : null,
    orders: s.orders ? { ...s.orders, items: s.orders.items.map(({ code, status, shopName, totalVnd }) => ({ code, status, shopName, totalVnd })) } : null,
    cart: { lines: s.cart.lines, titles: s.cart.titles.slice(0, 3) },
    maintenance: s.maintenance ? s.maintenance.map((m) => ({ ...m, item: cut(m.item) })) : null,
    placeNames: s.placeNames.slice(0, 12),
  };
  let out = scrub(base) as DeviceSnapshot;
  const drops: (keyof DeviceSnapshot)[] = ["fishPrices", "tide", "maintenance"];
  for (const k of drops) {
    if (JSON.stringify(out).length <= SNAPSHOT_MAX_BYTES) break;
    out = { ...out, [k]: null };
  }
  return out;
}
