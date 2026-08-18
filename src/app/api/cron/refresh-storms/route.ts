// CRON GHI BẢN TIN BÃO vào kho (2026-08-18) — nền của đường đi trên bản đồ.
//
// Vì sao là CRON chứ không ghi lúc có người mở app (chủ dự án chốt): đêm không
// ai mở app thì chuỗi bản tin đứt đúng lúc bão thường mạnh lên. NCHMF phát
// 3–6 giờ/lần (bão khẩn cấp 1 giờ/lần), nhịp 30 phút là dư an toàn mà vẫn rẻ —
// mỗi lượt chỉ 2 request HTML và gần như luôn kết thúc bằng "đã có, bỏ qua".
//
// GHI ĐÚNG MỘT LẦN MỖI BẢN TIN: `unique (storm_key, issued_at)` ở DB làm trọng
// tài (migration 0036). Không đọc-trước-rồi-ghi — hai lượt cron chồng nhau vẫn
// an toàn.
//
// KHÔNG BAO GIỜ XOÁ/SỬA hàng cũ: đường đã đi là lịch sử, tin mới chỉ THÊM hàng.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  NCHMF_INDEX_URL,
  htmlToText,
  pickLatestNchmfBulletin,
} from "@/lib/storms-vn";
import {
  khoaCanDoiTen,
  parseNchmfFull,
  stormKeyFor,
  type StormKeyRef,
} from "@/lib/storm-bulletin";
import { timeoutSignal } from "@/lib/abort";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA = "Mozilla/5.0 (compatible; SDFish/1.0; +https://sdvico.vn)";
const TIMEOUT_MS = 15000;

async function layHtml(url: string): Promise<string | null> {
  const r = await fetch(url, {
    cache: "no-store",
    headers: { accept: "text/html", "user-agent": UA },
    signal: timeoutSignal(TIMEOUT_MS),
  });
  if (!r.ok) {
    console.error("[cron-storms] tải", url, "→", r.status);
    return null;
  }
  return r.text();
}

