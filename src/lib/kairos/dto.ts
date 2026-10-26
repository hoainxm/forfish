// KAIROS — HÀNG DB ⇒ DỮ LIỆU RA CLIENT (14 §7, AC21). THUẦN.
//
// Cửa DUY NHẤT từ hàng có `*_phone` sang DTO. Mọi route đọc Kairos đi qua đây ⇒ SĐT không bao
// giờ ra client: tác giả = `profileId` (uuid công khai); "mine" tính ở máy chủ bằng so SĐT rồi
// chỉ trả boolean. `kairos-dto.test.ts` soi JSON ra không chứa SĐT nào.

import { docXemTruoc } from "./xem-truoc-link";
import { docNhacTen } from "./nhac-ten";
import { xepDem, type CamXuc, type DemCamXuc } from "./cam-xuc";
import { laAgent } from "./agent-doi.mjs";
import { kiemDinhKem } from "./chinh-sach.mjs";
import { laTinNong } from "./phan-phoi";
import type { KairosAbout, KairosAuthor, KairosComment, KairosPost, KairosPostKind, KairosRegion } from "./types";

/** Hàng `kairos_profiles` (đủ cột route cần). */
export interface ProfileRow {
  id: string;
  phone: string;
  handle: string;
  avatar_path: string | null;
  show_boat: boolean;
  official: boolean;
}

/** Hàng `kairos_posts`. */
export interface PostRow {
  id: string;
  kind: KairosPostKind;
  author_phone: string | null;
  /** nguồn thu của bài báo — nhận tin nóng (phan-phoi.NGUON_NONG) */
  source_id?: string | null;
  outlet: string | null;
  url: string | null;
  title: string | null;
  body: string;
  summary: string | null;
  summary_by: "ai" | "rss" | null;
  cover_url: string | null;
  images: unknown;
  topic: string;
  regions: string[] | null;
  provinces: string[] | null;
  ports: string[] | null;
  reshare_of: string | null;
  pinned_until: string | null;
  hay_count: number;
  comment_count: number;
  published_at: string;
  edited_at: string | null;
  /** 0071 */
  mentions?: unknown;
  /** 0074 — file đính kèm thông báo gov; cột chưa có ⇒ undefined */
  attachments?: unknown;
}

/** Hàng `kairos_comments`. */
export interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_phone: string;
  body: string;
  hay_count: number;
  created_at: string;
  /** 0070 — cột chưa có ⇒ undefined */
  image_path?: string | null;
  link_preview?: unknown;
  /** 0071 */
  mentions?: unknown;
}

export interface DtoCtx {
  /** SĐT người xem (null = khách) — chỉ để tính `mine`, không bao giờ ra ngoài */
  viewer: string | null;
  /** hồ sơ theo SĐT */
  profiles: ReadonlyMap<string, ProfileRow>;
  /** dòng phụ theo SĐT ("Cảng X" / tên cơ sở) — route tính bằng `sublineFor` */
  sublines?: ReadonlyMap<string, string>;
  /** số hiệu tàu theo SĐT — chỉ dùng khi hồ sơ bật show_boat */
  boats?: ReadonlyMap<string, string>;
  /** đường kho ⇒ URL công khai (kairos-media) */
  mediaUrl: (path: string) => string;
  /** id bài / bình luận người xem đã bấm Hay */
  hayPosts?: ReadonlySet<string>;
  hayComments?: ReadonlySet<string>;
  /** cảm xúc của người xem + đếm theo loại (0069) — không có ⇒ 👍 'hay' + chỉ tổng */
  camXucPosts?: ReadonlyMap<string, CamXuc>;
  camXucComments?: ReadonlyMap<string, CamXuc>;
  demPosts?: ReadonlyMap<string, Partial<Record<CamXuc, number>>>;
  demComments?: ReadonlyMap<string, Partial<Record<CamXuc, number>>>;
}

/** Đếm theo loại cho một bài/bình luận: có số theo loại ⇒ dùng; không (cột chưa có / chưa nạp) ⇒ cả tổng là 👍. */
function demCua(m: Partial<Record<CamXuc, number>> | undefined, tong: number): DemCamXuc {
  const d = xepDem(m);
  return d.length ? d : tong > 0 ? [{ kind: "hay", n: tong }] : [];
}

