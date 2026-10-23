// KHO LƯU TRỮ DỰ BÁO THEO NGÀY (2026-10-10) — Storage bucket riêng tư `forecast-archive`
// (migration 0058). Giữ lại mỗi ngày đúng thứ production đã tính/đã dùng để sau này fit và
// kiểm định lại trên DỮ LIỆU THẬT, không phải dựng lại:
//   weather/…      mọi hàng weather_snapshot (lưới gió/sóng d3·d16, mây/mưa/nhiệt/dông/áp
//                  suất, dòng chảy theo tầng, độ mặn, nước dâng) — bảng đó ghi đè mỗi ngày
//   fish/…         bản đồ cá ĐẦY ĐỦ mọi ô, mọi loài (fish_forecast_daily chỉ giữ ô ≥ 60)
//   fish-inputs/…  lưới ĐẦU VÀO mô hình cá (SST, phù du, SLA, dị thường, Copernicus, HYCOM,
//                  lưới mịn) — không lưu thì không bao giờ dựng lại được bản production
//   actual/…       (2026-10-19) THỰC TẾ ERA5 theo ngày cho 10 cảng (gió/giật/mưa/sóng) —
//                  vế "thật ra hôm đó thế nào" để đo skill liên tục (lib/sea-actual.ts)
//   drivers/…      (2026-10-23) ĐẦU VÀO + MỨC ĐÃ ÁP của lớp chuỗi thức ăn (lib/fish-chain.ts): trăng, ONI, PDO,
//                  Kuroshio–Luzon, phù du/nhiệt theo hộp nước trồi, thành phần đang áp/chưa áp, phiên bản thông số —
//                  chuỗi ngày này là thứ để FIT LẠI thông số (scripts/dong-dan) khi có thêm năm nhãn
// Đường dẫn: <loại>/<YYYY>/<YYYY-MM-DD>/<tên>.json.gz. Ghi đè trong ngày (upsert) — lượt sau
// trong cùng ngày thay lượt trước, mỗi ngày đúng một bản.
//
// CHỈ chạy server (cron). Không route nào đọc kho này cho app — đọc bằng script offline.
// Ghi hỏng không được làm hỏng việc chính của cron (dự báo vẫn lưu snapshot): trả kết quả,
// không ném.
import "server-only";
import { gzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ARCHIVE_BUCKET = "forecast-archive";
export type ArchiveKind = "weather" | "fish" | "fish-inputs" | "actual" | "drivers";

/**
 * Đường dẫn file trong kho. `day` phải là YYYY-MM-DD; `name` lấy từ id snapshot (`grid:d16`,
 * `curdepth:t50:d10`…) nên đổi mọi ký tự ngoài [a-z0-9._-] thành "_" — Storage không nhận ":".
 */
export function archivePath(kind: ArchiveKind, day: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`archivePath: ngày không hợp lệ "${day}"`);
  const safe = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^[._]+|[._]+$/g, "");
  if (!safe) throw new Error("archivePath: tên rỗng");
  return `${kind}/${day.slice(0, 4)}/${day}/${safe}.json.gz`;
}

/** JSON (NaN/Infinity ⇒ null theo chuẩn JSON) rồi gzip. */
export function encodeArchive(obj: unknown): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(obj), "utf8"), { level: 9 });
}

export interface ArchivePut {
  path: string;
  ok: boolean;
  bytes: number;
  error?: string;
}

/**
 * Ghi một file vào kho (ghi đè). Không ném — lỗi trả trong kết quả. THỬ LẠI tối đa `tries`
 * lần (nghỉ 1 s, 3 s): đo prod 2026-10-10, mạng IIS → Supabase rớt "fetch failed" ngẫu nhiên
 * MỘT file mỗi lượt (lượt 1 chlfine, lượt 2 currents) — không thử lại là ngày đó mất file.
 */
export async function putArchive(admin: SupabaseClient, path: string, obj: unknown, tries = 3): Promise<ArchivePut> {
  let buf: Buffer;
  try {
    buf = encodeArchive(obj);
  } catch (e) {
    return { path, ok: false, bytes: 0, error: e instanceof Error ? e.message : String(e) };
  }
  let last = "";
  for (let a = 0; a < tries; a++) {
    if (a > 0) await new Promise((r) => setTimeout(r, a === 1 ? 1000 : 3000));
    try {
      const { error } = await admin.storage
        .from(ARCHIVE_BUCKET)
        .upload(path, buf, { contentType: "application/gzip", upsert: true });
      if (!error) return { path, ok: true, bytes: buf.length };
      last = error.message;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  return { path, ok: false, bytes: 0, error: `${last} (sau ${tries} lần)` };
}

/** Số file ghi cùng lúc — 6 đủ rút 57 file từ ~5 phút xuống ~1 phút mà không dồn Supabase. */
export const ARCHIVE_CONCURRENCY = 6;

/** Chạy `fn` trên mọi phần tử, tối đa `limit` việc cùng lúc; giữ đúng thứ tự kết quả. */
export async function mapPool<T, R>(items: readonly T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

/** Gộp kết quả nhiều lần ghi cho log cron: số file, tổng byte, lỗi đầu tiên. */
export function summarizePuts(puts: readonly ArchivePut[]): { ok: boolean; files: number; bytes: number; failed: number; note?: string } {
  const failed = puts.filter((p) => !p.ok);
  return {
    ok: puts.length > 0 && failed.length < puts.length,
    files: puts.length - failed.length,
    bytes: puts.reduce((a, p) => a + p.bytes, 0),
    failed: failed.length,
    note: failed[0] ? `${failed[0].path}: ${failed[0].error?.slice(0, 120)}` : undefined,
  };
}
