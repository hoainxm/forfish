import "server-only";
// KAIROS — TRỢ GIÚP CHUNG CHO MỌI ROUTE /api/kairos/* (14 §7, AC21). Route mỏng gọi đây; luật
// thuần nằm ở validate/feed-query/dto/rate/… (có test).
//
// Ba cửa an toàn ở MỘT chỗ để không route nào quên:
//   1. danh tính = identityFromRequest (401 chưa đăng nhập, 503 không tra được — không bao giờ
//      401 vì hạ tầng hỏng);
//   2. ghi = có hồ sơ + chưa bị cấm (403 banned) — `requireWriter`;
//   3. ra client = qua dto.ts (không SĐT) — `hydratePosts` / `hydrateComments`.

import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { normalizeVnPhone } from "@/lib/phone";
import { notifyMarket } from "@/lib/market/notify";
import { getConfigValue } from "@/lib/app-config";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { boatExtra } from "./author-extra";
import { BAO_FEED_MS, type FeedFilter, type FeedParams } from "./feed-query";
import { authorDto, postDto, commentDto, type DtoCtx } from "./dto";
import { checkIngestKey, effectiveIngestKey, INGEST_KEY_HEADER } from "./ingest-key";
import { isKairosError, kairosErrorStatus, KairosError } from "./errors";
import { commentRecipients, notifyMessage, NOTIFY_WINDOW_MS, KAIROS_PUSH_SENT_BY } from "./notify-gop";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { agentMayDecide, feedAtOnApprove, shouldTellAuthor, stateFor, type Verdict } from "./quyet-dinh";
import { isBanned, KAIROS_RATES, overLimit, RATE_AUDIT_ACTIONS, rateUsed, windowStart, type KairosRateKey } from "./rate";
import { isUuid } from "./validate";
import { orphanUploads } from "./social";
import { defaultHandle, handleNorm } from "./ten-goi";
import { LIMITS, type KairosComment, type KairosPost } from "./types";
import { getKairosStore, type CommentFull, type KairosStore, type PostFull, type ProfileFull, type RateTable } from "./store";

export const PORT_IDS: ReadonlySet<string> = new Set(FISHING_PORTS.map((p) => p.id));
const PORT_NAME = new Map(FISHING_PORTS.map((p) => [p.id, p.name]));
export const portName = (id: string) => PORT_NAME.get(id) ?? null;

export function kErr(status: number, code: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: false, code, ...extra }, { status });
}

/** Lỗi kho có mã ⇒ JSON; lỗi lạ ⇒ log + 500 (không nuốt). */
export function kairosErrorResponse(e: unknown): NextResponse {
  if (isKairosError(e)) return kErr(kairosErrorStatus(e.code), e.code);
  console.error("[kairos] lỗi không có mã:", (e as Error)?.message ?? e);
  return kErr(500, "internal");
}

export async function storeOr503(): Promise<{ ok: true; store: KairosStore } | { ok: false; res: NextResponse }> {
  const store = await getKairosStore();
  return store ? { ok: true, store } : { ok: false, res: kErr(503, "unavailable") };
}

/** Người đọc: khách ⇒ phone null. Chuỗi chết ⇒ 401, không tra được ⇒ 503 (identityFromRequest). */
// nợ: trần đọc đếm bộ nhớ instance (lib/rate-limit.ts) — Vercel nhiều instance thì trần nhân lên;
// chuyển sang bảng đếm chung (Supabase/KV) cùng lúc với dataGate khi thấy cào dòng tin trong log.
const READ_STORE: RateStore = new Map();

/** Cửa ĐỌC chung của mọi route đọc Kairos: danh tính tuỳ chọn + trần đọc (SĐT, khách theo IP). */
export async function readerOf(req: Request): Promise<{ ok: true; phone: string | null } | { ok: false; res: NextResponse }> {
  const who = await identityFromRequest(req, true);
  if (!who.ok) return who;
  const phone = who.phone ? normalizeVnPhone(who.phone) : null;
  const key = phone ?? `ip:${clientIp(req) ?? "?"}`;
  if (!allowRequest(READ_STORE, key, Date.now(), KAIROS_RATES.read)) return { ok: false, res: kErr(429, "rate_limited") };
  return { ok: true, phone };
}

