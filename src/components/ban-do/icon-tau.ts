/*
  ICON TÀU AIS (2026-10-29, anh Long: "icon hình tàu cho giống các máy AIS"). Theo quy ước máy AIS/hải đồ điện tử
  (IEC 62288): mục tiêu ĐANG CHẠY = tam giác cân nhọn chỉ theo hướng (xoay bằng `icon-rotate`), ĐỨNG YÊN/không rõ
  hướng = chấm tròn (như MarineTraffic — nghiên cứu nhóm agent 29/10). Vẽ lúc chạy bằng canvas rồi `map.addImage` — không đụng chart-sprite (sinh lại sprite là hành
  động có chủ ý, CLAUDE.md "Dữ liệu bản đồ trong git"), không cần mạng ⇒ mất sóng vẫn có icon.

  Một ảnh cho mỗi (màu × hình): màu theo nhóm tàu (MAU_TAU) + hai màu mức (nguy/canh, MAU_MUC). Tên ảnh
  `ais-<khoá màu>-<chay|dung>`; lớp đặt `icon-image` = ["concat", "ais-", ["get","mk"], "-", chay ? "chay" : "dung"].
  setStyle (đổi nền) xoá ảnh ⇒ gọi lại `dangKyIconTau` ở onStyleData (đã có ảnh thì bỏ qua).
*/
import type { Map as MlMap } from "maplibre-gl";
import { MAU_MUC } from "@/lib/ais-cpa";
import { MAU_TAU } from "@/lib/tau-ais";

export const MAU_ICON_TAU: Record<string, string> = { ...MAU_TAU, ...MAU_MUC };
const TL = 2; // pixelRatio — vẽ gấp đôi cho nét sắc trên màn retina
const RONG = 22;
const CAO = 30;
/** bóng đổ dưới icon — tàu "nổi" khỏi nền hải đồ (anh Long: "cái tàu nó nổi lên chứ ko bị hải đồ lẫn") */
const BONG = "rgba(8, 30, 45, 0.55)";

function ve(mau: string, chay: boolean): ImageData | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = RONG * TL;
  c.height = CAO * TL;
  const g = c.getContext("2d");
  if (!g) return null;
  g.scale(TL, TL);
  g.beginPath();
  if (chay) {
    // tam giác cân, mũi lên trên (Bắc) — đáy hẹp hơn chiều cao như ký hiệu AIS trên máy
    g.moveTo(RONG / 2, 3);
    g.lineTo(RONG - 5, CAO - 5);
    g.lineTo(RONG / 2, CAO - 9);
    g.lineTo(5, CAO - 5);
  } else {
    // chấm tròn — tàu đứng/neo, không có hướng để chỉ (như MarineTraffic)
    g.arc(RONG / 2, CAO / 2, 5.5, 0, Math.PI * 2);
  }
  g.closePath();
  // 1) viền trắng dày + bóng đổ (vẽ trước, nằm dưới) ⇒ 2) ruột màu đè lên — tách hẳn khỏi nét hải đồ
  g.lineJoin = "round";
  g.shadowColor = BONG;
  g.shadowBlur = 3;
  g.shadowOffsetY = 1;
  g.lineWidth = 3.2;
  g.strokeStyle = "#ffffff";
  g.stroke();
  g.shadowColor = "transparent";
  g.fillStyle = mau;
  g.fill();
  return g.getImageData(0, 0, c.width, c.height);
}

/** Khung 4 góc vuông quanh mục tiêu đang chọn — ký hiệu "selected target" của máy AIS (IMO SN.1/Circ.243). */
function veKhungChon(): ImageData | null {
  if (typeof document === "undefined") return null;
  const n = 34;
  const c = document.createElement("canvas");
  c.width = n * TL;
  c.height = n * TL;
  const g = c.getContext("2d");
  if (!g) return null;
  g.scale(TL, TL);
  const a = 3; // lề
  const l = 9; // chiều dài mỗi cạnh góc
  const b = n - a;
  g.lineCap = "square";
  for (const [w, mau] of [
    [4, "#ffffff"],
    [2, "#0b2f44"],
  ] as const) {
    g.lineWidth = w;
    g.strokeStyle = mau;
    g.beginPath();
    g.moveTo(a, a + l); g.lineTo(a, a); g.lineTo(a + l, a);
    g.moveTo(b - l, a); g.lineTo(b, a); g.lineTo(b, a + l);
    g.moveTo(b, b - l); g.lineTo(b, b); g.lineTo(b - l, b);
    g.moveTo(a + l, b); g.lineTo(a, b); g.lineTo(a, b - l);
    g.stroke();
  }
  return g.getImageData(0, 0, c.width, c.height);
}

/** Nạp đủ ảnh icon tàu vào map (bỏ qua ảnh đã có). An toàn gọi nhiều lần. */
export function dangKyIconTau(map: MlMap): void {
  if (!map.hasImage("ais-chon")) {
    const k = veKhungChon();
    if (k) map.addImage("ais-chon", k, { pixelRatio: TL });
  }
  for (const [khoa, mau] of Object.entries(MAU_ICON_TAU)) {
    for (const chay of [true, false]) {
      const ten = `ais-${khoa}-${chay ? "chay" : "dung"}`;
      if (map.hasImage(ten)) continue;
      const img = ve(mau, chay);
      if (img) map.addImage(ten, img, { pixelRatio: TL });
    }
  }
}

/** Cỡ icon theo zoom — xa thì nhỏ cho đỡ rối (cả biển ~8 000 tàu), gần thì rõ hình. */
export const CO_ICON_TAU = ["interpolate", ["linear"], ["zoom"], 4, 0.38, 7, 0.55, 10, 0.8, 13, 1] as const;
