// BẢNG KHOÁ CẤU HÌNH — nhãn, chữ trợ giúp, hậu quả, env (tách khỏi app-config-keys.ts 2026-11-08, khong-lo-nguon
// nợ #10). CHỈ máy chủ import (app-config.ts, route admin, test): chữ trợ giúp có đường dẫn máy GPU, tên hệ thống
// tích hợp — không được vào chunk /quan-tri. Trang quản trị nhận qua `GET /api/admin/app-config`.
import type { ConfigKey, ConfigKeyMeta } from "@/lib/app-config-keys";

export const CONFIG_KEYS: ConfigKeyMeta[] = [
  {
    key: "vapid_public_key",
    label: "VAPID Public Key",
    risk: "Sai khoá công khai là MỌI máy đã bật thông báo ngừng nhận tin bão/tin mới, và phải bật lại từng máy.",
    secret: false,
    envVar: "VAPID_PUBLIC_KEY",
    help: "Khoá công khai Web Push (tạo bằng: npx web-push generate-vapid-keys).",
  },
  {
    key: "vapid_private_key",
    label: "VAPID Private Key",
    risk: "Sai khoá bí mật là server không gửi được thông báo nào nữa, không báo lỗi rõ.",
    secret: true,
    envVar: "VAPID_PRIVATE_KEY",
    help: "Khoá bí mật Web Push — không hiện lại sau khi lưu.",
  },
  {
    key: "vapid_subject",
    label: "VAPID Subject",
    risk: "Sai subject là dịch vụ đẩy của Apple/Google từ chối mọi thông báo.",
    secret: false,
    envVar: "VAPID_SUBJECT",
    help: "mailto:ban@domain.com hoặc URL https liên hệ.",
  },
  {
    key: "cron_secret",
    label: "CRON Secret",
    risk: "Không trùng GitHub là mọi cron (bão, thời tiết, cá, giá) ngừng chạy — dữ liệu cũ dần mà không ai biết.",
    secret: true,
    envVar: "CRON_SECRET",
    help: "Khoá xác thực cron (GitHub Actions gửi Bearer này). Đặt Ở ĐÂY (DB dùng chung) thì mọi deploy khớp — khỏi set env CRON_SECRET trên từng Vercel. Phải TRÙNG giá trị secret CRON_SECRET bên GitHub.",
  },
  /*  KHOÁ DỮ LIỆU BẢN ĐỒ (2026-09-17): mã 15 file biên tập lúc build (scripts/
      encode-data.mjs đọc DB qua service-role) và phát cho tài khoản đã đăng nhập
      (/api/data-key). Lần build đầu chưa có thì build TỰ SINH và ghi vào đây —
      admin không phải làm gì. Đổi khoá: bấm "Tạo ngẫu nhiên" → Lưu; route
      /api/admin/app-config tự chuyển khoá cũ sang "trước đó" để máy đang dùng
      file cũ vẫn đọc được; file MỚI chỉ dùng khoá mới sau lần deploy kế. */
  {
    key: "data_key_current",
    label: "Khoá dữ liệu bản đồ (hiện hành)",
    risk: "Sai khoá là sau lần deploy kế, 15 file dữ liệu bản đồ mã bằng khoá này không máy nào giải được.",
    secret: true,
    envVar: "SDFISH_DATA_KEY",
    generate: "hex32",
    help: "Mã 15 file dữ liệu biên tập (độ sâu, báo hiệu, luồng, chất đáy, mùa vụ cá…). Build đầu tự sinh. Đổi: bấm Tạo ngẫu nhiên → Lưu, khoá cũ tự chuyển xuống ô dưới; deploy lại để file mới dùng khoá mới.",
  },
  {
    key: "data_key_prev",
    label: "Khoá dữ liệu bản đồ (trước đó)",
    risk: "Đè sai là máy đã tải file bằng khoá cũ mất lớp độ sâu/báo hiệu cho tới khi tải lại.",
    secret: true,
    envVar: "SDFISH_DATA_KEY_PREV",
    help: "Tự chuyển từ khoá hiện hành khi đổi khoá — máy đã tải file bằng khoá cũ vẫn đọc được. Xoá bằng cách dán một khoá mới đè lên.",
  },
  /*  KHOÁ GÓI (2026-10-27, anh Long: "tất cả tải lưu server đi"): mã riêng các file chỉ premium đọc (lib/data-premium-
      files.mjs — rạn/chất đáy Allen, độ sâu rạn, mùa vụ cá); /api/data-key chỉ trao cho tài khoản premium. Ngẫu nhiên,
      KHÔNG suy từ khoá chủ (tài khoản thường giữ khoá chủ trong máy). Build đầu tự sinh. */
  {
    key: "data_key_premium",
    label: "Khoá dữ liệu gói (premium)",
    risk: "Đổi là sau lần deploy kế, máy premium phải có sóng xin lại khoá mới đọc được lớp rạn/chất đáy/mùa vụ cá.",
    secret: true,
    envVar: "SDFISH_DATA_KEY_PREMIUM",
    generate: "hex32",
    help: "Mã các file chỉ gói đọc (hình rạn + chất đáy Allen, độ sâu rạn xa bờ, mùa vụ cá). Build đầu tự sinh. Chỉ tài khoản premium nhận khoá này.",
  },
  /*  KHOÁ NHẬP TIN KAIROS (14 §9, AC17/AC21/AC24, 2026-10-23): máy GPU nhà gửi bài báo đã
      tóm tắt lên /api/kairos/nhap và quyết định kiểm duyệt lên /api/kairos/kiem, kèm khoá
      này ở header `x-kairos-key`. Env KAIROS_INGEST_KEY đặt thì ĐÈ ô này (lib/kairos/
      ingest-key.ts). Thiếu cả hai ⇒ hai route trả 503, không bao giờ mở cửa. */
  {
    key: "kairos_ingest_key",
    label: "Khoá nhập tin Kairos",
    risk: "Đổi khoá mà chưa đổi trên máy thu tin ở nhà là Kairos ngừng nhận tin báo mới và agent kiểm duyệt ngừng chạy.",
    secret: true,
    envVar: "KAIROS_INGEST_KEY",
    envFirst: true,
    generate: "hex32",
    help: "Máy thu tin trên máy GPU gửi kèm khoá này. Bấm Tạo ngẫu nhiên → Lưu, rồi dán CÙNG giá trị vào tệp env của máy GPU (KAIROS_INGEST_KEY).",
  },
  /*  KHOÁ MÁY THU TÀU AIS (2026-10-26): máy GPU nhà đọc web nguồn AIS rồi gửi bản vị trí tàu quanh
      biển VN lên POST /api/tau-ais/nhap kèm header `x-tau-ais-key`. Cùng luật env-thắng như Kairos
      (env TAU_AIS_KEY đè); thiếu cả hai ⇒ route 503. */
  {
    key: "tau_ais_key",
    label: "Khoá máy thu tàu AIS",
    risk: "Đổi khoá mà chưa đổi trên máy thu ở nhà là lớp Tàu xung quanh ngừng cập nhật (bà con vẫn thấy bản cũ, có giờ).",
    secret: true,
    envVar: "TAU_AIS_KEY",
    envFirst: true,
    generate: "hex32",
    help: "Máy thu AIS trên máy GPU gửi kèm khoá này. Tạo ngẫu nhiên → Lưu, rồi dán CÙNG giá trị vào ~/.config/forlife/tau-ais.env (TAU_AIS_KEY).",
  },
  /*  KHOÁ MÁY ĐỒNG BỘ S-TRACKING (2026-11-05): máy GPU đọc stracking.viettel.io 4 lần/ngày rồi gửi hạn cước + cảnh
      báo tàu lên POST /api/stracking/nhap kèm header `x-stracking-key`. Cùng luật env-thắng như AIS. */
  {
    key: "stracking_key",
    label: "Khoá máy thu S-Tracking",
    risk: "Đổi khoá mà chưa đổi trên máy GPU là hạn cước giám sát hành trình ngừng cập nhật (bà con vẫn thấy bản cũ, có giờ).",
    secret: true,
    envVar: "STRACKING_KEY",
    envFirst: true,
    generate: "hex32",
    help: "Máy GPU đồng bộ S-Tracking gửi kèm khoá này. Tạo ngẫu nhiên → Lưu, rồi dán CÙNG giá trị vào ~/.config/forlife/stracking.env (STRACKING_KEY).",
  },
  /*  GIA HẠN GIÁM SÁT HÀNH TRÌNH (2026-11-05, anh Long: "SDFISH_RENEWAL_SECRET đặt ở đâu? đưa vào quản trị đi"):
      máy chủ SDFish gọi edge fn `sdfish-renewal` của DB chung crm/hub (tạo đơn + QR, tra đơn, tự đóng khi hạn
      S-Tracking đổi) kèm header `x-sdfish-secret`. Ô này thắng env; trống cả hai ⇒ gia hạn trong app TẮT (bà con
      thấy "gọi SDVICO"). Contract: docs/contracts/stracking-renewal.contract.md. */
  {
    key: "sdfish_renewal_secret",
    label: "Khoá gia hạn giám sát hành trình",
    risk: "Không trùng khoá bên CRM là bà con không tạo được yêu cầu gia hạn, không xem được đơn, và hệ thống ngừng tự đóng đơn khi hạn đổi.",
    secret: true,
    envVar: "SDFISH_RENEWAL_SECRET",
    help: "Khoá chung với edge fn sdfish-renewal (DB chung crm/hub). Phải TRÙNG secret SDFISH_RENEWAL_SECRET đặt ở Supabase CRM (Edge Functions → Secrets). Đổi: đặt giá trị mới ở CRM trước, rồi dán vào đây.",
  },
  {
    key: "sdwork_crm_url",
    label: "Địa chỉ DB chung CRM (gia hạn)",
    risk: "Sai địa chỉ là mọi lệnh gia hạn gửi nhầm chỗ — bà con không tạo được yêu cầu, đơn không tự đóng.",
    secret: false,
    envVar: "SDWORK_SUPABASE_URL",
    help: "URL Supabase của DB chung crm/hub, dạng https://<ref>.supabase.co (không có / ở cuối). Hiện chỉ luồng gia hạn đọc ô này; các luồng SDWork khác vẫn đọc env SDWORK_SUPABASE_URL.",
  },
  /*  AI ĐƯỢC XEM AIS (2026-10-29, anh Long: "AIS là chỉ cho Long view thôi nhé, cũng 1 dạng option bật cho ai
      người đó view đc") — danh sách SĐT; chưa đặt ⇒ chỉ chủ dự án (lib/tau-ais/quyen.ts). Middleware chặn
      /api/tau-ais theo ô này, /api/tau-ais/quyen cho máy biết để hiện nút AIS. */
  {
    key: "tau_ais_xem",
    label: "Tài khoản xem AIS",
    risk: "Bỏ số nào ra là tài khoản đó mất chế độ AIS (nút AIS + lớp Tàu xung quanh) sau ít phút; gõ sai số là người đó không xem được.",
    secret: false,
    envVar: "TAU_AIS_XEM",
    help: "SĐT được xem chế độ AIS, cách nhau dấu phẩy (vd 0938635689, 0901234567). Chưa đặt = chỉ 0938635689.",
  },
  /*  KHOÁ LẤY PHIẾU KHÁCH SDVICO (14 §3.14, 0072, 2026-10-25): AI Assistant (máy nhà) lấy phiếu khách hỏi sản phẩm qua
      GET /api/sdvico/khach-hoi và báo đã nhắn nhóm Zalo KD qua POST …/da-bao, kèm khoá ở header `x-sdvico-key`. Thiếu
      khoá ⇒ hai route 503 (phiếu vẫn nhận, nằm chờ). */
  {
    key: "sdvico_lead_key",
    label: "Khoá lấy phiếu khách SDVICO",
    risk: "Đổi khoá mà chưa đổi bên AI Assistant là phiếu khách hỏi không còn được chuyển sang nhóm Zalo KD (phiếu vẫn lưu, nằm chờ).",
    secret: true,
    envVar: "SDVICO_LEAD_KEY",
    generate: "hex32",
    help: "AI Assistant gửi kèm khoá này (header x-sdvico-key) khi lấy phiếu khách để nhắn nhóm Zalo KD. Bấm Tạo ngẫu nhiên → Lưu, rồi dán CÙNG giá trị vào cấu hình AI Assistant.",
  },
  /*  KHOÁ ĐỐI TÁC TÍCH HỢP AIS (2026-11-02): đơn vị tích hợp gọi /api/doi-tac/v1/* kèm `Authorization: Bearer <token>`.
      Ô chỉ giữ BĂM "ten:sha256hex:khu:goi,…" (lib/doi-tac) — token rõ in một lần lúc cấp bằng scripts/doi-tac-khoa.mjs.
      Thiếu ⇒ API đối tác 503, không bao giờ mở. */
  {
    key: "doi_tac_ais",
    label: "Khoá đơn vị tích hợp AIS",
    risk: "Xoá một mục là đơn vị đó mất quyền lấy dữ liệu tàu sau tối đa 30 giây; dán sai khuôn là mọi đơn vị tích hợp bị chặn.",
    secret: true,
    envVar: "DOI_TAC_AIS",
    help: "Dạng ten:sha256hex:khu:goi (vd …:135:60 = khu 1,3,5 gói 60 phút), cách nhau dấu phẩy. Đừng gõ tay — cấp/thu bằng: node scripts/doi-tac-khoa.mjs cap <ten> --khu 135 --goi 60 | thu <ten> | ds.",
  },
  /*  KHOÁ MÃ TÀU ĐỐI TÁC (2026-11-13): `id` tàu trả cho đơn vị tích hợp = HMAC(khoá, tên đối tác + mã nội bộ) — KHÔNG lộ mã của
      nguồn thu, mỗi đối tác thấy một bộ mã riêng (dữ liệu lộ ra ngoài thì tra được của ai). Thiếu ⇒ API đối tác 503. */
  {
    key: "doi_tac_id_khoa",
    label: "Khoá mã tàu cho đơn vị tích hợp",
    risk: "Đổi khoá là MỌI mã tàu đối tác đang lưu đổi hết — họ mất nối dữ liệu cũ với mới. Chỉ đổi khi khoá bị lộ, và báo trước cho đối tác.",
    secret: true,
    envVar: "DOI_TAC_ID_KHOA",
    generate: "hex32",
    help: "Đặt một lần (Tạo ngẫu nhiên → Lưu, hoặc node scripts/doi-tac-khoa.mjs khoa-id). Đừng đổi khi không có lý do.",
  },
  /*  TRẦN KHO Ô BẢN ĐỒ (2026-11-04, lib/kho-o-ban-do): ngăn máy chủ tự tải vượt trần thì xoá ô cũ nhất. Chưa đặt = 2048 MB. */
  {
    key: "kho_o_tran_mb",
    label: "Trần kho ô bản đồ (MB)",
    risk: "Đặt quá nhỏ là máy chủ xoá ô liên tục và gọi nguồn ngoài nhiều hơn; quá lớn là đầy đĩa máy chủ.",
    secret: false,
    envVar: "SDFISH_KHO_O_MB",
    help: "Dung lượng tối đa cho ô bản đồ máy chủ tự tải (số MB, 100–100000). Chưa đặt = 2048. Xem số ô đang có ở thẻ Kho ô bản đồ.",
  },
];

export const CONFIG_META = new Map(CONFIG_KEYS.map((m) => [m.key, m]));

/** Khoá có hợp lệ không (chặn ghi khoá lạ từ API). */
export function isConfigKey(k: string): k is ConfigKey {
  return CONFIG_META.has(k as ConfigKey);
}
