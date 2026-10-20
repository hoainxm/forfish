import { describe, expect, it } from "vitest";
import { SPECIES_META } from "@/lib/fish-predict";

/*
  MÀU LOÀI CÁ = MÀU NỘI DUNG BẢN ĐỒ, không phải token UI (rà Codex lần 9). Màu
  này được nạp THẲNG vào paint của MapLibre (`activeFishColor` trong
  fishing-map-view) — MapLibre không đọc `var(--…)`, đổi sang token CSS là lớp
  cá mất màu. Cùng loại ngoại lệ với CHART_PALETTE (03-design-system). Nguồn
  DUY NHẤT là `color` trong hồ sơ loài ở lib/fish-predict.ts; cổng này giữ nó
  sạch thay cho luật token.
*/
describe("màu loài cá (nội dung bản đồ)", () => {
  const ds = Object.entries(SPECIES_META);
  it("mỗi loài có đúng một mã #rrggbb hợp lệ (MapLibre đọc được)", () => {
    const sai = ds.filter(([, m]) => !/^#[0-9a-f]{6}$/i.test(m.color ?? "")).map(([k]) => k);
    expect(sai).toEqual([]);
  });
  it("không hai loài trùng màu (chọn loài là để PHÂN BIỆT trên bản đồ)", () => {
    const seen = new Map<string, string>();
    const trung: string[] = [];
    for (const [k, m] of ds) {
      const c = m.color.toLowerCase();
      if (seen.has(c)) trung.push(`${seen.get(c)} = ${k} (${c})`);
      else seen.set(c, k);
    }
    expect(trung).toEqual([]);
  });
});
