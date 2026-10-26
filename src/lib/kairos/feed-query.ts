// KAIROS — BỘ LỌC DÒNG TIN (14 §3.2, §3.8, §3.9, §7 feed/new-count, AC02/AC06/AC13/AC14). THUẦN.
//
// Một bộ lọc, HAI cách chạy: `postgrestFeedExpr` (Supabase, dựng chuỗi logic PostgREST) và
// `matchFeed` (kho file dev). Hai cách phải ra CÙNG một tập bài — test chạy cả hai trên một bộ
// hàng mẫu. Luật nền (luôn áp):
//   · bài ẩn không bao giờ lên (route đặt `.eq("hidden", false)`, matchFeed tự kiểm);
//   · bài báo CHỈ lên khi agent đã cho đạt (`mod_state='dat'`, AC24) và còn trong 30 ngày (A6);
//     bài bà con / Chính thức hiện ngay (đã qua lọc chữ ở route);
//   · bài của người mình đã chặn bị bỏ (AC15) — lọc ở MÁY CHỦ, không tin client.
//
// Hồ sơ đọc (thói quen) KHÔNG đi vào đây — Cảng tôi/Gần tôi chỉ gửi MÃ cảng/tỉnh (AC04).

import { isTopic, type Topic } from "./chu-de.mjs";
import { PROVINCE_IDS, regionsOfProvince } from "./khu-vuc.mjs";
import { decodeCursor, isAfterDesc, type Cursor } from "./cursor";
import { isChip, type ChipId } from "./thoi-quen";
import { SEA_REGIONS } from "./types";
import { isUuid } from "./validate";

/** Bài báo ở dòng tin bao lâu (A6). */
export const BAO_FEED_DAYS = 30;
export const BAO_FEED_MS = BAO_FEED_DAYS * 24 * 60 * 60 * 1000;
/** Thông báo nhà nước (topic chinh-sach, 14 §21): CHỈ văn bản từ 01/01/2026 (anh Long 2026-10-26: "chỉ lấy từ 2026 thôi, lấy xa
 *  quá nặng"), và không quá 365 ngày — quyết định hỗ trợ dầu/đủ điều kiện ra theo đợt vài tháng một, bà con tra tên cả tháng sau. */
export const CHINH_SACH_TU_ISO = "2026-01-01T00:00:00+07:00";
export const CHINH_SACH_FEED_DAYS = 365;
export const CHINH_SACH_FEED_MS = CHINH_SACH_FEED_DAYS * 24 * 60 * 60 * 1000;
/** Mốc "since" của bài chinh-sach tại `now`: muộn hơn giữa 01/01/2026 và now − 365 ngày. */
export const chinhSachSince = (now: number): string => new Date(Math.max(Date.parse(CHINH_SACH_TU_ISO), now - CHINH_SACH_FEED_MS)).toISOString();
/** "Có N bài mới" đếm tới đây thôi (14 §7 new-count). */
export const NEW_COUNT_CAP = 99;

export interface FeedFilter {
  /** bài báo cũ hơn mốc này không lên (ISO) */
  baoSince: string;
  /** thông báo chinh-sach cũ hơn mốc này không lên (ISO) — không có ⇒ dùng baoSince */
  chinhSachSince?: string;
  /** tab Chính sách theo TỈNH (14 §21c): chỉ bài gắn tỉnh này HOẶC không gắn tỉnh nào (cả nước) */
  tinhChinhSach?: string;
  topic?: Topic;
  /** bài gắn MỘT trong các cảng (Cảng tôi / Bến) */
  ports?: string[];
  /** Gần tôi: trùng tỉnh HOẶC trùng vùng biển */
  near?: { provinces: string[]; regions: string[] };
  /** chỉ bài của các SĐT này (Theo dõi / trang người dùng) — mảng rỗng = không bài nào */
  authors?: string[];
  /** bỏ bài của các SĐT này (người mình đã chặn) */
  excludeAuthors?: string[];
  cursor?: Cursor | null;
  /** chỉ bài LÊN dòng tin sau mốc này (new-count, theo feed_at — bài báo duyệt muộn vẫn được đếm) */
  newerThan?: string;
}

