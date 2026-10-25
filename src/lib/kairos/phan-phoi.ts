// KAIROS — CỖ MÁY PHÂN PHỐI DÒNG TIN Ở MÁY CHỦ (14-ba-spec-kairos §13, anh Long 2026-10-24: "nâng lên"). THUẦN.
//
// Thay xếp-trong-trang (xep-bai.ts) cho dòng tin mặc định: máy chủ lấy ≤ ỨNG_VIÊN bài mới nhất, chấm điểm THEO
// NGƯỜI ĐỌC rồi mới chia trang. Khung theo các mạng xã hội lớn (EdgeRank → mô hình "giá trị dự đoán"):
//   điểm = độ mới · hợp gu (chủ đề, tác giả — học từ bài đã XEM/MỞ/đọc lâu) · gần nhà · tương tác (Hay, bình luận)
//        · đang theo dõi; bài đã xem bị đẩy xuống (đã mở: gần đáy; lướt qua: nửa điểm);
//   rồi ĐAN XEN (giống "diversity re-rank" của FB/IG): một tác giả tối đa TRẦN_TÁC_GIẢ bài/trang và không đứng
//   liền nhau, chủ đề không quá 3 bài liền, cứ KHÁM_PHÁ_MỖI bài chừa một chỗ cho chủ đề bà con CHƯA đọc nhiều
//   (khỏi bị nhốt trong vài chủ đề). Agent tri thức (16-ba-spec-agent-kairos) đi qua đúng luật này ⇒ 2000 agent
//   hiện đan xen, không ai nói liên tục.
// Không mạng, không DB — route nạp dữ liệu (phan-phoi-store.ts) rồi gọi `xepDongTin`.

/** Số bài mới nhất đưa vào chấm (≈ 5–7 ngày tin). Hết danh sách ⇒ dòng tin nối tiếp theo giờ. */
export const UNG_VIEN = 400;
/** Nửa đời độ mới (giờ). */
export const NUA_DOI_MOI_H = 18;
/** Tín hiệu đọc cũ hơn chừng này không tính; nửa đời của tín hiệu. */
export const TIN_HIEU_CUA_SO_MS = 30 * 24 * 60 * 60 * 1000;
export const NUA_DOI_TIN_HIEU_NGAY = 14;
/** Một tác giả (người, agent, báo) tối đa bao nhiêu bài trong một trang 20. */
export const TRAN_TAC_GIA = { nguoi: 2, bao: 6 } as const;
/** Cứ chừng này bài thì chừa một chỗ khám phá. */
export const KHAM_PHA_MOI = 7;
/**
 * TỈ LỆ BIỂN (anh Long 2026-10-24: "tỷ lệ tin liên quan biển và nghề thuỷ sản phải chiếm 85%"): một trang 20 bài
 * tối đa 3 bài KHÔNG phải chuyện biển. Chỉ nới khi đã hết tin biển trong ứng viên (dòng tin không được tắt ngang).
 */
export const TRAN_KHONG_BIEN = 3;

/**
 * Bài có phải chuyện biển / nghề thuỷ sản không: bài của bà con, agent, SDVICO (mạng xã hội NGƯ DÂN), bài báo
 * chủ đề Nghề cá (chu-de.mjs đã nâng tin có từ khoá nghề cá ở mọi mục), hoặc gắn vùng Hoàng Sa–Trường Sa.
 */
export const laTinBien = (p: Pick<PPPost, "kind" | "topic" | "regions">): boolean =>
  p.kind !== "bao" || p.topic === "nghe-ca" || !!p.regions?.includes("hoang-sa-truong-sa");

/**
 * TIN NÓNG NGOÀI BIỂN (anh Long 2026-10-24: "các bài mà tin nóng thu hút thì lấy để bà con biết thứ gì đang nóng
 * ngoài thuỷ sản"): 15 % suất không-phải-biển ưu tiên tin ĐANG NÓNG thay vì tin chung chung. "Nóng" = bài vào qua
 * nguồn "Tin nổi bật" của Google News (biên tập + số báo cùng đưa tin — scripts/kairos-nguon.json `gn-noi-bat`).
 * Tin nóng mà là chuyện biển (bão, Biển Đông) thì đã nằm trong 85 % — không cộng thêm.
 */
export const NGUON_NONG: ReadonlySet<string> = new Set(["gn-noi-bat"]);
export const laTinNong = (p: Pick<PPPost, "source_id">): boolean => !!p.source_id && NGUON_NONG.has(p.source_id);
/** Cộng cho tin nóng ngoài biển — hơn nửa điểm độ mới ⇒ chiếm suất ngoài biển trước tin thường cùng tuổi. */
export const W_NONG = 0.6;

