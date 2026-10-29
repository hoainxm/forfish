// Kiểm "trong vùng biển VN được phép" NHANH cho thuật toán lộ trình — CÙNG kết quả với
// `trongVungBienVN` (lib/vung-bien-vn.ts → geofence.insideAllowed), chỉ bớt việc.
//
// Vì sao cần: lộ trình kiểm đoạn thẳng giữa các mốc với mẫu dày 2 km (mỏm đất, đảo nhỏ lọt khe mẫu
// 10 km — đo với mùa vụ tháng 4, đoạn từ Quy Nhơn đi lên cắt qua mũi đất 13,90°B) và lọc vài nghìn
// ô cá. Bản gốc chạy chẵn-lẻ trên TOÀN BỘ ~1.100 cạnh cho mỗi điểm (~100 µs điểm trong khung) và
// nhớ theo toạ độ — mẫu dọc đoạn thẳng là điểm mới nên không trúng nhớ: lần chạy đầu ~300 ms.
//
// Cách làm (chặt, không xấp xỉ): chia cạnh của từng vòng theo DẢI VĨ ĐỘ 0,1°. Tia chẵn-lẻ chỉ có
// thể cắt cạnh nào vắt qua vĩ độ của điểm, nên chỉ cần xét các cạnh trong dải chứa điểm. Công thức
// cắt chép ĐÚNG phép tính của `pointInRing` (geofence.ts) để từng cạnh cho cùng kết quả bit-by-bit;
// test so khớp với bản gốc trên hàng nghìn điểm: lo-trinh-plan.test.ts.
// THUẦN, không phụ thuộc trình duyệt.

import { VN_SEA_POLYS } from "@/lib/vung-bien-vn";

const DAI = 0.1;

/** Một vòng: dải → mảng phẳng [xi, yi, xj, yj, …] các cạnh vắt qua dải đó. */
type Vong = Map<number, number[]>;

let bang: Vong[][] | null = null;

function dung(): Vong[][] {
  return VN_SEA_POLYS.map((poly) =>
    poly.map((ring) => {
      const m: Vong = new Map();
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const d0 = Math.floor(Math.min(yi, yj) / DAI), d1 = Math.floor(Math.max(yi, yj) / DAI);
        for (let d = d0; d <= d1; d++) {
          let a = m.get(d);
          if (!a) m.set(d, (a = []));
          a.push(xi, yi, xj, yj);
        }
      }
      return m;
    }),
  );
}

/** Như `trongVungBienVN(lat, lon)` — cùng kết quả, nhanh hơn nhiều lần khi gọi hàng nghìn điểm. */
export function trongVungNhanh(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  bang ??= dung();
  const d = Math.floor(lat / DAI);
  for (const poly of bang) {
    let trong = false;
    for (const vong of poly) {
      const a = vong.get(d);
      if (!a) continue;
      let vongTrong = false;
      for (let k = 0; k < a.length; k += 4) {
        const xi = a[k], yi = a[k + 1], xj = a[k + 2], yj = a[k + 3];
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi)
          vongTrong = !vongTrong;
      }
      if (vongTrong) trong = !trong;
    }
    if (trong) return true;
  }
  return false;
}
