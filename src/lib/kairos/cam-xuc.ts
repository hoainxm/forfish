// CẢM XÚC KIỂU FACEBOOK (anh Long 2026-10-24: "cho các icon cảm xúc tương tự fb ấy"). THUẦN — route, DTO, khung bài,
// bình luận dùng chung. Lượt "Hay" cũ (trước 0069) là 👍 `hay`. Một người MỘT cảm xúc trên một bài/bình luận (đổi
// cảm xúc = đổi loại, không cộng thêm lượt). Biểu tượng là emoji của máy (giống FB, không phải chữ trang trí).

export const CAM_XUC = [
  { id: "hay", emoji: "👍", nhan: "Hay", mau: "text-sea" },
  { id: "thuong", emoji: "❤️", nhan: "Thương", mau: "text-danger" },
  { id: "haha", emoji: "😆", nhan: "Haha", mau: "text-warn" },
  { id: "wow", emoji: "😮", nhan: "Wow", mau: "text-warn" },
  { id: "buon", emoji: "😢", nhan: "Buồn", mau: "text-warn" },
  { id: "gian", emoji: "😡", nhan: "Giận", mau: "text-danger" },
] as const;

export type CamXuc = (typeof CAM_XUC)[number]["id"];
export const CAM_XUC_IDS = CAM_XUC.map((c) => c.id) as readonly CamXuc[];
const THEO_ID = new Map(CAM_XUC.map((c) => [c.id as string, c]));

export const laCamXuc = (x: unknown): x is CamXuc => typeof x === "string" && THEO_ID.has(x);
export const camXucCua = (id: CamXuc) => THEO_ID.get(id)!;

/** Một dòng tổng: các loại có lượt, nhiều nhất trước (hoà ⇒ theo thứ tự CAM_XUC). */
export type DemCamXuc = { kind: CamXuc; n: number }[];

/** Đếm theo loại (từ máy chủ) ⇒ danh sách đã xếp; số âm/lạ bỏ. */
export function xepDem(dem: Partial<Record<string, number>> | null | undefined): DemCamXuc {
  const out: DemCamXuc = [];
  for (const id of CAM_XUC_IDS) {
    const n = dem?.[id];
    if (typeof n === "number" && Number.isFinite(n) && n > 0) out.push({ kind: id, n: Math.floor(n) });
  }
  return out.sort((a, b) => b.n - a.n || CAM_XUC_IDS.indexOf(a.kind) - CAM_XUC_IDS.indexOf(b.kind));
}

/** Trạng thái cảm xúc của MỘT bài/bình luận phía máy người xem. */
export interface CamXucState {
  myCamXuc: CamXuc | null;
  hayCount: number;
  camXuc: DemCamXuc;
}

/**
 * Chọn cảm xúc (lạc quan): `kind` null = bỏ; trùng cảm xúc đang có = bỏ (chạm lại để gỡ như FB); khác = đổi loại (tổng
 * không đổi). Tổng không xuống dưới 0, đếm theo loại không âm.
 */
export function chonCamXuc(s: CamXucState, kind: CamXuc | null): CamXucState {
  const moi = kind && kind !== s.myCamXuc ? kind : null;
  const dem = new Map(s.camXuc.map((x) => [x.kind, x.n]));
  if (s.myCamXuc) dem.set(s.myCamXuc, Math.max(0, (dem.get(s.myCamXuc) ?? 0) - 1));
  if (moi) dem.set(moi, (dem.get(moi) ?? 0) + 1);
  const tong = Math.max(0, s.hayCount + (moi ? 1 : 0) - (s.myCamXuc ? 1 : 0));
  return { myCamXuc: moi, hayCount: tong, camXuc: xepDem(Object.fromEntries(dem)) };
}

/** Kết quả máy chủ ⇒ trạng thái đúng; máy chủ hỏng ⇒ về trạng thái TRƯỚC khi bấm (hoàn tác lạc quan). */
export function chotCamXuc(
  truoc: CamXucState,
  res: { ok: true; data: { kind?: unknown; hayCount?: unknown; camXuc?: unknown } } | { ok: false },
): CamXucState {
  if (!res.ok) return truoc;
  const n = res.data.hayCount;
  const k = res.data.kind;
  return {
    myCamXuc: laCamXuc(k) ? k : null,
    hayCount: typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : truoc.hayCount,
    camXuc: res.data.camXuc && typeof res.data.camXuc === "object" ? xepDem(res.data.camXuc as Record<string, number>) : truoc.camXuc,
  };
}
