/**
 * BÁO HIỆU CHÍNH THỨC CỦA CỤC HÀNG HẢI — `public/data/vn-aids.v1.json`.
 *
 * ── VÌ SAO FILE NÀY TỒN TẠI (2026-09-02) ───────────────────────────────────
 * 774 báo hiệu nhà nước (437 từ cổng ENC + 337 từ Thông báo hàng hải) đã nằm
 * trong repo, có test, có ký hiệu — mà KHÔNG một dòng mã chạy nào đọc: mọi
 * tham chiếu trong `src/` đều là chú thích, `sw.js` không cache, và bản đồ
 * không vẽ. Đây là lần TÁI PHÁT THỨ TƯ của cùng một căn bệnh (lớp độ sâu · bộ
 * ký hiệu · kết quả đối chiếu · và giờ là lớp báo hiệu chính thức).
 *
 * Lần này tệ hơn ba lần trước ở một điểm: bộ tự kiểm `kiem-ban-do.mjs` đếm
 * lớp này và báo "sẽ thấy" — TRỌNG TÀI nói quá so với màn hình thật. Bản kiểm
 * kê 2026-09-02 bắt được điều đó, không phải cổng nào.
 *
 * ── QUAN HỆ VỚI `seamarks.ts` ──────────────────────────────────────────────
 * Cùng họ khuôn (bảng tra + mảng số) nhưng 12 cột thay vì tối đa 9: thêm `rt`
 * (tuyến luồng), `nm` (tên/số hiệu), `pp` (câu "tác dụng" của nhà nước). Giải
 * mã ra `Seamark` + phần mở rộng, để `chartSymbolId` / `seamarkLabel` /
 * `describeSeamark` dùng lại NGUYÊN — không viết bộ dịch thứ hai.
 *
 * Câu "tác dụng" quan trọng hơn nó trông: với nguồn Thông báo hàng hải, cột
 * màu thân luôn -1 (thông báo không ghi màu), nên bên luồng phải suy từ chính
 * câu đó — `chartSymbolId(m, purpose)` đã biết cách.
 */
import { timeoutSignal } from "@/lib/abort";
import type { Seamark, LightInfo } from "@/lib/seamarks";

/** Một báo hiệu chính thức = Seamark + phần nhà nước công bố kèm. */
export type VnAid = Seamark & {
  /** tên/số hiệu ("Phao 5", "Đăng tiêu BL.1"); null = nguồn không đọc được số */
  ten: string | null;
  /** câu "tác dụng" nguyên văn của nhà nước — cũng là nguồn suy bên luồng */
  tacDung: string | null;
  /** tên tuyến luồng ("Tuyến luồng Hải Phòng") */
  tuyen: string | null;
};

export type VnAidsFile = {
  v: number;
  types: string[];
  chars: string[];
  groups: string[];
  colours: string[];
  names: string[];
  purposes: string[];
  routes: { ten?: string }[];
  marks: number[][];
};

/*  Cột của `marks` — GIỮ ĐÚNG thứ tự trong `generate-vn-aids.mjs`:
      [lon, lat, t, ch, grp, lc, per, rng, bc, rt, nm, pp]
    -1 = "nguồn không ghi", KHÔNG phải 0 — tra bảng với -1 phải ra undefined. */
const tra = (bang: string[], i: number | undefined): string | undefined =>
  typeof i === "number" && i >= 0 ? bang[i] : undefined;

/**
 * Bỏ QUA hàng hỏng thay vì ném — cùng luật với `decodeSeamarks`: một dòng lỗi
 * không được làm mất cả lớp báo hiệu của chuyến biển.
 */
export function decodeVnAids(raw: unknown): VnAid[] {
  const f = raw as Partial<VnAidsFile> | null;
  if (!f || !Array.isArray(f.marks)) return [];
  const types = f.types ?? [];
  const chars = f.chars ?? [];
  const groups = f.groups ?? [];
  const colours = f.colours ?? [];
  const out: VnAid[] = [];
  for (const r of f.marks) {
    if (!Array.isArray(r) || r.length < 3) continue;
    const [lon, lat, t, ch, grp, lc, per, rng, bc, rt, nm, pp] = r;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const type = tra(types, t);
    if (!type) continue;

    const light: LightInfo | undefined =
      tra(chars, ch) || tra(groups, grp) || tra(colours, lc) || per > 0 || rng > 0
        ? {
            character: tra(chars, ch),
            group: tra(groups, grp),
            colour: tra(colours, lc),
            period: per > 0 ? per : undefined,
            range: rng > 0 ? rng : undefined,
          }
        : undefined;

    out.push({
      lon,
      lat,
      type,
      light,
      colour: tra(colours, bc),
      ten: tra(f.names ?? [], nm) ?? null,
      tacDung: tra(f.purposes ?? [], pp) ?? null,
      tuyen: (typeof rt === "number" && rt >= 0 && f.routes?.[rt]?.ten) || null,
    });
  }
  return out;
}

let cached: Promise<VnAid[]> | null = null;

/**
 * Hỏng thì XOÁ bộ nhớ đệm để lần sóng về sau thử lại — mất sóng không được
 * khoá vĩnh viễn (cùng án lệ `fetchSeamarks`).
 */
export async function fetchVnAids(): Promise<VnAid[]> {
  if (!cached) {
    cached = fetch("/data/vn-aids.v1.json", { signal: timeoutSignal(20000) })
      .then((r) => {
        if (!r.ok) throw new Error(`vn-aids ${r.status}`);
        return r.json();
      })
      .then(decodeVnAids)
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}
