import "server-only";
// KAIROS — HỢP ĐỒNG KHO (khuôn market/store.ts). Hai bản: supabase-store.ts (prod, bảng 0065 +
// bucket kairos-media) · file-store.ts (dev, `.local/kairos-dev.json`, chỉ khi isDevFileMode).
//
// LUẬT: adapter KHÔNG chứa nghiệp vụ — nhận dữ liệu đã kiểm (lib/kairos/validate.ts…) rồi
// đọc/ghi. Hàng ở đây CÓ SĐT; route đổi sang DTO qua dto.ts trước khi trả ra (AC21).
// Lỗi ném KairosError (errors.ts). Không nuốt lỗi ghi.

import type { FeedFilter } from "./feed-query";
import type { CommentRow, PostRow, ProfileRow } from "./dto";
import type { Cursor } from "./cursor";
import type { KairosPostKind, ReportReason } from "./types";

export type ModState = "cho-kiem" | "dat" | "nghi" | "chan";
export type TargetType = "post" | "comment";

export interface ProfileFull extends ProfileRow {
  handle_norm: string;
  handle_changed_at: string | null;
  rules_accepted_at: string | null;
  banned_until: string | null;
  ban_reason: string | null;
  created_at: string;
}

export interface PostFull extends PostRow {
  source_id: string | null;
  url_hash: string | null;
  title_norm: string | null;
  hidden: boolean;
  hidden_reason: string | null;
  mod_state: ModState;
  mod_checked_at: string | null;
  /** giờ bài lên dòng tin — khoá xếp/cursor/new-count (bài báo: lúc được cho đạt) */
  feed_at: string;
  created_at: string;
}

export interface CommentFull extends CommentRow {
  hidden: boolean;
  mod_state: ModState;
  mod_checked_at: string | null;
}

export interface NewPost {
  kind: KairosPostKind;
  author_phone: string | null;
  body: string;
  images: string[];
  topic: string;
  regions: string[];
  provinces: string[];
  ports: string[];
  reshare_of: string | null;
  pinned_until?: string | null;
  mod_state?: ModState;
  // chỉ bài báo
  source_id?: string | null;
  outlet?: string | null;
  url?: string | null;
  url_hash?: string | null;
  title?: string | null;
  title_norm?: string | null;
  summary?: string | null;
  summary_by?: "ai" | "rss" | null;
  cover_url?: string | null;
  published_at?: string;
}

export type PostPatch = Partial<
  Pick<
    PostFull,
    "body" | "images" | "topic" | "regions" | "provinces" | "ports" | "edited_at" | "pinned_until" | "hidden" | "hidden_reason" | "mod_state" | "mod_checked_at" | "feed_at"
  >
>;
export type CommentPatch = Partial<Pick<CommentFull, "hidden" | "mod_state" | "mod_checked_at">>;
export type ProfilePatch = Partial<
  Pick<ProfileFull, "handle" | "handle_norm" | "handle_changed_at" | "avatar_path" | "show_boat" | "rules_accepted_at" | "banned_until" | "ban_reason">
>;

export interface ReportRow {
  id: string;
  target_type: TargetType;
  target_id: string;
  reporter_phone: string;
  reason: ReportReason;
  note: string | null;
  status: "moi" | "da-an" | "bo-qua";
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface DecisionRow {
  id: number;
  target_type: TargetType;
  target_id: string;
  decided_by: "agent" | "staff";
  actor: string;
  verdict: "dat" | "nghi" | "chan";
  reason: string | null;
  score: number | null;
  rules_version: string | null;
  model: string | null;
  overrides: number | null;
  created_at: string;
}
export type NewDecision = Omit<DecisionRow, "id" | "created_at">;

export interface SeenRow {
  url_hash: string;
  title_norm: string | null;
  source_id: string | null;
  outcome: "nhan" | "trung-tieu-de" | "loai-chu-quyen" | "loi";
  flag_term: string | null;
  first_seen_at?: string;
}

export interface SourceRow {
  id: string;
  outlet: string;
  feed_url: string;
  section: string;
  topic: string;
  enabled?: boolean;
  last_ok_at?: string | null;
  last_error?: string | null;
}

export interface AuditRow {
  actor: string;
  actor_kind: "ba-con" | "staff" | "he-thong";
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  detail?: Record<string, unknown>;
  ip?: string | null;
}

/** Bảng đếm tần suất theo SĐT (A1) — đếm TRONG KHO, vì Vercel nhiều instance. */
export type RateTable = "posts" | "comments" | "reports" | "follows+blocks";

export interface KairosStore {
  // ── Hồ sơ ────────────────────────────────────────────────────────────
  profileByPhone(phone: string): Promise<ProfileFull | null>;
  profileById(id: string): Promise<ProfileFull | null>;
  profilesByPhones(phones: string[]): Promise<ProfileFull[]>;
  /** khoá handle_norm nào trong danh sách đã có người dùng */
  takenNorms(norms: string[]): Promise<Set<string>>;
  /** trùng handle_norm ⇒ KairosError('handle_taken'); trùng phone (hai lượt chen) ⇒ trả hồ sơ có sẵn */
  createProfile(row: { phone: string; handle: string; handle_norm: string }): Promise<ProfileFull>;
  /** trùng handle_norm ⇒ 'handle_taken'; không có ⇒ 'not_found' */
  updateProfile(phone: string, patch: ProfilePatch): Promise<ProfileFull>;
  /** tên khách hàng (customers.name) cho tên mặc định — không có ⇒ null */
  customerName(phone: string): Promise<string | null>;
  /** sổ tàu đồng bộ (user_docs kind='boats') theo SĐT — dòng phụ + số hiệu tàu */
  boatsOf(phones: string[]): Promise<Map<string, unknown>>;
  /** tên cơ sở bên mua (vựa/nậu/nhà máy/chợ) theo SĐT — tin cần mua mới nhất ở market_listings */
  buyerNamesOf(phones: string[]): Promise<Map<string, string>>;

