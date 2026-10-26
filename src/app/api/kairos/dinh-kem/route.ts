// PUT /api/kairos/dinh-kem — MÁY THU TIN GỬI DÒNG DANH SÁCH đọc từ file PDF đính kèm thông báo gov (14 §21b, 0075).
//
// Cửa: cùng khoá `x-kairos-key` với /nhap (thiếu khoá 503, sai 401). Gói: { postUrl, url, rows: [{stt, ten, reg, noiDung,
// page}] } ≤5000 dòng — máy chủ kiểm lại từng dòng (chinh-sach.kiemDongDanhSach: reg đúng dạng, chữ có trần) và chỉ nhận
// khi bài có thật (tra theo băm link bài) và `url` nằm trong `attachments` của bài (không gắn dòng vào file lạ).
// THAY cả bộ dòng của (bài, file): máy thu gửi lại không trùng. Trả { ok, inserted, postId }; bài chưa có ⇒ 404 not_found,
// file không thuộc bài ⇒ 400 bad_attachment.
import { NextResponse } from "next/server";
import { kiemDinhKem, kiemDongDanhSach } from "@/lib/kairos/chinh-sach.mjs";
import { urlHash } from "@/lib/kairos/lien-ket.mjs";
import { auditQuiet, ingestKeyDenied, jsonBody, kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";

export async function PUT(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  const raw = (await jsonBody(req)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return kErr(400, "bad_body");
  const postHash = typeof raw.postUrl === "string" ? urlHash(raw.postUrl) : null;
  const fileUrl = typeof raw.url === "string" ? raw.url.trim() : "";
  const fileHash = fileUrl ? urlHash(fileUrl) : null;
  if (!postHash || !fileHash) return kErr(400, "bad_body");
  const rows = kiemDongDanhSach(raw.rows);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const post = await store.postByUrlHash(postHash);
    if (!post) return kErr(404, "not_found");
    const dinhKem = kiemDinhKem((post as { attachments?: unknown }).attachments);
    if (!dinhKem.some((a) => urlHash(a.url) === fileHash)) return kErr(400, "bad_attachment");
    const inserted = await store.replaceDinhKemDong(post.id, fileHash, rows);
    await auditQuiet(store, { actor: "may-thu", actor_kind: "he-thong", action: "dinh_kem_dong", target_type: "post", target_id: post.id, detail: { inserted } });
    return NextResponse.json({ ok: true, inserted, postId: post.id });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