/**
 * Hồ sơ của SĐT — chưa có thì TẠO với tên mặc định (customers.name hợp lệ & chưa ai dùng, không
 * thì "Bà con " + 4 số cuối, trùng thêm số — ten-goi.defaultHandle). Hai lượt chen nhau ⇒ lượt
 * sau nhận hồ sơ lượt trước (kho trả hồ sơ có sẵn); trùng tên ⇒ thử lại một lần với tập mới.
 */
export async function ensureProfile(store: KairosStore, phone: string): Promise<ProfileFull> {
  const have = await store.profileByPhone(phone);
  if (have) return have;
  const name = await store.customerName(phone);
  for (let attempt = 0; attempt < 2; attempt++) {
    const digits = phone.replace(/\D/g, "").slice(-4) || "mới";
    const candidates = [name ?? "", ...Array.from({ length: 99 }, (_, i) => (i === 0 ? `Bà con ${digits}` : `Bà con ${digits} ${i + 1}`))];
    const taken = await store.takenNorms(candidates.filter(Boolean).map(handleNorm));
    const handle = defaultHandle(name, phone, (n) => taken.has(n));
    if (!handle) throw new KairosError("unavailable");
    try {
      return await store.createProfile({ phone, handle, handle_norm: handleNorm(handle) });
    } catch (e) {
      if (!(isKairosError(e) && e.code === "handle_taken") || attempt === 1) throw e;
    }
  }
  throw new KairosError("unavailable");
}

/**
 * Cửa GHI: đăng nhập (401/503) + kho (503) + hồ sơ + chưa bị cấm (403 banned, kèm hạn).
 * `rules=true` ⇒ chưa đồng ý nội quy trả 409 `rules` (đăng bài/bình luận — AC08).
 */
export async function requireWriter(
  req: Request,
  /** allowBanned: gỡ nội dung của chính mình (xoá bài/bình luận, bỏ Hay) vẫn được khi bị cấm */
  opts: { rules?: boolean; allowBanned?: boolean } = {},
): Promise<{ ok: true; store: KairosStore; phone: string; profile: ProfileFull } | { ok: false; res: NextResponse }> {
  const who = await identityFromRequest(req);
  if (!who.ok) return who;
  const s = await storeOr503();
  if (!s.ok) return s;
  const phone = normalizeVnPhone(who.phone);
  let profile: ProfileFull;
  try {
    profile = await ensureProfile(s.store, phone);
  } catch (e) {
    return { ok: false, res: kairosErrorResponse(e) };
  }
  if (!opts.allowBanned && isBanned(profile.banned_until, Date.now())) {
    return { ok: false, res: kErr(403, "banned", { until: profile.banned_until }) };
  }
  if (opts.rules && !profile.rules_accepted_at) return { ok: false, res: kErr(409, "rules") };
  return { ok: true, store: s.store, phone, profile };
}

const RATE_TABLE: Partial<Record<KairosRateKey, RateTable>> = {
  posts: "posts",
  comments: "comments",
  reports: "reports",
  "follows+blocks": "follows+blocks",
};

/** Trần theo ngày (A1) đếm trong kho. null = cho qua; vượt ⇒ 429 rate_limited. */
export async function rateDenied(store: KairosStore, key: KairosRateKey, phone: string): Promise<NextResponse | null> {
  const now = Date.now();
  const since = windowStart(key, now);
  const table = RATE_TABLE[key];
  const [rows, ...audited] = await Promise.all([
    table ? store.countSince(table, phone, since) : Promise.resolve(0),
    ...(RATE_AUDIT_ACTIONS[key] ?? []).map((a) => store.countAudit(phone, a, since)),
  ]);
  const used = rateUsed(rows, audited);
  return overLimit(key, used) ? kErr(429, "rate_limited") : null;
}

export function clientIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  const ip = (xf ? xf.split(",")[0] : req.headers.get("x-real-ip"))?.trim();
  return ip ? ip.slice(0, 64) : null;
}

