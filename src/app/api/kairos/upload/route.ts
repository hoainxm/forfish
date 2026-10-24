// POST /api/kairos/upload — TẢI MỘT ẢNH LÊN KHO kairos-media (14 §3.3, §7, AC07).
//
// Ảnh ĐÃ nén ở máy (market/image-resize.ts, cạnh dài 1.600). Máy chủ không tin `type` khai:
// kiểm magic bytes + trần cỡ bằng CÙNG hàm của Chợ (market/route-utils readImageUpload — trần
// 500 KB, chặt hơn 512 KB của bucket). Đường kho `<profileId>/<uuid>.<ext>` — không SĐT trong
// URL; bài chỉ nhận ảnh trong thư mục của chính người đăng (validatePost). 30 ảnh/ngày (A1),
// đếm bằng nhật ký `upload`.
import { NextResponse } from "next/server";
import { isMarketError } from "@/lib/market/errors";
import { readImageUpload } from "@/lib/market/route-utils";
import { clientIp, kErr, kairosErrorResponse, rateDenied, requireWriter } from "@/lib/kairos/server";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export async function POST(req: Request) {
  const w = await requireWriter(req, { rules: true });
  if (!w.ok) return w.res;
  const { store, phone, profile } = w;
  try {
    const limited = await rateDenied(store, "uploads", phone);
    if (limited) return limited;
    let img: Awaited<ReturnType<typeof readImageUpload>>;
    try {
      img = await readImageUpload(req);
    } catch (e) {
      if (isMarketError(e)) return kErr(400, e.code === "bad_size" ? "image_too_large" : "bad_image");
      throw e;
    }
    const path = `${profile.id}/${crypto.randomUUID()}.${EXT[img.mime]}`;
    await store.uploadImage(path, img.bytes, img.mime);
    // Nhật ký là sổ đếm 30 ảnh/ngày — ghi hỏng thì ảnh vẫn đã lên, chỉ log.
    try {
      await store.audit({ actor: phone, actor_kind: "ba-con", action: "upload", target_type: "image", target_id: path, detail: { bytes: img.bytes.length }, ip: clientIp(req) });
    } catch (e) {
      console.error("[kairos] nhật ký upload hỏng:", (e as Error)?.message);
    }
    return NextResponse.json({ ok: true, path, url: store.mediaUrl(path) }, { status: 201 });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
