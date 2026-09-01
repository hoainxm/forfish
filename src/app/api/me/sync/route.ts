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

const TABLE = "user_docs";
/** Bảng CHỈ-THÊM giữ bản cũ mỗi lần bị đè — xem migration 0054, 04 §Đồng bộ sổ */
const HISTORY_TABLE = "user_docs_history";

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
    (r) => ({ kind: r.kind, data: r.data, clientUpdatedAt: r.client_updated_at }),
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
      server: { kind, data: cur.data, clientUpdatedAt: cur.client_updated_at },
    });
  }

  /*  GIỮ BẢN CŨ TRƯỚC KHI ĐÈ (chủ dự án 2026-09-01: *"phía server ko cần xoá,
      mà lưu lại ở server kèm trạng thái đã xoá, để có thể phân tích hành vi
      người dùng sau này"*).

      `user_docs` giữ cả cuốn sổ là MỘT khối JSON, một dòng cho mỗi
      (owner_phone, kind) — không có dòng riêng cho từng việc để gắn cờ "đã
      xoá". Nên cách giữ được là chép BẢN TRƯỚC sang bảng chỉ-thêm; muốn biết
      bà con bỏ cái gì thì so hai bản.

      ⚠️ CHÉP LỖI THÌ KHÔNG CHẶN LƯỢT ĐẨY. Mất một dòng lịch sử là mất một mẩu
      số liệu phân tích của công ty; chặn lượt đẩy là sổ bà con không lên được
      server, rồi máy khác kéo về bản cũ — mất việc thật của người dùng. Không
      bao giờ đánh đổi theo chiều đó. Bảng chưa apply lên prod cũng rơi vào
      đúng nhánh này (lỗi bảng-không-tồn-tại) nên app vẫn chạy y như cũ. */
  if (cur) {
    const { error: hErr } = await admin.from(HISTORY_TABLE).insert({
      owner_phone: phone,
      kind,
      data: cur.data,
      client_updated_at: cur.client_updated_at,
    });
    if (hErr) {
      // để lại vết cho người vận hành, KHÔNG ném lên client
      console.error("[me/sync] khong luu duoc lich su:", hErr.message);
    }
  }

  const { error } = await admin.from(TABLE).upsert(
    {
      owner_phone: phone,
      kind,
      data,
      client_updated_at: clientUpdatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_phone,kind" },
  );
  if (error) return err(500, "write_failed");

  return NextResponse.json({ ok: true });
}
