// POST /api/kairos/sen-bien — SEN BIỂN ĐĂNG BÀI GIỚI THIỆU (máy GPU, scripts/kairos-sen-bien.mjs; anh Long 2026-10-24:
// "cho sen biển giới thiệu về mạng xã hội dành riêng cho bà con, đọc báo, trợ lý ...").
//
// Cửa: header `x-kairos-key` như /nhap (ingestKeyDenied). Thân {body, chuDe}: `chuDe` phải là một id trong
// sen-bien-gioi-thieu.CHU_DE; bài qua loiBai (độ dài, không link/emoji/hashtag, chủ quyền) + lọc chữ bậy. Bài đứng tên
// hồ sơ Sen Biển (sentinel `sen-bien:tro-ly`, seed 0068, dấu Chính thức), kind chinh-thuc, KHÔNG ghim, mod_state dat.
// Trần 2 bài / 20 giờ (máy hỏng chạy lặp cũng không ngập dòng tin). Nhật ký trước, đăng sau.
import { NextResponse } from "next/server";
import { CHU_DE, loiBai } from "@/lib/kairos/sen-bien-gioi-thieu.mjs";
import { badWordHit } from "@/lib/kairos/loc-chu";
import { hydratePosts, ingestKeyDenied, jsonBody, kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";
import { SEN_BIEN_PHONE } from "@/lib/kairos/types";

const TRAN = 2;
const CUA_SO_MS = 20 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  const b = (await jsonBody(req)) as { body?: unknown; chuDe?: unknown } | null;
  if (!b || typeof b !== "object") return kErr(400, "bad_body");
  const chuDe = CHU_DE.find((c) => c.id === b.chuDe);
  if (!chuDe) return kErr(400, "bad_topic");
  const loi = loiBai(b.body);
  if (loi) return kErr(400, loi);
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
      await store.audit({ actor: "may-thu", actor_kind: "he-thong", action: "sen_bien_post", target_type: "post", detail: { chuDe: chuDe.id } });
    } catch {
      return kErr(503, "audit_failed");
    }
    const row = await store.insertPost({
      kind: "chinh-thuc",
      author_phone: SEN_BIEN_PHONE,
      body,
      images: [],
      topic: "doi-song",
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
