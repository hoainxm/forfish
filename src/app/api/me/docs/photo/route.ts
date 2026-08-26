// /api/me/docs/photo — ẢNH GIẤY TỜ (P3). Bucket private `user-docs` (0051).
//
// Cùng luật: service-role + identityFromRequest theo SĐT. Path LUÔN bắt đầu
// bằng "<owner_phone>/" → kiểm owner bằng tiền tố path (không ai xem/xoá ảnh
// người khác). Client nén ảnh trước (lib/doc-photos); server vẫn chặn cỡ.
//
// POST   (multipart: docId + file) → tải 1 ảnh, trả { path }.
// GET    ?path=  → { url } signed URL ngắn hạn (60s) để <img> hiển thị.
// DELETE ?path=  → xoá 1 ảnh.
//
// ⚠️ KHÔNG cache ở service worker (riêng tư, ngoài API_CACHE_ALLOW).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";

const BUCKET = "user-docs";
const MAX_BYTES = 2 * 1024 * 1024; // 2MB — client đã nén, đây là trần cứng
const SIGNED_TTL = 60; // giây

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

/** Path phải thuộc SĐT đang gọi (tiền tố "<phone>/") — chặn xem/xoá của người khác. */
function ownsPath(path: string | null, phone: string): path is string {
  return !!path && path.startsWith(`${phone}/`) && !path.includes("..");
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);

  const form = await req.formData().catch(() => null);
  if (!form) return err(400, "bad_form");
  const docId = String(form.get("docId") ?? "").trim();
  const file = form.get("file");
  if (!docId || !/^[A-Za-z0-9_-]{1,64}$/.test(docId)) return err(400, "bad_doc");
  if (!(file instanceof Blob)) return err(400, "no_file");
  if (file.size === 0 || file.size > MAX_BYTES) return err(400, "bad_size");
  const ext = EXT[file.type];
  if (!ext) return err(400, "bad_type");

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  const path = `${phone}/${docId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return err(500, "upload_failed");

  return NextResponse.json({ ok: true, path });
}

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);

  const path = new URL(req.url).searchParams.get("path");
  if (!ownsPath(path, phone)) return err(403, "not_owner");

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL);
  if (error || !data?.signedUrl) return err(404, "not_found");

  return NextResponse.json({ ok: true, url: data.signedUrl });
}

export async function DELETE(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);

  const path = new URL(req.url).searchParams.get("path");
  if (!ownsPath(path, phone)) return err(403, "not_owner");

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) return err(500, "delete_failed");

  return NextResponse.json({ ok: true });
}
