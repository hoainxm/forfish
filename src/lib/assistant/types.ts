// TRỢ LÝ GIỌNG NÓI — hợp đồng type dùng chung cho tầng máy (parse/answer),
// client glue (snapshot/hook/UI) và tầng máy chủ (route/claude/mock).
// THUẦN: không import gì ngoài type của lib có sẵn.

import type { ExpiryLevel } from "@/lib/documents";

/* ───────────────────────── Ý ĐỊNH ───────────────────────── */

/** Mã ý định — MỘT danh sách cho cả parse offline lẫn system prompt online (bảng §3.0 ↔ 13 §3).
 *  Thêm mã = thêm dòng §3.0 + mẫu ở intents.ts + câu ở answer.ts + ≥4 câu test + 1 dòng ở 13. */
export type Intent =
  // ── Trục 1: đi biển ──
  | "thoi_tiet"      // INT-01/02/03/06: thời tiết/sóng/gió/mưa/đi được không — slot day, aspect, portName
  | "bao"            // INT-04: có bão/áp thấp không
  | "con_nuoc"       // INT-05: nước lớn/ròng (khi máy có bảng con nước)
  | "dan_duong"      // INT-07: dẫn đường tới điểm đã lưu <tên> (v1: mở Ra khơi + nói tên)
  | "dat_cang_nha"   // INT-08: đặt cảng nhà = <cảng>
  // ── Trục 4 + 3: tàu, giấy tờ, người ──
  | "giay_to"        // INT-09: giấy tờ sắp hết/đã hết hạn
  | "bao_duong"      // INT-10: bảo dưỡng tới hạn/quá hạn
  | "thuyen_vien"    // INT-11: sổ thuyền viên: mấy người, ai có cảnh báo (KHÔNG đọc CCCD/SĐT)
  | "tau_cua_toi"    // INT-12: tàu đang chọn / đổi tàu (slot boatName)
  // ── Trục 2: chợ vật tư + giá ──
  | "tim_mon"        // INT-13: tìm/mua món X → /cho/tim?q=
  | "them_gio"       // INT-14: thêm N món X vào giỏ CHỢ — ONLINE: client tìm top 3, chạm = xác nhận
  | "xem_gio"        // INT-15: giỏ có gì
  | "don_cua_toi"    // INT-16: đơn của tôi / đơn đang giao
  | "gia_ca"         // INT-17: giá cá (loài tuỳ chọn)
  | "gia_dau"        // INT-18: giá dầu DO
  | "tin_mua_ban"    // INT-19: tin mua/bán, bán cá ở đâu → /tien
  | "goi_shop"       // INT-21: gọi shop (của đơn gần nhất hoặc theo tên)
  | "goi_sdvico"     // INT-21: gọi SDVICO (SDVICO_HOTLINE)
  // ── Điều hướng ──
  | "mo_man"         // INT-20: mở màn (ScreenTarget)
  | "hop_thu"        // INT-22: hộp thư có tin mới không
  // ── Điều khiển trợ lý (INT-23/24) ──
  | "tro_giup"       // "bác nói được gì?"
  | "lap_lai"        // nói lại câu vừa rồi
  | "tat_tieng"      // tắt đọc to
  | "bat_tieng"      // bật đọc to
  | "xac_nhan"       // ừ / được / đồng ý  (chỉ có nghĩa khi đang chờ confirm)
  | "tu_choi"        // thôi / không / bỏ    (chỉ có nghĩa khi đang chờ confirm)
  | "huy"            // huỷ / đóng trợ lý
  // ── Không thuộc máy / chặn ──
  | "hoi_mo"         // INT-25: câu hỏi mở (kinh nghiệm, so sánh, giải thích) → online
  | "ngoai_pham_vi"  // INT-26: y tế/pháp lý/tiền cá nhân/chính trị/tra người — chặn, KHÔNG lên máy chủ
  | "chao_hoi"       // INT-27: chào / cảm ơn / "alo"
  | "khong_hieu";    // INT-27: không khớp gì — hỏi lại / online nếu có sóng

export const INTENTS: readonly Intent[] = [
  "thoi_tiet", "bao", "con_nuoc", "dan_duong", "dat_cang_nha",
  "giay_to", "bao_duong", "thuyen_vien", "tau_cua_toi",
  "tim_mon", "them_gio", "xem_gio", "don_cua_toi", "gia_ca", "gia_dau", "tin_mua_ban", "goi_shop", "goi_sdvico",
  "mo_man", "hop_thu",
  "tro_giup", "lap_lai", "tat_tieng", "bat_tieng", "xac_nhan", "tu_choi", "huy",
  "hoi_mo", "ngoai_pham_vi", "chao_hoi", "khong_hieu",
] as const;

