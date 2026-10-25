/*
  BIÊN NHẬN NỔI DÙNG CHUNG (toast) — kho module, KHÔNG cần Provider (rà FB 2026-10-25, X5/X8: 3 kiểu toast tự chế).
  Khuôn lấy từ Kairos `use-post-actions` (role=status, 5 s, hai màu tốt/xấu). Luật:
   · MỘT toast một lúc — báo mới ĐÈ báo cũ (bà con đọc một câu, không xếp hàng).
   · Tự tắt sau TOAST_MS; có nút phụ (≤2 chữ, vd "Hoàn tác") thì bấm = gọi callback + tắt.
   · Phần vẽ ở `components/ui/toast.tsx` (`<ToastHost/>` gắn một lần ở vỏ app). File này thuần để test.
*/

/** 5 s theo khuôn Kairos (notify.ts 3 s là cho dòng báo trên bản đồ — câu toast có hành động cần lâu hơn). */
export const TOAST_MS = 5000;

export type LoaiToast = "tot" | "xau";

export type Toast = {
  id: number;
  text: string;
  loai: LoaiToast;
  hanhDong?: { nhan: string; onClick: () => void };
};

let hienTai: Toast | null = null;
let dem = 0;
let dongHo: ReturnType<typeof setTimeout> | null = null;
const nguoiNghe = new Set<() => void>();

function phat() {
  for (const cb of nguoiNghe) cb();
}

/** Báo một câu; trả id để tắt sớm. `ms` chỉ dùng cho test / câu dài. */
export function baoToast(text: string, opts: { loai?: LoaiToast; hanhDong?: Toast["hanhDong"]; ms?: number } = {}): number {
  const id = ++dem;
  hienTai = { id, text, loai: opts.loai ?? "tot", hanhDong: opts.hanhDong };
  if (dongHo) clearTimeout(dongHo);
  dongHo = setTimeout(() => tatToast(id), opts.ms ?? TOAST_MS);
  phat();
  return id;
}

/** Tắt toast `id` (hoặc toast đang hiện nếu không truyền). Id cũ đã bị đè ⇒ bỏ qua. */
export function tatToast(id?: number): void {
  if (!hienTai || (id !== undefined && hienTai.id !== id)) return;
  hienTai = null;
  if (dongHo) clearTimeout(dongHo);
  dongHo = null;
  phat();
}

export function docToast(): Toast | null {
  return hienTai;
}

export function theoDoiToast(cb: () => void): () => void {
  nguoiNghe.add(cb);
  return () => {
    nguoiNghe.delete(cb);
  };
}

/** Bấm nút phụ: chạy việc rồi tắt (một chạm, không để toast treo tới hết giờ). */
export function bamHanhDong(t: Toast): void {
  t.hanhDong?.onClick();
  tatToast(t.id);
}
