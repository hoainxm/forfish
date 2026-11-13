// PUT /api/kairos/dinh-kem — MÁY THU TIN GỬI DÒNG DANH SÁCH đọc từ file PDF đính kèm thông báo gov (14 §21b, 0075).
//
// Cửa: cùng khoá `x-kairos-key` với /nhap (thiếu khoá 503, sai 401). Gói: { postUrl, url, rows: [{stt, ten, reg, noiDung,
// page}] } ≤5000 dòng — máy chủ kiểm lại từng dòng (chinh-sach.kiemDongDanhSach: reg đúng dạng, chữ có trần) và chỉ nhận
// khi bài có thật (tra theo băm link bài) và `url` nằm trong `attachments` của bài (không gắn dòng vào file lạ).
// THAY cả bộ dòng của (bài, file): máy thu gửi lại không trùng. Trả { ok, inserted, postId }; bài chưa có ⇒ 404 not_found,
// file không thuộc bài ⇒ 400 bad_attachment.
//
// VỚT FILE (2026-11-13, chinh-sach.ganDinhKem): gói có thêm `dinhKem: [{title, url}]` ⇒ bài đang TRỐNG file thì ghi
// danh sách file này vào `attachments` (bài vào kho lúc trang chi tiết bị tường lửa chặn). Bài đã có file ⇒ giữ nguyên.
// Gói chỉ có `dinhKem` (không `url`) ⇒ trả { ok, gan, postId } — máy thu gửi dòng từng file ở các gói sau.
import { NextResponse } from "next/server";
import { ganDinhKem, kiemDinhKem, kiemDongDanhSach } from "@/lib/kairos/chinh-sach.mjs";
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
  const coVot = Array.isArray(raw.dinhKem);
  if (!postHash || (!fileHash && !coVot)) return kErr(400, "bad_body");
  const rows = kiemDongDanhSach(raw.rows);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const post = await store.postByUrlHash(postHash);
    if (!post) return kErr(404, "not_found");
    let hienCo: unknown = (post as { attachments?: unknown }).attachments;
    if (coVot) {
      const moi = ganDinhKem(hienCo, raw.dinhKem);
      if (moi) {
        await store.updatePost(post.id, { attachments: moi });
        hienCo = moi;
        await auditQuiet(store, { actor: "may-thu", actor_kind: "he-thong", action: "dinh_kem_vot", target_type: "post", target_id: post.id, detail: { gan: moi.length } });
      }
      if (!fileHash) return NextResponse.json({ ok: true, gan: moi?.length ?? 0, postId: post.id });
    }
    const dinhKem = kiemDinhKem(hienCo);
    if (!fileHash || !dinhKem.some((a) => urlHash(a.url) === fileHash)) return kErr(400, "bad_attachment");
    const inserted = await store.replaceDinhKemDong(post.id, fileHash, rows);
    await auditQuiet(store, { actor: "may-thu", actor_kind: "he-thong", action: "dinh_kem_dong", target_type: "post", target_id: post.id, detail: { inserted } });
    return NextResponse.json({ ok: true, inserted, postId: post.id });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