/** Ghi nhật ký của bà con SAU khi việc chính đã xong — hỏng thì log, KHÔNG làm hỏng việc chính. */
export async function auditQuiet(store: KairosStore, row: Parameters<KairosStore["audit"]>[0]): Promise<void> {
  try {
    await store.audit(row);
  } catch (e) {
    console.error("[kairos] nhật ký hỏng (việc chính đã xong):", row.action, (e as Error)?.message);
  }
}

/** Dựng ngữ cảnh DTO cho một lô hàng: hồ sơ, dòng phụ, số hiệu tàu, Hay của người xem. */
async function dtoCtx(
  store: KairosStore,
  viewer: string | null,
  posts: PostFull[],
  comments: CommentFull[],
): Promise<DtoCtx> {
  const phones = [...posts.map((p) => p.author_phone), ...comments.map((c) => c.author_phone)].filter((x): x is string => !!x);
  const [profiles, boats, buyers, hayPosts, hayComments] = await Promise.all([
    store.profilesByPhones(phones),
    store.boatsOf(phones),
    store.buyerNamesOf(phones),
    viewer ? store.hayOf("post", viewer, posts.map((p) => p.id)) : Promise.resolve(new Set<string>()),
    viewer ? store.hayOf("comment", viewer, comments.map((c) => c.id)) : Promise.resolve(new Set<string>()),
  ]);
  const sublines = new Map<string, string>();
  const boatRegs = new Map<string, string>();
  for (const phone of new Set([...boats.keys(), ...buyers.keys()])) {
    const x = boatExtra(boats.get(phone), portName, buyers.get(phone));
    if (x.subline) sublines.set(phone, x.subline);
    if (x.boatReg) boatRegs.set(phone, x.boatReg);
  }
  return {
    viewer,
    profiles: new Map(profiles.map((p) => [p.phone, p])),
    sublines,
    boats: boatRegs,
    mediaUrl: (p) => store.mediaUrl(p),
    hayPosts,
    hayComments,
  };
}

/**
 * Hàng bài ⇒ DTO đủ: bài gốc khi đăng lại (bài gốc ẩn / của người bị chặn ⇒ "không còn"),
 * 2 bình luận nhiều Hay nhất (bỏ người bị chặn), Hay của người xem. Không SĐT nào ra ngoài.
 */
export async function hydratePosts(
  store: KairosStore,
  rows: PostFull[],
  viewer: string | null,
  blocked: string[],
  opts: { topComments?: boolean } = {},
): Promise<KairosPost[]> {
  if (!rows.length) return [];
  const reshareIds = [...new Set(rows.map((r) => r.reshare_of).filter((x): x is string => !!x))];
  const originals = reshareIds.length ? await store.getPosts(reshareIds) : [];
  const visibleOrig = new Map(
    originals
      .filter((o) => !o.hidden && !(o.kind === "bao" && o.mod_state !== "dat") && !(o.author_phone && blocked.includes(o.author_phone)))
      .map((o) => [o.id, o]),
  );
  const tops = opts.topComments === false
    ? rows.map(() => [] as CommentFull[])
    : await Promise.all(rows.map((r) => (r.comment_count > 0 ? store.topComments(r.id, LIMITS.topComments, blocked) : Promise.resolve([] as CommentFull[]))));
  const ctx = await dtoCtx(store, viewer, [...rows, ...visibleOrig.values()], tops.flat());
  return rows.map((r, i) =>
    postDto(r, ctx, { topComments: tops[i], reshare: r.reshare_of ? visibleOrig.get(r.reshare_of) ?? null : null }),
  );
}

export async function hydrateComments(store: KairosStore, rows: CommentFull[], viewer: string | null): Promise<KairosComment[]> {
  if (!rows.length) return [];
  const ctx = await dtoCtx(store, viewer, [], rows);
  return rows.map((c) => commentDto(c, ctx));
}

