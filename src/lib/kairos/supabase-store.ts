import { laCamXuc, type CamXuc } from "./cam-xuc";
import "server-only";
// KAIROS — KHO SUPABASE (prod). Service-role, bảng 0065 (RLS bật, không policy) + bucket
// kairos-media. Không nghiệp vụ (xem store.ts). Lỗi DB ⇒ KairosError; KHÔNG trả rỗng giả khi
// truy vấn hỏng (rỗng giả = dòng tin trắng mà máy tưởng thật, đè mất bản lưu offline).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { postgrestFeedExpr, pgQuote } from "./feed-query";
import { KairosError } from "./errors";
import { reportNeedsCheck } from "./quyet-dinh";
import { isUuid } from "./validate";
import { HO_SO_FIELDS } from "./store";
import type {
  AuditRow, CommentFull, DecisionRow, KairosStore, NewDecision, PostFull, PostXep, ProfileFull, RateTable, ReportRow,
  SeenRow, SourceRow, TargetType,
  DinhKemDongRow,
} from "./store";

const BUCKET = "kairos-media";
const PROFILE_BASE_COLS =
  "id,phone,handle,handle_norm,handle_changed_at,avatar_path,show_boat,official,rules_accepted_at,banned_until,ban_reason,created_at";
/** Cột trang cá nhân (0067) — có thể CHƯA có trên DB khi deploy đi trước migration. */
const PROFILE_HO_SO_COLS = HO_SO_FIELDS.join(",");
/** Đã thấy cột 0067 thiếu ⇒ đọc bằng cột gốc, hỏi lại sau 5 phút (migration áp xong tự nhận). */
const HO_SO_RECHECK_MS = 5 * 60_000;
const POST_COLS =
  "id,kind,author_phone,source_id,outlet,url,url_hash,title,title_norm,body,summary,summary_by,cover_url,images,topic,regions,provinces,ports,reshare_of,pinned_until,hidden,hidden_reason,mod_state,mod_checked_at,hay_count,comment_count,published_at,feed_at,created_at,edited_at,mentions,attachments";
/** cột XẾP dòng tin (PostXep) — giữ khớp type PostXep ở store.ts */
const XEP_COLS = "id,kind,author_phone,source_id,outlet,topic,regions,provinces,ports,hay_count,comment_count,published_at,feed_at";
const COMMENT_COLS = "id,post_id,parent_id,author_phone,body,hay_count,hidden,mod_state,mod_checked_at,created_at,image_path,link_preview,mentions";
const IN_MAX = 200;
/** trần số lượt cảm xúc đọc một lô để đếm theo loại */
const DEM_TOI_DA = 10_000;
/** Cột `kind` chưa có (0069 chưa áp) — Postgres 42703 / PostgREST PGRST204 ⇒ chạy như trước (mọi lượt là 'hay'). */
const thieuCotKind = (e: { code?: string; message?: string }) => e.code === "42703" || e.code === "PGRST204" || /\bkind\b/.test(e.message ?? "");

type PgErr = { code?: string; message?: string } | null;

function fail(where: string, e: PgErr): never {
  console.error(`[kairos] ${where} hỏng:`, e?.code, e?.message);
  throw new KairosError("unavailable");
}
const isUnique = (e: PgErr) => e?.code === "23505";
/** Lỗi "cột không có" của Postgres (42703) / PostgREST (PGRST204 khi ghi cột lạ). */
export const isMissingColumn = (e: PgErr) =>
  e?.code === "42703" || e?.code === "PGRST204" || /column .* does not exist|could not find the '.*' column/i.test(e?.message ?? "");

/** Hàng kairos_dinh_kem_dong ⇒ DinhKemDongRow (cột snake ⇒ camel như kho file). */
function dongTuHang(r: Record<string, unknown>): DinhKemDongRow {
  return {
    id: Number(r.id), post_id: String(r.post_id), url_hash: String(r.url_hash), stt: Number(r.stt ?? 0), ten: String(r.ten ?? ""),
    tenNorm: String(r.ten_norm ?? ""), reg: String(r.reg ?? ""), regNorm: String(r.reg_norm ?? ""), noiDung: String(r.noi_dung ?? ""), page: Number(r.page ?? 1),
  };
}

