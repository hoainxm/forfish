// Trục 1 — cảnh báo bão / áp thấp nhiệt đới trên Biển Đông.
//
// Nguồn hiện tại: GDACS (hệ cảnh báo thiên tai toàn cầu EU/UN, JSON công khai,
// không key) — gọi qua API route /api/storms của app (tránh CORS + cache).
// Quy tắc adapter: đổi nguồn chỉ sửa file này + route, không đụng UI.
// An toàn là trên hết: nguồn fail → KHÔNG hiển thị "không có bão" — im lặng
// và để lời dặn nghe đài duyên hải làm việc của nó.

import { apiUrl } from "@/lib/api-base";
import { loadForecast, saveForecast } from "@/lib/forecast-cache";
import { forecastStoreReady } from "@/lib/forecast-store";
import { timeoutSignal } from "@/lib/abort";

export type StormAlert = {
  id: string;
  /** Tên quốc tế của bão, vd "WUTIP" */
  name: string;
  /** "Áp thấp nhiệt đới" | "Bão" | "Bão mạnh" | "Siêu bão" theo gió mạnh nhất */
  kindLabel: string;
  windKmh: number | null;
  lat: number;
  lon: number;
  /** danger = nguồn đánh giá mức cam/đỏ; watch = mức xanh (vẫn phải nói) */
  alert: "watch" | "danger";
  updated: string;
  /** Đường đi bão [lon,lat][] (quá khứ→dự báo) — rỗng nếu nguồn không có */
  track: number[][];
  /** Vùng ảnh hưởng — danh sách polygon, mỗi polygon = mảng ring [lon,lat][] */
  areas: number[][][][];
};

export type StormCheck =
  | { ok: true; storms: StormAlert[]; checkedAt: string }
  | { ok: false };

/**
 * Tin bão cũ hơn ngần này thì coi như CHƯA HỎI ĐƯỢC. Service worker giữ lại bản
 * /api/storms cũ để dùng offline → `ok:true` vẫn có thể là tin của mấy hôm
 * trước. Nói "không có bão" dựa trên tin cũ là nói dối chuyện tính mạng.
 */
export const STORM_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** Máy chạy lệch giờ chút thì tha; lệch nhiều coi như không tin được */
const CLOCK_SKEW_MS = 60 * 60 * 1000;

/**
 * BA trạng thái tin bão — không được nhập nhằng:
 *  · "dang-hoi"  → chưa có trả lời, chưa nói gì
 *  · "khong-hoi-duoc" → mất sóng / nguồn lỗi / tin quá cũ → CẤM nói "không có bão"
 *  · "khong-co"  → hỏi được thật và không có bão (kèm giờ đã hỏi)
 *  · "co-bao"    → có bão (kèm giờ của bản tin; `cu` = tin đã cũ)
 */
export type StormStatus =
  | { kind: "dang-hoi" }
  | { kind: "khong-hoi-duoc" }
  | { kind: "khong-co"; checkedAt: number }
  | { kind: "co-bao"; storms: StormAlert[]; checkedAt: number | null; cu: boolean };

/**
 * Quy trạng thái tin bão về đúng một trong bốn nhánh trên.
 * `check === null` = chưa có trả lời. `now` truyền vào để test được.
 */
export function stormStatus(
  check: StormCheck | null | undefined,
  now: number = Date.now(),
): StormStatus {
  if (!check) return { kind: "dang-hoi" };
  if (!check.ok) return { kind: "khong-hoi-duoc" };

  const parsed = Date.parse(check.checkedAt ?? "");
  const checkedAt = Number.isFinite(parsed) ? parsed : null;
  const age = checkedAt == null ? null : now - checkedAt;
  const cu =
    age == null || age > STORM_MAX_AGE_MS || age < -CLOCK_SKEW_MS;

  // CÓ bão thì vẫn phải hiện (thà báo thừa còn hơn giấu) — nhưng kèm giờ thật.
  if (check.storms.length > 0) {
    return { kind: "co-bao", storms: check.storms, checkedAt, cu };
  }
  // KHÔNG có bão trong bản tin: chỉ được nói khi bản tin còn mới.
  return cu ? { kind: "khong-hoi-duoc" } : { kind: "khong-co", checkedAt: checkedAt as number };
}

/** Vùng quan tâm: Biển Đông + dải tiếp cận ngoài Philippines (cảnh báo sớm) */
export function inWatchRegion(lat: number, lon: number): boolean {
  return lon >= 99 && lon <= 132 && lat >= 3 && lat <= 27;
}

export function stormKindLabel(windKmh: number | null): string {
  if (windKmh == null) return "Bão / áp thấp";
  if (windKmh < 63) return "Áp thấp nhiệt đới";
  if (windKmh < 118) return "Bão";
  if (windKmh < 184) return "Bão mạnh";
  return "Siêu bão";
}