/** Ý định KHÔNG BAO GIỜ gửi lên máy chủ (13 INT-26, AC-T06). */
export const NEVER_ONLINE: readonly Intent[] = ["ngoai_pham_vi"] as const;

/** Ý định NÊN đi online nếu có sóng (dù offline có khớp): câu hỏi mở. */
export const ONLINE_FIRST: readonly Intent[] = ["hoi_mo"] as const;

/** Màn mở được bằng giọng — khớp route thật (07 §4), không có route mới. */
export type ScreenTarget =
  | "trang_chu" | "ra_khoi" | "tau" | "giay_to" | "bao_duong" | "san_pham" | "ban_thuyen"
  | "giao_dich" | "cho" | "gio_hang" | "don_hang" | "ban_hang" | "hop_thu" | "cang_ca" | "huong_dan";

export const SCREEN_HREF: Record<ScreenTarget, string> = {
  trang_chu: "/",
  ra_khoi: "/ngu-truong",
  tau: "/tau",
  giay_to: "/tau?tab=giay-to",
  bao_duong: "/tau?tab=dich-vu",
  san_pham: "/tau?tab=san-pham",
  ban_thuyen: "/nguoi",
  giao_dich: "/tien",
  cho: "/cho",
  gio_hang: "/cho/gio",
  don_hang: "/cho/don",
  ban_hang: "/ban-hang",
  hop_thu: "/",            // Trang chủ không nhận ?tab; hộp thư là InboxSection inline → câu trả lời nói "kéo xuống hộp thư"
  cang_ca: "/cang",
  huong_dan: "/huong-dan.html",
};

/** Tham số rút từ câu nói. Mọi trường tuỳ chọn; parse chỉ điền cái thấy. */
export interface Slots {
  /** 0 = hôm nay, 1 = ngày mai, 2 = ngày kia … 6 ("tuần sau" → 6); thiếu = hôm nay. answer kẹp theo hạng (basic ≤2) */
  day?: number;
  /** khía cạnh thời tiết bà con hỏi; thiếu = "chung" (điểm đi biển + sóng + gió);
   *  "di_duoc" = INT-06 (điểm + bão + luôn "nghe đài duyên hải") */
  aspect?: "chung" | "song" | "gio" | "mua" | "di_duoc";
  /** tên cảng nói trong câu (đã foldVn, khớp ctx.portNames) — thoi_tiet/tin_mua_ban; thiếu = cảng nhà */
  portName?: string;
  /** tên/số hiệu tàu (đã foldVn) — tau_cua_toi khi muốn đổi tàu */
  boatName?: string;
  /** loại giấy hỏi riêng (DocumentKind) — giay_to, tuỳ chọn */
  docKind?: string;
  /** chuỗi tìm món (đã foldVn) — tim_mon / them_gio */
  q?: string;
  /** `q` ở dạng CÓ DẤU lấy từ câu gốc (để hiện/đọc; "nhớt" → "dầu nhớt") — không dùng để tra kho */
  qRaw?: string;
  /** số lượng — them_gio (bắt buộc, mặc định 1, clamp 1..999) / tim_mon (tuỳ chọn); số tiếng Việt đã đổi sang số */
  qty?: number;
  /** đơn vị nói kèm (cây, thùng, bao, lít, kg…) — them_gio, chỉ để hiện lại */
  unit?: string;
  /** `unit` có dấu ("thung" → "thùng") — chỉ để hiện/đọc */
  unitRaw?: string;
  /** loài cá (đã foldVn) — gia_ca */
  species?: string;
  /** màn cần mở — mo_man */
  target?: ScreenTarget;
  /** tên cảng (đã foldVn) — dat_cang_nha; hoặc tên điểm đã lưu — dan_duong */
  placeName?: string;
  /** tên shop (đã foldVn) — goi_shop */
  shopName?: string;
  /** dạng có dấu (từ câu gốc) của placeName / shopName / species — chỉ để hiện/đọc khi không tra được tên chuẩn */
  nameRaw?: string;
  /** don_cua_toi: chỉ đơn đang giao hay tất cả */
  orderFilter?: "dang_giao" | "tat_ca";
}

export interface ParsedIntent {
  intent: Intent;
  /** 0..1 — ≥0.6 tầng máy tự trả lời; <0.6 → online nếu có sóng, không thì hỏi lại */
  confidence: number;
  slots: Slots;
  /** chuỗi đã chuẩn hoá (để log/test/hiện lại), KHÔNG phải câu gốc */
  normalized: string;
  /** ý thứ hai trong câu ("coi thời tiết rồi gọi SDVICO") — UI hiện thành chip, không tự làm (13 §3, AC-T07) */
  followUp?: Intent;
  /** vì sao khong_hieu: câu >40 chữ / rỗng (13 INT-27) */
  reason?: "qua_dai" | "rong";
}