export function createKairosSupabaseStore(): KairosStore | null {
  const admin = createAdminClient();
  if (!admin) return null;
  const db: SupabaseClient = admin;

  const posts = () => db.from("kairos_posts");

  // Cột 0067 có chưa: null = chưa biết; false = thiếu (từ lúc `missingAt`).
  let hoSoCols: boolean | null = null;
  let missingAt = 0;
  const tryHoSo = () => hoSoCols !== false || Date.now() - missingAt > HO_SO_RECHECK_MS;
  /**
   * Chạy một truy vấn hồ sơ với đủ cột; cột 0067 chưa có ⇒ chạy lại bằng cột gốc (trường mới
   * = undefined, trang vẫn hiện). Lỗi khác trả nguyên cho bên gọi.
   */
  async function profileQuery<R extends { error: PgErr }>(build: (cols: string) => PromiseLike<R>): Promise<R> {
    if (tryHoSo()) {
      const r = await build(`${PROFILE_BASE_COLS},${PROFILE_HO_SO_COLS}`);
      if (!r.error) hoSoCols = true;
      if (!r.error || !isMissingColumn(r.error)) return r;
      if (hoSoCols !== false) console.warn("[kairos] cột trang cá nhân (0067) chưa có — đọc hồ sơ bằng cột gốc:", r.error?.message);
      hoSoCols = false;
      missingAt = Date.now();
    }
    return build(PROFILE_BASE_COLS);
  }
  const comments = () => db.from("kairos_comments");

  async function one<T>(where: string, q: PromiseLike<{ data: unknown; error: PgErr }>): Promise<T | null> {
    const { data, error } = await q;
    if (error) fail(where, error);
    return (data as T | null) ?? null;
  }
  async function many<T>(where: string, q: PromiseLike<{ data: unknown; error: PgErr }>): Promise<T[]> {
    const { data, error } = await q;
    if (error) fail(where, error);
    return (data as T[] | null) ?? [];
  }

  const store: KairosStore = {
    // ── Hồ sơ ──
    profileByPhone: (phone) =>
      one<ProfileFull>("profileByPhone", profileQuery((c) => db.from("kairos_profiles").select(c).eq("phone", phone).maybeSingle())),
    profileById: (id) => one<ProfileFull>("profileById", profileQuery((c) => db.from("kairos_profiles").select(c).eq("id", id).maybeSingle())),
    async profilesByPhones(phones) {
      const uniq = [...new Set(phones)].slice(0, IN_MAX);
      if (!uniq.length) return [];
      return many<ProfileFull>("profilesByPhones", profileQuery((c) => db.from("kairos_profiles").select(c).in("phone", uniq)));
    },
    async profilesByIds(ids) {
      const uniq = [...new Set(ids)].filter(isUuid).slice(0, IN_MAX);
      if (!uniq.length) return [];
      return many<ProfileFull>("profilesByIds", profileQuery((c) => db.from("kairos_profiles").select(c).in("id", uniq)));
    },
    async searchProfiles(qNorm, limit, bo) {
      const q = qNorm.replace(/[%_\\]/g, "").trim();
      if (!q) return [];
      // nợ: ilike '%q%' quét cả bảng hồ sơ (vài nghìn dòng) — thêm chỉ mục trigram handle_norm khi bảng vượt ~50 nghìn
      const rows = await many<ProfileFull>(
        "searchProfiles",
        profileQuery((c) => db.from("kairos_profiles").select(c).ilike("handle_norm", `%${q}%`).limit(limit + bo.length)),
      );
      return rows.filter((r) => !bo.includes(r.phone)).slice(0, limit);
    },
    async takenNorms(norms) {
      const uniq = [...new Set(norms)].slice(0, IN_MAX);
      if (!uniq.length) return new Set();
      const rows = await many<{ handle_norm: string }>("takenNorms", db.from("kairos_profiles").select("handle_norm").in("handle_norm", uniq));
      return new Set(rows.map((r) => r.handle_norm));
    },
    async createProfile(row) {
      const { data, error } = await profileQuery((c) => db.from("kairos_profiles").insert(row).select(c).single());
      if (!error) return data as unknown as ProfileFull;
      if (isUnique(error)) {
        const existing = await store.profileByPhone(row.phone);
        if (existing) return existing;
        throw new KairosError("handle_taken");
      }
      fail("createProfile", error);
    },
    async updateProfile(phone, patch) {
      const { data, error } = await profileQuery((c) => db.from("kairos_profiles").update(patch).eq("phone", phone).select(c).maybeSingle());
      if (error) {
        if (isUnique(error)) throw new KairosError("handle_taken");
        // ghi trường 0067 khi cột chưa có ⇒ 503 có mã (màn: "Phần giới thiệu chưa mở"), không 500 mù
        if (isMissingColumn(error) && HO_SO_FIELDS.some((k) => k in patch)) throw new KairosError("fields_missing");
        fail("updateProfile", error);
      }
      if (!data) throw new KairosError("not_found");
      return data as unknown as ProfileFull;
    },
    async customerName(phone) {
      const r = await one<{ name: string | null }>("customerName", db.from("customers").select("name").eq("phone", phone).maybeSingle());
      return r?.name ?? null;
    },
    async boatsOf(phones) {
      const uniq = [...new Set(phones)].filter((p) => /^\d+$/.test(p)).slice(0, IN_MAX);
      const out = new Map<string, unknown>();
      if (!uniq.length) return out;
      // Phụ — dòng phụ/số hiệu tàu hỏng thì thẻ vẫn hiện, không làm hỏng dòng tin.
      const { data, error } = await db.from("user_docs").select("owner_phone,data").eq("kind", "boats").in("owner_phone", uniq);
      if (error) {
        console.error("[kairos] đọc sổ tàu hỏng (bỏ dòng phụ):", error.code, error.message);
        return out;
      }
      for (const r of (data ?? []) as { owner_phone: string; data: unknown }[]) out.set(r.owner_phone, r.data);
      return out;
    },
    async buyerNamesOf(phones) {
      const uniq = [...new Set(phones)].filter((p) => /^\d+$/.test(p)).slice(0, IN_MAX);
      const out = new Map<string, string>();
      if (!uniq.length) return out;
      // Phụ như sổ tàu: hỏng thì bỏ dòng phụ, thẻ vẫn hiện. Bên mua = tin 'mua' của cơ sở
      // (không phải ngư dân), lấy tin mới nhất.
      const { data, error } = await db
        .from("market_listings")
        .select("owner_phone,poster_name,created_at")
        .eq("side", "mua")
        .in("poster_kind", ["nau", "vua", "nha-may", "cho"])
        .in("owner_phone", uniq)
        .order("created_at", { ascending: false })
        .limit(uniq.length * 5);
      if (error) {
        console.error("[kairos] đọc tên cơ sở bên mua hỏng (bỏ dòng phụ):", error.code, error.message);
        return out;
      }
      for (const r of (data ?? []) as { owner_phone: string; poster_name: string | null }[]) {
        const name = r.poster_name?.trim();
        if (name && !out.has(r.owner_phone)) out.set(r.owner_phone, name);
      }
      return out;
    },

    // ── Bài ──
    async listPosts(f, limit) {
      const expr = postgrestFeedExpr(f);
      if (!expr) return [];
      return many<PostFull>(
        "listPosts",
        posts().select(POST_COLS).eq("hidden", false).or(expr).order("feed_at", { ascending: false }).order("id", { ascending: false }).limit(limit),
      );
    },
    async listPostsXep(f, limit) {
      const expr = postgrestFeedExpr(f);
      if (!expr) return [];
      return many<PostXep>(
        "listPostsXep",
        posts().select(XEP_COLS).eq("hidden", false).or(expr).order("feed_at", { ascending: false }).order("id", { ascending: false }).limit(limit),
      );
    },
    async countPosts(f, cap) {
      const expr = postgrestFeedExpr(f);
      if (!expr) return 0;
      const { count, error } = await posts().select("id", { count: "exact", head: true }).eq("hidden", false).or(expr);
      if (error) fail("countPosts", error);
      return Math.min(count ?? 0, cap);
    },
    pinnedPosts: (nowIso) =>
      many<PostFull>(
        "pinnedPosts",
        posts().select(POST_COLS).eq("kind", "chinh-thuc").eq("hidden", false).gt("pinned_until", nowIso).order("feed_at", { ascending: false }).limit(5),
      ),
    getPost: (id) => one<PostFull>("getPost", posts().select(POST_COLS).eq("id", id).maybeSingle()),
    async getPosts(ids) {
      const uniq = [...new Set(ids)].slice(0, IN_MAX);
      if (!uniq.length) return [];
      return many<PostFull>("getPosts", posts().select(POST_COLS).in("id", uniq));
    },
    async insertPost(row) {
      const { data, error } = await posts().insert(row).select(POST_COLS).single();
      if (error) {
        console.error("[kairos] thêm bài hỏng:", error.code, error.message);
        throw new KairosError("insert_failed");
      }
      return data as PostFull;
    },
    async updatePost(id, patch) {
      const { data, error } = await posts().update(patch).eq("id", id).select(POST_COLS).maybeSingle();
      if (error) fail("updatePost", error);
      if (!data) throw new KairosError("not_found");
      return data as PostFull;
    },
    async deletePost(id) {
      const { error } = await posts().delete().eq("id", id);
      if (error) fail("deletePost", error);
    },
    async countAuthorPosts(phone) {
      const { count, error } = await posts().select("id", { count: "exact", head: true }).eq("author_phone", phone).eq("hidden", false);
      if (error) fail("countAuthorPosts", error);
      return count ?? 0;
    },
    async searchPosts(q, limit) {
      let query = posts().select(POST_COLS).order("created_at", { ascending: false }).limit(limit);
      const s = q.trim().replace(/[%_\\]/g, "").slice(0, 80);
      if (s) query = query.or(`title.ilike.${pgQuote(`%${s}%`)},body.ilike.${pgQuote(`%${s}%`)}`);
      return many<PostFull>("searchPosts", query);
    },

    // ── Bình luận ──
    async listComments(postId, cursor, limit, excludeAuthors) {
      let q = comments().select(COMMENT_COLS).eq("post_id", postId).eq("hidden", false);
      if (excludeAuthors.length) q = q.not("author_phone", "in", `(${excludeAuthors.map(pgQuote).join(",")})`);
      if (cursor) q = q.or(`created_at.gt.${pgQuote(cursor.at)},and(created_at.eq.${pgQuote(cursor.at)},id.gt.${cursor.id})`);
      return many<CommentFull>("listComments", q.order("created_at", { ascending: true }).order("id", { ascending: true }).limit(limit));
    },
    async topComments(postId, n, excludeAuthors) {
      let q = comments().select(COMMENT_COLS).eq("post_id", postId).eq("hidden", false).is("parent_id", null);
      if (excludeAuthors.length) q = q.not("author_phone", "in", `(${excludeAuthors.map(pgQuote).join(",")})`);
      return many<CommentFull>("topComments", q.order("hay_count", { ascending: false }).order("created_at", { ascending: true }).limit(n));
    },
    getComment: (id) => one<CommentFull>("getComment", comments().select(COMMENT_COLS).eq("id", id).maybeSingle()),
    async insertComment(row) {
      const { data, error } = await comments().insert(row).select(COMMENT_COLS).single();
      if (error) {
        console.error("[kairos] thêm bình luận hỏng:", error.code, error.message);
        throw new KairosError(error.code === "P0001" || error.code === "23503" ? "not_found" : "insert_failed");
      }
      return data as CommentFull;
    },
    async deleteComment(id) {
      const { error } = await comments().delete().eq("id", id);
      if (error) fail("deleteComment", error);
    },
    async updateComment(id, patch) {
      const { data, error } = await comments().update(patch).eq("id", id).select(COMMENT_COLS).maybeSingle();
      if (error) fail("updateComment", error);
      if (!data) throw new KairosError("not_found");
      return data as CommentFull;
    },

    allComments: (postId, limit) =>
      many<CommentFull>("allComments", comments().select(COMMENT_COLS).eq("post_id", postId).order("created_at", { ascending: true }).limit(limit)),
    async getComments(ids) {
      const uniq = [...new Set(ids)].slice(0, IN_MAX);
      if (!uniq.length) return [];
      return many<CommentFull>("getComments", comments().select(COMMENT_COLS).in("id", uniq));
    },

    // ── Hay ──
    async setHay(t, targetId, phone, on, kind = "hay") {
      const table = t === "post" ? "kairos_post_hay" : "kairos_comment_hay";
      const col = t === "post" ? "post_id" : "comment_id";
      if (on) {
        // đổi cảm xúc = UPDATE kind (upsert không bỏ qua trùng); tổng hay_count chỉ đổi khi INSERT (trigger)
        let { error } = await db.from(table).upsert({ [col]: targetId, phone, kind }, { onConflict: `${col},phone` });
        if (error && thieuCotKind(error)) ({ error } = await db.from(table).upsert({ [col]: targetId, phone }, { onConflict: `${col},phone`, ignoreDuplicates: true }));
        if (error) {
          if (error.code === "23503") throw new KairosError("not_found");
          fail("setHay", error);
        }
      } else {
        const { error } = await db.from(table).delete().eq(col, targetId).eq("phone", phone);
        if (error) fail("unsetHay", error);
      }
    },
    async hayOf(t, phone, ids) {
      const uniq = [...new Set(ids)].slice(0, IN_MAX);
      if (!phone || !uniq.length) return new Set();
      const table = t === "post" ? "kairos_post_hay" : "kairos_comment_hay";
      const col = t === "post" ? "post_id" : "comment_id";
      const rows = await many<Record<string, string>>("hayOf", db.from(table).select(col).eq("phone", phone).in(col, uniq));
      return new Set(rows.map((r) => r[col]));
    },
    async camXucOf(t, phone, ids) {
      const uniq = [...new Set(ids)].slice(0, IN_MAX);
      const out = new Map<string, CamXuc>();
      if (!phone || !uniq.length) return out;
      const table = t === "post" ? "kairos_post_hay" : "kairos_comment_hay";
      const col = t === "post" ? "post_id" : "comment_id";
      const r = await db.from(table).select(`${col},kind`).eq("phone", phone).in(col, uniq);
      if (r.error && thieuCotKind(r.error)) {
        const rows = await many<Record<string, string>>("camXucOf", db.from(table).select(col).eq("phone", phone).in(col, uniq));
        for (const x of rows) out.set(x[col], "hay");
        return out;
      }
      if (r.error) fail("camXucOf", r.error);
      for (const x of (r.data ?? []) as Record<string, string>[]) out.set(x[col], laCamXuc(x.kind) ? x.kind : "hay");
      return out;
    },
    async demCamXuc(t, ids) {
      const uniq = [...new Set(ids)].slice(0, IN_MAX);
      const out = new Map<string, Partial<Record<CamXuc, number>>>();
      if (!uniq.length) return out;
      const table = t === "post" ? "kairos_post_hay" : "kairos_comment_hay";
      const col = t === "post" ? "post_id" : "comment_id";
      // nợ: gom ở máy chủ app từ từng lượt (trần DEM_TOI_DA dòng/lô) — nâng lên view/RPC đếm nhóm khi bài có hàng nghìn lượt
      const r = await db.from(table).select(`${col},kind`).in(col, uniq).limit(DEM_TOI_DA);
      if (r.error && thieuCotKind(r.error)) return out;
      if (r.error) fail("demCamXuc", r.error);
      for (const x of (r.data ?? []) as Record<string, string>[]) {
        const k: CamXuc = laCamXuc(x.kind) ? x.kind : "hay";
        const m = out.get(x[col]) ?? {};
        m[k] = (m[k] ?? 0) + 1;
        out.set(x[col], m);
      }
      return out;
    },

    // ── Theo dõi / chặn ──
    async setEdge(kind, from, to, on) {
      const [table, a, b] = kind === "follow" ? ["kairos_follows", "follower_phone", "followee_phone"] : ["kairos_blocks", "blocker_phone", "blocked_phone"];
      if (on) {
        const row: Record<string, string> = { [a]: from, [b]: to };
        const { error } = await db.from(table).upsert(row, { onConflict: `${a},${b}`, ignoreDuplicates: true });
        if (error) fail("setEdge", error);
      } else {
        const { error } = await db.from(table).delete().eq(a, from).eq(b, to);
        if (error) fail("unsetEdge", error);
      }
    },
    async edgesFrom(kind, from) {
      if (!from) return [];
      const [table, a, b] = kind === "follow" ? ["kairos_follows", "follower_phone", "followee_phone"] : ["kairos_blocks", "blocker_phone", "blocked_phone"];
      const rows = await many<Record<string, string>>("edgesFrom", db.from(table).select(b).eq(a, from).limit(2000));
      return rows.map((r) => r[b]);
    },
    async followCounts(phone) {
      const cnt = async (col: "followee_phone" | "follower_phone") => {
        const { count, error } = await db.from("kairos_follows").select("follower_phone", { count: "exact", head: true }).eq(col, phone);
        if (error) fail("followCounts", error);
        return count ?? 0;
      };
      const [followers, following] = await Promise.all([cnt("followee_phone"), cnt("follower_phone")]);
      return { followers, following };
    },
    async followList(dir, phone, limit) {
      const [where, pick] = dir === "followers" ? ["followee_phone", "follower_phone"] : ["follower_phone", "followee_phone"];
      const rows = await many<Record<string, string>>(
        "followList",
        db.from("kairos_follows").select(pick).eq(where, phone).order("created_at", { ascending: false }).limit(limit),
      );
      return rows.map((r) => r[pick]);
    },

    // ── Báo xấu ──
    async insertReport(row) {
      const { error } = await db.from("kairos_reports").insert(row);
      if (!error) return "new";
      if (isUnique(error)) return "dup";
      fail("insertReport", error);
    },
    async distinctReporters(t, targetId) {
      const { count, error } = await db.from("kairos_reports").select("id", { count: "exact", head: true }).eq("target_type", t).eq("target_id", targetId);
      if (error) fail("distinctReporters", error);
      return count ?? 0; // unique (đích, người báo) ⇒ số dòng = số người
    },
    listReports: (status, limit) =>
      many<ReportRow>("listReports", db.from("kairos_reports").select("*").eq("status", status).order("created_at", { ascending: false }).limit(limit)),
    async resolveReports(t, targetId, status, by, atIso) {
      const { error } = await db
        .from("kairos_reports")
        .update({ status, handled_by: by, handled_at: atIso })
        .eq("target_type", t)
        .eq("target_id", targetId)
        .eq("status", "moi");
      if (error) fail("resolveReports", error);
    },

    // ── Tần suất + nhật ký ──
    async countSince(table: RateTable, phone, sinceIso) {
      const cnt = async (tbl: string, col: string) => {
        const { count, error } = await db.from(tbl).select("*", { count: "exact", head: true }).eq(col, phone).gte("created_at", sinceIso);
        if (error) fail(`countSince ${tbl}`, error);
        return count ?? 0;
      };
      switch (table) {
        case "posts":
          return cnt("kairos_posts", "author_phone");
        case "comments":
          return cnt("kairos_comments", "author_phone");
        case "reports":
          return cnt("kairos_reports", "reporter_phone");
        case "follows+blocks":
          return (await cnt("kairos_follows", "follower_phone")) + (await cnt("kairos_blocks", "blocker_phone"));
      }
    },
    async audit(row: AuditRow) {
      const { error } = await db.from("kairos_audit").insert({ ...row, detail: row.detail ?? {} });
      if (error) {
        console.error("[kairos] ghi nhật ký hỏng:", error.code, error.message);
        throw new KairosError("insert_failed");
      }
    },
    async countAudit(actor, action, sinceIso) {
      const { count, error } = await db.from("kairos_audit").select("id", { count: "exact", head: true }).eq("actor", actor).eq("action", action).gte("at", sinceIso);
      if (error) fail("countAudit", error);
      return count ?? 0;
    },

    // ── Thông báo gộp ──
    async takeNotifyMark(postId, phone, nowIso, windowMs) {
      const cutoff = new Date(Date.parse(nowIso) - windowMs).toISOString();
      // Đóng dấu có điều kiện: chỉ đè dấu CŨ hơn cửa sổ; chưa có dấu thì thêm. Hai lượt chen
      // nhau ⇒ một lượt thắng (update có điều kiện / PK), lượt kia không gửi.
      const upd = await db.from("kairos_notify_marks").update({ last_at: nowIso }).eq("post_id", postId).eq("phone", phone).lt("last_at", cutoff).select("post_id");
      if (upd.error) fail("notifyMark", upd.error);
      if ((upd.data ?? []).length > 0) return true;
      const ins = await db.from("kairos_notify_marks").insert({ post_id: postId, phone, last_at: nowIso });
      if (!ins.error) return true;
      if (isUnique(ins.error) || ins.error.code === "23503") return false;
      fail("notifyMark insert", ins.error);
    },

    // ── Kiểm duyệt ──
    async modQueue(limit) {
      const [p, c, reps] = await Promise.all([
        many<PostFull>("modQueue posts", posts().select(POST_COLS).eq("mod_state", "cho-kiem").order("created_at", { ascending: true }).limit(limit)),
        many<CommentFull>("modQueue comments", comments().select(COMMENT_COLS).eq("mod_state", "cho-kiem").order("created_at", { ascending: true }).limit(limit)),
        // mới trước: báo cũ đã chấm (còn 'moi' chờ người trực) không chèn ép báo vừa tới
        many<{ target_type: TargetType; target_id: string; created_at: string }>(
          "modQueue reports",
          db.from("kairos_reports").select("target_type,target_id,created_at").eq("status", "moi").order("created_at", { ascending: false }).limit(limit * 3),
        ),
      ]);
      const seenP = new Set(p.map((x) => x.id));
      const seenC = new Set(c.map((x) => x.id));
      const times = new Map<string, string[]>();
      for (const r of reps) {
        const k = `${r.target_type}:${r.target_id}`;
        times.set(k, [...(times.get(k) ?? []), r.created_at]);
      }
      const rp = [...new Set(reps.filter((r) => r.target_type === "post" && !seenP.has(r.target_id)).map((r) => r.target_id))].slice(0, limit);
      const rc = [...new Set(reps.filter((r) => r.target_type === "comment" && !seenC.has(r.target_id)).map((r) => r.target_id))].slice(0, limit);
      const [reportedPosts, reportedComments] = await Promise.all([
        rp.length ? many<PostFull>("modQueue rposts", posts().select(POST_COLS).in("id", rp)) : Promise.resolve([] as PostFull[]),
        rc.length ? many<CommentFull>("modQueue rcomments", comments().select(COMMENT_COLS).in("id", rc)) : Promise.resolve([] as CommentFull[]),
      ]);
      return {
        posts: p,
        comments: c,
        reportedPosts: reportedPosts.filter((x) => reportNeedsCheck(times.get(`post:${x.id}`) ?? [], x.mod_checked_at)),
        reportedComments: reportedComments.filter((x) => reportNeedsCheck(times.get(`comment:${x.id}`) ?? [], x.mod_checked_at)),
      };
    },
    async insertDecision(row: NewDecision) {
      const { data, error } = await db.from("kairos_mod_decisions").insert(row).select("*").single();
      if (error) {
        console.error("[kairos] ghi quyết định hỏng:", error.code, error.message);
        throw new KairosError("insert_failed");
      }
      return data as DecisionRow;
    },
    getDecision: (id) => one<DecisionRow>("getDecision", db.from("kairos_mod_decisions").select("*").eq("id", id).maybeSingle()),
    agentFlagged: (limit) =>
      many<DecisionRow>(
        "agentFlagged",
        db.from("kairos_mod_decisions").select("*").eq("decided_by", "agent").in("verdict", ["nghi", "chan"]).order("created_at", { ascending: false }).limit(limit),
      ),
    async latestDecisions(t, ids) {
      const uniq = [...new Set(ids)].slice(0, IN_MAX);
      const out = new Map<string, DecisionRow>();
      if (!uniq.length) return out;
      const rows = await many<DecisionRow>(
        "latestDecisions",
        db.from("kairos_mod_decisions").select("*").eq("target_type", t).in("target_id", uniq).order("created_at", { ascending: false }).limit(uniq.length * 5),
      );
      for (const r of rows) if (!out.has(r.target_id)) out.set(r.target_id, r);
      return out;
    },

    // ── Máy thu tin ──
    async seenHashes(hashes) {
      const uniq = [...new Set(hashes)].slice(0, IN_MAX);
      if (!uniq.length) return new Set();
      const rows = await many<{ url_hash: string }>("seenHashes", db.from("kairos_seen").select("url_hash").in("url_hash", uniq));
      return new Set(rows.map((r) => r.url_hash));
    },
    async recentTitles(norms, sinceIso) {
      const uniq = [...new Set(norms)].slice(0, IN_MAX);
      if (!uniq.length) return [];
      const rows = await many<{ title_norm: string; first_seen_at: string }>(
        "recentTitles",
        db.from("kairos_seen").select("title_norm,first_seen_at").in("title_norm", uniq).gte("first_seen_at", sinceIso),
      );
      return rows.map((r) => ({ titleNorm: r.title_norm, firstSeenAt: r.first_seen_at }));
    },
    async insertSeen(rows) {
      if (!rows.length) return;
      const { error } = await db.from("kairos_seen").upsert(rows, { onConflict: "url_hash", ignoreDuplicates: true });
      if (error) fail("insertSeen", error);
    },
    async insertBao(rows) {
      if (!rows.length) return 0;
      const { data, error } = await posts().upsert(rows, { onConflict: "url_hash", ignoreDuplicates: true }).select("id");
      if (error) fail("insertBao", error);
      return (data ?? []).length;
    },
    async upsertSources(rows) {
      if (!rows.length) return;
      const { error } = await db.from("kairos_sources").upsert(rows, { onConflict: "id" });
      if (error) fail("upsertSources", error);
    },
    // ── 0075 dòng danh sách đính kèm — bảng chưa có (42P01) ⇒ đọc trả rỗng, ghi ném unavailable (máy thu giữ hàng đợi)
    postByUrlHash: (h) => one<PostFull>("postByUrlHash", posts().select(POST_COLS).eq("url_hash", h).maybeSingle()),
    async replaceDinhKemDong(postId, urlHash, rows) {
      const del = await db.from("kairos_dinh_kem_dong").delete().eq("post_id", postId).eq("url_hash", urlHash);
      if (del.error) fail("replaceDinhKemDong.delete", del.error);
      for (let i = 0; i < rows.length; i += 500) {
        const lo = rows.slice(i, i + 500).map((r) => ({
          post_id: postId, url_hash: urlHash, stt: r.stt, ten: r.ten, ten_norm: r.tenNorm, reg: r.reg, reg_norm: r.regNorm, noi_dung: r.noiDung, page: r.page,
        }));
        const { error } = await db.from("kairos_dinh_kem_dong").insert(lo);
        if (error) fail("replaceDinhKemDong.insert", error);
      }
      return rows.length;
    },
    async traDinhKemDong(postId, q, limit) {
      const regs = [...(q.regNorms ?? []), ...(q.regNorm ? [q.regNorm] : [])].map((r) => r.replace(/[%_,()"\\]/g, ""));
      const or: string[] = regs.map((r) => `reg_norm.ilike.%${r}%`);
      if (q.tenNorm) or.push(`ten_norm.ilike.%${q.tenNorm.replace(/[%_,()"\\]/g, "")}%`);
      if (!or.length) return [];
      const { data, error } = await db.from("kairos_dinh_kem_dong").select("*").eq("post_id", postId).or(or.join(",")).order("stt").limit(limit);
      if (error) {
        if (error.code === "42P01") return [];
        fail("traDinhKemDong", error);
      }
      return ((data ?? []) as Record<string, unknown>[]).map(dongTuHang);
    },
    async demDinhKemDong(postId) {
      const { count, error } = await db.from("kairos_dinh_kem_dong").select("id", { count: "exact", head: true }).eq("post_id", postId);
      if (error) {
        if (error.code === "42P01") return 0;
        fail("demDinhKemDong", error);
      }
      return count ?? 0;
    },
    sovereigntyFlags: (limit) =>
      many<SeenRow>("sovereigntyFlags", db.from("kairos_seen").select("*").eq("outcome", "loai-chu-quyen").order("first_seen_at", { ascending: false }).limit(limit)),
    async newsStatus() {
      // nợ: quét kind='bao' theo created_at chưa có chỉ mục riêng — bảng còn nhỏ; thêm chỉ mục
      // (kind, created_at desc) khi kairos_posts vượt ~100 nghìn dòng.
      const [last, sources] = await Promise.all([
        many<{ created_at: string }>("newsStatus", posts().select("created_at").eq("kind", "bao").order("created_at", { ascending: false }).limit(1)),
        many<SourceRow>("newsStatus", db.from("kairos_sources").select("*").order("id")),
      ]);
      return { lastBaoAt: last[0]?.created_at ?? null, sources };
    },

    // ── Ảnh ──
    async uploadImage(path, bytes, mime) {
      const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
      if (error) {
        console.error("[kairos] tải ảnh lên hỏng:", error.message);
        throw new KairosError("storage_failed");
      }
    },
    async removeImages(paths) {
      if (!paths.length) return;
      const { error } = await db.storage.from(BUCKET).remove(paths);
      if (error) {
        console.error("[kairos] xoá ảnh kho hỏng:", error.message);
        throw new KairosError("storage_failed");
      }
    },
    mediaUrl: (path) => db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
    async mediaInUse(paths) {
      const want = new Set(paths.slice(0, IN_MAX));
      const used = new Set<string>();
      // đường kho = '<profileId>/<uuid>.<ext>' ⇒ chỉ cần soi bài + ảnh đại diện của chủ thư mục
      const ids = [...new Set([...want].map((p) => p.split("/")[0]).filter(isUuid))];
      if (!ids.length) return used;
      // ảnh bìa (0067) cũng là ảnh đang dùng — cột chưa có thì chỉ soi ảnh đại diện
      const owners = await many<ProfileFull>("mediaInUse", profileQuery((c) => db.from("kairos_profiles").select(c).in("id", ids)));
      for (const o of owners) for (const x of [o.avatar_path, o.cover_path]) if (x && want.has(x)) used.add(x);
      if (!owners.length) return used;
      // ảnh bình luận (0070)
      const cm = await many<{ image_path: string | null }>("mediaInUse", comments().select("image_path").in("image_path", [...want]));
      for (const c of cm) if (c.image_path) used.add(c.image_path);
      // nợ: đọc mọi bài của chủ thư mục (≤10 bài/ngày/người); đổi sang lọc jsonb `images @> [path]` khi một người vượt vài nghìn bài
      const rows = await many<{ images: unknown }>("mediaInUse", posts().select("images").in("author_phone", owners.map((o) => o.phone)));
      for (const r of rows) for (const img of Array.isArray(r.images) ? (r.images as string[]) : []) if (want.has(img)) used.add(img);
      return used;
    },
    async uploadsToCheck(since, before, limit) {
      const out: string[] = [];
      const seen = new Set<string>();
      // nợ: lật tối đa 10 trang × 500 dấu `upload` mỗi lượt — đủ cho 5.000 ảnh/tuần; nâng bằng dấu mốc quét khi vượt
      for (let page = 0; page < 10 && out.length < limit; page++) {
        const ups = await many<{ target_id: string | null }>(
          "uploadsToCheck",
          db.from("kairos_audit").select("target_id").eq("action", "upload").gte("at", since).lt("at", before)
            .order("at", { ascending: true }).order("id", { ascending: true }).range(page * 500, page * 500 + 499),
        );
        const ids = [...new Set(ups.map((u) => u.target_id).filter((x): x is string => !!x && !seen.has(x)))];
        ids.forEach((x) => seen.add(x));
        if (ids.length) {
          const done = new Set<string>();
          for (let i = 0; i < ids.length; i += IN_MAX) {
            const marks = await many<{ target_id: string }>(
              "uploadsToCheck",
              db.from("kairos_audit").select("target_id").in("action", ["media_discard", "media_gc"]).in("target_id", ids.slice(i, i + IN_MAX)),
            );
            marks.forEach((m) => done.add(m.target_id));
          }
          for (const x of ids) if (!done.has(x) && out.length < limit) out.push(x);
        }
        if (ups.length < 500) break;
      }
      return out;
    },
  };
  return store;
}