/**
 * "Thích đọc" (Tuỳ chọn dòng tin, tuy-chon.ts): chủ đề bà con chọn được cộng ngần này. Bằng nửa điểm độ mới của bài
 * vừa đăng ⇒ đẩy lên rõ nhưng không đè bài mới hơn hẳn, và KHÔNG phá trần tin biển (luật đan xen áp sau điểm).
 */
export const W_THICH = 0.5;

/** Bài của agent tri thức (16-ba-spec-agent-kairos): SĐT sentinel `agent:<mã>` — không phụ thuộc cột is_agent. */
export const laBaiAgent = (p: Pick<PPPost, "author_phone">): boolean => !!p.author_phone?.startsWith("agent:");

const W = { moi: 1, chuDe: 0.7, tacGia: 0.4, cang: 0.6, tinh: 0.4, vung: 0.2, tuongTac: 0.5, theoDoi: 0.6 } as const;

export interface PPPost {
  id: string;
  kind: string;
  author_phone: string | null;
  /** nguồn thu (bài báo) — để nhận tin nóng (NGUON_NONG); bài người ⇒ null */
  source_id?: string | null;
  outlet: string | null;
  topic: string;
  regions: readonly string[] | null;
  provinces: readonly string[] | null;
  ports: readonly string[] | null;
  hay_count: number;
  comment_count: number;
  published_at: string;
  feed_at: string;
}

/** Một dòng kairos_reads của người đọc (đã nối chủ đề + tác giả của bài). */
export interface ReadSignal {
  post_id: string;
  topic: string;
  tacGia: string;
  seen_at: string;
  opened: boolean;
  dwell_ms: number;
}

export interface Reader {
  reads: readonly ReadSignal[];
  /** SĐT đang theo dõi */
  follows: ReadonlySet<string>;
  home: { port: string | null; province: string | null; regions: readonly string[] };
  /** chủ đề "Thích đọc" bà con tự chọn (Tuỳ chọn dòng tin) — ưu tiên, không lọc */
  thich?: ReadonlySet<string>;
  /**
   * HẠT XÁO của lượt làm mới (anh Long 2026-10-24: "mỗi lần vuốt xuống refresh thì thứ tự tin random để đỡ nhàm").
   * Có ⇒ mỗi bài cộng một nhiễu cố định theo (hạt, id) trong [0, NHIEU_XAO): bài cùng tầm điểm đổi chỗ mỗi lần làm
   * mới, tin rất mới / rất hợp gu vẫn ở trên; cùng hạt ⇒ cùng thứ tự (phân trang không lặp). Luật đan xen + 85 % tin
   * biển áp SAU nhiễu nên vẫn giữ.
   */
  hat?: number;
}

/** Biên độ nhiễu xáo — nhỏ hơn W.moi (1) để bài mới hẳn không bị đẩy xuống đáy. */
export const NHIEU_XAO = 0.45;

/** Số giả ngẫu nhiên [0, 1) cố định theo (hạt, id) — FNV-1a + trộn bit. Thuần. */
export function nhieu(hat: number, id: string): number {
  let h = (2166136261 ^ (hat >>> 0)) >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Khoá tác giả: người/agent theo SĐT (hoặc sentinel), bài báo theo tên báo. */
export const tacGiaCua = (p: Pick<PPPost, "kind" | "author_phone" | "outlet">): string =>
  p.kind === "bao" ? `bao:${p.outlet ?? "?"}` : `nguoi:${p.author_phone ?? "?"}`;

const tuoiGio = (iso: string, now: number) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, (now - t) / 3_600_000) : 1e6;
};

/**
 * Gu đọc theo một khoá (chủ đề / tác giả), trong khoảng [-1, 1]. Mỗi lần XEM là một phép thử, MỞ hoặc đọc lâu là
 * một lần "thích"; tỉ lệ thích của khoá so với tỉ lệ chung của người đọc. Tín hiệu cũ mờ dần (nửa đời 14 ngày).
 * Ít dữ liệu ⇒ gần 0 (làm mượt bằng 4 phép thử ảo ở tỉ lệ chung).
 */
export function guDoc(reads: readonly ReadSignal[], khoa: (r: ReadSignal) => string, now: number): Map<string, number> {
  const thu = new Map<string, number>();
  const thich = new Map<string, number>();
  let tongThu = 0;
  let tongThich = 0;
  for (const r of reads) {
    const t = Date.parse(r.seen_at);
    if (!Number.isFinite(t) || now - t > TIN_HIEU_CUA_SO_MS) continue;
    const w = Math.pow(0.5, (now - t) / 86_400_000 / NUA_DOI_TIN_HIEU_NGAY);
    const like = (r.opened ? 1 : 0) + Math.min(1, Math.max(0, r.dwell_ms) / 20_000);
    const k = khoa(r);
    thu.set(k, (thu.get(k) ?? 0) + w);
    thich.set(k, (thich.get(k) ?? 0) + w * Math.min(1, like));
    tongThu += w;
    tongThich += w * Math.min(1, like);
  }
  const out = new Map<string, number>();
  if (tongThu <= 0) return out;
  const chung = tongThich / tongThu;
  for (const [k, n] of thu) {
    const tiLe = ((thich.get(k) ?? 0) + 4 * chung) / (n + 4);
    // chênh so với tỉ lệ chung, quy về [-1, 1]
    const d = chung > 0 ? (tiLe - chung) / Math.max(chung, 1 - chung) : 0;
    out.set(k, Math.max(-1, Math.min(1, d * 2)));
  }
  return out;
}

