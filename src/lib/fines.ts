// Logic sắp xếp mức phạt — THUẦN, có test. rangeVnd là chuỗi tiếng Việt kiểu
// "800 triệu – 1 tỷ đồng" / "500 nghìn – 5 triệu đồng". Để xếp "theo mức phạt"
// (TA-010 báo cáo test) ta lấy CẬN TRÊN của khoảng = số tiền lớn nhất xuất hiện.

const UNIT_VND: Record<string, number> = {
  "nghìn": 1_000,
  "triệu": 1_000_000,
  "tỷ": 1_000_000_000,
};

/** Cận trên (đồng) của chuỗi khoảng phạt — số tiền lớn nhất tìm thấy. 0 nếu
 *  không đọc được. VD "800 triệu – 1 tỷ đồng" → 1_000_000_000. */
export function parseFineMaxVnd(rangeVnd: string): number {
  const re = /(\d+(?:[.,]\d+)?)\s*(nghìn|triệu|tỷ)/g;
  let max = 0;
  for (const m of rangeVnd.matchAll(re)) {
    const amount = parseFloat(m[1].replace(",", ".")) * UNIT_VND[m[2]];
    if (amount > max) max = amount;
  }
  return max;
}
