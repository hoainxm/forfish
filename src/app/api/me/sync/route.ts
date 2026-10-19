// /api/me/sync — ĐỒNG BỘ SỔ per-máy lên server theo SĐT (P1).
//
// Cùng luật market_listings/devices: app bỏ phiên Supabase (0037) → auth.uid()
// NULL → mọi truy cập đi SERVICE-ROLE + identityFromRequest lọc owner_phone.
// Bảng user_docs (0050) RLS đóng hẳn: client ẩn danh không đọc được của ai.
//
// GET  = kéo MỌI kind của SĐT đang đăng nhập.
// PUT  = ghi 1 kind (body {kind, data, clientUpdatedAt, baseIds?}).
//        · CÓ `baseIds` (máy đời 2026-10-06+): GỘP 3 CHIỀU THEO `id`
//          (`mergeById`, lib/user-sync-core) — máy thêm/xoá gì, máy khác
//          thêm/xoá gì đều giữ; mục có ở cả hai thì bên GHI SAU thắng. Trả
//          `server` = cuốn đã gộp + mốc mới để máy nhận về.
//        · KHÔNG có `baseIds` (bản app cũ còn ngoài biển): giữ LAST-WRITE-WINS
//          nguyên cuốn như trước — server mới hơn thì trả stale.
//        · GHI CÓ ĐIỀU KIỆN theo `rev` (0064, rà Codex 2026-10-19): hai máy ghi
//          sát nhau không đè mất phần của nhau; hết lượt thử ⇒ 503 `busy`, máy
//          giữ sổ "chưa đẩy" và tự gửi lại. Cuốn quá cỡ ⇒ 400 `too_large`.
//
// ⚠️ KHÔNG cache ở service worker (gắn danh tính, dữ liệu riêng tư).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import {
  decidePut,
  invalidPut,
  isValidBaseIds,
  type SyncKind,
} from "@/lib/user-sync-core";

import { stripDeleted } from "@/lib/sync-tombstone";

const TABLE = "user_docs";
/** Số lần đọc–quyết–ghi khi bị máy khác chen (CAS trượt). */
const SYNC_CAS_TRIES = 3;

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  const { data, error } = await admin
    .from(TABLE)
    .select("kind,data,client_updated_at")
    .eq("owner_phone", phone);
  if (error) return err(500, "query_failed");

  const items = (data as { kind: SyncKind; data: unknown; client_updated_at: number }[]).map(
    /*  LỌC BỎ BẢN ĐÃ XOÁ trước khi trả cho máy — server giữ để phân tích,
        nhưng bà con đã bỏ thì không được thấy lại (chủ dự án 2026-09-01). */
    (r) => ({
      kind: r.kind,
      data: stripDeleted(r.data),
      clientUpdatedAt: r.client_updated_at,
    }),
  );
  // `phone` = chủ của các cuốn này (chính người đang gọi). Máy so với chủ của
  // sổ đang nằm trong máy: khác người ⇒ sổ trong máy là của tài khoản TRƯỚC
  // (máy bị đá rồi người khác đăng nhập) ⇒ dọn trước khi kéo/đẩy. Không lộ gì
  // thêm: người gọi vốn biết SĐT của chính mình.
  return NextResponse.json({ ok: true, phone, items });
}

export async function PUT(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);

  const body = (await req.json().catch(() => null)) as {
    kind?: SyncKind;
    data?: unknown;
    clientUpdatedAt?: number;
    baseIds?: unknown;
  } | null;
  const bad = invalidPut(body);
  if (bad) return err(400, bad);
  const hasBase = !!body && "baseIds" in body;
  if (hasBase && !isValidBaseIds(body!.baseIds)) return err(400, "bad_base");
  const { kind, data, clientUpdatedAt } = body as {
    kind: SyncKind;
    data: unknown;
    clientUpdatedAt: number;
  };
  const baseIds = hasBase ? ((body!.baseIds as string[] | null) ?? null) : undefined;

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  /*  ĐỌC → QUYẾT → GHI CÓ ĐIỀU KIỆN (CAS, rà Codex 2026-10-18; cột rev 0064).
      Trước đây bước ghi là upsert trần: hai máy cùng đọc một bản rồi lần lượt
      ghi ⇒ phần thêm của máy ghi trước bị đè mất. Nay ghi kèm `rev = rev đã
      đọc`; trượt (máy khác vừa ghi) ⇒ đọc lại, quyết lại trên bản mới, thử lại.
      Hết lượt ⇒ 503: máy giữ sổ "chưa đẩy" và tự gửi lại (user-sync.ts), không
      mất gì. Quyết định là hàm THUẦN `decidePut` (có test). */
  for (let attempt = 0; attempt < SYNC_CAS_TRIES; attempt++) {
    const { data: cur, error: readErr } = await admin
      .from(TABLE)
      .select("data,client_updated_at,rev")
      .eq("owner_phone", phone)
      .eq("kind", kind)
      .maybeSingle();
    if (readErr) return err(500, "query_failed");

    const nowIso = new Date().toISOString();
    const d = decidePut(
      cur ? { data: cur.data, clientUpdatedAt: Number(cur.client_updated_at) || 0 } : null,
      { kind, data, clientUpdatedAt, baseIds },
      nowIso,
    );
    if (d.action === "reply") return NextResponse.json(d.reply);

    const row = {
      owner_phone: phone,
      kind,
      data: d.write.data,
      client_updated_at: d.write.clientUpdatedAt,
      updated_at: nowIso,
    };
    if (cur) {
      const rev = Number(cur.rev) || 0;
      const { data: hit, error } = await admin
        .from(TABLE)
        .update({ ...row, rev: rev + 1 })
        .eq("owner_phone", phone)
        .eq("kind", kind)
        .eq("rev", rev)
        .select("rev");
      if (error) return err(500, "write_failed");
      if (!hit || hit.length === 0) continue; // máy khác vừa ghi — đọc lại
    } else {
      const { error } = await admin.from(TABLE).insert({ ...row, rev: 1 });
      if (error) {
        if (error.code === "23505") continue; // máy khác vừa tạo cuốn này — đọc lại
        return err(500, "write_failed");
      }
    }
    return NextResponse.json(d.reply);
  }
  return err(503, "busy");
}