/** Giờ kết thúc + 48h vẫn coi là "đang hoạt động" (nguồn cập nhật trễ) */
const ACTIVE_GRACE_MS = 48 * 60 * 60 * 1000;

type GeoFeature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    eventid?: number | string;
    eventname?: string;
    alertlevel?: string;
    iscurrent?: string | boolean;
    todate?: string;
    datemodified?: string;
    severitydata?: { severity?: number };
  };
};

/**
 * Lọc GeoJSON của nguồn về danh sách bão trong vùng quan tâm.
 * `now` truyền vào để test được — không gọi Date.now() bên trong.
 */
export function parseStorms(json: unknown, now: Date): StormAlert[] {
  const features: GeoFeature[] =
    (json as { features?: GeoFeature[] })?.features ?? [];
  const seen = new Set<string>();
  const out: StormAlert[] = [];

  // Pass 1 — gom geometry đường đi (LineString) + vùng ảnh hưởng (Polygon/
  // MultiPolygon) theo eventid, để gắn vào tâm bão tương ứng (GDACS trả nhiều
  // feature cùng eventid: 1 tâm + track + các polygon bán kính gió).
  const trackByEv = new Map<string, number[][]>();
  const areasByEv = new Map<string, number[][][][]>();
  for (const f of features) {
    const ev = String(f.properties?.eventid ?? "");
    if (!ev) continue;
    const g = f.geometry;
    const c = g?.coordinates;
    if (g?.type === "LineString" && Array.isArray(c)) {
      trackByEv.set(ev, c as number[][]);
    } else if (g?.type === "Polygon" && Array.isArray(c)) {
      const arr = areasByEv.get(ev) ?? [];
      arr.push(c as number[][][]);
      areasByEv.set(ev, arr);
    } else if (g?.type === "MultiPolygon" && Array.isArray(c)) {
      const arr = areasByEv.get(ev) ?? [];
      for (const poly of c as number[][][][]) arr.push(poly);
      areasByEv.set(ev, arr);
    }
  }

  for (const f of features) {
    const p = f.properties ?? {};
    if (f.geometry?.type !== "Point") continue; // tâm bão; track/polygon ở pass 1
    if (String(p.iscurrent) !== "true") continue;

    const coords = f.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [lon, lat] = coords as [number, number];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    if (!inWatchRegion(lat, lon)) continue;

    // bão đã tan quá 48h thì thôi
    if (p.todate) {
      const end = new Date(`${p.todate}Z`).getTime();
      if (Number.isFinite(end) && now.getTime() - end > ACTIVE_GRACE_MS) {
        continue;
      }
    }

    const id = String(p.eventid ?? `${lat},${lon}`);
    if (seen.has(id)) continue;
    seen.add(id);

    const windKmh =
      typeof p.severitydata?.severity === "number"
        ? Math.round(p.severitydata.severity)
        : null;
    const level = (p.alertlevel ?? "").toLowerCase();

    out.push({
      id,
      name: p.eventname?.replace(/-\d+$/, "") ?? "chưa rõ tên",
      kindLabel: stormKindLabel(windKmh),
      windKmh,
      lat,
      lon,
      alert: level === "orange" || level === "red" ? "danger" : "watch",
      updated: p.datemodified ?? "",
      track: trackByEv.get(id) ?? [],
      areas: areasByEv.get(id) ?? [],
    });
  }
  return out;
}

/** Kho bản tin bão trong máy — `forfish.fc.storm.latest` */
export const STORM_NS = "storm";
export const STORM_ID = "latest";

/**
 * Client gọi route nội bộ; hỏi được thì LƯU VÀO MÁY, hỏi không được thì lấy
 * bản đã lưu ra.
 *
 * VÌ SAO LƯU (2026-08-01): trước đây bản tin bão CHỈ sống trong kho service
 * worker — không nằm trong gói tải sẵn, không nằm trong tệp sao lưu, không ai
 * kiểm nó còn hay mất. Thứ duy nhất trong app dính TÍNH MẠNG mà lại tồn tại
 * nhờ may mắn. Nay nó đi cùng đường với dự báo: localStorage `forfish.*` ⇒ tự
 * vào tệp sao lưu ⇒ pretrip kiểm được ⇒ popup "đã lưu gì" đếm được.
 *
 * KHÔNG nói dối khi dùng bản cũ: payload mang sẵn `checkedAt`, và
 * `stormStatus()` coi tin quá STORM_MAX_AGE_MS (12h) là CHƯA HỎI ĐƯỢC — banner
 * vàng "Chưa hỏi được tin bão", tuyệt đối không có câu "không có bão".
 */