/** Tác giả công khai. Không có hồ sơ (lỗi dữ liệu) ⇒ "Bà con" ẩn danh, KHÔNG lộ SĐT. */
export function authorDto(phone: string, ctx: DtoCtx): KairosAuthor {
  const p = ctx.profiles.get(phone);
  if (!p) return { profileId: "", handle: "Bà con", subline: "", avatarUrl: null, official: false };
  const a: KairosAuthor = {
    profileId: p.id,
    handle: p.handle,
    subline: ctx.sublines?.get(phone) ?? "",
    avatarUrl: p.avatar_path ? ctx.mediaUrl(p.avatar_path) : null,
    official: p.official,
  };
  const boat = p.show_boat ? ctx.boats?.get(phone) : undefined;
  if (boat) a.boatReg = boat;
  if (laAgent(phone)) a.isAgent = true;
  return a;
}

/** File đính kèm (0074) ⇒ trường `attachments` chỉ khi có phần tử hợp lệ (bản hỏng/cột chưa có ⇒ không trường). */
function dinhKem(raw: unknown): { attachments?: KairosPost["attachments"] } {
  const xs = kiemDinhKem(raw);
  return xs.length ? { attachments: xs } : {};
}

/** Cột trang cá nhân (0067) của một hồ sơ — vắng (cột chưa có) ⇒ undefined. */
export interface ProfileAboutRow {
  cover_path?: string | null;
  que_tinh?: string | null;
  nghe?: string | null;
  gioi_thieu?: string | null;
  home_port?: string | null;
}

/** Phần Giới thiệu + ảnh bìa ra client. Cột chưa có / rỗng ⇒ trường trống (không lỗi). */
export function aboutDto(p: ProfileAboutRow, mediaUrl: (path: string) => string): KairosAbout {
  return {
    coverUrl: p.cover_path ? mediaUrl(p.cover_path) : null,
    queTinh: p.que_tinh || null,
    nghe: p.nghe || null,
    gioiThieu: p.gioi_thieu ?? "",
    homePort: p.home_port || null,
  };
}

export function commentDto(r: CommentRow, ctx: DtoCtx): KairosComment {
  return {
    id: r.id,
    postId: r.post_id,
    parentId: r.parent_id,
    author: authorDto(r.author_phone, ctx),
    body: r.body,
    hayCount: r.hay_count,
    hayByMe: ctx.hayComments?.has(r.id) ?? false,
    myCamXuc: ctx.camXucComments?.get(r.id) ?? (ctx.hayComments?.has(r.id) ? "hay" : null),
    camXuc: demCua(ctx.demComments?.get(r.id), r.hay_count),
    createdAt: r.created_at,
    mine: !!ctx.viewer && r.author_phone === ctx.viewer,
    image: r.image_path ? ctx.mediaUrl(r.image_path) : null,
    link: docXemTruoc(r.link_preview),
    mentions: docNhacTen(r.mentions),
  };
}

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/**
 * `reshare`: hàng bài gốc khi `reshare_of` có và bài gốc còn hiện (route đã lọc ẩn/chặn);
 * `reshare_of` có mà không truyền ⇒ "Bài gốc không còn" (A11).
 */
export function postDto(
  r: PostRow,
  ctx: DtoCtx,
  extra: { topComments?: CommentRow[]; reshare?: PostRow | null } = {},
): KairosPost {
  const reshare = extra.reshare && r.reshare_of ? postDto({ ...extra.reshare, reshare_of: null }, ctx) : null;
  return {
    id: r.id,
    kind: r.kind,
    author: r.author_phone && r.kind !== "bao" ? authorDto(r.author_phone, ctx) : null,
    outlet: r.outlet,
    url: r.url,
    title: r.title,
    body: r.body,
    summary: r.summary,
    summaryBy: r.summary_by,
    coverUrl: r.cover_url,
    ...(r.kind === "bao" && laTinNong(r) ? { nong: true } : {}),
    ...(dinhKem(r.attachments)),
    images: strArr(r.images).map(ctx.mediaUrl),
    topic: r.topic,
    regions: (r.regions ?? []) as KairosRegion[],
    provinces: r.provinces ?? [],
    ports: r.ports ?? [],
    reshareOf: reshare,
    ...(r.reshare_of && !reshare ? { reshareGone: true } : {}),
    pinnedUntil: r.pinned_until,
    hayCount: r.hay_count,
    commentCount: r.comment_count,
    hayByMe: ctx.hayPosts?.has(r.id) ?? false,
    myCamXuc: ctx.camXucPosts?.get(r.id) ?? (ctx.hayPosts?.has(r.id) ? "hay" : null),
    camXuc: demCua(ctx.demPosts?.get(r.id), r.hay_count),
    topComments: (extra.topComments ?? []).map((c) => commentDto(c, ctx)),
    publishedAt: r.published_at,
    editedAt: r.edited_at,
    mine: !!ctx.viewer && r.author_phone === ctx.viewer,
    mentions: docNhacTen(r.mentions),
  };
}
