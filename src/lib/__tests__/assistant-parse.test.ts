import { describe, expect, it } from "vitest";
import { parseUtterance, CONFIDENCE_OFFLINE, blockReasonOf } from "@/lib/assistant/parse";
import type { Intent, ParseContext, Slots } from "@/lib/assistant/types";
import { INTENTS, NEVER_ONLINE } from "@/lib/assistant/types";

/*  BỘ HIỂU Ý TẦNG MÁY — bảng câu nói thật (13 §3, 14 §4.5). Mỗi ý định ≥4 câu,
    có dấu + không dấu + nói tắt + giọng miền. Ca đối chứng (bảo hiểm ≠ bão,
    "mua dầu" ≠ giá dầu, hành động phá huỷ không có mã…) là HARD — sai một câu
    là đỏ. Bảng chính đo TỈ LỆ ĐÚNG và đòi ≥95% (13 AC-T01: sai ≤3% + không câu
    nào rơi nhầm INT-26 — vế thứ hai là HARD ở dưới).  */

const CTX: ParseContext = {
  route: "/",
  awaitingConfirm: false,
  boatNames: ["BĐ 91234", "BĐ-97777 TS", "Ghe nhỏ"],
  portNames: ["Vũng Tàu", "Sa Kỳ", "Quy Nhơn", "Hòn Rớ (Nha Trang)", "Phan Thiết", "Tắc Cậu"],
  placeNames: ["Bãi rạn", "Bãi mực Hoàng Sa", "Hòn Cau", "Điểm số 2"],
};

interface Case {
  say: string;
  intent: Intent;
  slots?: Partial<Slots>;
  followUp?: Intent;
  reason?: string;
  ctx?: Partial<ParseContext>;
  minConf?: number;
}

