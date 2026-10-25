// POST /api/kairos/posts — BÀ CON ĐĂNG BÀI (14 §3.3, §7, AC07/AC08/AC11/AC14/AC15/AC21).
//
// SĐT lấy từ chuỗi cứng (identityFromRequest) — KHÔNG từ body. Kiểm ở ranh giới
// (validatePost: ≤2.000 ký tự, ≤5 ảnh trong thư mục CỦA MÌNH, chủ đề, ≤3 cảng, chữ bậy + chủ
// quyền ⇒ 400). Chưa đồng ý nội quy ⇒ 409 `rules`; bị cấm ⇒ 403 `banned`; 10 bài/ngày ⇒ 429.
// Đăng lại (`reshareOf`) đúng 1 tầng: đăng lại một bài đăng lại ⇒ trỏ về bài GỐC (A11).
// Bài lên NGAY (mod_state cho-kiem — agent quét sau, AC24b).
import { NextResponse } from "next/server";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { tagArea } from "@/lib/kairos/khu-vuc.mjs";
import { auditQuiet, clientIp, hydratePosts, jsonBody, kErr, kairosErrorResponse, PORT_IDS, postVisible, rateDenied, requireWriter, nhacTenHopLe, notifyNhacTen, trucKhachHoi } from "@/lib/kairos/server";
import { MAX_POST_PORTS, validatePost } from "@/lib/kairos/validate";

export async function POST(req: Request) {
  const w = await requireWriter(req, { rules: true });
  if (!w.ok) return w.res;
  const { store, phone, profile } = w;
  const body = await jsonBody(req);
  if (!body) return kErr(400, "bad_body");
  const v = validatePost(body, { profileId: profile.id, portIds: PORT_IDS });
  if (!v.ok) return kErr(400, v.code);
  try {
    const limited = await rateDenied(store, "posts", phone);
    if (limited) return limited;

    const blocked = await store.edgesFrom("block", phone);
    let reshareOf: string | null = null;
    if (v.value.reshareOf) {
      const target = await store.getPost(v.value.reshareOf);
      const rootId = target?.reshare_of ?? target?.id ?? null;
      const root = rootId && rootId !== target?.id ? await store.getPost(rootId) : target;
      if (!postVisible(root, phone, blocked)) return kErr(404, "not_found");
      reshareOf = root.id;
    }

    const nhac = await nhacTenHopLe(store, v.value.mentions, v.value.body, phone, blocked);
    const area = tagArea(v.value.body, { ports: FISHING_PORTS, chosenPorts: v.value.ports });
    const row = await store.insertPost({
      kind: "ba-con",
      author_phone: phone,
      body: v.value.body,
      images: v.value.images,
      topic: v.value.topic,
      regions: area.regions,
      provinces: area.provinces,
      ports: area.ports.slice(0, MAX_POST_PORTS),
      reshare_of: reshareOf,
      mentions: nhac.ds,
      mod_state: "cho-kiem",
    });
    await notifyNhacTen(store, { postId: row.id, phones: nhac.phones, byHandle: profile.handle });
    await auditQuiet(store, {
      actor: phone, actor_kind: "ba-con", action: reshareOf ? "post_reshare" : "post_create",
      target_type: "post", target_id: row.id, detail: { images: v.value.images.length, reshareOf }, ip: clientIp(req),
    });
    // bài HỎI MUA sản phẩm SDVICO ⇒ SDVICO trả lời dưới bài (14 §3.14) — hỏng không ảnh hưởng bài
    await trucKhachHoi(store, { post: row, comment: null, askerPhone: phone, askerProfile: profile, text: v.value.body, nguCanh: "" });
    const [post] = await hydratePosts(store, [row], phone, []);
    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
