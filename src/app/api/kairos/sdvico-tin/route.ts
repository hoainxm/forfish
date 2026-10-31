// POST /api/kairos/sdvico-tin — TIN TRIỂN KHAI SDVICO (máy GPU, scripts/kairos-trien-khai.mjs; anh Long 2026-10-31: "các tin này
// … quảng bá cho công ty theo hướng info công ty đã triển khai" · "tự đăng luôn, liên quan tiền bạc hoặc chính sách hay nhạy cảm
// thì mới cần duyệt"). Thân {body, anh: [{data: base64 JPEG/PNG/WebP ≤ 500 KB}] 1–5}.
//
// Cửa: header `x-kairos-key` như /nhap (ingestKeyDenied). Máy chủ KIỂM LẠI chữ (`loiTin`: không số tiền — tiền phải qua duyệt
// tay, script không được gửi —, không SĐT, không số tàu, không mở "bà con ơi") + chữ bậy + chống phá + chủ quyền. Bài đứng tên
// hồ sơ SDVICO (`sdvico:chinh-thuc`, dấu Chính thức), kind chinh-thuc, KHÔNG ghim, mod_state dat, topic kinh-te. Trần
// TRAN_TIN_NGAY bài / 24 giờ (audit `sdvico_tin`) — máy chạy lặp cũng không ngập dòng tin. Nhật ký trước, đăng sau.
import { NextResponse } from "next/server";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { chongPhaFlag } from "@/lib/kairos/chong-pha.mjs";
import { chuQuyenFlag } from "@/lib/kairos/chu-quyen.mjs";
import { tagArea } from "@/lib/kairos/khu-vuc.mjs";
import { badWordHit } from "@/lib/kairos/loc-chu";
import { hydratePosts, ingestKeyDenied, jsonBody, kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";
import { ANH_TOI_DA, loiTin, TRAN_TIN_NGAY } from "@/lib/kairos/tin-trien-khai.mjs";
import { SDVICO_PHONE } from "@/lib/kairos/types";
import { sniffImageMime, UPLOAD_MAX_BYTES, type UploadMime } from "@/lib/market/route-utils";

const NGAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  const b = (await jsonBody(req)) as { body?: unknown; anh?: unknown } | null;
  if (!b || typeof b !== "object") return kErr(400, "bad_body");
  const loi = loiTin(b.body);
  if (loi) return kErr(400, loi);
  const body = String(b.body).trim();
  if (badWordHit(body)) return kErr(400, "bad_words");
  if (chongPhaFlag(body)) return kErr(400, "anti_state");
  if (chuQuyenFlag(body)) return kErr(400, "sovereignty");
  const ds = Array.isArray(b.anh) ? b.anh : [];
  if (ds.length < 1 || ds.length > ANH_TOI_DA) return kErr(400, "bad_image_count");
  const anh: { bytes: Uint8Array; mime: UploadMime }[] = [];
  for (const a of ds) {
    const data = (a as { data?: unknown })?.data;
    if (typeof data !== "string" || data.length > UPLOAD_MAX_BYTES * 1.4) return kErr(400, "bad_image");
    const bytes = new Uint8Array(Buffer.from(data, "base64"));
    const mime = bytes.length <= UPLOAD_MAX_BYTES ? sniffImageMime(bytes) : null;
    if (!mime) return kErr(400, "bad_image");
    anh.push({ bytes, mime });
  }
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  const now = Date.now();
  try {
    const sd = await store.profileByPhone(SDVICO_PHONE);
    if (!sd) return kErr(503, "no_sdvico_profile");
    if ((await store.countAudit("may-thu", "sdvico_tin", new Date(now - NGAY_MS).toISOString())) >= TRAN_TIN_NGAY) {
      return kErr(429, "rate_limited");
    }
    try {
      await store.audit({ actor: "may-thu", actor_kind: "he-thong", action: "sdvico_tin", target_type: "post", detail: { anh: anh.length } });
    } catch {
      return kErr(503, "audit_failed");
    }
    const images: string[] = [];
    for (const a of anh) {
      const ext = a.mime === "image/png" ? "png" : a.mime === "image/webp" ? "webp" : "jpg";
      const duong = `${sd.id}/${crypto.randomUUID()}.${ext}`;
      await store.uploadImage(duong, a.bytes, a.mime);
      images.push(duong);
    }
    const area = tagArea(body, { ports: FISHING_PORTS });
    const row = await store.insertPost({
      kind: "chinh-thuc",
      author_phone: SDVICO_PHONE,
      body,
      images,
      topic: "kinh-te",
      regions: area.regions,
      provinces: area.provinces,
      ports: area.ports.slice(0, 3),
      reshare_of: null,
      pinned_until: null,
      mod_state: "dat",
    });
    const [post] = await hydratePosts(store, [row], null, []);
    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
