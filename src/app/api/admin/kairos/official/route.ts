// POST /api/admin/kairos/official — SDVICO ĐĂNG BÀI CHÍNH THỨC (14 §2, §3.11, AC16). Quyền
// kairos:create (preset quản lý KHÔNG có — admin tick riêng). Bài đứng tên hồ sơ SDVICO
// (phone sentinel `sdvico:chinh-thuc`, seed ở 0065), dấu "Chính thức"; ghim tuỳ chọn ≤30 ngày.
// Ảnh: người trực tải qua /api/kairos/upload bằng tài khoản của mình ⇒ ảnh nằm trong thư mục
// hồ sơ của người trực (validatePost kiểm đúng thư mục đó). Nhật ký trước, đăng sau.
import { NextResponse } from "next/server";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { requirePermission } from "@/lib/admin-auth";
import { normalizeVnPhone } from "@/lib/phone";
import { PIN_MAX_MS } from "@/lib/kairos/admin-action";
import { tagArea } from "@/lib/kairos/khu-vuc.mjs";
import { clientIp, ensureProfile, hydratePosts, jsonBody, kErr, kairosErrorResponse, PORT_IDS, storeOr503 } from "@/lib/kairos/server";
import { SDVICO_PHONE } from "@/lib/kairos/types";
import { MAX_POST_PORTS, validatePost } from "@/lib/kairos/validate";

export async function POST(req: Request) {
  const who = await requirePermission("kairos", "create");
  if (!who.ok) return kErr(who.status, who.code);
  const body = (await jsonBody(req)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return kErr(400, "bad_body");
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  const now = Date.now();
  try {
    const sdvico = await store.profileByPhone(SDVICO_PHONE);
    if (!sdvico) return kErr(503, "no_sdvico_profile"); // 0065 chưa seed
    const staffProfile = await ensureProfile(store, normalizeVnPhone(who.phone));
    const v = validatePost({ ...body, reshareOf: null }, { profileId: staffProfile.id, portIds: PORT_IDS });
    if (!v.ok) return kErr(400, v.code);
    let pinnedUntil: string | null = null;
    if (body.pinnedUntil != null) {
      const t = typeof body.pinnedUntil === "string" ? Date.parse(body.pinnedUntil) : NaN;
      if (!Number.isFinite(t) || t <= now || t > now + PIN_MAX_MS) return kErr(400, "bad_until");
      pinnedUntil = new Date(t).toISOString();
    }
    try {
      await store.audit({ actor: `staff:${who.phone}`, actor_kind: "staff", action: "admin_official", target_type: "post", detail: { pinnedUntil, images: v.value.images.length }, ip: clientIp(req) });
    } catch {
      return kErr(503, "audit_failed");
    }
    const area = tagArea(v.value.body, { ports: FISHING_PORTS, chosenPorts: v.value.ports });
    const row = await store.insertPost({
      kind: "chinh-thuc",
      author_phone: SDVICO_PHONE,
      body: v.value.body,
      images: v.value.images,
      topic: v.value.topic,
      regions: area.regions,
      provinces: area.provinces,
      ports: area.ports.slice(0, MAX_POST_PORTS),
      reshare_of: null,
      pinned_until: pinnedUntil,
      mod_state: "dat", // người trực soạn = đã duyệt
    });
    const [post] = await hydratePosts(store, [row], null, []);
    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
