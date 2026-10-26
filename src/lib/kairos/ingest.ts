// KAIROS — NHẬN BÀI TỪ MÁY THU TIN (14 §9, AC17/AC18). THUẦN.
//
// Máy GPU đã chặn trùng + chủ quyền + gắn chủ đề/khu vực, nhưng máy chủ KHÔNG TIN và CHẠY LẠI
// đủ bộ bằng CÙNG hàm .mjs (lien-ket/chu-de/khu-vuc/chu-quyen): một máy thu cũ/lệch phiên bản
// không được đẩy tin trùng hay tin sai chủ quyền lên dòng tin. Bài vào kho ở `cho-kiem` — chỉ
// lên dòng tin khi agent kiểm duyệt cho đạt (AC24).

import { normalizeUrl, urlHash, titleNorm, isDupTitle, TITLE_DUP_WINDOW_MS } from "./lien-ket.mjs";
import { topicFor, isTopic } from "./chu-de.mjs";
import { tagArea } from "./khu-vuc.mjs";
import { chuQuyenFlag, chuQuyenFlagAll } from "./chu-quyen.mjs";
import { kiemDinhKem, laHostGov, laTinChoBaCon } from "./chinh-sach.mjs";
import { cleanText } from "./validate";
import type { DinhKem } from "./types";
import type { NewPost, SeenRow, SourceRow } from "./store";

export const INGEST_MAX_ITEMS = 50;
export const INGEST_MAX_SOURCES = 80;
export const RSS_SUMMARY_MAX = 300;

export interface IngestItem {
  sourceId: string;
  outlet: string;
  url: string;
  title: string;
  description: string;
  summary: string | null;
  summaryBy: "ai" | "rss";
  coverUrl: string | null;
  section: string;
  publishedAt: string | null;
  /** nguồn gov (14 §21): file đính kèm trên tên miền *.gov.vn — bài khác luôn [] */
  attachments: DinhKem[];
}

export interface IngestSource {
  id: string;
  outlet: string;
  feedUrl: string;
  section: string;
  topic: string;
  ok: boolean;
  error: string | null;
}

const ID_RE = /^[a-z0-9-]{2,60}$/;
const SECTION_RE = /^[a-z0-9-]{1,40}$/;

