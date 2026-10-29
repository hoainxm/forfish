// "SẴN SÀNG RA KHƠI" — MỘT ĐỊNH NGHĨA cho mọi chip (rà offline F2/F3, 2026-10-29).
//
// Trước đây chip "Đã lưu đủ" chỉ xét DỮ LIỆU (savedCoverage) + VỎ (isShellReady). Từ 2026-10-02 cả nền bản đồ, bờ,
// đảo, độ sâu đều là bản mã SDF2 — máy KHÔNG có khoá (`forfish.datakey.v1`) thì bản đồ trắng trơn, mà chip vẫn xanh.
// Nền pmtiles (~14 MB) thì chỉ vào kho khi màn Bản đồ xin lát đầu tiên — bà con chỉ xem Trang chủ rồi ra khơi là
// không có nền. Nay "sẵn sàng" = đủ BỐN thứ, đều đọc TRONG MÁY, không request:
//   1. dữ liệu đủ (coverageChipOk) · 2. vỏ đủ (isShellReady) · 3. có khoá dữ liệu · 4. có nền bản đồ trong kho SW.

import { readToken, tokenHeader } from "@/lib/device-token-store";
import { timeoutSignal } from "@/lib/abort";
import { DEFAULT_POINT } from "@/lib/ocean-map";
import type { SavedPlace } from "@/lib/places";
import type { PretripPoint } from "@/lib/pretrip";

/** GIỮ ĐỒNG BỘ với `SDFISH_BASEMAP_V` / `BASEMAP_ARCHIVE` trong public/sw.js — test pretrip-ready bắt lệch. */
export const BASEMAP_CACHE = "sdfish-basemap-v2";
export const BASEMAP_PATH = "/data/vn-basemap.pmtiles";

/** Đọc khoá trong máy — MỘT luật ở data-key.ts (trước đây chép lại ở đây; gộp 2026-10-29). Re-export cho chỗ gọi cũ. */
export { hasDataKey } from "@/lib/data-key";

/** Nền bản đồ đã nằm trong kho SW chưa. `caches.has` trước để KHÔNG tạo kho rỗng khi chỉ đọc. Không ném. */
export async function hasBasemap(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    if (!(await caches.has(BASEMAP_CACHE))) return false;
    const c = await caches.open(BASEMAP_CACHE);
    return (await c.match(BASEMAP_PATH)) != null;
  } catch {
    return false;
  }
}

export type ReadyParts = {
  /** coverageChipOk(...) */
  dataOk: boolean;
  /** isShellReady() — null = chưa đọc xong */
  shellOk: boolean | null;
  keyOk: boolean;
  /** hasBasemap() — null = chưa đọc xong */
  basemapOk: boolean | null;
};

/** Thứ còn thiếu QUAN TRỌNG NHẤT (thứ tự = cái gì làm app/bản đồ chết trước). null = đủ cả bốn (hoặc chưa đọc xong). */
export type ReadyGap = "shell" | "key" | "basemap" | "data";

export function readyGap(p: ReadyParts): ReadyGap | null {
  if (p.shellOk === false) return "shell";
  if (!p.keyOk) return "key";
  if (p.basemapOk === false) return "basemap";
  if (!p.dataOk) return "data";
  return null;
}

/** XANH chỉ khi đủ CẢ BỐN và đã đọc xong (null = chưa chắc ⇒ không xanh). */
export function readyToSail(p: ReadyParts): boolean {
  return readyGap(p) === null && p.shellOk === true && p.basemapOk === true;
}

/**
 * Câu đời thường cho thứ thiếu (không phải "data" — câu dữ liệu do coverageChipText lo). `coTaiKhoan` = máy có chuỗi
 * thiết bị: khoá chỉ trao cho tài khoản, nên khách mà bảo "mở app lúc có sóng" là bảo một việc không bao giờ đủ.
 */
export function readyGapText(g: Exclude<ReadyGap, "data">, coTaiKhoan = true): string {
  if (g === "shell") return "App cần mạng để tải nốt dữ liệu. Bà con mở lại khi có sóng nhé.";
  if (g === "key")
    return coTaiKhoan
      ? "Chưa tải được khoá bản đồ — mở app lúc có sóng"
      : "Bản đồ ngoài khơi cần đăng nhập — đăng nhập lúc có sóng";
  return "Chưa lưu nền bản đồ — mở app lúc có sóng";
}