const CASES: Case[] = [
  // ── thoi_tiet (INT-01/02/03) ──
  { say: "thời tiết hôm nay", intent: "thoi_tiet", slots: { day: 0, aspect: "chung" } },
  { say: "thoi tiet hom nay sao", intent: "thoi_tiet", slots: { day: 0 } },
  { say: "hom nay bien the nao", intent: "thoi_tiet", slots: { day: 0 } },
  { say: "nay sóng gió ra sao", intent: "thoi_tiet", slots: { day: 0 } },
  { say: "trời hôm nay có êm không", intent: "thoi_tiet", slots: { day: 0 } },
  { say: "bữa nay biển có êm không", intent: "thoi_tiet", slots: { day: 0 } },
  { say: "coi thời tiết Vũng Tàu giùm", intent: "thoi_tiet", slots: { portName: "vung tau" } },
  { say: "sóng ở Sa Kỳ bữa nay", intent: "thoi_tiet", slots: { day: 0, aspect: "song", portName: "sa ky" } },
  { say: "ngày mai sao", intent: "thoi_tiet", slots: { day: 1 } },
  { say: "mai sóng cao không", intent: "thoi_tiet", slots: { day: 1, aspect: "song" } },
  { say: "ngày kia gió mạnh không", intent: "thoi_tiet", slots: { day: 2, aspect: "gio" } },
  { say: "mốt có mưa không", intent: "thoi_tiet", slots: { day: 2, aspect: "mua" } },
  { say: "mốt trời sao", intent: "thoi_tiet", slots: { day: 2 } },
  { say: "ba ngày tới sóng gió sao", intent: "thoi_tiet", slots: { day: 3 } },
  { say: "cuối tuần biển êm không", intent: "thoi_tiet", slots: { day: 5 } },
  { say: "sóng cao bao nhiêu", intent: "thoi_tiet", slots: { aspect: "song" } },
  { say: "gió cấp mấy", intent: "thoi_tiet", slots: { aspect: "gio" } },
  { say: "gio manh khong", intent: "thoi_tiet", slots: { aspect: "gio" } },
  { say: "có dông không", intent: "thoi_tiet", slots: { aspect: "mua" } },
  { say: "sóng lớn hông", intent: "thoi_tiet", slots: { aspect: "song" } },
  { say: "gió giật bao nhiêu", intent: "thoi_tiet", slots: { aspect: "gio" } },
  // ── di_duoc (INT-06) ──
  { say: "mai đi được không", intent: "thoi_tiet", slots: { day: 1, aspect: "di_duoc" } },
  { say: "di duoc khong", intent: "thoi_tiet", slots: { aspect: "di_duoc" } },
  { say: "hôm nay ra khơi ok không", intent: "thoi_tiet", slots: { day: 0, aspect: "di_duoc" } },
  { say: "điểm đi biển mấy", intent: "thoi_tiet", slots: { aspect: "di_duoc" } },
  { say: "có nên đi không", intent: "thoi_tiet", slots: { aspect: "di_duoc" } },
  { say: "ra khơi được không", intent: "thoi_tiet", slots: { day: 0, aspect: "di_duoc" } },
  { say: "bữa nay đi biển được không", intent: "thoi_tiet", slots: { day: 0, aspect: "di_duoc" } },
  { say: "tuần sau có đi được không", intent: "thoi_tiet", slots: { day: 6, aspect: "di_duoc" } },
  // ── bao (INT-04) ──
  { say: "có bão không", intent: "bao" },
  { say: "co bao khong", intent: "bao" },
  { say: "áp thấp sao rồi", intent: "bao" },
  { say: "bão số mấy tới đâu rồi", intent: "bao" },
  { say: "biển đông có bão hông", intent: "bao" },
  { say: "tin bão mới nhất", intent: "bao" },
  { say: "bão vô chưa", intent: "bao" },
  { say: "bao gio bao vao", intent: "bao" },
  { say: "áp thấp ở đâu", intent: "bao" },
  // ── con_nuoc (INT-05) ──
  { say: "con nước hôm nay", intent: "con_nuoc", slots: { day: 0 } },
  { say: "nuoc len hay xuong", intent: "con_nuoc" },
  { say: "mấy giờ nước lớn", intent: "con_nuoc" },
  { say: "nước ròng lúc nào", intent: "con_nuoc" },
  { say: "triều cường không", intent: "con_nuoc" },
  { say: "nước rặc mấy giờ", intent: "con_nuoc" },
  // ── dan_duong (INT-07) ──
  { say: "dẫn đường tới bãi rạn", intent: "dan_duong", slots: { placeName: "bai ran" }, minConf: 0.9 },
  { say: "dẫn đường tới bãi mực", intent: "dan_duong", slots: { placeName: "bai muc hoang sa" }, minConf: 0.9 },
  { say: "chỉ đường ra Hòn Cau", intent: "dan_duong", slots: { placeName: "hon cau" } },
  { say: "dan duong ve cang", intent: "dan_duong", slots: { placeName: "cang nha" } },
  { say: "về cảng nhà", intent: "dan_duong", slots: { placeName: "cang nha" } },
  { say: "chạy ra Hòn Cau", intent: "dan_duong", slots: { placeName: "hon cau" } },
  { say: "tới điểm số 2", intent: "dan_duong", slots: { placeName: "diem so 2" } },
  // ── dat_cang_nha (INT-08) ──
  { say: "đặt cảng nhà là Vũng Tàu", intent: "dat_cang_nha", slots: { placeName: "vung tau" }, minConf: 0.9 },
  { say: "đặt cảng nhà là Quy Nhơn", intent: "dat_cang_nha", slots: { placeName: "quy nhon" } },
  { say: "cang nha cua toi la Sa Ky", intent: "dat_cang_nha", slots: { placeName: "sa ky" } },
  { say: "tôi hay đi từ Hòn Rớ", intent: "dat_cang_nha", slots: { placeName: "hon ro" } }, // khoá cảng = tên ngoài ngoặc (ports.ts)
  { say: "đổi cảng nhà sang Phan Thiết", intent: "dat_cang_nha", slots: { placeName: "phan thiet" } },
  { say: "cảng của tui là Tắc Cậu", intent: "dat_cang_nha", slots: { placeName: "tac cau" } },
  // ── giay_to (INT-09) ──
  { say: "giấy tờ sắp hết hạn", intent: "giay_to" },
  { say: "giấy tờ nào sắp hết hạn", intent: "giay_to" },
  { say: "giay phep con han khong", intent: "giay_to", slots: { docKind: "giay_phep_khai_thac" } },
  { say: "đăng kiểm tới khi nào", intent: "giay_to", slots: { docKind: "dang_kiem" } },
  { say: "bảo hiểm tàu còn không", intent: "giay_to", slots: { docKind: "bao_hiem" } },
  { say: "bảo hiểm tàu hết hạn chưa", intent: "giay_to", slots: { docKind: "bao_hiem" } },
  { say: "coi giấy tờ giùm", intent: "giay_to" },
  { say: "giấy gì hết hạn chưa", intent: "giay_to" },
  { say: "hạn giấy phép khai thác", intent: "giay_to" },
  { say: "dang kiem con han khong", intent: "giay_to", slots: { docKind: "dang_kiem" } },
  // ── bao_duong (INT-10) ──
  { say: "bảo dưỡng gì tới hạn", intent: "bao_duong" },
  { say: "bảo dưỡng tới hạn", intent: "bao_duong" },
  { say: "toi ky thay nhot chua", intent: "bao_duong" },
  { say: "máy tới kỳ chưa", intent: "bao_duong" },
  { say: "việc bảo dưỡng nào quá hạn", intent: "bao_duong" },
  { say: "thay lọc dầu chưa", intent: "bao_duong" },
  { say: "coi sổ bảo dưỡng", intent: "bao_duong" },
  { say: "thay nhớt chưa tới hạn hả", intent: "bao_duong" },
  // ── thuyen_vien (INT-11) ──
  { say: "bạn thuyền thiếu gì", intent: "thuyen_vien" },
  { say: "ai chua co bao hiem", intent: "thuyen_vien" },
  { say: "tàu có mấy người", intent: "thuyen_vien" },
  { say: "danh sách bạn thuyền", intent: "thuyen_vien" },
  { say: "ai thiếu căn cước", intent: "thuyen_vien" },
  { say: "thuyền viên mấy người", intent: "thuyen_vien" },
  // ── tau_cua_toi (INT-12) ──
  { say: "tàu đang chọn là tàu nào", intent: "tau_cua_toi" },
  { say: "doi sang tau BD 91234", intent: "tau_cua_toi", slots: { boatName: "bd 91234" }, minConf: 0.9 },
  { say: "đổi sang tàu BĐ 91234", intent: "tau_cua_toi", slots: { boatName: "bd 91234" } },
  { say: "tôi có mấy tàu", intent: "tau_cua_toi" },
  { say: "tàu này số gì", intent: "tau_cua_toi" },
  { say: "chuyển qua tàu ghe nhỏ", intent: "tau_cua_toi", slots: { boatName: "ghe nho" } },
  // ── tim_mon (INT-13) ──
  { say: "mua đá", intent: "tim_mon", slots: { q: "da" } },
  { say: "tôi cần mua đá", intent: "tim_mon", slots: { q: "da" } },
  { say: "cần mua đá", intent: "tim_mon", slots: { q: "da" } },
  { say: "tim nhot castrol", intent: "tim_mon", slots: { q: "dau nhot castrol" } },
  { say: "mua lọc dầu Yanmar", intent: "tim_mon", slots: { q: "loc dau yanmar" } },
  { say: "chỗ nào bán lưới", intent: "tim_mon", slots: { q: "luoi" } },
  { say: "kiếm cái bơm nước biển", intent: "tim_mon", slots: { q: "bom nuoc bien", unit: "cai" } },
  { say: "cần dầu DO", intent: "tim_mon", slots: { q: "dau do" } },
  { say: "mua 2 thùng nhớt", intent: "tim_mon", slots: { q: "dau nhot", qty: 2, unit: "thung" } },
  { say: "tìm dây thừng", intent: "tim_mon", slots: { q: "day thung" } },
  { say: "có bán lưới không", intent: "tim_mon", slots: { q: "luoi" } },
  { say: "mua hai chục lít dầu nhớt", intent: "tim_mon", slots: { q: "dau nhot", qty: 20, unit: "lit" } },
  // ── them_gio (INT-14) ──
  { say: "thêm 2 thùng nhớt vào giỏ", intent: "them_gio", slots: { q: "dau nhot", qty: 2, unit: "thung" } },
  { say: "bỏ 2 thùng nhớt vô giỏ", intent: "them_gio", slots: { q: "dau nhot", qty: 2, unit: "thung" } },
  { say: "bo 5 cay da vo gio", intent: "them_gio", slots: { q: "da", qty: 5, unit: "cay" } },
  { say: "cho 1 cái lọc dầu vào giỏ", intent: "them_gio", slots: { q: "loc dau", qty: 1, unit: "cai" } },
  { say: "lấy 3 cái kẽm chống ăn mòn", intent: "them_gio", slots: { q: "kem chong an mon", qty: 3, unit: "cai" } },
  { say: "thêm vô giỏ 1 can 20 lít", intent: "them_gio", slots: { qty: 1, unit: "can" } },
  { say: "mua giùm 2 bao muối bỏ giỏ", intent: "them_gio", slots: { q: "muoi", qty: 2, unit: "bao" } },
  { say: "thêm hai cây đá vào giỏ", intent: "them_gio", slots: { q: "da", qty: 2, unit: "cay" } },
  { say: "lấy mười thùng nước đá", intent: "them_gio", slots: { q: "da", qty: 10, unit: "thung" } },
  { say: "thêm ba bao muối vào giỏ", intent: "them_gio", slots: { q: "muoi", qty: 3, unit: "bao" } },
  { say: "thêm một tá pin vào giỏ", intent: "them_gio", slots: { q: "pin", qty: 12 } },
  { say: "them 2 thung nhot vao gio hang", intent: "them_gio", slots: { q: "dau nhot", qty: 2, unit: "thung" } },
  // ── xem_gio (INT-15) ──
  { say: "giỏ hàng của tôi", intent: "xem_gio" },
  { say: "trong gio co gi", intent: "xem_gio" },
  { say: "coi giỏ", intent: "xem_gio" },
  { say: "giỏ có mấy món", intent: "xem_gio" },
  { say: "mở giỏ hàng", intent: "xem_gio" },
  { say: "giỏ có gì", intent: "xem_gio" },
  // ── don_cua_toi (INT-16) ──
  { say: "đơn của tôi", intent: "don_cua_toi", slots: { orderFilter: "tat_ca" } },
  { say: "đơn của tôi sao rồi", intent: "don_cua_toi", slots: { orderFilter: "tat_ca" } },
  { say: "don dau toi chua", intent: "don_cua_toi", slots: { orderFilter: "dang_giao" } },
  { say: "hàng tới chưa", intent: "don_cua_toi", slots: { orderFilter: "dang_giao" } },
  { say: "đơn đang giao", intent: "don_cua_toi", slots: { orderFilter: "dang_giao" } },
  { say: "coi đơn hàng", intent: "don_cua_toi" },
  { say: "shop xác nhận chưa", intent: "don_cua_toi" },
  { say: "đơn về chưa", intent: "don_cua_toi", slots: { orderFilter: "dang_giao" } },
  // ── gia_ca (INT-17) ──
  { say: "giá cá hôm nay", intent: "gia_ca" },
  { say: "giá cá ngừ hôm nay", intent: "gia_ca", slots: { species: "ca ngu" } },
  { say: "giá cá ngừ", intent: "gia_ca", slots: { species: "ca ngu" } },
  { say: "gia ca thu bao nhieu", intent: "gia_ca", slots: { species: "ca thu" } },
  { say: "cá cơm giá sao", intent: "gia_ca", slots: { species: "ca com" } },
  { say: "mực bao nhiêu một ký", intent: "gia_ca", slots: { species: "muc" } },
  { say: "mực giá bao nhiêu", intent: "gia_ca", slots: { species: "muc" } },
  { say: "bảng giá cá", intent: "gia_ca" },
  { say: "giá cá tuần này", intent: "gia_ca" },
  { say: "cá nục ở Quy Nhơn bao nhiêu", intent: "gia_ca", slots: { species: "ca nuc", portName: "quy nhon" } },
  // ── gia_dau (INT-18) ──
  { say: "giá dầu", intent: "gia_dau" },
  { say: "giá dầu hôm nay", intent: "gia_dau" },
  { say: "dau DO bao nhieu", intent: "gia_dau" },
  { say: "dầu DO bao nhiêu", intent: "gia_dau" },
  { say: "dầu lên hay xuống", intent: "gia_dau" },
  { say: "dau len hay xuong", intent: "gia_dau" },
  { say: "một lít dầu bao nhiêu", intent: "gia_dau" },
  { say: "giá dầu kỳ này", intent: "gia_dau" },
  // ── tin_mua_ban (INT-19) ──
  { say: "ai mua cá ngừ", intent: "tin_mua_ban", slots: { species: "ca ngu" } },
  { say: "dang tin ban ca", intent: "tin_mua_ban" },
  { say: "bán cá ở đâu được giá", intent: "tin_mua_ban" },
  { say: "chỗ nào thu mua mực", intent: "tin_mua_ban", slots: { species: "muc" } },
  { say: "tin mua bán hôm nay", intent: "tin_mua_ban" },
  { say: "vựa nào ở Sa Kỳ", intent: "tin_mua_ban", slots: { portName: "sa ky" } },
  // ── mo_man (INT-20) ──
  { say: "mở ra khơi", intent: "mo_man", slots: { target: "ra_khoi" } },
  { say: "mo ban do", intent: "mo_man", slots: { target: "ra_khoi" } },
  { say: "vô tàu cá", intent: "mo_man", slots: { target: "tau" } },
  { say: "vào tàu cá", intent: "mo_man", slots: { target: "tau" } },
  { say: "mở tàu cá", intent: "mo_man", slots: { target: "tau" } },
  { say: "qua bạn thuyền", intent: "mo_man", slots: { target: "ban_thuyen" } },
  { say: "mở giao dịch", intent: "mo_man", slots: { target: "giao_dich" } },
  { say: "vào chợ", intent: "mo_man", slots: { target: "cho" } },
  { say: "qua chợ", intent: "mo_man", slots: { target: "cho" } },
  { say: "kênh người bán", intent: "mo_man", slots: { target: "ban_hang" } },
  { say: "mở bán hàng", intent: "mo_man", slots: { target: "ban_hang" } },
  { say: "mở hộp thư", intent: "mo_man", slots: { target: "hop_thu" } },
  { say: "về trang chủ", intent: "mo_man", slots: { target: "trang_chu" } },
  { say: "mở giấy tờ", intent: "mo_man", slots: { target: "giay_to" } },
  { say: "xem giấy tờ", intent: "mo_man", slots: { target: "giay_to" } },
  { say: "mở sổ bảo dưỡng", intent: "mo_man", slots: { target: "bao_duong" } },
  { say: "mở cảng", intent: "mo_man", slots: { target: "cang_ca" } },
  { say: "mở đơn hàng", intent: "mo_man", slots: { target: "don_hang" } },
  // ── goi_* (INT-21) ──
  { say: "gọi SDVICO", intent: "goi_sdvico" },
  { say: "goi sdvico", intent: "goi_sdvico" },
  { say: "gọi tổng đài", intent: "goi_sdvico" },
  { say: "alo SDVICO giúp", intent: "goi_sdvico" },
  { say: "gọi shop", intent: "goi_shop" },
  { say: "goi shop Dai Phat", intent: "goi_shop", slots: { shopName: "dai phat" } },
  { say: "gọi cửa hàng Hải Đăng", intent: "goi_shop", slots: { shopName: "hai dang" } },
  { say: "gọi chỗ bán đá", intent: "goi_shop", slots: { shopName: "da" } },
  { say: "gọi shop đơn đang giao", intent: "goi_shop" },
  { say: "gọi anh Tâm", intent: "goi_shop", followUp: "thuyen_vien" },
  // ── hop_thu (INT-22) ──
  { say: "có tin gì mới không", intent: "hop_thu" },
  { say: "có tin mới không", intent: "hop_thu" },
  { say: "co thong bao gi khong", intent: "hop_thu" },
  { say: "SDVICO nhắn gì", intent: "hop_thu" },
  { say: "đọc tin mới", intent: "hop_thu" },
  { say: "hộp thư có gì", intent: "hop_thu" },
  // ── tro_giup (INT-23) ──
  { say: "bác nói được gì", intent: "tro_giup" },
  { say: "may lam duoc gi", intent: "tro_giup" },
  { say: "giúp tôi", intent: "tro_giup" },
  { say: "hỏi gì được", intent: "tro_giup" },
  { say: "chỉ tôi cách dùng", intent: "tro_giup" },
  // ── điều khiển (INT-24) ──
  { say: "tắt tiếng", intent: "tat_tieng" },
  { say: "im đi", intent: "tat_tieng" },
  { say: "bat tieng", intent: "bat_tieng" },
  { say: "bật tiếng", intent: "bat_tieng" },
  { say: "nói lại", intent: "lap_lai" },
  { say: "nghe lại", intent: "lap_lai" },
  { say: "ừ", intent: "xac_nhan", ctx: { awaitingConfirm: true } },
  { say: "được", intent: "xac_nhan", ctx: { awaitingConfirm: true } },
  { say: "đồng ý", intent: "xac_nhan", ctx: { awaitingConfirm: true } },
  { say: "thôi", intent: "tu_choi", ctx: { awaitingConfirm: true } },
  { say: "không", intent: "tu_choi", ctx: { awaitingConfirm: true } },
  { say: "thôi", intent: "huy" },
  { say: "dừng", intent: "huy" },
  { say: "đóng", intent: "huy" },
  // ── chao_hoi (INT-27) ──
  { say: "alo", intent: "chao_hoi" },
  { say: "chào", intent: "chao_hoi" },
  { say: "cảm ơn nha", intent: "chao_hoi" },
  { say: "cam on", intent: "chao_hoi" },
  // ── hoi_mo (INT-25) ──
  { say: "tại sao sóng lớn cá ít", intent: "hoi_mo" },
  { say: "nên đi biển mùa này không", intent: "hoi_mo" },
  { say: "lưới rê khác lưới vây thế nào", intent: "hoi_mo" },
  { say: "mùa này cá gì được giá", intent: "hoi_mo" },
  { say: "nhớt nào tốt cho máy Yanmar", intent: "hoi_mo" },
  { say: "sao giá dầu tăng", intent: "hoi_mo" },
  { say: "cách bảo quản cá ngừ", intent: "hoi_mo" },
  { say: "đá xay với đá cây nên mua loại nào", intent: "hoi_mo" },
  // ── ngoai_pham_vi (INT-26) ──
  { say: "uống thuốc gì cho hết say sóng", intent: "ngoai_pham_vi", reason: "y_te" },
  { say: "bị phạt bao nhiêu nếu thiếu giấy", intent: "ngoai_pham_vi", reason: "phap_ly" },
  { say: "phạt bao nhiêu nếu thiếu giấy", intent: "ngoai_pham_vi", reason: "phap_ly" },
  { say: "tôi nên vay ngân hàng nào", intent: "ngoai_pham_vi", reason: "tien" },
  { say: "tra căn cước số 0123", intent: "ngoai_pham_vi", reason: "tra_nguoi" },
  { say: "tra CCCD số 012345678901", intent: "ngoai_pham_vi", reason: "tra_nguoi" },
  { say: "chuyện chính trị", intent: "ngoai_pham_vi", reason: "khac" },
  { say: "kể chuyện cười", intent: "ngoai_pham_vi", reason: "khac" },
  // ── khong_hieu (INT-27) ──
  { say: "asdf", intent: "khong_hieu" },
  { say: "", intent: "khong_hieu", reason: "rong" },
  { say: "xì xà xì xồ ù ơ", intent: "khong_hieu" },
  { say: "mua dầu", intent: "khong_hieu", slots: { q: "dau" } },
  { say: "huỷ đơn SD260906ABCD", intent: "khong_hieu", followUp: "don_cua_toi" },
  { say: "đặt hàng luôn", intent: "khong_hieu", followUp: "xem_gio" },
  { say: "xoá giấy đăng kiểm", intent: "khong_hieu", followUp: "giay_to" },
  { say: "ừ", intent: "khong_hieu" },
];

