// KAIROS — KHO FILE cho DEV (`.local/kairos-dev.json` + `.local/kairos-uploads/`). Khuôn
// market/file-store.ts: chỉ chạy khi isDevFileMode (MARKET_STORE=file, không Vercel, không
// production) — khởi tạo gọi assertDevFileMode, sai là ném. Ghi tuần tự (hàng đợi) + tmp rồi
// rename; JSON hỏng ⇒ KHÔNG đè, ném `unavailable`.
//
// Ràng buộc DB được làm lại ở đây cho đúng hành vi prod: unique handle_norm/url_hash/(đích,
// người báo), PK Hay/theo dõi/chặn, cascade xoá, trigger đếm, trả lời đúng 1 cấp.

import type { CamXuc } from "./cam-xuc";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertDevFileMode } from "@/lib/market/dev-mode";
import { devLocalDir } from "@/lib/market/file-store";
import { matchFeed } from "./feed-query";
import { isAfterAsc } from "./cursor";
import { KairosError } from "./errors";
import { reportNeedsCheck } from "./quyet-dinh";
import type {
  AuditRow, CommentFull, DecisionRow, KairosStore, NewPost, PostFull, ProfileFull, ReportRow, SeenRow, SourceRow, TargetType,
  DinhKemDongRow,
} from "./store";
import { SDVICO_PHONE, SEN_BIEN_PHONE } from "./types";

export const KAIROS_DEV_FILE = "kairos-dev.json";
export const KAIROS_DEV_UPLOADS = "kairos-uploads";

interface State {
  version: 1;
  profiles: ProfileFull[];
  posts: PostFull[];
  comments: CommentFull[];
  postHay: { post_id: string; phone: string; created_at: string; kind?: CamXuc }[];
  commentHay: { comment_id: string; phone: string; created_at: string; kind?: CamXuc }[];
  follows: { from: string; to: string; created_at: string }[];
  blocks: { from: string; to: string; created_at: string }[];
  reports: ReportRow[];
  seen: (SeenRow & { first_seen_at: string })[];
  sources: SourceRow[];
  decisions: DecisionRow[];
  marks: { post_id: string; phone: string; last_at: string }[];
  audit: (AuditRow & { id: number; at: string })[];
  /** 0075 — dòng danh sách file đính kèm; kho cũ không có ⇒ coi như [] */
  dinhKem?: DinhKemDongRow[];
}

/** Tên tệp ảnh dev: đường kho `<profileId>/<uuid>.<ext>` ⇒ `<profileId>__<uuid>.<ext>` (một tầng). */
export function devMediaName(storePath: string): string {
  return storePath.replace("/", "__");
}
export function kairosDevUploadDir(): string {
  return path.join(devLocalDir(), KAIROS_DEV_UPLOADS);
}