export async function fetchStormCheck(): Promise<StormCheck> {
  /*  CHỜ KHO MỞ XONG RỒI MỚI ĐỌC BẢN LƯU (2026-08-02k — vòng đánh giá cuối).
      Mất sóng thì `fetch` hỏng TỨC THÌ (không có độ trễ mạng che cửa sổ đua),
      nên nhánh lùi chạy khi gương còn rỗng ⇒ trả `null` ⇒ màn hình nói "chưa
      có" trong khi kho còn nguyên. Từ phiên thứ hai localStorage đã bị dọn nên
      không còn lớp chắn nào. Hàm đã async; `forecastStoreReady()` có trần chờ. */
  await forecastStoreReady();

  try {
    const r = await fetch(apiUrl("/api/storms"), {
      signal: timeoutSignal(20000),
    });
    if (r.ok) {
      const j = (await r.json()) as StormCheck;
      if (j.ok) {
        /*  MỐC LƯU = GIỜ BẢN TIN, KHÔNG PHẢI GIỜ MÁY (2026-08-02, audit R3).
            `r.ok` KHÔNG có nghĩa là "vừa hỏi được nguồn": service worker trả
            bản trong kho với status 200 theo BA đường — mất sóng (`.catch` →
            `caches.match`), nguồn 5xx (isRescuableStatus cứu bằng bản kho), và
            hết `API_STALE_MS` (đua đồng hồ, có bản lưu thì trả ngay). Cả ba đều
            xuống tới đây với `j.ok === true`.
            Đóng `Date.now()` cho một bản có thể 6 giờ tuổi là NÓI DỐI hai chỗ:
            popup "đã lưu gì" khoe "Tin bão · vừa xong", và `savedStormAt()` làm
            lớp bão trong pretrip báo xanh. Với thứ dính TÍNH MẠNG thì mốc phải
            là tuổi THẬT của bản tin. Cùng khuôn với `generatedAt` của bản đồ cá
            (fish-predict.ts). `checkedAt` rác/thiếu → đành lấy giờ máy. */
        const at = Date.parse(j.checkedAt ?? "");
        /*  KẸP VỀ HIỆN TẠI (sửa 2026-08-02h): nhánh lùi `Date.now()` trộn GIỜ
            MÁY vào cùng trục với giờ máy chủ. Một máy có đồng hồ chạy trước mà
            gặp payload thiếu `checkedAt` (bản đời cũ còn nằm trong kho service
            worker) sẽ ghim `savedAt` ở TƯƠNG LAI và cửa chống-lùi ngay dưới khoá
            vĩnh viễn mọi bản tin thật sau đó — tin bão đông cứng ở bản trước bão. */
        const mocMoi = Math.min(
          Date.now(),
          Number.isFinite(at) ? at : Date.now(),
        );
        /*  ⚠️ TIN BÃO KHÔNG ĐƯỢC PHÉP ĐI LÙI (sửa 2026-08-02h — an toàn tính mạng).

            Chú thích ngay trên đã liệt kê BA đường service worker trả bản CŨ kèm
            `200 + ok:true`. Thiếu cửa này thì ca sau xảy ra được: kho service
            worker kẹt ở bản tin 08:00 (một cú `put` bị nuốt vì hết chỗ) trong
            khi localStorage đã có bản 12:00 lấy thẳng từ mạng ⇒ lần gọi sau mất
            sóng, SW trả bản 08:00 ⇒ **bản tin TRƯỚC lúc bão hình thành ghi đè
            lên bản CÓ bão**, và `savedStormAt()` cũng lùi theo nên lớp bão trong
            mẻ tải sẵn báo xanh.

            Luật: chỉ ghi khi bản mới KHÔNG CŨ HƠN bản đang giữ. Bằng mốc thì vẫn
            ghi (nội dung có thể đã cập nhật trong cùng một mốc bản tin). */
        const dangGiu = loadForecast<StormCheck>(STORM_NS, STORM_ID);
        if (dangGiu && mocMoi < dangGiu.savedAt) return j;
        saveForecast(STORM_NS, STORM_ID, j, mocMoi);
        return j;
      }
    }
  } catch {
    /* mất sóng → xuống nhánh bản lưu */
  }
  const hit = loadForecast<StormCheck>(STORM_NS, STORM_ID);
  return hit?.data?.ok ? hit.data : { ok: false };
}

/** Đã có bản tin bão nào trong máy chưa (popup "đã lưu gì" + pretrip đọc) */
export function savedStormAt(): number | null {
  return loadForecast<StormCheck>(STORM_NS, STORM_ID)?.savedAt ?? null;
}