/** Điểm một bài cho một người đọc (chưa đan xen). Thuần, để test. */
export function diemBai(
  p: PPPost,
  r: Reader,
  now: number,
  ctx: { chuDe: Map<string, number>; tacGia: Map<string, number>; daXem: Map<string, { opened: boolean }> },
): number {
  const age = tuoiGio(p.feed_at, now);
  let s = W.moi * Math.pow(0.5, age / NUA_DOI_MOI_H);
  s += W.chuDe * (ctx.chuDe.get(p.topic) ?? 0);
  if (r.thich?.has(p.topic)) s += W_THICH;
  if (laTinNong(p) && !laTinBien(p)) s += W_NONG;
  const tg = tacGiaCua(p);
  s += W.tacGia * (ctx.tacGia.get(tg) ?? 0);
  if (r.home.port && p.ports?.includes(r.home.port)) s += W.cang;
  else if (r.home.province && p.provinces?.includes(r.home.province)) s += W.tinh;
  else if (r.home.regions.some((x) => p.regions?.includes(x))) s += W.vung;
  // tương tác: bình luận nặng gấp đôi Hay; bão hoà ở ~40; mờ theo tuổi bài (bài cũ nhiều Hay không chiếm mãi)
  const tt = Math.min(1, Math.log1p(Math.max(0, p.hay_count) + 2 * Math.max(0, p.comment_count)) / Math.log1p(40));
  s += W.tuongTac * tt * Math.pow(0.5, age / 36);
  if (p.author_phone && r.follows.has(p.author_phone)) s += W.theoDoi;
  const xem = ctx.daXem.get(p.id);
  if (xem) s = xem.opened ? s * 0.15 - 1 : s * 0.5;
  return s;
}

/** Bài người thật được ưu tiên trong chừng này giờ kể từ lúc lên dòng tin. */
export const UU_TIEN_NGUOI_THAT_H = 72;

/** Bài do NGƯỜI THẬT đăng (bà con, không phải agent AI, không phải bài báo/chính thức). */
export const laBaiNguoiThat = (p: Pick<PPPost, "kind" | "author_phone">): boolean => p.kind === "ba-con" && !!p.author_phone && !laBaiAgent(p);

const tranTacGia = (tg: string) => (tg.startsWith("bao:") ? TRAN_TAC_GIA.bao : TRAN_TAC_GIA.nguoi);

/**
 * Xếp TOÀN BỘ ứng viên cho một người đọc: chấm điểm rồi đan xen theo từng trang `trang` bài.
 * Thứ tự hoàn toàn xác định (hoà điểm ⇒ giữ thứ tự máy chủ: feed_at desc) ⇒ cùng dữ liệu + cùng hạt xáo cùng kết quả,
 * phân trang bằng vị trí không lặp bài.
 */
