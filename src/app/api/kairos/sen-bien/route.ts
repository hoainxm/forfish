// POST /api/kairos/sen-bien — SEN BIỂN ĐĂNG BÀI (máy GPU). Hai loại bài, phân biệt bằng thân:
//   {body, chuDe} — GIỚI THIỆU app (scripts/kairos-sen-bien.mjs; anh Long 2026-10-24: "cho sen biển giới thiệu về mạng xã
//     hội dành riêng cho bà con, đọc báo, trợ lý ..."): `chuDe` ∈ sen-bien-gioi-thieu.CHU_DE; bài qua loiBai; topic doi-song.
//   {body, luat}  — TUYÊN TRUYỀN LUẬT Nghị định 246/2026 (scripts/kairos-luat.mjs; anh Long 2026-10-26: "cho kairos chạy
//     tuyên truyền các quy định liên quan luật và xử lý vi phạm hành chính mới"): `luat` ∈ tuyen-truyen-luat.MUC; bài PHẢI
//     chứa nguyên văn trích + dòng căn cứ của đúng mục (loiBaiLuat — không ai sửa được số tiền phạt), topic chinh-sach ⇒
//     lên tab Chính sách (loại "Quy định") lẫn dòng tin chung.
//
// Cửa: header `x-kairos-key` như /nhap (ingestKeyDenied). Lọc chữ bậy. Bài đứng tên hồ sơ Sen Biển (sentinel
// `sen-bien:tro-ly`, seed 0068, dấu Chính thức), kind chinh-thuc, KHÔNG ghim, mod_state dat.
// Trần 4 bài / 20 giờ cả hai loại (1 giới thiệu + ≤2 luật mỗi ngày; máy hỏng chạy lặp cũng không ngập dòng tin).
// Nhật ký trước, đăng sau.
import { NextResponse } from "next/server";
import { CHU_DE, loiBai } from "@/lib/kairos/sen-bien-gioi-thieu.mjs";
import { MUC, loiBaiLuat } from "@/lib/kairos/tuyen-truyen-luat.mjs";
import { badWordHit } from "@/lib/kairos/loc-chu";
import { hydratePosts, ingestKeyDenied, jsonBody, kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";
import { SEN_BIEN_PHONE } from "@/lib/kairos/types";

const TRAN = 4;
const CUA_SO_MS = 20 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  const b = (await jsonBody(req)) as { body?: unknown; chuDe?: unknown; luat?: unknown } | null;
  if (!b || typeof b !== "object") return kErr(400, "bad_body");
  const muc = b.luat != null ? MUC.find((m) => m.id === b.luat) : undefined;
  const chuDe = b.luat == null ? CHU_DE.find((c) => c.id === b.chuDe) : undefined;
  if (!muc && !chuDe) return kErr(400, "bad_topic");
  const loi = muc ? loiBaiLuat(b.body, muc) : loiBai(b.body);
  if (loi) return kErr(400, loi);
  const topic = muc ? "chinh-sach" : "doi-song";
  const detail = muc ? { luat: muc.id, dieu: muc.dieu } : { chuDe: chuDe!.id };
  const body = String(b.body).trim();
  if (badWordHit(body)) return kErr(400, "bad_words");
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  const now = Date.now();
  try {
    const sen = await store.profileByPhone(SEN_BIEN_PHONE);
    if (!sen) return kErr(503, "no_sen_bien_profile"); // 0068 chưa áp
    const da = await store.countSince("posts", SEN_BIEN_PHONE, new Date(now - CUA_SO_MS).toISOString());
    if (da >= TRAN) return kErr(429, "rate_limited");
    try {
      await store.audit({ actor: "may-thu", actor_kind: "he-thong", action: "sen_bien_post", target_type: "post", detail });
    } catch {
      return kErr(503, "audit_failed");
    }
    const row = await store.insertPost({
      kind: "chinh-thuc",
      author_phone: SEN_BIEN_PHONE,
      body,
      images: [],
      topic,
      regions: [],
      provinces: [],
      ports: [],
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