/** Người xem có được thấy bài này không (chi tiết / bình luận / Hay). */
export function postVisible(p: PostFull | null, viewer: string | null, blocked: string[]): p is PostFull {
  if (!p) return false;
  if (p.hidden) return false; // bài ẩn: "Bài này không còn" với mọi người, kể cả chủ bài
  if (p.kind === "bao" && p.mod_state !== "dat") return false;
  if (p.author_phone && p.author_phone !== viewer && blocked.includes(p.author_phone)) return false;
  return true;
}

/** Đọc JSON body; hỏng ⇒ null (route trả 400). */
export async function jsonBody(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}

/**
 * Tham số URL đã kiểm ⇒ bộ lọc kho (feed + new-count dùng chung). Theo dõi cần SĐT (401);
 * `author` lạ ⇒ 404. Bài người mình chặn luôn bị bỏ.
 */
export async function feedFilterFor(
  store: KairosStore,
  p: FeedParams,
  viewer: string | null,
  now: number,
): Promise<{ ok: true; filter: FeedFilter; blocked: string[] } | { ok: false; res: NextResponse }> {
  if (p.theoDoi && !viewer) return { ok: false, res: kErr(401, "login_required") };
  const blocked = viewer ? await store.edgesFrom("block", viewer) : [];
  const filter: FeedFilter = {
    baoSince: new Date(now - BAO_FEED_MS).toISOString(),
    topic: p.topic,
    ports: p.ports,
    near: p.near,
    excludeAuthors: blocked,
    cursor: p.cursor,
  };
  if (p.theoDoi && viewer) filter.authors = await store.edgesFrom("follow", viewer);
  if (p.authorProfileId) {
    const prof = await store.profileById(p.authorProfileId);
    if (!prof) return { ok: false, res: kErr(404, "not_found") };
    filter.authors = filter.authors ? filter.authors.filter((x) => x === prof.phone) : [prof.phone];
  }
  return { ok: true, filter, blocked };
}

/**
 * Báo chủ bài / chủ bình luận khi có bình luận mới (AC10, A3): người nhận theo notify-gop, gộp
 * 1 tin/bài/người nhận/giờ bằng dấu ở kho, gửi qua hạ tầng sẵn có (market/notify ⇒
 * account-notify: hộp thư + đẩy; máy dev ⇒ sổ thông báo /dev). Không bao giờ ném — bình luận
 * đã lưu xong là việc chính.
 */
export async function notifyComment(
  store: KairosStore,
  input: { post: PostFull; parentAuthor: string | null; commenter: string; commenterHandle: string },
): Promise<void> {
  try {
    const targets = commentRecipients({
      postKind: input.post.kind,
      postAuthor: input.post.author_phone,
      parentAuthor: input.parentAuthor,
      commenter: input.commenter,
    });
    const nowIso = new Date().toISOString();
    for (const t of targets) {
      if (!(await store.takeNotifyMark(input.post.id, t.phone, nowIso, NOTIFY_WINDOW_MS))) continue;
      await notifyMarket(t.phone, { ...notifyMessage(t, input.commenterHandle, input.post.id), sentBy: KAIROS_PUSH_SENT_BY });
    }
  } catch (e) {
    console.error("[kairos] báo bình luận hỏng (bỏ qua):", (e as Error)?.message);
  }
}

// nợ: Hay 300/giờ đếm bộ nhớ instance (lib/rate-limit.ts) — Vercel nhiều instance thì trần nhân lên; chuyển sang đếm trong kho (bảng kairos_hay theo created_at) khi thấy bấm Hay hàng loạt trong nhật ký.
const HAY_STORE: RateStore = new Map();

/**
 * Hai người có chặn nhau không — CẢ HAI chiều (mình chặn họ, họ chặn mình). `myBlocks` = SĐT
 * mình đã chặn (đã đọc sẵn ở route); chiều kia hỏi kho. Chính mình ⇒ false.
 */
export async function blockedEitherWay(store: KairosStore, me: string, myBlocks: readonly string[], other: string | null): Promise<boolean> {
  if (!other || other === me) return false;
  if (myBlocks.includes(other)) return true;
  return (await store.edgesFrom("block", other)).includes(me);
}

