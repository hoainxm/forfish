// /api/me/sync — ĐỒNG BỘ SỔ per-máy lên server theo SĐT (P1).
//
// Cùng luật market_listings/devices: app bỏ phiên Supabase (0037) → auth.uid()
// NULL → mọi truy cập đi SERVICE-ROLE + identityFromRequest lọc owner_phone.
// Bảng user_docs (0050) RLS đóng hẳn: client ẩn danh không đọc được của ai.
//
// GET  = kéo MỌI kind của SĐT đang đăng nhập.
// PUT  = ghi 1 kind (body {kind, data, clientUpdatedAt}); LAST-WRITE-WINS: server
//        có bản mới hơn (client_updated_at lớn hơn) → KHÔNG đè, trả stale + bản
//        server để client nhận về.
//
// ⚠️ KHÔNG cache ở service worker (gắn danh tính, dữ liệu riêng tư).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import { invalidPut, type SyncKind } from "@/lib/user-sync-core";

import { keepDeleted, stripDeleted } from "@/lib/sync-tombstone";

const TABLE = "user_docs";

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
  return NextResponse.json({ ok: true, items });
}

export async function PUT(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);

  const body = (await req.json().catch(() => null)) as {
    kind?: SyncKind;
    data?: unknown;
    clientUpdatedAt?: number;
  } | null;
  const bad = invalidPut(body);
  if (bad) return err(400, bad);
  const { kind, data, clientUpdatedAt } = body as {
    kind: SyncKind;
    data: unknown;
    clientUpdatedAt: number;
  };

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  // LAST-WRITE-WINS: bản server mới hơn thì KHÔNG đè — trả về để client nhận.
  const { data: cur, error: readErr } = await admin
    .from(TABLE)
    .select("data,client_updated_at")
    .eq("owner_phone", phone)
    .eq("kind", kind)
    .maybeSingle();
  if (readErr) return err(500, "query_failed");

  if (cur && cur.client_updated_at > clientUpdatedAt) {
    return NextResponse.json({
      ok: true,
      stale: true,
      // cùng luật với GET: bản trả về cho máy KHÔNG mang theo thứ đã xoá
      server: {
        kind,
        data: stripDeleted(cur.data),
        clientUpdatedAt: cur.client_updated_at,
      },
    });
  }

  /*  GIỮ BẢN ĐÃ XOÁ Ở SERVER (chủ dự án 2026-09-01: *"đã xoá thì xoá ở máy còn
      trên server vẫn có"*). Bản ghi biến mất so với lần đẩy trước thì Ở LẠI
      trong chính cuốn sổ này, chỉ thêm cờ `_deleted` + `_deletedAt` — không
      bảng mới, không migration, vì `data` vốn là `jsonb`.
      Máy bà con không thấy lại: nhánh GET đã lọc bỏ trước khi trả về. */
  const dataGiuVet = keepDeleted(cur?.data, data, new Date().toISOString());

  const { error } = await admin.from(TABLE).upsert(
    {
      owner_phone: phone,
      kind,
      data: dataGiuVet,
      client_updated_at: clientUpdatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_phone,kind" },
  );
  if (error) return err(500, "write_failed");

  return NextResponse.json({ ok: true });
}
