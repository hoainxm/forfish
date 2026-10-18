// TRỢ LÝ — KHỚP TÊN CẢNG VỚI DANH SÁCH THẬT (thuần, dùng chung cho parse + answer + hook).
//
// Vì sao cần riêng một chỗ: cùng một cảng nằm ở HAI danh sách với hai tên —
// `PORTS` "Sa Kỳ" / "Hòn Rớ (Nha Trang)" (10 cảng có dự báo biển) và
// `FISHING_PORTS` "Cảng cá Sa Kỳ" / "Hòn Rớ" (173 cảng chỉ định). Khớp thô theo
// tên làm "Sa Kỳ" ra 2 ứng viên → máy hỏi lại một cảng mà bà con vừa nói rõ
// (audit 2026-09-06 P1-2). Luật ở đây:
//   · khoá so = tên NGOÀI ngoặc, bỏ tiền tố "cảng cá / cảng / bến / cửa biển",
//     bỏ dấu (`foldVn`);
//   · khớp ĐẦY ĐỦ khoá thắng khớp một phần; cùng khoá thì gộp làm một;
//   · id ưu tiên `PORTS` (có dự báo biển theo id), tỉnh ưu tiên `FISHING_PORTS`
//     (tên tỉnh sau sáp nhập 2025 — khớp `COASTAL_PROVINCES` của lib/region).

import { FISHING_PORTS } from "@/data/fishing-ports";
import { PORTS } from "@/data/ports";
import { foldVn } from "@/lib/sen-bien/ngram";

export interface PortHit {
  id: string;
  /** tên hiển thị có dấu, ngoài ngoặc ("Hòn Rớ (Nha Trang)" → "Hòn Rớ") */
  name: string;
  province: string;
}

/** Tiền tố hay nói kèm — bỏ đi để "cảng cá Sa Kỳ" = "Sa Kỳ". */
const PREFIX_RE = /^(?:cang ca|cang|ben ca|ben|cua bien|cua)\s+/;

/** Khoá so của một tên cảng / cụm bà con nói: ngoài ngoặc, bỏ tiền tố, bỏ dấu. */
export function portKey(name: string): string {
  const outside = name.replace(/\s*\([^)]*\)\s*/g, " ");
  const k = foldVn(outside).replace(PREFIX_RE, "").trim();
  return k || foldVn(name);
}

function displayName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim() || name;
}

/** Toàn bộ cảng gộp theo khoá — dựng một lần lúc nạp module (≈180 mục). */
const BY_KEY: Map<string, PortHit> = (() => {
  const m = new Map<string, PortHit>();
  for (const p of PORTS) {
    const k = portKey(p.name);
    if (!m.has(k)) m.set(k, { id: p.id, name: displayName(p.name), province: p.province });
  }
  for (const p of FISHING_PORTS) {
    const k = portKey(p.name);
    const cur = m.get(k);
    if (cur) {
      // cùng cảng: giữ id PORTS, lấy tỉnh theo danh mục chỉ định (tên sau sáp nhập)
      if (p.province) cur.province = p.province;
      continue;
    }
    m.set(k, { id: p.id, name: displayName(p.name), province: p.province ?? "" });
  }
  return m;
})();

/** Tên mọi cảng (để điền `ParseContext.portNames`). */
export const ALL_PORT_NAMES: readonly string[] = [...PORTS, ...FISHING_PORTS].map((p) => p.name);

function wordIn(hay: string, needle: string): boolean {
  return (` ${hay} `).includes(` ${needle} `);
}

/**
 * Khớp cụm bà con nói với danh sách tên. Trả về khoá đã gộp trùng, đầy đủ trước
 * một phần. `names` truyền vào (chứ không đọc thẳng danh sách) để test được với
 * danh sách nhỏ; app truyền `ALL_PORT_NAMES`.
 *
 * MỘT CHIỀU THÔI (audit vòng 2 P1-N2): khớp một phần chỉ nhận khi TÊN CẢNG chứa
 * cụm bà con nói ("Hòn" → "Hòn Rớ"). Chiều ngược lại — cụm bà con nói chứa khoá
 * cảng — bắt "Đà Nẵng" thành "Bến Đá" (khoá 1 từ "da") rồi đặt cảng nhà ở
 * TP.HCM với độ tin 0,9, không hỏi lại. Tên 2 từ trở lên vẫn nhận chiều đó vì
 * đủ dài để không trúng nhầm ("cảng cá Tắc Cậu Kiên Giang" → "tac cau").
 */
export function matchPortKeys(phrase: string, names: readonly string[], limit = 4): string[] {
  const p = portKey(phrase);
  if (p.length < 2) return [];
  const exact: string[] = [];
  const partial: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const k = portKey(n);
    if (!k || seen.has(k)) continue;
    if (k === p) {
      seen.add(k);
      exact.push(k);
    } else if (wordIn(k, p) || (k.includes(" ") && wordIn(p, k))) {
      seen.add(k);
      partial.push(k);
    }
  }
  return (exact.length ? exact : partial).slice(0, limit);
}

/** Khoá của 10 cảng có dự báo biển (`PORTS`) — chỗ duy nhất lấy cảng đi gợi ý. */
const SEA_KEYS = new Set(PORTS.map((p) => portKey(p.name)));

/**
 * Không thấy cảng tên đó → gợi ý cảng CÙNG TỈNH với cụm bà con vừa nói. Bà con
 * hay nói tên tỉnh/thành thay tên cảng ("cảng nhà là Đà Nẵng"); đưa mấy cảng
 * trong tỉnh đó ra làm chip vẫn là 1 chạm, thay vì bắt mở cả danh sách.
 *
 * CHỈ lấy trong `PORTS`: cảng nhà quyết định dự báo biển, gợi ý cảng có dự báo
 * thật là gợi ý dùng được ngay. Tỉnh đọc theo danh mục chỉ định (tên sau sáp
 * nhập) — cùng tên tỉnh mà app đang lưu. Rỗng khi không đoán được: thà không
 * gợi ý còn hơn chỉ bà con sang một tỉnh khác.
 */
export function nearPortKeys(phrase: string, limit = 3): string[] {
  const p = portKey(phrase);
  if (p.length < 2) return [];
  const out: string[] = [];
  for (const [k, hit] of BY_KEY) {
    if (k === p || !hit.province || !SEA_KEYS.has(k)) continue;
    if (!wordIn(foldVn(hit.province), p)) continue;
    out.push(k);
    if (out.length >= limit) break;
  }
  return out;
}

/** Cảng theo khoá (hoặc theo tên/cụm bất kỳ — tự đổi sang khoá). */
export function portByKey(keyOrName: string): PortHit | undefined {
  return BY_KEY.get(portKey(keyOrName));
}

/** Cảng theo id ở một trong hai danh sách. */
export function portById(id: string): PortHit | undefined {
  for (const h of BY_KEY.values()) if (h.id === id) return h;
  const f = FISHING_PORTS.find((p) => p.id === id);
  return f ? { id: f.id, name: displayName(f.name), province: f.province ?? "" } : undefined;
}