/** Ngữ cảnh lúc parse — thứ parse cần ngoài câu nói. */
export interface ParseContext {
  route: string;
  /** đang chờ bà con xác nhận một hành động → "ừ/thôi" mới có nghĩa */
  awaitingConfirm: boolean;
  /** tên tàu/số hiệu trong máy, để khớp slot boatName */
  boatNames: readonly string[];
  /** tên cảng + tên điểm đã lưu, để khớp slot placeName mà không cần regex biết trước */
  portNames: readonly string[];
  placeNames: readonly string[];
}

/* ───────────────────── DỮ LIỆU MÁY (SNAPSHOT) ───────────────────── */

/** Một ngày dự báo theo cảng — rút gọn từ ScoredSeaDay (lib/sea.ts). */
export interface SeaDaySummary {
  date: string;          // ISO yyyy-mm-dd
  score: number;         // 1–100
  level: "good" | "caution" | "bad";
  waveMaxM: number;
  waveEstimated: boolean;
  windMaxKmh: number;
  gustMaxKmh: number;
  precipMm: number;
  wmoCode: number | null;
}

export interface StormSummary {
  name: string;
  kindLabel: string;     // "Bão" | "Áp thấp nhiệt đới" | …
  windKmh: number | null;
  alert: "watch" | "danger";
  /** Toạ độ CHỈ ở bản trong máy (answer offline); bản gửi máy chủ bỏ đi (13 §7.3 không gửi toạ độ) */
  lat?: number;
  lon?: number;
  /**
   * Km từ CẢNG NHÀ tới tâm bão — client tính lúc gom (`haversineKm`). Bỏ trống
   * khi bản tin không có toạ độ hoặc chưa đặt cảng nhà; lúc đó `answer` coi như
   * bão ở GẦN (nghiêng về an toàn). Cũng bị bỏ trước khi gửi máy chủ.
   */
  distanceKm?: number;
}

export interface DocSummary {
  /** nhãn loại giấy (kindLabel) — KHÔNG số giấy, KHÔNG tên chủ */
  label: string;
  expiresOn: string | null;
  daysLeft: number | null;
  level: ExpiryLevel;
}

export interface MaintenanceSummary {
  item: string;          // tên việc (do bà con gõ — coi là dữ liệu, cắt ≤40 ký tự)
  dueOn: string;
  daysLeft: number;
  level: "overdue" | "soon" | "ok";
}

export interface OrderSummary {
  code: string;
  status: "cho_xac_nhan" | "da_xac_nhan" | "dang_giao" | "da_giao" | "hoan_thanh" | "da_huy";
  shopName: string;
  totalVnd: number;
  /** SĐT shop chỉ giữ ở CLIENT để action call; KHÔNG gửi lên server (server tự tra) */
  shopPhone?: string;
}

/**
 * Tất cả những gì trợ lý biết về máy này — client gom MỘT lần mỗi câu hỏi.
 * LUẬT: chỉ số đếm, nhãn loại, hạn, mốc lưu. KHÔNG CCCD/SĐT/STK/tên người/số giấy.
 * `null` = máy KHÔNG CÓ bản này (khác mảng rỗng = có bản, rỗng thật).
 */
export interface DeviceSnapshot {
  takenAt: number;                 // epoch ms giờ máy
  route: string;
  online: boolean;                 // navigator.onLine !== false
  premium: boolean;
  home: { portId: string; portName: string; province: string } | null;
  weather: { portId: string; portName: string; savedAt: number; days: SeaDaySummary[] } | null; // MỌI ngày đã lưu (≤7) — answer cắt 3 khi !premium (brief §4 #6); stripForServer cắt 3 trước khi gửi
  storm: { savedAt: number; storms: StormSummary[] } | null;
  tide: { stationName: string; savedAt: number; extremes: { at: number; kind: "high" | "low"; heightM: number }[] } | null;
  boat: { name: string; count: number; names: string[] } | null;   // names ≤5 để khớp/đổi tàu (tên tàu do bà con đặt — coi là dữ liệu, ≤40 ký tự)
  docs: DocSummary[] | null;       // của tàu đang chọn; null = đọc hỏng (readFailed)
  maintenance: MaintenanceSummary[] | null;
  crew: { count: number; issues: number } | null;
  cart: { lines: number; titles: string[] };   // titles ≤3, mỗi tên ≤40 ký tự
  orders: { savedAt: number; items: OrderSummary[] } | null; // ≤5 mới nhất
  fishPrices: { savedAt: number; week: string | null; items: { species: string; minVnd: number; maxVnd: number }[] } | null; // ≤12
  fuel: { savedAt: number; date: string; priceVnd: number } | null;
  inboxUnread: number;
  /** tên điểm đã lưu (≤12) — chỉ tên, không toạ độ */
  placeNames: string[];
}