export function xepDongTin<T extends PPPost>(posts: readonly T[], r: Reader, now: number, trang = 20): T[] {
  const chuDe = guDoc(r.reads, (x) => x.topic, now);
  const tacGia = guDoc(r.reads, (x) => x.tacGia, now);
  const daXem = new Map<string, { opened: boolean }>();
  for (const x of r.reads) {
    const cu = daXem.get(x.post_id);
    daXem.set(x.post_id, { opened: (cu?.opened ?? false) || x.opened });
  }
  const ctx = { chuDe, tacGia, daXem };
  /*  BÀI NGƯỜI THẬT LUÔN ĐỨNG ĐẦU (anh Long 2026-10-24: "luôn ưu tiên bài do người thật"): bài bà con đăng trong
      UU_TIEN_NGUOI_THAT_H giờ mà người đọc CHƯA mở ⇒ lên trước mọi bài báo/agent, mới nhất trước, KHÔNG qua luật đan xen
      hay trần 85 % tin biển (bài "Giao lưu" chủ đề đời sống trước đây bị trần ngoài-biển đẩy xuống sâu). Đã mở rồi
      ⇒ về lại máy chấm điểm như mọi bài, để đầu dòng tin không đứng yên mãi. */
  const truoc: T[] = [];
  const conLai: T[] = [];
  for (const p of posts) {
    if (laBaiNguoiThat(p) && tuoiGio(p.feed_at, now) <= UU_TIEN_NGUOI_THAT_H && !daXem.get(p.id)?.opened) truoc.push(p);
    else conLai.push(p);
  }
  truoc.sort((a, b) => Date.parse(b.feed_at) - Date.parse(a.feed_at) || (a.id < b.id ? 1 : -1));
  const con = conLai.map((p, i) => ({
    p,
    s: diemBai(p, r, now, ctx) + (r.hat != null ? NHIEU_XAO * nhieu(r.hat, p.id) : 0),
    i,
    tg: tacGiaCua(p),
  }));
  con.sort((a, b) => b.s - a.s || a.i - b.i);

  const out: T[] = [...truoc];
  let demTrang = new Map<string, number>();
  let khongBien = 0;
  const tranKhongBien = Math.round((TRAN_KHONG_BIEN * trang) / 20);
  const gan: { tg: string; topic: string }[] = [];
  while (con.length) {
    if (out.length % trang === 0) {
      demTrang = new Map();
      khongBien = 0;
    }
    const viTri = out.length % trang;
    const khamPha = viTri > 0 && viTri % KHAM_PHA_MOI === 0;
    // Luật đan xen theo độ "cứng": không bài nào qua đủ ⇒ nới dần từ luật mềm nhất (chủ đề liền, khám phá,
    // tác giả đứng liền); tỉ lệ biển nới gần cuối, trần tác giả/trang nới SAU CÙNG.
    const luat = [
      (c: (typeof con)[number]) => (demTrang.get(c.tg) ?? 0) < tranTacGia(c.tg),
      (c: (typeof con)[number]) => laTinBien(c.p) || khongBien < tranKhongBien,
      (c: (typeof con)[number]) => !(gan.length && gan[gan.length - 1].tg === c.tg),
      (c: (typeof con)[number]) => !khamPha || (chuDe.get(c.p.topic) ?? 0) <= 0,
      (c: (typeof con)[number]) => !(gan.length >= 3 && gan.slice(-3).every((g) => g.topic === c.p.topic)),
    ];
    let chon = -1;
    for (let giu = luat.length; giu >= 0 && chon < 0; giu--) {
      const ap = luat.slice(0, giu);
      chon = con.findIndex((c) => ap.every((f) => f(c)));
    }
    const [c] = con.splice(chon, 1);
    out.push(c.p);
    demTrang.set(c.tg, (demTrang.get(c.tg) ?? 0) + 1);
    if (!laTinBien(c.p)) khongBien++;
    gan.push({ tg: c.tg, topic: c.p.topic });
    if (gan.length > 4) gan.shift();
  }
  return out;
}

// ───────── Con trỏ của dòng tin xếp theo người đọc ─────────
// "pp.<base64url JSON>" — tách hẳn con trỏ theo giờ (cursor.ts) để route nhận ra đường nào.

export interface PPCursor {
  /** mốc chụp ứng viên: chỉ bài lên dòng tin TRƯỚC mốc này (trang sau không lẫn bài mới) */
  at: string;
  /** vị trí trong danh sách đã xếp */
  off: number;
  /** hạt xáo của lượt làm mới — trang sau dùng lại để cùng thứ tự */
  hat?: number;
}

/** Hạt xáo hợp lệ: số nguyên 0…2^31-1; lạ ⇒ undefined (xếp không xáo). */
export function docHat(raw: unknown): number | undefined {
  const n = typeof raw === "string" && /^\d{1,10}$/.test(raw) ? Number(raw) : typeof raw === "number" ? raw : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 2147483647 ? n : undefined;
}

export function maHoaPP(c: PPCursor): string {
  return `pp.${Buffer.from(JSON.stringify({ a: c.at, o: c.off, ...(c.hat != null ? { h: c.hat } : {}) })).toString("base64url")}`;
}

export function giaiMaPP(raw: string | null | undefined, now: number): PPCursor | null {
  if (!raw || !raw.startsWith("pp.") || raw.length > 200) return null;
  try {
    const o = JSON.parse(Buffer.from(raw.slice(3), "base64url").toString("utf8")) as { a?: unknown; o?: unknown; h?: unknown };
    if (typeof o.a !== "string" || typeof o.o !== "number" || !Number.isInteger(o.o) || o.o < 0 || o.o > UNG_VIEN) return null;
    const t = Date.parse(o.a);
    // mốc quá cũ (app để nền nhiều ngày) hoặc ở tương lai ⇒ coi như hỏng, app tải lại trang đầu
    if (!Number.isFinite(t) || t > now + 60_000 || now - t > 2 * 86_400_000) return null;
    const hat = docHat(o.h);
    return { at: new Date(t).toISOString(), off: o.o, ...(hat != null ? { hat } : {}) };
  } catch {
    return null;
  }
}
