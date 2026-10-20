// LƯU TRỮ THEO NGÀY (2026-10-10, chủ dự án: "lưu đầy đủ đi, để phục vụ cho tối ưu sau này").
// Chép MỌI hàng weather_snapshot (lưới gió/sóng, mây/mưa/nhiệt/dông/áp suất, dòng chảy theo
// tầng, độ mặn, nước dâng) và MỌI hàng fish_forecast_snapshot (bản đồ cá đủ ô, đủ loài) vào
// kho Storage `forecast-archive` theo ngày giờ VN — hai bảng đó ghi đè mỗi ngày. Lưới ĐẦU VÀO
// mô hình cá do /api/cron/refresh-fish tự lưu (chỉ nó có trong tay).
//
// Lịch: SAU refresh-fish (02:00 UTC) và refresh-weather (02:30 UTC) để chép bản mới nhất.
// Chạy lại trong ngày = ghi đè cùng file. Không ném: phần nào hỏng ghi vào `parts`.
// Bảo vệ bằng CRON_SECRET như mọi cron (route không trả dữ liệu cho app).
//
// (2026-10-19) Thêm phần `actual`: THỰC TẾ ERA5 10 cảng cho 5 ngày đã qua (lib/sea-actual.ts)
// — vế "hôm đó thật ra sóng gió bao nhiêu" để đo skill liên tục cạnh `sea_daily` (dự báo).
// 20 request Open-Meteo archive (15 s mỗi cái, 6 cùng lúc), cảng hỏng ⇒ null, không bịa.
import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/app-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { vnToday } from "@/lib/sea-history";
import { ARCHIVE_CONCURRENCY, archivePath, mapPool, putArchive, summarizePuts } from "@/lib/forecast-archive";
import { PORTS } from "@/data/ports";
import { timeoutSignal } from "@/lib/abort";
import {
  ACTUAL_FETCH_TIMEOUT_MS,
  ACTUAL_FILE,
  actualFileHasData,
  actualUrls,
  actualWindow,
  buildActualDayFiles,
  portActualByDay,
} from "@/lib/sea-actual";

/** Tải JSON Open-Meteo, lỗi/timeout/không phải 200 ⇒ null (cảng đó thành null, không ném). */
async function fetchJsonOrNull(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: timeoutSignal(ACTUAL_FETCH_TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const maxDuration = 300; // lưới d16 vài MB/hàng, ~50 hàng
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = (await getCronSecret()) ?? "";
  if (!secret) return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });

  const day = vnToday(new Date());
  const parts: Record<string, ReturnType<typeof summarizePuts>> = {};

  // Mỗi hàng select riêng (không select * cả bảng một lần — hàng d16 nặng), nhưng chạy
  // SONG SONG theo nhóm ARCHIVE_CONCURRENCY: đo prod 2026-10-10, ghi TUẦN TỰ 57 file mất
  // 5 phút 13 giây (~5 s/file IIS → Supabase) ⇒ IIS/ARR cắt ở ~5 phút, cron-prod nhận 502.
  for (const [kind, table] of [
    ["weather", "weather_snapshot"],
    ["fish", "fish_forecast_snapshot"],
  ] as const) {
    const { data: ids, error } = await admin.from(table).select("id");
    if (error || !ids) {
      parts[kind] = { ok: false, files: 0, bytes: 0, failed: 1, note: error?.message ?? "không đọc được danh sách" };
      continue;
    }
    const puts = await mapPool(ids as { id: string }[], ARCHIVE_CONCURRENCY, async ({ id }) => {
      const { data: row, error: e } = await admin.from(table).select("*").eq("id", id).maybeSingle();
      return e || !row
        ? { path: `${kind}/${id}`, ok: false, bytes: 0, error: e?.message ?? "mất hàng" }
        : await putArchive(admin, archivePath(kind, day, id), row);
    });
    parts[kind] = summarizePuts(puts);
  }

  // THỰC TẾ ERA5 — 10 cảng × (gió + sóng), cửa sổ [day−9, day−5]; mỗi ngày thực tế một file.
  // Ngày không có số nào (ERA5 chưa ra tới đó) thì KHÔNG ghi — lượt mai tự lấp.
  {
    const win = actualWindow(day);
    const fetchedAt = new Date().toISOString();
    const perPort = await mapPool(PORTS, ARCHIVE_CONCURRENCY, async (p) => {
      const u = actualUrls(p, win);
      const [wind, wave] = await Promise.all([fetchJsonOrNull(u.wind), fetchJsonOrNull(u.wave)]);
      return { id: p.id, byDay: portActualByDay(wind, wave, win) };
    });
    const files = buildActualDayFiles(perPort, win, fetchedAt).filter(actualFileHasData);
    const puts = await mapPool(files, ARCHIVE_CONCURRENCY, (f) => putArchive(admin, archivePath("actual", f.date, ACTUAL_FILE), f));
    const s = summarizePuts(puts);
    const portsDown = perPort.filter((p) => [...p.byDay.values()].every((v) => v === null)).map((p) => p.id);
    parts.actual = {
      ...s,
      ok: s.ok,
      note: s.note ?? (files.length === 0 ? `ERA5 chưa có ngày nào trong ${win.start}…${win.end}` : portsDown.length ? `cảng không lấy được: ${portsDown.join(", ")}` : undefined),
    };
  }

  return NextResponse.json({ ok: Object.values(parts).some((p) => p.ok), day, parts });
}