/** Hàng tối thiểu để lọc (khớp cột kairos_posts). */
export interface FilterableRow {
  id: string;
  kind: string;
  author_phone: string | null;
  topic: string;
  ports: string[] | null;
  provinces: string[] | null;
  regions: string[] | null;
  hidden: boolean;
  mod_state: string;
  published_at: string;
  feed_at: string;
}

/** Tham số URL đã đọc — `authorProfileId`/`theoDoi` route tự tra ra SĐT. */
export interface FeedParams {
  chip: ChipId;
  cursor: Cursor | null;
  topic?: Topic;
  ports?: string[];
  near?: { provinces: string[]; regions: string[] };
  authorProfileId?: string;
  theoDoi: boolean;
  /** chip chinh-sach + province= ⇒ lọc theo tỉnh (tỉnh nào xem tỉnh đó) */
  tinhChinhSach?: string;
}

const TOPIC_CHIPS = new Set<string>(["nghe-ca", "thoi-su", "phap-luat", "doi-song", "the-thao", "giai-tri", "kinh-te", "chinh-sach"]);
const PROVINCE_SET = new Set<string>(PROVINCE_IDS as readonly string[]);
const REGION_SET = new Set<string>(SEA_REGIONS);

/**
 * Đọc query của /api/kairos/feed và new-count. Mã lạ ⇒ lỗi 400 có mã (không đoán ý người gọi);
 * con trỏ hỏng ⇒ trang đầu (decodeCursor).
 * - `chip`: mặc định "moi". Chủ đề ⇒ lọc topic. "cang-toi" cần `port`. "gan-toi" cần `province`
 *   hoặc `region` (tỉnh tự suy ra vùng). "theo-doi" ⇒ route cần SĐT.
 * - `port` (không kèm chip cảng): Bến của cảng đó. `author` = profileId (trang người dùng).
 */
export function parseFeedParams(
  sp: URLSearchParams,
  portIds: ReadonlySet<string>,
): { ok: true; value: FeedParams } | { ok: false; code: "bad_chip" | "bad_port" | "bad_area" | "bad_author" } {
  const chipRaw = sp.get("chip") || "moi";
  if (!isChip(chipRaw)) return { ok: false, code: "bad_chip" };
  const chip = chipRaw;
  const out: FeedParams = { chip, cursor: decodeCursor(sp.get("cursor")), theoDoi: chip === "theo-doi" };

  if (TOPIC_CHIPS.has(chip) && isTopic(chip)) out.topic = chip;

  const port = sp.get("port");
  if (port != null && port !== "") {
    if (!portIds.has(port)) return { ok: false, code: "bad_port" };
    out.ports = [port];
  }
  if (chip === "cang-toi" && !out.ports) return { ok: false, code: "bad_port" };

  if (chip === "chinh-sach") {
    const prov = sp.get("province") || "";
    if (prov && !PROVINCE_SET.has(prov)) return { ok: false, code: "bad_area" };
    if (prov) out.tinhChinhSach = prov;
  }

  if (chip === "gan-toi") {
    const prov = sp.get("province") || "";
    const reg = sp.get("region") || "";
    if (prov && !PROVINCE_SET.has(prov)) return { ok: false, code: "bad_area" };
    if (reg && !REGION_SET.has(reg)) return { ok: false, code: "bad_area" };
    if (!prov && !reg) return { ok: false, code: "bad_area" };
    const regions = new Set<string>(reg ? [reg] : []);
    if (prov) for (const r of regionsOfProvince(prov) as string[]) regions.add(r);
    out.near = { provinces: prov ? [prov] : [], regions: [...regions] };
  }

  const author = sp.get("author");
  if (author != null && author !== "") {
    if (!isUuid(author)) return { ok: false, code: "bad_author" };
    out.authorProfileId = author.toLowerCase();
  }
  return { ok: true, value: out };
}

const overlap = (a: readonly string[] | null | undefined, b: readonly string[]) => !!a && a.some((x) => b.includes(x));