const txt = (v: unknown, max: number): string => {
  if (typeof v !== "string") return "";
  const t = cleanText(v.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
  return [...t].slice(0, max).join("");
};
const httpsUrl = (v: unknown): string | null => {
  if (typeof v !== "string" || v.length > 1000) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Gói POST /api/kairos/nhap. Mục hỏng bị BỎ (đếm vào `invalid`), không làm hỏng cả gói. */
export function parseIngestBody(raw: unknown):
  | { ok: true; items: IngestItem[]; sources: IngestSource[]; invalid: number }
  | { ok: false; code: string } {
  if (!raw || typeof raw !== "object") return { ok: false, code: "bad_body" };
  const r = raw as Record<string, unknown>;
  const itemsRaw = r.items ?? [];
  const sourcesRaw = r.sources ?? [];
  if (!Array.isArray(itemsRaw) || !Array.isArray(sourcesRaw)) return { ok: false, code: "bad_body" };
  if (itemsRaw.length > INGEST_MAX_ITEMS) return { ok: false, code: "too_many" };
  if (sourcesRaw.length > INGEST_MAX_SOURCES) return { ok: false, code: "too_many" };

  let invalid = 0;
  const items: IngestItem[] = [];
  for (const it of itemsRaw as unknown[]) {
    const x = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
    const sourceId = typeof x.sourceId === "string" && ID_RE.test(x.sourceId) ? x.sourceId : "";
    const outlet = txt(x.outlet, 60);
    const url = typeof x.url === "string" ? x.url.trim() : "";
    const title = txt(x.title, 300);
    const section = typeof x.section === "string" && SECTION_RE.test(x.section) ? x.section : "";
    if (!sourceId || [...outlet].length < 2 || !url || !title || !section) {
      invalid++;
      continue;
    }
    // TIN CHÍNH SÁCH (14 §21): section chinh-sach CHỈ từ tên miền *.gov.vn và CHỈ bài cho bà con đi biển — máy chủ
    // kiểm lại, máy thu cũ/lệch không đẩy được trang lạ vào tab Chính sách. File đính kèm chỉ nhận ở bài gov.
    const gov = laHostGov(url);
    const description = txt(x.description, 2000);
    if (section === "chinh-sach" && (!gov || !laTinChoBaCon(`${title}\n${description}`))) {
      invalid++;
      continue;
    }
    const pub = typeof x.publishedAt === "string" ? Date.parse(x.publishedAt) : NaN;
    items.push({
      sourceId,
      outlet,
      url,
      title,
      description,
      summary: txt(x.summary, 1000) || null,
      summaryBy: x.summaryBy === "ai" ? "ai" : "rss",
      coverUrl: httpsUrl(x.coverUrl),
      section,
      publishedAt: Number.isFinite(pub) ? new Date(pub).toISOString() : null,
      attachments: gov ? kiemDinhKem(x.attachments, { chiGov: true }) : [],
    });
  }

  const sources: IngestSource[] = [];
  for (const s of sourcesRaw as unknown[]) {
    const x = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const id = typeof x.id === "string" && ID_RE.test(x.id) ? x.id : "";
    const outlet = txt(x.outlet, 60);
    const feedUrl = httpsUrl(x.feedUrl);
    const section = typeof x.section === "string" && SECTION_RE.test(x.section) ? x.section : "";
    if (!id || [...outlet].length < 2 || !feedUrl || feedUrl.length > 500 || !section || !isTopic(x.topic)) {
      invalid++;
      continue;
    }
    sources.push({ id, outlet, feedUrl, section, topic: x.topic as string, ok: x.ok === true, error: txt(x.error, 500) || null });
  }
  return { ok: true, items, sources, invalid };
}

export interface IngestPlan {
  posts: NewPost[];
  seen: SeenRow[];
  stats: { nhan: number; trungLink: number; trungTieuDe: number; chuQuyen: number; linkHong: number };
}

type PortLike = { id: string; name: string; province?: string; active?: boolean };

/**
 * Xét từng mục: link hỏng ⇒ bỏ · trùng link (kho hoặc ngay trong gói) ⇒ bỏ · trùng tiêu đề 7
 * ngày ⇒ ghi `trung-tieu-de` · chủ quyền ở tiêu đề/mô tả ⇒ `loai-chu-quyen` · tóm tắt AI trúng
 * cờ ⇒ lùi về mô tả RSS (cắt 300) · còn lại ⇒ bài `bao` ở `cho-kiem`.
 */
export function planIngest(
  items: IngestItem[],
  ctx: {
    seenHashes: ReadonlySet<string>;
    recentTitles: { titleNorm: string; firstSeenAt: string }[];
    now: number;
    ports: readonly PortLike[];
  },
): IngestPlan {
  const stats = { nhan: 0, trungLink: 0, trungTieuDe: 0, chuQuyen: 0, linkHong: 0 };
  const posts: NewPost[] = [];
  const seen: SeenRow[] = [];
  const batchHashes = new Set<string>();
  const titles = [...ctx.recentTitles];
  const nowIso = new Date(ctx.now).toISOString();

  for (const it of items) {
    const url = normalizeUrl(it.url);
    const hash = urlHash(it.url);
    if (!url || !hash) {
      stats.linkHong++;
      continue;
    }
    if (ctx.seenHashes.has(hash) || batchHashes.has(hash)) {
      stats.trungLink++;
      continue;
    }
    batchHashes.add(hash);
    const tNorm = titleNorm(it.title);
    if (isDupTitle(tNorm, titles, ctx.now)) {
      stats.trungTieuDe++;
      seen.push({ url_hash: hash, title_norm: tNorm, source_id: it.sourceId, outcome: "trung-tieu-de", flag_term: null });
      continue;
    }
    const flag = chuQuyenFlagAll(it.title, it.description);
    if (flag) {
      stats.chuQuyen++;
      seen.push({ url_hash: hash, title_norm: tNorm, source_id: it.sourceId, outcome: "loai-chu-quyen", flag_term: flag.slice(0, 100) });
      continue;
    }
    let summary = it.summary;
    let summaryBy: "ai" | "rss" = it.summaryBy;
    if (!summary || chuQuyenFlag(summary)) {
      summary = [...it.description].slice(0, RSS_SUMMARY_MAX).join("") || null;
      summaryBy = "rss";
    }
    const text = `${it.title}\n${it.description}`;
    // thông báo gov: tên cơ quan ("UBND tỉnh Gia Lai") cũng nói tỉnh nào — đưa vào chữ gắn khu vực
    const area = tagArea(`${it.title}\n${summary ?? it.description}${it.section === "chinh-sach" ? `\n${it.outlet}` : ""}`, { ports: ctx.ports });
    const pub = it.publishedAt && Date.parse(it.publishedAt) <= ctx.now + 60 * 60 * 1000 ? it.publishedAt : nowIso;
    // tin cũ hơn cửa sổ trùng tiêu đề vẫn nhận, nhưng giờ đăng không được xa hơn 1 năm (RSS lỗi giờ)
    const published = Date.parse(pub) < ctx.now - 365 * 24 * 60 * 60 * 1000 ? nowIso : pub;
    posts.push({
      kind: "bao",
      author_phone: null,
      source_id: it.sourceId,
      outlet: it.outlet,
      url,
      url_hash: hash,
      title: it.title,
      title_norm: tNorm,
      body: "",
      summary,
      summary_by: summary ? summaryBy : null,
      cover_url: it.coverUrl,
      images: [],
      ...(it.attachments.length ? { attachments: it.attachments } : {}),
      topic: topicFor(it.section, text),
      regions: area.regions,
      provinces: area.provinces,
      ports: area.ports.slice(0, 10),
      reshare_of: null,
      mod_state: "cho-kiem",
      published_at: published,
    });
    seen.push({ url_hash: hash, title_norm: tNorm, source_id: it.sourceId, outcome: "nhan", flag_term: null });
    if (tNorm) titles.push({ titleNorm: tNorm, firstSeenAt: nowIso });
    stats.nhan++;
  }
  return { posts, seen, stats };
}

/** Mốc đầu cửa sổ trùng tiêu đề. */
export function titleWindowStart(now: number): string {
  return new Date(now - TITLE_DUP_WINDOW_MS).toISOString();
}

/** Nguồn ⇒ hàng kairos_sources (last_ok_at/last_error theo lượt này). */
export function sourceRows(sources: IngestSource[], nowIso: string): SourceRow[] {
  return sources.map((s) => ({
    id: s.id,
    outlet: s.outlet,
    feed_url: s.feedUrl,
    section: s.section,
    topic: s.topic,
    ...(s.ok ? { last_ok_at: nowIso, last_error: null } : { last_error: s.error ?? "lỗi không rõ" }),
  }));
}