/**
 * PUT Hay `{on: boolean}` — idempotent (PK cặp ở DB: bấm trùng không đếm 2, AC09). Trả số Hay
 * SAU khi ghi để app đối chiếu bản lạc quan. Bỏ Hay vẫn được khi bị cấm; bật thì không.
 * Chặn hai chiều (AC15): mình chặn họ HOẶC họ chặn mình ⇒ không Hay được bài/bình luận của họ
 * (404 như không thấy — không lộ ai chặn ai). Hay bình luận còn soi cả chủ bài. Bỏ Hay luôn được
 * (gỡ dấu của mình không làm phiền ai).
 */
export async function hayToggle(req: Request, t: "post" | "comment", rawId: string): Promise<NextResponse> {
  if (!isUuid(rawId)) return kErr(404, "not_found");
  const body = await jsonBody(req);
  const on = (body as { on?: unknown } | null)?.on;
  if (typeof on !== "boolean") return kErr(400, "bad_body");
  const w = await requireWriter(req, { allowBanned: !on });
  if (!w.ok) return w.res;
  const { store, phone } = w;
  if (!allowRequest(HAY_STORE, phone, Date.now(), KAIROS_RATES.hay)) return kErr(429, "rate_limited");
  const id = rawId.toLowerCase();
  try {
    const blocked = await store.edgesFrom("block", phone);
    if (t === "post") {
      const p = await store.getPost(id);
      if (!postVisible(p, phone, blocked)) return kErr(404, "not_found");
      if (on && (await blockedEitherWay(store, phone, blocked, p.author_phone))) return kErr(404, "not_found");
    } else {
      const c = await store.getComment(id);
      if (!c || c.hidden || blocked.includes(c.author_phone)) return kErr(404, "not_found");
      const p = await store.getPost(c.post_id);
      if (!postVisible(p, phone, blocked)) return kErr(404, "not_found");
      if (on && ((await blockedEitherWay(store, phone, blocked, c.author_phone)) || (await blockedEitherWay(store, phone, blocked, p.author_phone)))) {
        return kErr(404, "not_found");
      }
    }
    await store.setHay(t, id, phone, on);
    const fresh = t === "post" ? await store.getPost(id) : await store.getComment(id);
    return NextResponse.json({ ok: true, on, hayCount: fresh?.hay_count ?? 0 });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

/** Tác giả công khai của MỘT hồ sơ (trang người dùng, /me) — cùng luật dto.authorDto. */
export async function profileAuthor(store: KairosStore, profile: ProfileFull) {
  const [boats, buyers] = await Promise.all([store.boatsOf([profile.phone]), store.buyerNamesOf([profile.phone])]);
  const x = boatExtra(boats.get(profile.phone), portName, buyers.get(profile.phone));
  return authorDto(profile.phone, {
    viewer: null,
    profiles: new Map([[profile.phone, profile]]),
    sublines: new Map(x.subline ? [[profile.phone, x.subline]] : []),
    boats: new Map(x.boatReg ? [[profile.phone, x.boatReg]] : []),
    mediaUrl: (p) => store.mediaUrl(p),
  });
}

/** Theo dõi / chặn một hồ sơ. Chặn = bỏ luôn theo dõi hai chiều (kiểu Facebook). */
export async function edgeToggle(req: Request, kind: "follow" | "block", rawProfileId: string, on: boolean): Promise<NextResponse> {
  if (!isUuid(rawProfileId)) return kErr(404, "not_found");
  // bỏ theo dõi / chặn (tự vệ) vẫn được khi bị cấm; theo dõi mới thì không
  const w = await requireWriter(req, { allowBanned: !(kind === "follow" && on) });
  if (!w.ok) return w.res;
  const { store, phone } = w;
  try {
    const target = await store.profileById(rawProfileId.toLowerCase());
    if (!target) return kErr(404, "not_found");
    if (target.phone === phone) return kErr(400, "self");
    if (on) {
      const limited = await rateDenied(store, "follows+blocks", phone);
      if (limited) return limited;
    }
    await store.setEdge(kind, phone, target.phone, on);
    if (kind === "block" && on) {
      await store.setEdge("follow", phone, target.phone, false);
      await store.setEdge("follow", target.phone, phone, false);
    }
    return NextResponse.json({ ok: true, on });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

/**
 * Cửa máy GPU (/api/kairos/nhap, /api/kairos/kiem): header `x-kairos-key` so thời-gian-hằng
 * với khoá hiệu lực (env KAIROS_INGEST_KEY đè, không thì app_config.kairos_ingest_key).
 * Thiếu cả hai ⇒ 503 `not_configured` — KHÔNG BAO GIỜ mở. Sai ⇒ 401. null = cho qua.
 */
export async function ingestKeyDenied(req: Request): Promise<NextResponse | null> {
  let dbVal: string | null = null;
  try {
    dbVal = await getConfigValue("kairos_ingest_key");
  } catch (e) {
    console.error("[kairos] đọc khoá nhập tin hỏng:", (e as Error)?.message);
  }
  const verdict = checkIngestKey(req.headers.get(INGEST_KEY_HEADER), effectiveIngestKey(process.env.KAIROS_INGEST_KEY, dbVal));
  if (verdict === "unconfigured") return kErr(503, "not_configured");
  if (verdict === "bad") return kErr(401, "bad_key");
  return null;
}

/**
 * Ghi MỘT quyết định kiểm duyệt (agent hoặc người trực) rồi áp trạng thái (quyet-dinh.stateFor).
 * Agent không đè người trực (agentMayDecide ⇒ 'skipped'). Ẩn ⇒ đóng báo xấu đang mở của đích;
 * agent tự ẩn bài/bình luận bà con ⇒ báo người đăng lý do + nhật ký `he-thong` (AC24b).
 */
export async function applyDecision(
  store: KairosStore,
  d: {
    targetType: "post" | "comment";
    targetId: string;
    verdict: Verdict;
    reason: string | null;
    score: number | null;
    by: "agent" | "staff";
    actor: string;
    rulesVersion: string | null;
    model: string | null;
    overrides: number | null;
  },
): Promise<"applied" | "skipped" | "missing"> {
  const isPost = d.targetType === "post";
  const target = isPost ? await store.getPost(d.targetId) : await store.getComment(d.targetId);
  if (!target) return "missing";
  if (d.by === "agent") {
    const latest = (await store.latestDecisions(d.targetType, [d.targetId])).get(d.targetId);
    if (!agentMayDecide(latest)) return "skipped";
  }
  await store.insertDecision({
    target_type: d.targetType, target_id: d.targetId, decided_by: d.by, actor: d.actor, verdict: d.verdict, reason: d.reason,
    score: d.score, rules_version: d.rulesVersion, model: d.model, overrides: d.overrides,
  });
  const nowIso = new Date().toISOString();
  const patch = { ...stateFor(d.verdict, d.by, isPost, d.reason), mod_checked_at: nowIso };
  if (isPost) await store.updatePost(d.targetId, { ...patch, ...feedAtOnApprove(target as PostFull, d.verdict, nowIso) });
  else await store.updateComment(d.targetId, patch);
  if (d.verdict === "chan") await store.resolveReports(d.targetType, d.targetId, "da-an", d.actor, nowIso);
  else if (d.by === "staff" && d.verdict === "dat") await store.resolveReports(d.targetType, d.targetId, "bo-qua", d.actor, nowIso);

  const kind = isPost ? (target as PostFull).kind : "ba-con";
  if (shouldTellAuthor(d.verdict, d.by, kind)) {
    // Đã ẩn sẵn (người trực / ≥5 báo xấu ẩn trước) ⇒ KHÔNG báo người đăng lần nữa, nhưng VẪN ghi
    // nhật ký: mọi quyết định ẩn của agent phải truy được, kể cả khi trùng việc đã làm.
    const already = target.hidden;
    if (target.author_phone && !already) {
      const postId = isPost ? target.id : (target as CommentFull).post_id;
      await notifyMarket(target.author_phone, {
        title: isPost ? "Bài của bạn đã bị ẩn" : "Bình luận của bạn đã bị ẩn",
        body: `Lý do: ${(d.reason ?? "vi phạm nội quy Kairos").slice(0, 200)}. Người trực SDVICO sẽ xem lại nếu bạn liên hệ.`,
        url: `/kairos/p/${postId}`,
        sentBy: KAIROS_PUSH_SENT_BY,
        pushOs: false,
      });
    }
    await auditQuiet(store, {
      actor: "agent", actor_kind: "he-thong", action: "agent_hide", target_type: d.targetType, target_id: d.targetId,
      detail: { reason: d.reason, score: d.score, rulesVersion: d.rulesVersion, ...(already ? { alreadyHidden: true, note: "đích đã ẩn sẵn trước quyết định này — không báo lại người đăng" } : {}) },
    });
  }
  return "applied";
}

// ── Dọn ảnh mồ côi (agent kiểm duyệt gọi mỗi lượt) ─────────────────────────

/** Ảnh tải lên quá ngần này mà không thuộc bài nào / không là ảnh đại diện ⇒ mồ côi. */
export const MEDIA_GC_AGE_MS = 24 * 60 * 60 * 1000;
/** Chỉ soi ảnh tải trong 7 ngày qua (cũ hơn đã soi ở các lượt trước). */
export const MEDIA_GC_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MEDIA_GC_BATCH = 200;

/**
 * Xoá ảnh kairos-media tải lên >24 giờ mà không dùng (Huỷ khung soạn lúc mất sóng, đóng app giữa
 * chừng, ảnh đại diện tải rồi Huỷ — A48). Mỗi ảnh đã soi để dấu `media_gc` (removed true/false)
 * ⇒ không soi lại. Kho xoá lỗi ⇒ ném (route 500), không đóng dấu — lượt sau thử lại.
 */
export async function gcOrphanMedia(store: KairosStore, now = Date.now()): Promise<{ checked: number; removed: number }> {
  const cands = await store.uploadsToCheck(new Date(now - MEDIA_GC_LOOKBACK_MS).toISOString(), new Date(now - MEDIA_GC_AGE_MS).toISOString(), MEDIA_GC_BATCH);
  if (!cands.length) return { checked: 0, removed: 0 };
  const inUse = await store.mediaInUse(cands);
  const drop = orphanUploads(cands, [...inUse]);
  await store.removeImages(drop);
  const dropped = new Set(drop);
  for (const p of cands) {
    await auditQuiet(store, { actor: "agent", actor_kind: "he-thong", action: "media_gc", target_type: "image", target_id: p, detail: { removed: dropped.has(p) } });
  }
  return { checked: cands.length, removed: drop.length };
}

// ── Quản trị ───────────────────────────────────────────────────────────

/** Bài cho người trực: DTO công khai (không SĐT) + trạng thái kiểm duyệt. */
export async function adminPosts(store: KairosStore, rows: PostFull[]) {
  const dto = await hydratePosts(store, rows, null, [], { topComments: false });
  return rows.map((r, i) => ({ ...dto[i], hidden: r.hidden, hiddenReason: r.hidden_reason, modState: r.mod_state, createdAt: r.created_at }));
}
export async function adminComments(store: KairosStore, rows: CommentFull[]) {
  const dto = await hydrateComments(store, rows, null);
  return rows.map((r, i) => ({ ...dto[i], hidden: r.hidden, modState: r.mod_state }));
}

/**
 * Dữ liệu cho trang công khai `/k/[id]` (server render, người CHƯA có app — 14 §3.6, AC11):
 * nhìn như khách — bài + 2 bình luận đầu, không SĐT, không cờ của ai. Bài ẩn / báo chưa duyệt /
 * đã xoá / mã lạ ⇒ null ("Bài này không còn"). Kho chưa cấu hình ⇒ ném KairosError('unavailable').
 */
export async function loadPublicPost(rawId: string): Promise<KairosPost | null> {
  if (!isUuid(rawId)) return null;
  const store = await getKairosStore();
  if (!store) throw new KairosError("unavailable");
  const row = await store.getPost(rawId.toLowerCase());
  if (!postVisible(row, null, [])) return null;
  const [post] = await hydratePosts(store, [row], null, []);
  return post ?? null;
}