function matchSlots(got: Slots, want: Partial<Slots> | undefined): string | null {
  if (!want) return null;
  for (const [k, v] of Object.entries(want)) {
    const g = got[k as keyof Slots];
    if (g !== v) return `slot ${k}: chờ ${JSON.stringify(v)}, ra ${JSON.stringify(g)}`;
  }
  return null;
}

describe("assistant-parse — bảng câu nói thật (13 §3 / 14 §4.5)", () => {
  it("bảng có ≥120 câu, mọi ý định nghiệp vụ đều có ≥4 câu", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(120);
    const count = new Map<Intent, number>();
    for (const c of CASES) count.set(c.intent, (count.get(c.intent) ?? 0) + 1);
    const skip = new Set<Intent>(["xac_nhan", "tu_choi", "lap_lai", "tat_tieng", "bat_tieng", "huy", "chao_hoi", "tro_giup"]);
    for (const i of INTENTS) {
      if (skip.has(i)) continue;
      expect(count.get(i) ?? 0, `ý định ${i} cần ≥4 câu`).toBeGreaterThanOrEqual(4);
    }
  });

  it("tỉ lệ đúng ≥95% (ghi số thật ra console)", () => {
    const fails: string[] = [];
    for (const c of CASES) {
      const p = parseUtterance(c.say, { ...CTX, ...(c.ctx ?? {}) });
      const errs: string[] = [];
      if (p.intent !== c.intent) errs.push(`intent chờ ${c.intent}, ra ${p.intent} (conf ${p.confidence})`);
      const sl = matchSlots(p.slots, c.slots);
      if (sl) errs.push(sl);
      if (c.followUp && p.followUp !== c.followUp) errs.push(`followUp chờ ${c.followUp}, ra ${p.followUp}`);
      if (c.reason) {
        const got = c.intent === "ngoai_pham_vi" ? blockReasonOf(p) : p.reason;
        if (got !== c.reason) errs.push(`reason chờ ${c.reason}, ra ${got}`);
      }
      const minConf = c.minConf ?? (c.intent === "khong_hieu" || c.intent === "hoi_mo" ? 0 : CONFIDENCE_OFFLINE);
      if (c.intent !== "khong_hieu" && p.confidence < minConf) errs.push(`conf ${p.confidence} < ${minConf}`);
      if (errs.length) fails.push(`"${c.say}" → ${errs.join("; ")} [norm: ${p.normalized}]`);
    }
    const rate = (CASES.length - fails.length) / CASES.length;
    console.log(`[assistant-parse] ${CASES.length - fails.length}/${CASES.length} đúng = ${(rate * 100).toFixed(1)}%`);
    if (fails.length) console.log(fails.join("\n"));
    expect(rate, fails.join("\n")).toBeGreaterThanOrEqual(0.95);
  });

  it("HARD: không câu nào trong bảng rơi nhầm vào ngoai_pham_vi (13 AC-T01)", () => {
    for (const c of CASES) {
      if (c.intent === "ngoai_pham_vi") continue;
      const p = parseUtterance(c.say, { ...CTX, ...(c.ctx ?? {}) });
      expect(p.intent, `"${c.say}" bị chặn oan`).not.toBe("ngoai_pham_vi");
    }
  });

  it("AC-T05/AC-T07 · HARD: ca đối chứng bắt buộc (14 §4.5)", () => {
    const P = (s: string, ctx: Partial<ParseContext> = {}) => parseUtterance(s, { ...CTX, ...ctx });
    expect(P("bảo hiểm tàu hết hạn chưa").intent).not.toBe("bao");
    expect(P("bảo hiểm tàu hết hạn chưa").intent).toBe("giay_to");
    expect(P("giá cá bao nhiêu").intent).not.toBe("bao");
    expect(P("mua dầu").intent).not.toBe("gia_dau");
    expect(P("giá dầu").intent).not.toBe("tim_mon");
    expect(P("giá dầu").intent).toBe("gia_dau");
    expect(P("mua một cây đá").slots).toMatchObject({ q: "da", qty: 1, unit: "cay" });
    expect(P("mốt có mưa không").slots.day).toBe(2);
    expect(P("mai đi được không").slots.aspect).toBe("di_duoc");
    expect(P("có bão không").intent).toBe("bao");
    expect(P("mua 2 thùng nhớt")).toMatchObject({ intent: "tim_mon", slots: { qty: 2 } });
    expect(P("bỏ 2 thùng nhớt vô giỏ")).toMatchObject({ intent: "them_gio", slots: { qty: 2 } });
    // hành động có hậu quả — KHÔNG có mã (13 P8, AC-T45)
    for (const s of ["huỷ đơn SD260906ABCD", "đặt hàng luôn", "xoá giấy đăng kiểm", "đăng xuất"]) {
      const p = P(s);
      expect(p.intent, s).toBe("khong_hieu");
      expect(p.followUp, s).toBeTruthy();
    }
    // >40 chữ → qua_dai
    const dai = Array.from({ length: 45 }, (_, i) => `chữ${i}`).join(" ");
    expect(P(dai)).toMatchObject({ intent: "khong_hieu", reason: "qua_dai" });
    expect(P("")).toMatchObject({ intent: "khong_hieu", confidence: 0, reason: "rong" });
    // ừ / thôi theo ngữ cảnh chờ xác nhận
    expect(P("ừ", { awaitingConfirm: true }).intent).toBe("xac_nhan");
    expect(P("ừ").intent).toBe("khong_hieu");
    expect(P("thôi", { awaitingConfirm: true }).intent).toBe("tu_choi");
    expect(P("thôi").intent).toBe("huy");
    // nhiều ý một câu
    expect(P("coi thời tiết rồi gọi SDVICO")).toMatchObject({ intent: "thoi_tiet", followUp: "goi_sdvico" });
    // ngoại phạm vi không bao giờ đi online
    expect(NEVER_ONLINE).toContain("ngoai_pham_vi");
    expect(P("uống thuốc gì cho hết say sóng").confidence).toBe(1);
  });

  /*  AC-T06 vế 1 — NĂM NHÓM BỊ CHẶN (13 §6, `intents.BLOCKLIST`). Ca này đi kèm
      ca đối chứng ngay dưới: câu chỉ CHỨA CHỮ giống nhóm cấm nhưng là việc đi
      biển bình thường thì KHÔNG được chặn. Không có vế đối chứng thì một bộ dò
      "chặn tất" cũng xanh, mà chặn oan là bà con mất việc thật.  */
  it("AC-T06: năm nhóm câu bị chặn đều ra ngoai_pham_vi, và không chặn oan câu nghề", () => {
    const P = (s: string) => parseUtterance(s, CTX);
    const chan: [string, string][] = [
      ["uống thuốc gì cho hết say sóng", "y tế"],
      ["bác sĩ nói sao về bệnh này", "y tế"],
      ["phạt bao nhiêu nếu không có nhật ký", "pháp lý"],
      ["vay tiền ngân hàng lãi suất mấy phần", "tiền"],
      ["tra căn cước số 012345678901", "tra người"],
      ["số điện thoại của anh Tâm ở đâu", "tra người"],
      ["chuyện chính trị dạo này sao", "khác"],
    ];
    for (const [say, nhom] of chan) {
      expect(P(say).intent, `${nhom}: "${say}" phải bị chặn`).toBe("ngoai_pham_vi");
    }
    // ĐỐI CHỨNG — cùng ngách chữ nghĩa nhưng là việc đi biển, KHÔNG được chặn
    const hien = [
      "bảo hiểm tàu hết hạn chưa",
      "giá dầu hôm nay bao nhiêu",
      "gọi shop hỏi cái nhớt",
      "giấy tờ nào sắp hết hạn",
    ];
    for (const say of hien) {
      expect(P(say).intent, `KHÔNG được chặn oan: "${say}"`).not.toBe("ngoai_pham_vi");
    }
  });
  it("không bao giờ ném với đầu vào lạ", () => {
    for (const bad of [null, undefined, 123, {}, " ", "😀😀😀", "a".repeat(5000)]) {
      const p = parseUtterance(bad as unknown as string, CTX);
      expect(INTENTS).toContain(p.intent);
      expect(p.confidence).toBeGreaterThanOrEqual(0);
    }
  });

  it("ngữ cảnh màn chỉ PHÁ HOÀ, không nâng conf qua ngưỡng 0.6", () => {
    const a = parseUtterance("hàng", { ...CTX, route: "/cho" });
    expect(a.confidence).toBeLessThan(CONFIDENCE_OFFLINE);
  });
});
