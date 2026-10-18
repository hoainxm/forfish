// SEN BIỂN — GHI MẪU ĐỂ HỌC THÊM (chủ dự án 2026-10-18: "làm đi cái phần thu thập
// để nâng cấp mô hình sau khi sử dụng, đảm bảo mô hình luôn thông minh"; bà con đã
// đồng ý điều khoản lúc đăng ký nên không hỏi thêm).
//
// Mỗi câu bà con nói với Sen Biển ⇒ MỘT mẫu: chữ bộ nghe ra + máy đã hiểu thành việc gì
// (+ Gemma đoán gì, nếu có). Cất TRONG MÁY trước, có sóng mới gửi về `/api/sen-bien/mau`;
// máy chủ gom lại, thầy chấm nhãn, huấn luyện n-gram/Gemma bản mới, qua cổng chấm rồi phát.
//
// Tín hiệu quý nhất không cần ai chấm: câu NÓI LẠI. Bà con nói, Sen Biển hiểu sai, bà con
// nói lại khác đi trong vài giây ⇒ câu trước là ca sai, câu sau là cách nói đúng. Nên mỗi
// mẫu mang `phien` (một lần mở Sen Biển) và `t` (mốc ms) — máy chủ tự ghép cặp.
//
// KHÔNG GỬI: tiếng thu (chỉ chữ), vị trí tàu, SĐT (máy chủ biết người gọi qua chuỗi thiết
// bị nhưng không lưu SĐT vào mẫu — xem route). Mất sóng: kho nằm im, không treo gì.

import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { tokenHeader } from "@/lib/device-token-store";

import type { SenReply } from "./hieu-y";

export const MAU_KEY = "forfish.senbien.mau.v1";
const LAN_GUI_KEY = "forfish.senbien.mau-gui.v1";
export const MAU_TRAN = 300; // đầy thì bỏ mẫu cũ nhất — mẫu là thứ "có thì tốt", không được ăn chỗ của giấy tờ
export const LO_GUI = 100; // = trần route nhận
export const CAU_TOI_DA = 200;
const CACH_GUI_MS = 10 * 60_000; // gửi hỏng thì 10 phút sau mới thử lại
const CHO_GUI_MS = 8_000;

export type MauSen = {
  id: string;
  /** mốc ms lúc nói */
  t: number;
  /** một lần mở Sen Biển — ghép cặp câu nói lại */
  phien: string;
  /** chữ bộ nghe ra (đã cắt ≤ 200 ký tự) */
  cau: string;
  /** máy làm gì: go/pick/start/stop/cancel/mute/unmute/repeat/howfar/hoi/map/say */
  tra: string;
  /** chi tiết việc: ý n-gram (say), loại câu hỏi (hoi), việc bản đồ (map), số chỗ (pick) */
  ct?: string;
  /** Gemma đoán ý gì (Android) — null = không có/không kịp */
  gemma?: string | null;
  /** đang chờ "đi" / đang dẫn đường lúc nói */
  xn: boolean;
  chay: boolean;
  nen: string;
  ban: string;
};

const TRA = new Set(["go", "pick", "start", "stop", "cancel", "mute", "unmute", "repeat", "howfar", "hoi", "map", "say"]);
const CHU_NGAN = /^[a-z0-9_:.-]{0,40}$/;

/** Việc máy đã làm, gọn để học — không mang toạ độ chỗ đến (chỉ loại chỗ). */
export function tomTatTraLoi(r: SenReply): { tra: string; ct?: string } {
  switch (r.kind) {
    case "go":
      return { tra: "go", ct: r.dest.kind };
    case "pick":
      return { tra: "pick", ct: String(r.options.length) };
    case "hoi":
      return { tra: "hoi", ct: r.q.loai };
    case "map":
      return { tra: "map", ct: r.lenh.viec };
    case "say":
      return { tra: "say", ct: r.y };
    default:
      return { tra: r.kind };
  }
}

/**
 * Kiểm một mẫu ở RANH GIỚI (máy chủ nhận, và máy đọc lại kho của chính nó). Sai khuôn ⇒ null,
 * không sửa đoán. Dùng chung hai đầu để không có hai bản luật.
 */