  // ── Bài ──────────────────────────────────────────────────────────────
  /** theo (feed_at desc, id desc), tối đa `limit` hàng */
  listPosts(f: FeedFilter, limit: number): Promise<PostFull[]>;
  countPosts(f: FeedFilter, cap: number): Promise<number>;
  /** Chính thức còn ghim (pinned_until > now), không ẩn */
  pinnedPosts(nowIso: string): Promise<PostFull[]>;
  /** kể cả bài ẩn — route tự quyết ai được thấy */
  getPost(id: string): Promise<PostFull | null>;
  getPosts(ids: string[]): Promise<PostFull[]>;
  insertPost(row: NewPost): Promise<PostFull>;
  updatePost(id: string, patch: PostPatch): Promise<PostFull>;
  /** cascade: bình luận + Hay + dấu thông báo (FK on delete cascade) */
  deletePost(id: string): Promise<void>;
  /** số bài đang hiện của một người (trang người dùng) */
  countAuthorPosts(phone: string): Promise<number>;
  /** quản trị: tìm theo chữ (tiêu đề/thân), kể cả bài ẩn, mới nhất trước */
  searchPosts(q: string, limit: number): Promise<PostFull[]>;

  // ── Bình luận ────────────────────────────────────────────────────────
  /** (created_at asc, id asc), không ẩn, bỏ người bị chặn */
  listComments(postId: string, cursor: Cursor | null, limit: number, excludeAuthors: string[]): Promise<CommentFull[]>;
  /** bình luận GỐC nhiều Hay nhất (hay desc, created asc), không ẩn, bỏ người bị chặn */
  topComments(postId: string, n: number, excludeAuthors: string[]): Promise<CommentFull[]>;
  getComment(id: string): Promise<CommentFull | null>;
  insertComment(row: { post_id: string; parent_id: string | null; author_phone: string; body: string }): Promise<CommentFull>;
  /** cascade xoá trả lời con */
  deleteComment(id: string): Promise<void>;
  updateComment(id: string, patch: CommentPatch): Promise<CommentFull>;
  /** quản trị: MỌI bình luận của bài kể cả ẩn, cũ trước */
  allComments(postId: string, limit: number): Promise<CommentFull[]>;
  getComments(ids: string[]): Promise<CommentFull[]>;

  // ── Hay — idempotent (PK cặp) ────────────────────────────────────────
  setHay(t: TargetType, targetId: string, phone: string, on: boolean): Promise<void>;
  hayOf(t: TargetType, phone: string, ids: string[]): Promise<Set<string>>;

  // ── Theo dõi / chặn ──────────────────────────────────────────────────
  setEdge(kind: "follow" | "block", from: string, to: string, on: boolean): Promise<void>;
  /** SĐT mà `from` đang theo dõi / đã chặn */
  edgesFrom(kind: "follow" | "block", from: string): Promise<string[]>;

  // ── Báo xấu ──────────────────────────────────────────────────────────
  /** 'dup' khi người này đã báo đích này */
  insertReport(row: { target_type: TargetType; target_id: string; reporter_phone: string; reason: ReportReason; note: string | null }): Promise<"new" | "dup">;
  distinctReporters(t: TargetType, targetId: string): Promise<number>;
  listReports(status: ReportRow["status"], limit: number): Promise<ReportRow[]>;
  resolveReports(t: TargetType, targetId: string, status: "da-an" | "bo-qua", by: string, atIso: string): Promise<void>;

