// GET /api/kairos/feed — DÒNG TIN KAIROS (14 §3.2, §7, AC02/AC03/AC13/AC14; 14-ba-spec-kairos §13).
//
// Khách đọc được (identityFromRequest anonymous). 20 bài/trang, con trỏ mờ `next`; kèm 2 bình luận nhiều Hay
// nhất mỗi bài. Trang đầu dòng tin mặc định trả thêm `pinned` — bài Chính thức còn ghim, đã bỏ khỏi `posts`.
//
// HAI ĐƯỜNG (2026-10-24, anh Long: "nâng lên" — phân phối tin theo người đọc ở máy chủ):
//   · DÒNG TIN MẶC ĐỊNH (không lọc cảng/người/chủ đề/theo dõi) ⇒ XẾP THEO NGƯỜI ĐỌC: lấy ≤ UNG_VIEN bài mới nhất
//     trước mốc chụp, chấm điểm + đan xen (lib/kairos/phan-phoi.ts) theo tín hiệu đọc của SĐT (kairos_reads) +
//     cảng/tỉnh nhà app gửi (`nha`, `tinh` — chỉ MÃ, không hồ sơ đọc), chia trang bằng con trỏ `pp.`.
//     Hết danh sách xếp ⇒ `next` chuyển sang con trỏ theo giờ ⇒ dòng tin cũ hơn tiếp tục như trước.
//   · Bến / trang người dùng / theo dõi / con trỏ theo giờ ⇒ (feed_at desc, id desc) như cũ.
// XÁO MỖI LẦN LÀM MỚI (2026-10-24): `hat=<số>` ⇒ nhiễu cố định theo (hạt, bài) — app đổi hạt mỗi lần vuốt xuống làm mới;
// trang sau mang hạt trong con trỏ `pp.` (phan-phoi.NHIEU_XAO).
// TUỲ CHỌN DÒNG TIN (lib/kairos/tuy-chon.ts, chỉ dòng tin mặc định): `thich=<mã,mã>` ⇒ chủ đề đó được cộng điểm
// (ưu tiên, không lọc; mã lạ bỏ qua, không 400) · `ai=0` ⇒ bỏ bài agent tri thức (`agent:` sentinel) TRƯỚC khi xếp,
// và cả ở đoạn nối tiếp theo giờ.
//
// ⚠️ KHÔNG cache ở service worker: gắn danh tính (hayByMe, mine, chặn). Không vào API_CACHE_ALLOW.
import { NextResponse } from "next/server";
import { encodeCursor } from "@/lib/kairos/cursor";
import { parseFeedParams } from "@/lib/kairos/feed-query";
import { PROVINCE_IDS, regionsOfProvince } from "@/lib/kairos/khu-vuc.mjs";
import { docHat, giaiMaPP, laBaiAgent, maHoaPP, UNG_VIEN, xepDongTin } from "@/lib/kairos/phan-phoi";
import { tinHieuCua } from "@/lib/kairos/phan-phoi-store";
import { feedFilterFor, hydratePosts, kErr, kairosErrorResponse, PORT_IDS, readerOf, storeOr503 } from "@/lib/kairos/server";
import { docThamSo } from "@/lib/kairos/tuy-chon";
import { LIMITS } from "@/lib/kairos/types";

const PROVINCE_SET = new Set<string>(PROVINCE_IDS as readonly string[]);

export async function GET(req: Request) {
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  const sp = new URL(req.url).searchParams;
  const parsed = parseFeedParams(sp, PORT_IDS);
  if (!parsed.ok) return kErr(400, parsed.code);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  const p = parsed.value;
  const now = Date.now();
  const rawCursor = sp.get("cursor");
  const pp = giaiMaPP(rawCursor, now);
  const macDinh = p.chip === "moi" && !p.ports && !p.authorProfileId && !p.near && !p.topic && !p.theoDoi;
  const tuyChon = docThamSo(sp);
  const boAgent = macDinh && !tuyChon.ai;
  try {
    const f = await feedFilterFor(store, p, who.phone, now);
    if (!f.ok) return f.res;

    let page;
    let next: string | null;
    if (macDinh && (!rawCursor || pp)) {
      // ── xếp theo người đọc ──
      const at = pp?.at ?? new Date(now).toISOString();
      // hạt xáo: trang đầu lấy từ `hat` app gửi (đổi mỗi lần vuốt làm mới), trang sau lấy lại từ con trỏ
      const hat = pp ? pp.hat : docHat(sp.get("hat"));
      const off = pp?.off ?? 0;
      const nha = sp.get("nha");
      const tinh = sp.get("tinh");
      const home = {
        port: nha && PORT_IDS.has(nha) ? nha : null,
        province: tinh && PROVINCE_SET.has(tinh) ? tinh : null,
        regions: tinh && PROVINCE_SET.has(tinh) ? (regionsOfProvince(tinh) as string[]) : [],
      };
      // bài lên dòng tin SAU mốc chụp không vào danh sách này (trang sau không lẫn bài mới — "Có N bài mới" lo)
      const [ungVien, reads, follows] = await Promise.all([
        store.listPosts({ ...f.filter, cursor: { at: new Date(Date.parse(at) + 1).toISOString(), id: "ffffffff-ffff-ffff-ffff-ffffffffffff" } }, UNG_VIEN),
        tinHieuCua(who.phone),
        who.phone ? store.edgesFrom("follow", who.phone) : Promise.resolve([] as string[]),
      ]);
      const conLai = boAgent ? ungVien.filter((r) => !laBaiAgent(r)) : ungVien;
      const thich = tuyChon.thich.size ? tuyChon.thich : undefined;
      const xep = xepDongTin(conLai, { reads, follows: new Set(follows), home, thich, hat }, Date.parse(at), LIMITS.pageSize);
      page = xep.slice(off, off + LIMITS.pageSize);
      if (off + LIMITS.pageSize < xep.length) next = maHoaPP({ at, off: off + LIMITS.pageSize, hat });
      else {
        // hết danh sách xếp ⇒ tiếp theo giờ từ bài CŨ NHẤT trong ứng viên (danh sách ứng viên theo feed_at desc)
        const cuoi = ungVien.length === UNG_VIEN ? ungVien[ungVien.length - 1] : null;
        next = cuoi ? encodeCursor({ at: cuoi.feed_at, id: cuoi.id }) : null;
      }
    } else {
      const rows = await store.listPosts(f.filter, LIMITS.pageSize + 1);
      const trang = rows.slice(0, LIMITS.pageSize);
      const last = trang[trang.length - 1];
      next = rows.length > LIMITS.pageSize && last ? encodeCursor({ at: last.feed_at, id: last.id }) : null;
      // con trỏ tính TRƯỚC khi bỏ bài agent ⇒ trang ngắn hơn nhưng không lặp/không mất bài
      page = boAgent ? trang.filter((r) => !laBaiAgent(r)) : trang;
    }

    const firstMoi = !rawCursor && macDinh;
    const pinnedRows = firstMoi ? await store.pinnedPosts(new Date(now).toISOString()) : [];
    const pinnedIds = new Set(pinnedRows.map((r) => r.id));
    const [posts, pinned] = await Promise.all([
      hydratePosts(store, page.filter((r) => !pinnedIds.has(r.id)), who.phone, f.blocked),
      hydratePosts(store, pinnedRows, who.phone, f.blocked),
    ]);
    return NextResponse.json({ ok: true, posts, pinned, next, at: new Date(now).toISOString() });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