export async function GET(req: Request) {
  // Cùng cổng bảo vệ với các cron khác (CRON_SECRET; Vercel Cron tự gắn header)
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, reason: "no-secret" }, { status: 401 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 503 });

  const now = new Date();
  const indexHtml = await layHtml(NCHMF_INDEX_URL);
  if (indexHtml == null) {
    return NextResponse.json({ ok: false, reason: "index-failed" }, { status: 503 });
  }

  const url = pickLatestNchmfBulletin(indexHtml);
  // Trời yên: trang không có bản tin bão nào. KHÔNG phải lỗi.
  if (!url) return NextResponse.json({ ok: true, saved: 0, reason: "no-bulletin" });

  const html = await layHtml(url);
  if (html == null) {
    return NextResponse.json({ ok: false, reason: "bulletin-failed" }, { status: 503 });
  }

  const text = htmlToText(html);
  const b = parseNchmfFull(text, now, url);
  if (!b || b.issuedAt == null) {
    /*  Đọc không nổi bản tin ⇒ 503 để lượt cron sau thử lại VÀ để lỗi có dấu
        vết. Tuyệt đối không ghi hàng rỗng: một hàng sai trong kho là một khúc
        đường vẽ sai trên bản đồ, và nó nằm lại vĩnh viễn. */
    console.error("[cron-storms] parse không ra bản tin:", url);
    return NextResponse.json({ ok: false, reason: "parse-failed", url }, { status: 503 });
  }

  /*  Bản tin GẦN NHẤT trong kho để nối cơn (xem `stormKeyFor`). Chỉ nhìn lại 24
      giờ: xa hơn thì chắc chắn là cơn khác, mà lấy nhầm khoá là nối hai cơn làm
      một — đường đi vẽ ra sẽ nhảy ngang qua biển. */
  const tuMs = new Date(b.issuedAt - 24 * 3600_000).toISOString();
  const { data: truocRows } = await admin
    .from("storm_bulletins")
    .select("storm_key, issued_at, lat, lon")
    .gte("issued_at", tuMs)
    .order("issued_at", { ascending: false })
    .limit(1);
  const truocRow = truocRows?.[0] as
    | { storm_key: string; issued_at: string; lat: number; lon: number }
    | undefined;
  const truoc: StormKeyRef | null = truocRow
    ? {
        key: truocRow.storm_key,
        issuedAt: Date.parse(truocRow.issued_at),
        lat: Number(truocRow.lat),
        lon: Number(truocRow.lon),
      }
    : null;

  const stormKey = stormKeyFor(b, truoc);

  /*  ÁP THẤP MẠNH LÊN THÀNH BÃO: đổi NHÃN các bản tin cũ sang khoá bão để đường
      đi liền một vệt. Chỉ đụng cột `storm_key` — toạ độ/giờ giữ nguyên. Đổi tên
      hỏng thì vẫn ghi bản tin mới (mất một khúc đường còn hơn mất tin mới nhất);
      lượt cron sau sẽ không thử lại vì lúc đó `truoc.key` đã là khoá bão. */
  const khoaCu = khoaCanDoiTen(b, truoc, stormKey);
  if (khoaCu) {
    const { error: rErr } = await admin
      .from("storm_bulletins")
      .update({ storm_key: stormKey })
      .eq("storm_key", khoaCu);
    if (rErr) console.error("[cron-storms] nối khoá ATNĐ→bão HỎNG:", rErr.message);
  }

  const { data: inserted, error } = await admin
    .from("storm_bulletins")
    .insert({
      storm_key: stormKey,
      issued_at: new Date(b.issuedAt).toISOString(),
      observed_at: b.observedAt ? new Date(b.observedAt).toISOString() : null,
      la_bao: b.laBao,
      so_bao: b.soBao,
      lat: b.lat,
      lon: b.lon,
      cap: b.cap,
      giat: b.giat,
      dir: b.dir,
      speed_kmh: b.speedKmh,
      radius_km: b.radiusKm,
      danger_box: b.danger,
      risk: b.risk,
      source: "nchmf",
      url: b.url,
      // giữ nguyên văn để soi lại khi parser lệch — bản tin ~3 KB, rẻ
      raw_text: text.slice(0, 8000),
    })
    .select("id")
    .maybeSingle();

  // 23505 = đã có bản tin này (cron chạy dày hơn nhịp phát tin) — chuyện THƯỜNG
  if (error?.code === "23505") {
    return NextResponse.json({ ok: true, saved: 0, stormKey, reason: "da-co" });
  }
  if (error) {
    console.error("[cron-storms] ghi bản tin HỎNG:", error.code, error.message);
    return NextResponse.json({ ok: false, reason: "insert-failed" }, { status: 500 });
  }

  let diem = 0;
  if (inserted?.id && b.forecast.length > 0) {
    const { error: fErr } = await admin.from("storm_forecast_points").insert(
      b.forecast.map((p, i) => ({
        bulletin_id: inserted.id,
        valid_at: p.validAt ? new Date(p.validAt).toISOString() : null,
        lat: p.lat,
        lon: p.lon,
        cap: p.cap,
        giat: p.giat,
        dir: p.dir,
        speed_kmh: p.speedKmh,
        danger_box: p.danger,
        seq: i,
      })),
    );
    // Mốc dự báo hỏng thì bản tin vẫn giữ — đường ĐÃ ĐI quan trọng hơn, và lượt
    // cron sau có bản tin mới sẽ có mốc mới.
    if (fErr) console.error("[cron-storms] ghi mốc dự báo HỎNG:", fErr.message);
    else diem = b.forecast.length;
  }

  return NextResponse.json({
    ok: true,
    saved: 1,
    stormKey,
    issuedAt: new Date(b.issuedAt).toISOString(),
    forecastPoints: diem,
  });
}
