// /api/kairos/posts/[id] — MỘT BÀI (14 §3.3, §3.4, §7, AC08/AC10/AC21).
//
// GET    khách đọc được: bài + trang bình luận đầu (30, cursor). Bài ẩn / báo chưa duyệt / của
//        người mình chặn ⇒ 404 `gone` ("Bài này không còn").
// PATCH  chủ bài (bà con): sửa chữ/ảnh/chủ đề/cảng — kiểm như lúc đăng; thẻ hiện "đã sửa";
//        bài quay về hàng chờ agent. Ảnh bị bỏ khi sửa được xoá khỏi kho SAU khi lưu. Trần
//        30 lần sửa/ngày/SĐT (rate.KAIROS_RATES.edits, đếm nhật ký `post_edit`) ⇒ 429.
// DELETE chủ bài: XOÁ ẢNH KHO TRƯỚC — kho lỗi ⇒ 500, bài còn nguyên (không xoá nửa vời,
//        AC08); rồi xoá bài (cascade bình luận + Hay).
import { NextResponse } from "next/server";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { tagArea } from "@/lib/kairos/khu-vuc.mjs";
import { decodeCursor, encodeCursor } from "@/lib/kairos/cursor";
import { auditQuiet, clientIp, hydrateComments, hydratePosts, jsonBody, kErr, kairosErrorResponse, PORT_IDS, postVisible, readerOf, rateDenied, requireWriter, storeOr503, nhacTenHopLe, notifyNhacTen } from "@/lib/kairos/server";
import { LIMITS } from "@/lib/kairos/types";
import { isUuid, MAX_POST_PORTS, validatePost } from "@/lib/kairos/validate";
import { docNhacTen } from "@/lib/kairos/nhac-ten";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return kErr(404, "gone");
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const blocked = who.phone ? await store.edgesFrom("block", who.phone) : [];
    const row = await store.getPost(id.toLowerCase());
    if (!postVisible(row, who.phone, blocked)) return kErr(404, "gone");
    const cursor = decodeCursor(new URL(req.url).searchParams.get("cursor"));
    const rows = await store.listComments(row.id, cursor, LIMITS.commentPageSize + 1, blocked);
    const page = rows.slice(0, LIMITS.commentPageSize);
    const last = page[page.length - 1];
    const next = rows.length > LIMITS.commentPageSize && last ? encodeCursor({ at: last.created_at, id: last.id }) : null;
    const [[post], comments] = await Promise.all([hydratePosts(store, [row], who.phone, blocked), hydrateComments(store, page, who.phone)]);
    return NextResponse.json({ ok: true, post, comments, next });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return kErr(404, "not_found");
  const w = await requireWriter(req);
  if (!w.ok) return w.res;
  const { store, phone, profile } = w;
  const body = await jsonBody(req);
  if (!body || typeof body !== "object") return kErr(400, "bad_body");
  try {
    const row = await store.getPost(id.toLowerCase());
    if (!row || row.hidden) return kErr(404, "not_found");
    if (row.kind !== "ba-con" || row.author_phone !== phone) return kErr(403, "not_owner");
    const limited = await rateDenied(store, "edits", phone);
    if (limited) return limited;
    // đăng lại giữ nguyên bài gốc — sửa không đổi được đích đăng lại
    const v = validatePost({ ...(body as Record<string, unknown>), reshareOf: row.reshare_of }, { profileId: profile.id, portIds: PORT_IDS });
    if (!v.ok) return kErr(400, v.code);
    const nhac = await nhacTenHopLe(store, v.value.mentions, v.value.body, phone, await store.edgesFrom("block", phone));
    const area = tagArea(v.value.body, { ports: FISHING_PORTS, chosenPorts: v.value.ports });
    const updated = await store.updatePost(row.id, {
      body: v.value.body,
      mentions: nhac.ds,
      images: v.value.images,
      topic: v.value.topic,
      regions: area.regions,
      provinces: area.provinces,
      ports: area.ports.slice(0, MAX_POST_PORTS),
      edited_at: new Date().toISOString(),
      mod_state: "cho-kiem",
      mod_checked_at: null,
    });
    const before = Array.isArray(row.images) ? (row.images as string[]) : [];
    const dropped = before.filter((p) => !v.value.images.includes(p));
    if (dropped.length) {
      // Bài đã lưu xong — ảnh mồ côi chỉ tốn chỗ kho, không mất gì của bà con ⇒ log, không 500.
      await store.removeImages(dropped).catch((e) => console.error("[kairos] xoá ảnh bỏ khi sửa hỏng:", (e as Error)?.message));
    }
    // chỉ báo người MỚI được tag lúc sửa (người đã tag từ trước không bị báo lại)
    const cu = new Set(docNhacTen(row.mentions).map((m) => m.id));
    const moi = nhac.ds.map((m, i) => (cu.has(m.id) ? null : nhac.phones[i])).filter((x): x is string => !!x);
    await notifyNhacTen(store, { postId: row.id, phones: moi, byHandle: profile.handle });
    await auditQuiet(store, { actor: phone, actor_kind: "ba-con", action: "post_edit", target_type: "post", target_id: row.id, ip: clientIp(req) });
    const [post] = await hydratePosts(store, [updated], phone, []);
    return NextResponse.json({ ok: true, post });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return kErr(404, "not_found");
  // xoá bài của mình vẫn được khi đang bị cấm (gỡ nội dung luôn là được phép)
  const w = await requireWriter(req, { allowBanned: true });
  if (!w.ok) return w.res;
  const { store, phone: who } = w;
  try {
    const row = await store.getPost(id.toLowerCase());
    if (!row) return kErr(404, "not_found");
    if (row.kind !== "ba-con" || row.author_phone !== who) return kErr(403, "not_owner");
    const images = Array.isArray(row.images) ? (row.images as string[]) : [];
    await store.removeImages(images); // ném storage_failed ⇒ 500, bài còn nguyên
    await store.deletePost(row.id);
    await auditQuiet(store, {
      actor: who, actor_kind: "ba-con", action: "post_delete", target_type: "post", target_id: row.id,
      detail: { images: images.length }, ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