/* ───────────────────── TRẢ LỜI + HÀNH ĐỘNG ───────────────────── */

/** Tập hành động ĐÓNG (13 AC-T24): không có đặt hàng/huỷ/xoá/gửi. `confirm` bắt buộc cho addToCart + call. */
export type AssistantAction =
  | { type: "navigate"; href: string }
  | { type: "search"; q: string }                          // → /cho/tim?q=
  | { type: "addToCart"; productId: string; title: string; qty: number; variantLabel?: string; shopName: string; priceVnd: number } // client đã tìm qua /api/cho/san-pham
  | { type: "call"; tel: string; label: string }
  | { type: "setHomePort"; portId: string; portName: string; province?: string }   // đảo được — chip "Đổi lại" (utterance đặt lại cảng cũ), không confirm; `province` tra từ danh sách để UI ghi đúng tỉnh
  | { type: "setBoat"; boatId: string; boatName: string }       // đảo được — chip "Đổi lại", không confirm
  | { type: "mute"; on: boolean };

export type ReplySource = "offline" | "online" | "mock";

export interface AssistantReply {
  /** chữ hiện trên màn (≤2 câu, có thể xuống dòng) */
  text: string;
  /** chữ đọc to — thường = text, ngắn hơn khi text có bảng số */
  speak: string;
  /** hành động ĐỀ NGHỊ — UI thực hiện ngay nếu vô hại (navigate/search/mute),
   *  hoặc hỏi xác nhận nếu có `confirm` */
  action?: AssistantAction;
  /** cần một CHẠM trước khi làm `action` (addToCart, call). Xác nhận luôn là chạm (13 §4.3); "ừ" chỉ là đường phụ khi đang chờ */
  confirm?: { question: string };
  /** hỏi lại 1 lần (13 §4.1 "hỏi lại"): câu + chip ≤4; chọn chip = gửi utterance đó (13 = `needsClarify`) */
  clarify?: { question: string; options: Suggestion[] };
  /** thẻ món ONLINE cho them_gio (≤3) — chạm thẻ = xác nhận addToCart (use-assistant điền, answer thuần không có) */
  candidates?: { productId: string; title: string; priceVnd: number; shopName: string; variants?: string[] }[];
  /** số lượng bà con ĐÃ NÓI (them_gio) — UI mở sẵn bộ đếm đúng số trên MỌI thẻ khi có ≥2 `candidates`
   *  (1 thẻ thì `action.addToCart.qty` cũng bằng số này). Không có = 1 */
  qty?: number;
  source: ReplySource;
  /** mốc lưu của dữ liệu dùng để trả lời (epoch ms) — UI in "lưu lúc …" */
  savedAt?: number;
  /** câu trả lời trích KHO KIẾN THỨC: dòng nguồn + tháng soát ("Theo … · SDVICO soát 9/2026") — UI in dưới câu */
  sourceNote?: string;
  /** ý định đã hiểu — để UI chọn chip tiếp theo + log */
  intent: Intent;
}

export interface Suggestion {
  label: string;      // chữ trên chip (≤4 từ)
  utterance: string;  // câu sẽ được xử lý như bà con vừa nói
}

/* ───────────────────── HỢP ĐỒNG ROUTE ───────────────────── */

export interface AssistantRequest {
  text: string;                     // 1..300 ký tự — MỘT câu, không kèm 10 câu trước (13 §4.1/§7.3)
  snapshot: DeviceSnapshot;         // ≤ 8 KB sau JSON.stringify, đã stripForServer
  route: string;
}
// nợ: `history` ≤3 lượt ("món kia"), thêm lại khi đo thấy bà con nói tham chiếu; 13 §4.1 chốt v1 mỗi lượt = 1 câu

export type AssistantErrorCode =
  | "invalid"          // 400 body sai hình/quá dài
  | "bad_snapshot"     // 400 snapshot có trường nhạy cảm (CCCD/SĐT/STK/toạ độ/tên người) — từ chối, không lặng lẽ bỏ (13 AC-T53)
  | "no_token"         // 401 (từ identityFromRequest)
  | "unknown_token" | "token_revoked" // 401
  | "quota"            // 429 hết lượt hôm nay
  | "no_key"           // 503 chưa cấu hình khoá (prod)
  | "unavailable"      // 503 cổng danh tính không tra được
  | "upstream"         // 502 Anthropic lỗi (4xx/5xx không phải timeout)
  | "timeout"          // 504 quá 20 s
  | "refused";         // 200 nhưng model từ chối (stop_reason refusal sau fallback)

export type AssistantResponse =
  | { ok: true; reply: AssistantReply; remaining: number }
  | { ok: false; code: AssistantErrorCode };