export function lamSachMau(x: unknown): MauSen | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : null);
  const id = str(o.id, 40);
  const phien = str(o.phien, 40);
  const cau = typeof o.cau === "string" ? o.cau.trim().slice(0, CAU_TOI_DA) : "";
  const tra = str(o.tra, 10);
  const t = typeof o.t === "number" && Number.isFinite(o.t) && o.t > 0 ? Math.floor(o.t) : null;
  if (!id || !phien || !cau || !tra || !TRA.has(tra) || t == null) return null;
  const ct = o.ct == null ? undefined : str(o.ct, 40);
  if (ct === null || (ct !== undefined && !CHU_NGAN.test(ct))) return null;
  const gemma = o.gemma == null ? null : str(o.gemma, 40);
  if (gemma !== null && !CHU_NGAN.test(gemma)) return null;
  return {
    id,
    t,
    phien,
    cau,
    tra,
    ...(ct !== undefined ? { ct } : {}),
    gemma,
    xn: o.xn === true,
    chay: o.chay === true,
    nen: str(o.nen, 10) ?? "?",
    ban: str(o.ban, 40) ?? "",
  };
}

/** Thêm một mẫu, giữ tối đa `tran` mẫu MỚI nhất. Thuần. */
export function themMau(ds: readonly MauSen[], m: MauSen, tran = MAU_TRAN): MauSen[] {
  const out = [...ds, m];
  return out.length > tran ? out.slice(out.length - tran) : out;
}

/** Bỏ khỏi kho các mẫu máy chủ đã nhận (theo id). Thuần. */
export function boDaGui(ds: readonly MauSen[], daGui: readonly string[]): MauSen[] {
  const s = new Set(daGui);
  return ds.filter((m) => !s.has(m.id));
}

function docKho(): MauSen[] {
  try {
    const raw = window.localStorage.getItem(MAU_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.map(lamSachMau).filter((m): m is MauSen => m !== null) : [];
  } catch {
    return [];
  }
}

function ghiKho(ds: MauSen[]): void {
  try {
    window.localStorage.setItem(MAU_KEY, JSON.stringify(ds));
  } catch {
    // máy hết chỗ: mẫu học là thứ bỏ được — không báo, không xoá đồ khác để lấy chỗ
  }
}

function maNgau(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Mã một lần mở Sen Biển — gọi lúc mở. */
export function phienMoi(): string {
  return maNgau();
}

/** Ghi một câu vừa nói. Không ném, không chờ mạng. */
export function ghiMauSen(a: {
  phien: string;
  cau: string;
  r: SenReply;
  gemma?: string | null;
  xn: boolean;
  chay: boolean;
  nen: string;
  ban: string;
}): void {
  const m = lamSachMau({
    id: maNgau(),
    t: Date.now(),
    phien: a.phien,
    cau: a.cau,
    ...tomTatTraLoi(a.r),
    gemma: a.gemma ?? null,
    xn: a.xn,
    chay: a.chay,
    nen: a.nen,
    ban: a.ban,
  });
  if (!m) return;
  ghiKho(themMau(docKho(), m));
}

/**
 * Gửi một lô lên máy chủ khi có sóng và đã đăng nhập. Chỉ xoá khỏi máy những mẫu máy chủ
 * báo ĐÃ NHẬN. Mất sóng / hết giờ / lỗi ⇒ giữ nguyên, 10 phút sau mới thử lại.
 * Bắn-rồi-quên: nơi gọi không cần chờ.
 */
export async function guiMauSen(now = Date.now()): Promise<number> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
    const head = tokenHeader();
    if (!Object.keys(head).length) return 0; // chưa đăng nhập: giữ trong máy
    const lan = Number(window.localStorage.getItem(LAN_GUI_KEY) ?? 0);
    if (Number.isFinite(lan) && now - lan < CACH_GUI_MS) return 0;
    const ds = docKho();
    if (!ds.length) return 0;
    window.localStorage.setItem(LAN_GUI_KEY, String(now));
    const lo = ds.slice(0, LO_GUI);
    const res = await fetch(apiUrl("/api/sen-bien/mau"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...head },
      body: JSON.stringify({ mau: lo }),
      signal: timeoutSignal(CHO_GUI_MS),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; nhan?: unknown } | null;
    if (!res.ok || !j?.ok || !Array.isArray(j.nhan)) return 0;
    const nhan = j.nhan.filter((x): x is string => typeof x === "string");
    // đọc lại kho: trong lúc gửi có thể đã thêm câu mới
    ghiKho(boDaGui(docKho(), nhan));
    window.localStorage.removeItem(LAN_GUI_KEY); // gửi được ⇒ lô sau gửi tiếp ngay lần tới
    return nhan.length;
  } catch {
    return 0;
  }
}