function seed(now: Date): State {
  const iso = (minAgo: number) => new Date(now.getTime() - minAgo * 60_000).toISOString();
  const sdvico: ProfileFull = {
    id: crypto.randomUUID(), phone: SDVICO_PHONE, handle: "SDVICO", handle_norm: "sdvico", handle_changed_at: null,
    avatar_path: null, show_boat: false, official: true, rules_accepted_at: iso(0), banned_until: null, ban_reason: null, created_at: iso(0),
  };
  // Sen Biển (gương seed migration 0068) — để dev file chạy được /api/kairos/sen-bien (giới thiệu + tuyên truyền luật)
  const senBien: ProfileFull = {
    id: crypto.randomUUID(), phone: SEN_BIEN_PHONE, handle: "Sen Biển", handle_norm: "sen bien", handle_changed_at: null,
    avatar_path: null, show_boat: false, official: true, rules_accepted_at: iso(0), banned_until: null, ban_reason: null, created_at: iso(0),
  };
  const base = (over: Partial<PostFull>): PostFull => ({
    id: crypto.randomUUID(), kind: "bao", author_phone: null, source_id: null, outlet: null, url: null, url_hash: null, title: null,
    title_norm: null, body: "", summary: null, summary_by: null, cover_url: null, images: [], topic: "nghe-ca", regions: ["ca-nuoc"],
    provinces: [], ports: [], reshare_of: null, pinned_until: null, hidden: false, hidden_reason: null, mod_state: "dat",
    mod_checked_at: iso(0), hay_count: 0, comment_count: 0, published_at: iso(30), feed_at: iso(30), created_at: iso(30), edited_at: null, ...over,
  });
  return {
    version: 1,
    profiles: [sdvico, senBien],
    posts: [
      base({
        source_id: "dev-thuy-san", outlet: "Báo mẫu", url: "https://example.com/tin-cam-bien", url_hash: "dev-1",
        title: "Quảng Ngãi tạm cấm tàu cá ra khơi do gió mạnh", title_norm: "quang ngai tam cam tau ca ra khoi do gio manh",
        summary: "Bản tin mẫu cho máy dev. Tàu cá được yêu cầu vào nơi tránh trú an toàn.", summary_by: "rss",
        regions: ["mien-trung"], provinces: ["quang-ngai"], ports: ["sa-huynh"], published_at: iso(90), feed_at: iso(90), created_at: iso(90),
      }),
      base({
        kind: "chinh-thuc", author_phone: SDVICO_PHONE, mod_state: "cho-kiem", topic: "nghe-ca",
        body: "Bài Chính thức mẫu của SDVICO trên máy dev.", pinned_until: new Date(now.getTime() + 7 * 864e5).toISOString(),
        published_at: iso(60), feed_at: iso(60), created_at: iso(60),
      }),
    ],
    comments: [], postHay: [], commentHay: [], follows: [], blocks: [], reports: [], seen: [], sources: [], decisions: [], marks: [], audit: [],
  };
}

const EXT_OK = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

