"use client";

/*
  ẢNH CHO ĐIỂM NGƯỜI DÙNG — chế độ Hải đồ (2026-11-04, anh Long: "cho lưu đi, đẩy máy chủ luôn").
  Đối chiếu iSailor AddInfoEditor (điểm có ảnh chụp). Một điểm giữ tối đa `ANH_DIEM_TOI_DA` ảnh (places.ts).

  ĐƯỜNG ĐI CỦA MỘT ẢNH
    1. Nén trong máy (`compressImage` của ảnh giấy tờ, cạnh dài 1280 px, ≤ 900 KB — đủ nhận ra mỏm đá/phao).
    2. CÓ SÓNG ⇒ đẩy ngay lên máy chủ: DÙNG LẠI `/api/me/docs/photo` (bucket riêng tư `user-docs`, path luôn bắt
       đầu bằng SĐT chủ ⇒ chỉ chủ xem/xoá được; không thêm bảng, không migration). Điểm giữ PATH máy chủ.
    3. MẤT SÓNG / đẩy hỏng ⇒ cất bytes vào KHO CHỜ trong máy (lib/hai-do/anh-cho-kho), điểm giữ khoá `cho:<id>`;
       có sóng lại thì `dayAnhCho` đẩy lên, đổi khoá thành path, rồi mới gỡ khỏi kho chờ.
  Xem: ảnh đã đẩy đọc qua `docAnhGiayUrl` (kho trong máy trước, mạng sau) ⇒ mất sóng vẫn xem ảnh đã đẩy từ máy này.
  Mọi hàm KHÔNG ném: hỏng ⇒ null/false, chỗ gọi nói một dòng.
*/
import { compressImage, deleteDocPhoto, docAnhGiayUrl, uploadDocPhoto } from "@/lib/doc-photos";
import type { SavedPlace } from "@/lib/places";
import { datCho, layCho, tatCaCho, xoaCho } from "@/lib/hai-do/anh-cho-kho";

export const KHOA_CHO = "cho:";
/** ảnh trong kho chờ mà điểm không còn nhắc tới, cũ hơn mức này mới gỡ (vừa cất mà điểm chưa kịp ghi sổ thì không phải rác) */
const MO_COI_MS = 10 * 60_000;

export const laAnhCho = (k: string): boolean => k.startsWith(KHOA_CHO);

/** docId cho route ảnh (chỉ nhận [A-Za-z0-9_-]{1,64}) từ id điểm "12.064,109.713". Thuần, có test. */
export function docIdDiem(placeId: string): string {
  return `diem_${placeId.replace(/[^A-Za-z0-9]/g, "_")}`.slice(0, 64);
}

const coSong = () => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Lưu một ảnh cho điểm: nén → có sóng thì đẩy (trả path) → không thì cất kho chờ (trả "cho:…").
 * null = không giữ được ở đâu cả (kho hỏng VÀ không đẩy được) — chỗ gọi báo, điểm vẫn lưu không ảnh.
 */
export async function luuAnhDiem(placeId: string, file: Blob): Promise<string | null> {
  let blob: Blob;
  try {
    blob = await compressImage(file, { maxDim: 1280, targetBytes: 900 * 1024 });
  } catch {
    blob = file; // máy không nén được (WebView cũ) — máy chủ vẫn chặn cỡ 2 MB
  }
  if (coSong()) {
    const path = await uploadDocPhoto(docIdDiem(placeId), blob);
    if (path) return path;
  }
  const khoa = `${KHOA_CHO}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return (await datCho({ khoa, placeId, blob, luc: Date.now() })) ? khoa : null;
}

/**
 * Đẩy các ảnh còn trong kho chờ lên máy chủ (gọi lúc mở màn + khi có sóng lại). Trả danh sách điểm MỚI nếu có
 * ảnh đổi khoá, null nếu không có gì đổi. Lần lượt từng ảnh; mất sóng / lỗi giữa chừng thì dừng, lần sau đẩy tiếp.
 */
export async function dayAnhCho(places: readonly SavedPlace[]): Promise<SavedPlace[] | null> {
  const cho = places.flatMap((p) => (p.anh ?? []).filter(laAnhCho).map((k) => ({ p, k })));
  const tat = await tatCaCho();
  const dangDung = new Set(cho.map((c) => c.k));
  for (const h of tat) if (!dangDung.has(h.khoa) && Date.now() - h.luc > MO_COI_MS) await xoaCho(h.khoa);
  if (!cho.length) return null;
  const doi = new Map<string, string>();
  for (const { p, k } of cho) {
    if (!coSong()) break;
    const h = tat.find((x) => x.khoa === k) ?? (await layCho(k));
    if (!h) continue;
    const path = await uploadDocPhoto(docIdDiem(p.id), h.blob);
    if (!path) break; // sóng yếu / máy chủ lỗi — giữ trong kho chờ, lần sau
    doi.set(k, path);
    await xoaCho(k);
  }
  if (!doi.size) return null;
  return places.map((p) => (p.anh?.some((k) => doi.has(k)) ? { ...p, anh: p.anh.map((k) => doi.get(k) ?? k) } : p));
}

/** URL để <img> hiện ảnh (`blob:` từ kho hoặc signed URL). Chỗ gọi revoke `blob:` khi gỡ. null = không có. */
export async function urlAnhDiem(khoa: string): Promise<string | null> {
  if (laAnhCho(khoa)) {
    const h = await layCho(khoa);
    return h?.blob ? URL.createObjectURL(h.blob) : null;
  }
  const r = await docAnhGiayUrl(khoa);
  return r?.url ?? null;
}

/** Gỡ ảnh: kho chờ thì xoá trong máy; đã đẩy thì xoá trên máy chủ (+ bản cất trong máy). */
export async function xoaAnhDiem(khoa: string): Promise<boolean> {
  return laAnhCho(khoa) ? xoaCho(khoa) : deleteDocPhoto(khoa);
}