  // ── Tần suất + nhật ký ───────────────────────────────────────────────
  countSince(table: RateTable, phone: string, sinceIso: string): Promise<number>;
  /** nhật ký chỉ-thêm (≥2 năm). Ném khi ghi hỏng — bên gọi quyết định. */
  audit(row: AuditRow): Promise<void>;
  countAudit(actor: string, action: string, sinceIso: string): Promise<number>;

  // ── Thông báo gộp (A3) ───────────────────────────────────────────────
  /** true = được gửi (và đã đóng dấu); false = đã gửi cho bài này trong `windowMs` */
  takeNotifyMark(postId: string, phone: string, nowIso: string, windowMs: number): Promise<boolean>;

  // ── Kiểm duyệt (AC24) ────────────────────────────────────────────────
  /** hàng chờ agent: bài + bình luận `cho-kiem` cũ nhất trước, cộng mọi đích có báo xấu `moi` */
  modQueue(limit: number): Promise<{ posts: PostFull[]; comments: CommentFull[]; reportedPosts: PostFull[]; reportedComments: CommentFull[] }>;
  insertDecision(row: NewDecision): Promise<DecisionRow>;
  getDecision(id: number): Promise<DecisionRow | null>;
  /** quyết định agent `nghi`/`chan` mới nhất trước — hàng chờ người trực */
  agentFlagged(limit: number): Promise<DecisionRow[]>;
  /** quyết định mới nhất của từng đích */
  latestDecisions(t: TargetType, ids: string[]): Promise<Map<string, DecisionRow>>;

  // ── Máy thu tin (AC17) ───────────────────────────────────────────────
  seenHashes(hashes: string[]): Promise<Set<string>>;
  recentTitles(norms: string[], sinceIso: string): Promise<{ titleNorm: string; firstSeenAt: string }[]>;
  /** on conflict (url_hash) do nothing */
  insertSeen(rows: SeenRow[]): Promise<void>;
  /** on conflict (url_hash) do nothing — trả số bài THẬT được thêm */
  insertBao(rows: NewPost[]): Promise<number>;
  upsertSources(rows: SourceRow[]): Promise<void>;
  /** bài máy thu loại vì chủ quyền — tab quản trị Cờ chủ quyền */
  sovereigntyFlags(limit: number): Promise<SeenRow[]>;
  /** tab quản trị: giờ bài báo mới nhất vào kho (nhắc khi >2 giờ im) + trạng thái từng nguồn RSS */
  newsStatus(): Promise<{ lastBaoAt: string | null; sources: SourceRow[] }>;

  // ── Ảnh (bucket kairos-media) ────────────────────────────────────────
  uploadImage(path: string, bytes: Uint8Array, mime: "image/jpeg" | "image/png" | "image/webp"): Promise<void>;
  /** ném KairosError('storage_failed') khi kho không xoá được — route KHÔNG xoá bài nửa vời */
  removeImages(paths: string[]): Promise<void>;
  mediaUrl(path: string): string;
  /** đường kho nào trong `paths` đang được dùng: ảnh của một bài (kể cả bài ẩn) hoặc ảnh đại diện */
  mediaInUse(paths: string[]): Promise<Set<string>>;
  /**
   * Ảnh đã tải (nhật ký `upload`) trong [sinceIso, beforeIso) CHƯA có dấu dọn (`media_discard` /
   * `media_gc`) — ứng viên ảnh mồ côi, cũ trước, tối đa `limit`.
   */
  uploadsToCheck(sinceIso: string, beforeIso: string, limit: number): Promise<string[]>;
}

// ── Singleton sống qua HMR ──────────────────────────────────────────────
import { isDevFileMode } from "@/lib/market/dev-mode";

type G = typeof globalThis & { __sdfishKairosStore?: KairosStore | null };

/** null = chưa cấu hình Supabase và không ở kho file dev ⇒ route trả 503. */
export async function getKairosStore(): Promise<KairosStore | null> {
  const g = globalThis as G;
  if (g.__sdfishKairosStore) return g.__sdfishKairosStore;
  // import() động: file-store kéo node:fs — không nằm trong bundle prod.
  const store = isDevFileMode()
    ? (await import("./file-store")).createKairosFileStore()
    : (await import("./supabase-store")).createKairosSupabaseStore();
  if (store) g.__sdfishKairosStore = store;
  return store;
}