export function createKairosFileStore(opts: { dir?: string; now?: () => Date } = {}): KairosStore {
  assertDevFileMode();
  const dir = opts.dir ?? devLocalDir();
  const file = path.join(dir, KAIROS_DEV_FILE);
  const uploads = path.join(dir, KAIROS_DEV_UPLOADS);
  const now = opts.now ?? (() => new Date());
  const nowIso = () => now().toISOString();

  let state: State | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  };
  async function persist() {
    if (!state) return;
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(tmp, file);
  }
  async function load(): Promise<State> {
    if (state) return state;
    let raw: string | null = null;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") {
        console.error("[kairos] không đọc được kho file:", file, (e as Error).message);
        throw new KairosError("unavailable");
      }
    }
    if (raw == null) {
      state = seed(now());
      await persist();
      return state;
    }
    try {
      const parsed = JSON.parse(raw) as State;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.posts)) throw new Error("sai hình dạng");
      state = parsed;
      return state;
    } catch (e) {
      console.error("[kairos] kho file hỏng JSON, KHÔNG đè:", file, (e as Error).message);
      throw new KairosError("unavailable");
    }
  }
  const read = <T>(fn: (s: State) => T): Promise<T> => withLock(async () => structuredClone(fn(await load())));
  const mutate = <T>(fn: (s: State) => T): Promise<T> =>
    withLock(async () => {
      const s = await load();
      const out = fn(s);
      await persist();
      return structuredClone(out);
    });

  const byDesc = (a: PostFull, b: PostFull) =>
    a.feed_at < b.feed_at ? 1 : a.feed_at > b.feed_at ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  const byAsc = (a: CommentFull, b: CommentFull) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  const getPostIn = (s: State, id: string) => s.posts.find((p) => p.id === id) ?? null;
  const getCommentIn = (s: State, id: string) => s.comments.find((c) => c.id === id) ?? null;
  const dropComments = (s: State, ids: Set<string>) => {
    // cascade trả lời con + Hay của bình luận; đếm comment_count như trigger
    const all = new Set(ids);
    for (const c of s.comments) if (c.parent_id && all.has(c.parent_id)) all.add(c.id);
    for (const c of s.comments) {
      if (!all.has(c.id)) continue;
      const p = getPostIn(s, c.post_id);
      if (p) p.comment_count = Math.max(0, p.comment_count - 1);
    }
    s.comments = s.comments.filter((c) => !all.has(c.id));
    s.commentHay = s.commentHay.filter((h) => !all.has(h.comment_id));
  };

  const store: KairosStore = {
    profileByPhone: (phone) => read((s) => s.profiles.find((p) => p.phone === phone) ?? null),
    profileById: (id) => read((s) => s.profiles.find((p) => p.id === id) ?? null),
    profilesByPhones: (phones) => read((s) => s.profiles.filter((p) => phones.includes(p.phone))),
    profilesByIds: (ids) => read((s) => s.profiles.filter((p) => ids.includes(p.id))),
    searchProfiles: (qNorm, limit, bo) =>
      read((s) => s.profiles.filter((p) => !bo.includes(p.phone) && qNorm.trim() && p.handle_norm.includes(qNorm.trim())).slice(0, limit)),
    takenNorms: (norms) => read((s) => s.profiles.filter((p) => norms.includes(p.handle_norm)).map((p) => p.handle_norm)).then((x) => new Set(x)),
    createProfile: (row) =>
      mutate((s) => {
        const existing = s.profiles.find((p) => p.phone === row.phone);
        if (existing) return existing;
        if (s.profiles.some((p) => p.handle_norm === row.handle_norm)) throw new KairosError("handle_taken");
        const p: ProfileFull = {
          id: crypto.randomUUID(), ...row, handle_changed_at: null, avatar_path: null, show_boat: false, official: false,
          rules_accepted_at: null, banned_until: null, ban_reason: null, created_at: nowIso(),
        };
        s.profiles.push(p);
        return p;
      }),
    updateProfile: (phone, patch) =>
      mutate((s) => {
        const p = s.profiles.find((x) => x.phone === phone);
        if (!p) throw new KairosError("not_found");
        if (patch.handle_norm && s.profiles.some((x) => x !== p && x.handle_norm === patch.handle_norm)) throw new KairosError("handle_taken");
        Object.assign(p, patch);
        return p;
      }),
    async customerName(phone) {
      try {
        // import động: market/store là server-only — để kho này test được bằng Vitest
        const { getMarketStore } = await import("@/lib/market/store");
        const personas = await (await getMarketStore()).devPersonas();
        return personas.find((p) => p.phone === phone)?.name ?? null;
      } catch {
        return null;
      }
    },
    async boatsOf() {
      return new Map(); // máy dev không có sổ tàu đồng bộ — dòng phụ trống
    },
    async buyerNamesOf() {
      return new Map(); // máy dev: chợ tin nằm ở kho khác — dòng phụ chỉ theo cảng
    },

    listPosts: (f, limit) => read((s) => s.posts.filter((p) => matchFeed(p, f)).sort(byDesc).slice(0, limit)),
    // kho file: đủ hàng cũng là PostXep (thừa cột không sao)
    listPostsXep: (f, limit) => read((s) => s.posts.filter((p) => matchFeed(p, f)).sort(byDesc).slice(0, limit)),
    countPosts: (f, cap) => read((s) => Math.min(s.posts.filter((p) => matchFeed(p, f)).length, cap)),
    pinnedPosts: (n) =>
      read((s) => s.posts.filter((p) => p.kind === "chinh-thuc" && !p.hidden && !!p.pinned_until && p.pinned_until > n).sort(byDesc).slice(0, 5)),
    getPost: (id) => read((s) => getPostIn(s, id)),
    getPosts: (ids) => read((s) => s.posts.filter((p) => ids.includes(p.id))),
    insertPost: (row: NewPost) =>
      mutate((s) => {
        const t = nowIso();
        const p: PostFull = {
          id: crypto.randomUUID(), source_id: null, outlet: null, url: null, url_hash: null, title: null, title_norm: null, summary: null,
          summary_by: null, cover_url: null, pinned_until: null, hidden: false, hidden_reason: null, mod_state: "cho-kiem", mod_checked_at: null,
          hay_count: 0, comment_count: 0, published_at: t, feed_at: t, created_at: t, edited_at: null, ...row,
        } as PostFull;
        if (p.url_hash && s.posts.some((x) => x.url_hash === p.url_hash)) throw new KairosError("insert_failed");
        s.posts.push(p);
        return p;
      }),
    updatePost: (id, patch) =>
      mutate((s) => {
        const p = getPostIn(s, id);
        if (!p) throw new KairosError("not_found");
        Object.assign(p, patch);
        return p;
      }),
    deletePost: (id) =>
      mutate((s) => {
        dropComments(s, new Set(s.comments.filter((c) => c.post_id === id).map((c) => c.id)));
        s.postHay = s.postHay.filter((h) => h.post_id !== id);
        s.marks = s.marks.filter((m) => m.post_id !== id);
        for (const p of s.posts) if (p.reshare_of === id) p.reshare_of = null; // on delete set null
        s.posts = s.posts.filter((p) => p.id !== id);
      }),
    countAuthorPosts: (phone) => read((s) => s.posts.filter((p) => p.author_phone === phone && !p.hidden).length),
    searchPosts: (q, limit) =>
      read((s) => {
        const n = q.trim().toLowerCase();
        return s.posts
          .filter((p) => !n || (p.title ?? "").toLowerCase().includes(n) || p.body.toLowerCase().includes(n))
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .slice(0, limit);
      }),

    listComments: (postId, cursor, limit, ex) =>
      read((s) =>
        s.comments
          .filter((c) => c.post_id === postId && !c.hidden && !ex.includes(c.author_phone))
          .filter((c) => !cursor || isAfterAsc({ at: c.created_at, id: c.id }, cursor))
          .sort(byAsc)
          .slice(0, limit),
      ),
    topComments: (postId, n, ex) =>
      read((s) =>
        s.comments
          .filter((c) => c.post_id === postId && !c.hidden && !c.parent_id && !ex.includes(c.author_phone))
          .sort((a, b) => b.hay_count - a.hay_count || byAsc(a, b))
          .slice(0, n),
      ),
    // kho file: cùng luật topComments + demDinhKemDong, gộp cho đủ giao diện (không có chuyện độ trễ mạng)
    kemTheoBai: async (postIds, n, ex, demDinhKem) => {
      const top = new Map<string, CommentFull[]>();
      const dinhKem = new Map<string, number>();
      for (const id of new Set(postIds)) {
        top.set(id, await store.topComments(id, n, ex));
        if (demDinhKem) dinhKem.set(id, await store.demDinhKemDong(id));
      }
      return { top, dinhKem };
    },
    getComment: (id) => read((s) => getCommentIn(s, id)),
    insertComment: (row) =>
      mutate((s) => {
        const post = getPostIn(s, row.post_id);
        if (!post) throw new KairosError("not_found");
        if (row.parent_id) {
          const parent = getCommentIn(s, row.parent_id);
          if (!parent || parent.parent_id || parent.post_id !== row.post_id) throw new KairosError("not_found");
        }
        const c: CommentFull = { id: crypto.randomUUID(), ...row, hay_count: 0, hidden: false, mod_state: "cho-kiem", mod_checked_at: null, created_at: nowIso() };
        s.comments.push(c);
        post.comment_count += 1;
        return c;
      }),
    deleteComment: (id) => mutate((s) => dropComments(s, new Set([id]))),
    updateComment: (id, patch) =>
      mutate((s) => {
        const c = getCommentIn(s, id);
        if (!c) throw new KairosError("not_found");
        Object.assign(c, patch);
        return c;
      }),

    allComments: (postId, limit) => read((s) => s.comments.filter((c) => c.post_id === postId).sort(byAsc).slice(0, limit)),
    getComments: (ids) => read((s) => s.comments.filter((c) => ids.includes(c.id))),

    setHay: (t, targetId, phone, on, kind = "hay") =>
      mutate((s) => {
        if (t === "post") {
          const p = getPostIn(s, targetId);
          if (!p) throw new KairosError("not_found");
          const has = s.postHay.find((h) => h.post_id === targetId && h.phone === phone);
          if (on && !has) {
            s.postHay.push({ post_id: targetId, phone, created_at: nowIso(), kind });
            p.hay_count += 1;
          } else if (on && has) has.kind = kind; // đổi cảm xúc, tổng không đổi
          else if (!on && has) {
            s.postHay = s.postHay.filter((h) => !(h.post_id === targetId && h.phone === phone));
            p.hay_count = Math.max(0, p.hay_count - 1);
          }
        } else {
          const c = getCommentIn(s, targetId);
          if (!c) throw new KairosError("not_found");
          const has = s.commentHay.find((h) => h.comment_id === targetId && h.phone === phone);
          if (on && !has) {
            s.commentHay.push({ comment_id: targetId, phone, created_at: nowIso(), kind });
            c.hay_count += 1;
          } else if (on && has) has.kind = kind;
          else if (!on && has) {
            s.commentHay = s.commentHay.filter((h) => !(h.comment_id === targetId && h.phone === phone));
            c.hay_count = Math.max(0, c.hay_count - 1);
          }
        }
      }),
    hayOf: (t, phone, ids) =>
      read((s) =>
        t === "post"
          ? s.postHay.filter((h) => h.phone === phone && ids.includes(h.post_id)).map((h) => h.post_id)
          : s.commentHay.filter((h) => h.phone === phone && ids.includes(h.comment_id)).map((h) => h.comment_id),
      ).then((xs) => new Set(xs)),
    camXucOf: (t, phone, ids) =>
      read((s) => {
        const out = new Map<string, CamXuc>();
        if (t === "post") for (const h of s.postHay) if (h.phone === phone && ids.includes(h.post_id)) out.set(h.post_id, h.kind ?? "hay");
        if (t === "comment") for (const h of s.commentHay) if (h.phone === phone && ids.includes(h.comment_id)) out.set(h.comment_id, h.kind ?? "hay");
        return out;
      }),
    demCamXuc: (t, ids) =>
      read((s) => {
        const out = new Map<string, Partial<Record<CamXuc, number>>>();
        const them = (id: string, k: CamXuc) => {
          const m = out.get(id) ?? {};
          m[k] = (m[k] ?? 0) + 1;
          out.set(id, m);
        };
        if (t === "post") for (const h of s.postHay) if (ids.includes(h.post_id)) them(h.post_id, h.kind ?? "hay");
        if (t === "comment") for (const h of s.commentHay) if (ids.includes(h.comment_id)) them(h.comment_id, h.kind ?? "hay");
        return out;
      }),

    setEdge: (kind, from, to, on) =>
      mutate((s) => {
        const list = kind === "follow" ? s.follows : s.blocks;
        const i = list.findIndex((e) => e.from === from && e.to === to);
        if (on && i < 0) list.push({ from, to, created_at: nowIso() });
        if (!on && i >= 0) list.splice(i, 1);
      }),
    edgesFrom: (kind, from) => read((s) => (kind === "follow" ? s.follows : s.blocks).filter((e) => e.from === from).map((e) => e.to)),
    followCounts: (phone) =>
      read((s) => ({ followers: s.follows.filter((e) => e.to === phone).length, following: s.follows.filter((e) => e.from === phone).length })),
    followList: (dir, phone, limit) =>
      read((s) =>
        s.follows
          .filter((e) => (dir === "followers" ? e.to : e.from) === phone)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .slice(0, limit)
          .map((e) => (dir === "followers" ? e.from : e.to)),
      ),

    insertReport: (row) =>
      mutate((s) => {
        if (s.reports.some((r) => r.target_type === row.target_type && r.target_id === row.target_id && r.reporter_phone === row.reporter_phone)) return "dup" as const;
        s.reports.push({ id: crypto.randomUUID(), ...row, status: "moi", handled_by: null, handled_at: null, created_at: nowIso() });
        return "new" as const;
      }),
    distinctReporters: (t, id) => read((s) => s.reports.filter((r) => r.target_type === t && r.target_id === id).length),
    listReports: (status, limit) =>
      read((s) => s.reports.filter((r) => r.status === status).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit)),
    resolveReports: (t, id, status, by, at) =>
      mutate((s) => {
        for (const r of s.reports) {
          if (r.target_type === t && r.target_id === id && r.status === "moi") Object.assign(r, { status, handled_by: by, handled_at: at });
        }
      }),

    countSince: (table, phone, since) =>
      read((s) => {
        switch (table) {
          case "posts":
            return s.posts.filter((p) => p.author_phone === phone && p.created_at >= since).length;
          case "comments":
            return s.comments.filter((c) => c.author_phone === phone && c.created_at >= since).length;
          case "reports":
            return s.reports.filter((r) => r.reporter_phone === phone && r.created_at >= since).length;
          case "follows+blocks":
            return [...s.follows, ...s.blocks].filter((e) => e.from === phone && e.created_at >= since).length;
        }
      }),
    audit: (row) =>
      mutate((s) => {
        s.audit.push({ id: s.audit.length + 1, ...row, at: nowIso() });
      }),
    countAudit: (actor, action, since) => read((s) => s.audit.filter((a) => a.actor === actor && a.action === action && a.at >= since).length),

    takeNotifyMark: (postId, phone, n, windowMs) =>
      mutate((s) => {
        if (!getPostIn(s, postId)) return false;
        const m = s.marks.find((x) => x.post_id === postId && x.phone === phone);
        if (m && Date.parse(m.last_at) >= Date.parse(n) - windowMs) return false;
        if (m) m.last_at = n;
        else s.marks.push({ post_id: postId, phone, last_at: n });
        return true;
      }),

    modQueue: (limit) =>
      read((s) => {
        const byCreated = <T extends { created_at: string }>(a: T, b: T) => (a.created_at < b.created_at ? -1 : 1);
        const posts = s.posts.filter((p) => p.mod_state === "cho-kiem").sort(byCreated).slice(0, limit);
        const comments = s.comments.filter((c) => c.mod_state === "cho-kiem").sort(byCreated).slice(0, limit);
        const open = s.reports.filter((r) => r.status === "moi");
        const timesOf = (t: TargetType, id: string) => open.filter((r) => r.target_type === t && r.target_id === id).map((r) => r.created_at);
        return {
          posts,
          comments,
          reportedPosts: s.posts.filter((p) => !posts.includes(p) && reportNeedsCheck(timesOf("post", p.id), p.mod_checked_at)).slice(0, limit),
          reportedComments: s.comments.filter((c) => !comments.includes(c) && reportNeedsCheck(timesOf("comment", c.id), c.mod_checked_at)).slice(0, limit),
        };
      }),
    insertDecision: (row) =>
      mutate((s) => {
        const d: DecisionRow = { id: s.decisions.length + 1, ...row, created_at: nowIso() };
        s.decisions.push(d);
        return d;
      }),
    getDecision: (id) => read((s) => s.decisions.find((d) => d.id === id) ?? null),
    agentFlagged: (limit) =>
      read((s) => s.decisions.filter((d) => d.decided_by === "agent" && d.verdict !== "dat").reverse().slice(0, limit)),
    latestDecisions: (t: TargetType, ids) =>
      read((s) => {
        const out = new Map<string, DecisionRow>();
        for (const d of [...s.decisions].reverse()) if (d.target_type === t && ids.includes(d.target_id) && !out.has(d.target_id)) out.set(d.target_id, d);
        return [...out.entries()];
      }).then((e) => new Map(e)),

    seenHashes: (hashes) => read((s) => s.seen.filter((x) => hashes.includes(x.url_hash)).map((x) => x.url_hash)).then((x) => new Set(x)),
    recentTitles: (norms, since) =>
      read((s) =>
        s.seen
          .filter((x) => x.title_norm && norms.includes(x.title_norm) && x.first_seen_at >= since)
          .map((x) => ({ titleNorm: x.title_norm as string, firstSeenAt: x.first_seen_at })),
      ),
    insertSeen: (rows) =>
      mutate((s) => {
        for (const r of rows) if (!s.seen.some((x) => x.url_hash === r.url_hash)) s.seen.push({ ...r, first_seen_at: r.first_seen_at ?? nowIso() });
      }),
    insertBao: (rows) =>
      mutate((s) => {
        let n = 0;
        for (const r of rows) {
          if (r.url_hash && s.posts.some((x) => x.url_hash === r.url_hash)) continue;
          const t = nowIso();
          s.posts.push({
            id: crypto.randomUUID(), source_id: null, outlet: null, url: null, url_hash: null, title: null, title_norm: null, summary: null,
            summary_by: null, cover_url: null, pinned_until: null, hidden: false, hidden_reason: null, mod_state: "cho-kiem", mod_checked_at: null,
            hay_count: 0, comment_count: 0, published_at: t, created_at: t, edited_at: null, ...r, feed_at: t,
          } as PostFull);
          n++;
        }
        return n;
      }),
    upsertSources: (rows) =>
      mutate((s) => {
        for (const r of rows) {
          const i = s.sources.findIndex((x) => x.id === r.id);
          if (i >= 0) s.sources[i] = { ...s.sources[i], ...r };
          else s.sources.push(r);
        }
      }),
    sovereigntyFlags: (limit) => read((s) => s.seen.filter((x) => x.outcome === "loai-chu-quyen").reverse().slice(0, limit)),
    postByUrlHash: (h) => read((s) => s.posts.find((p) => p.url_hash === h) ?? null),
    replaceDinhKemDong: (postId, urlHash, rows) =>
      mutate((s) => {
        const giu = (s.dinhKem ?? []).filter((d) => !(d.post_id === postId && d.url_hash === urlHash));
        let id = Math.max(0, ...giu.map((d) => d.id));
        s.dinhKem = [...giu, ...rows.map((r) => ({ ...r, id: ++id, post_id: postId, url_hash: urlHash }))];
        return rows.length;
      }),
    traDinhKemDong: (postId, q, limit) =>
      read((s) => {
        const regs = [...(q.regNorms ?? []), ...(q.regNorm ? [q.regNorm] : [])];
        return (s.dinhKem ?? [])
          .filter((d) => d.post_id === postId)
          .filter((d) => (regs.length && regs.some((r) => d.regNorm.includes(r))) || (q.tenNorm && d.tenNorm.includes(q.tenNorm)))
          .slice(0, limit);
      }),
    demDinhKemDong: (postId) => read((s) => (s.dinhKem ?? []).filter((d) => d.post_id === postId).length),
    newsStatus: () =>
      read((s) => ({
        lastBaoAt: s.posts.reduce<string | null>((m, p) => (p.kind === "bao" && (!m || p.created_at > m) ? p.created_at : m), null),
        sources: [...s.sources].sort((a, b) => a.id.localeCompare(b.id)),
      })),

    async uploadImage(p, bytes) {
      if (!EXT_OK.test(p)) throw new KairosError("storage_failed");
      try {
        await fs.mkdir(uploads, { recursive: true });
        await fs.writeFile(path.join(uploads, devMediaName(p)), bytes);
      } catch (e) {
        console.error("[kairos] ghi ảnh dev hỏng:", (e as Error).message);
        throw new KairosError("storage_failed");
      }
    },
    async removeImages(paths) {
      for (const p of paths) {
        if (!EXT_OK.test(p)) continue;
        try {
          await fs.unlink(path.join(uploads, devMediaName(p)));
        } catch (e) {
          if ((e as NodeJS.ErrnoException)?.code === "ENOENT") continue; // đã không còn = đạt mục đích
          console.error("[kairos] xoá ảnh dev hỏng:", (e as Error).message);
          throw new KairosError("storage_failed");
        }
      }
    },
    mediaUrl: (p) => `/api/dev/kairos-media/${devMediaName(p)}`,
    mediaInUse: (paths) =>
      read((s) => {
        const want = new Set(paths);
        const used = new Set<string>();
        for (const p of s.posts) for (const img of Array.isArray(p.images) ? (p.images as string[]) : []) if (want.has(img)) used.add(img);
        for (const pr of s.profiles) for (const x of [pr.avatar_path, pr.cover_path]) if (x && want.has(x)) used.add(x);
        for (const c of s.comments) if (c.image_path && want.has(c.image_path)) used.add(c.image_path);
        return used;
      }),
    uploadsToCheck: (since, before, limit) =>
      read((s) => {
        const done = new Set(s.audit.filter((a) => a.action === "media_discard" || a.action === "media_gc").map((a) => a.target_id));
        const out: string[] = [];
        for (const a of [...s.audit].sort((x, y) => (x.at < y.at ? -1 : 1))) {
          if (a.action !== "upload" || !a.target_id || a.at < since || a.at >= before || done.has(a.target_id)) continue;
          if (!out.includes(a.target_id)) out.push(a.target_id);
          if (out.length >= limit) break;
        }
        return out;
      }),
  };
  return store;
}