/** Kho file dev: hàng này có lên dòng tin theo bộ lọc không. ĐÚNG luật của postgrestFeedExpr. */
export function matchFeed(r: FilterableRow, f: FeedFilter): boolean {
  if (r.hidden) return false;
  if (r.kind === "bao") {
    if (r.mod_state !== "dat") return false;
    const moc = r.topic === "chinh-sach" && f.chinhSachSince ? f.chinhSachSince : f.baoSince;
    if (Date.parse(r.published_at) < Date.parse(moc)) return false;
  }
  if (f.topic && r.topic !== f.topic) return false;
  if (f.tinhChinhSach && (r.provinces?.length ?? 0) > 0 && !r.provinces!.includes(f.tinhChinhSach)) return false;
  if (f.ports && !overlap(r.ports, f.ports)) return false;
  if (f.near && !overlap(r.provinces, f.near.provinces) && !overlap(r.regions, f.near.regions)) return false;
  if (f.authors && (!r.author_phone || !f.authors.includes(r.author_phone))) return false;
  if (f.excludeAuthors?.length && r.author_phone && f.excludeAuthors.includes(r.author_phone)) return false;
  if (f.cursor && !isAfterDesc({ at: r.feed_at, id: r.id }, f.cursor)) return false;
  if (f.newerThan && !(Date.parse(r.feed_at) > Date.parse(f.newerThan))) return false;
  return true;
}

/** Giá trị trong cây logic PostgREST: bọc ngoặc kép (dấu `,` `.` `:` `()` là ký tự dành riêng). */
export function pgQuote(v: string): string {
  return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
/** Mảng Postgres `{a,b}` cho toán tử ov — phần tử đã là mã an toàn (đã kiểm danh mục). */
const pgArray = (xs: readonly string[]) => pgQuote(`{${xs.map((x) => x.replace(/[{},"\\]/g, "")).join(",")}}`);
const pgList = (xs: readonly string[]) => `(${xs.map(pgQuote).join(",")})`;

/**
 * Bộ lọc ⇒ MỘT biểu thức `and(...)` cho `.or(expr)` của supabase-js (một nhánh `or` = chính
 * nhánh đó). Gộp hết vào một tham số vì nhiều điều kiện cần OR lồng (bài báo, cursor, Gần tôi).
 * `authors` rỗng ⇒ null: bên gọi trả trang trống, khỏi gọi DB.
 * Không gồm `hidden=false` — bên gọi đặt `.eq("hidden", false)` để dùng chỉ mục partial.
 */
export function postgrestFeedExpr(f: FeedFilter): string | null {
  if (f.authors && f.authors.length === 0) return null;
  const cuaSo = f.chinhSachSince
    ? `or(published_at.gte.${pgQuote(f.baoSince)},and(topic.eq.chinh-sach,published_at.gte.${pgQuote(f.chinhSachSince)}))`
    : `published_at.gte.${pgQuote(f.baoSince)}`;
  const parts: string[] = [`or(kind.neq.bao,and(mod_state.eq.dat,${cuaSo}))`];
  if (f.topic) parts.push(`topic.eq.${f.topic}`);
  if (f.tinhChinhSach) parts.push(`or(provinces.ov.${pgArray([f.tinhChinhSach])},provinces.eq.${pgQuote("{}")})`);
  if (f.ports?.length) parts.push(`ports.ov.${pgArray(f.ports)}`);
  if (f.near) {
    const near: string[] = [];
    if (f.near.provinces.length) near.push(`provinces.ov.${pgArray(f.near.provinces)}`);
    if (f.near.regions.length) near.push(`regions.ov.${pgArray(f.near.regions)}`);
    if (!near.length) return null;
    parts.push(near.length === 1 ? near[0] : `or(${near.join(",")})`);
  }
  if (f.authors?.length) parts.push(`author_phone.in.${pgList(f.authors)}`);
  if (f.excludeAuthors?.length) parts.push(`or(author_phone.is.null,author_phone.not.in.${pgList(f.excludeAuthors)})`);
  if (f.cursor) {
    const at = pgQuote(f.cursor.at);
    parts.push(`or(feed_at.lt.${at},and(feed_at.eq.${at},id.lt.${f.cursor.id}))`);
  }
  if (f.newerThan) parts.push(`feed_at.gt.${pgQuote(f.newerThan)}`);
  return `and(${parts.join(",")})`;
}

/** Mốc "since" của new-count: ISO hợp lệ, không ở tương lai xa, không quá 30 ngày (đỡ đếm cả kho). */
export function parseSince(raw: string | null, now: number): string | null {
  if (!raw || raw.length > 40) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  const clamped = Math.min(Math.max(t, now - BAO_FEED_MS), now + 60_000);
  return new Date(clamped).toISOString();
}