/** Một lời về máy cho viên trạng thái bản đồ (cùng hình `GhiChuMay` của storm-banner): `ngan` vào dòng gọn, `day` khi bung. */
export type LoiVeMay = { ngan: string; day: string; ben?: boolean };

/**
 * VIÊN TRẠNG THÁI BẢN ĐỒ — THỨ TỰ LỜI VỀ MÁY (rà UI B-P1-2 lô 2, 2026-10-29). Tin bão luôn đứng đầu viên (storm-banner
 * tự đặt); sau đó: thiếu khoá (bản đồ trắng, nằm lì) > mất sóng / mạng yếu > chưa tải được dự báo. Viên một dòng cắt
 * đuôi bằng "…" nên thứ quan trọng hơn phải đứng trước. `ngan` = vế trước " — " của câu đủ.
 */
export function loiVeMay(p: {
  thieuKhoa: boolean;
  coTaiKhoan: boolean;
  /** offlineBasemapNote(...) — null khi có sóng */
  matSong: string | null;
  /** câu mẻ tải sẵn hỏng (pretripMapWarn) — null khi không có */
  duBao: string | null;
}): LoiVeMay[] {
  const ngan = (cau: string) => cau.split(" — ")[0].replace(/\.$/, "");
  const out: LoiVeMay[] = [];
  if (p.thieuKhoa) {
    const cau = readyGapText("key", p.coTaiKhoan);
    out.push({ ngan: ngan(cau), day: `${cau}.`, ben: true });
  }
  if (p.matSong) out.push({ ngan: ngan(p.matSong), day: p.matSong });
  if (p.duBao) out.push({ ngan: ngan(p.duBao), day: p.duBao });
  return out;
}

/**
 * KÉO NỀN BẢN ĐỒ VÀO KHO khi chưa có — chỉ gọi BÊN TRONG cửa tải sẵn (6 giờ + có sóng), nên không thêm lượt mạng lúc
 * mở app. Cách: xin 1 byte (Range) — nhánh `basemapFirst` của sw.js thấy kho trống thì tự kéo trọn file
 * (`fillBasemapArchive`, `keepAlive`); đó chính là đường màn Bản đồ vẫn đi, chỉ dời chỗ kích. Không đọc thân phản hồi
 * (bản mã — mọi chỗ ĐỌC file dữ liệu vẫn phải qua data-fetch).
 * Bỏ qua khi: mất sóng · chưa có SW điều khiển (xin thẳng mạng thì không ai cất) · chưa có tài khoản (lớp bản đồ cần
 * chuỗi, khách tải về cũng không giải được) · kho đã có. Có trần 15 s, nuốt mọi lỗi. Trả true nếu đã kích.
 */
export async function warmBasemap(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || navigator.onLine === false) return false;
    if (!navigator.serviceWorker?.controller) return false;
    if (!readToken()) return false;
    if (await hasBasemap()) return false;
    await fetch(BASEMAP_PATH, {
      headers: { Range: "bytes=0-0", ...tokenHeader() },
      signal: timeoutSignal(15000),
    }).catch(() => null);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chỗ tải sẵn khi KHÔNG đứng ở màn Bản đồ (cửa tải sẵn ở tầng app). Cùng luật với `pretripPoints` của bản đồ: cảng nhà
 * + mọi điểm đã ghim, không bịa thêm chỗ; chưa ghim gì ⇒ đúng điểm mặc định bản đồ mở ra (`DEFAULT_POINT`), để lớp
 * "gió sóng điểm" không bao giờ thiếu chỉ vì bà con chưa mở bản đồ. Cảng nhà đứng đầu (ưu tiên khi hết giờ).
 */
export function appPretripPoints(places: SavedPlace[]): PretripPoint[] {
  if (places.length === 0) return [{ lat: DEFAULT_POINT.lat, lon: DEFAULT_POINT.lon, name: "Điểm đang xem" }];
  const sorted = [...places.filter((p) => p.kind === "home"), ...places.filter((p) => p.kind !== "home")];
  return sorted.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    name: p.kind === "home" ? `Cảng nhà — ${p.name}` : p.name,
  }));
}
