// /api/me/heartbeat — máy tự báo "tôi vừa mở app, ở chế độ nào, đã đủ đồ đi
// biển chưa". Ghi 3 cột mốc trên `customers` (migration 0021).
//
// Vì sao có: /quan-tri cần biết ai ĐÃ CÀI mà CHƯA BAO GIỜ MỞ BẢN CÀI — nhóm sẽ
// ra khơi với máy trắng tay (kho bản cài trên iOS tách riêng với Safari). Chip
// "đã sử dụng" hiện tại là nhân viên tự tick, không phải số đo.
//
// THANG MỘT CHIỀU: web → bản cài → tải đủ. Chưa qua bản cài thì KHÔNG với tới
// bậc "đủ đồ", mọi nền (2026-08-01j) — xem countsAsOfflineReady.
//
// LUẬT: chỉ ghi MỐC + CHẾ ĐỘ. KHÔNG vị trí, KHÔNG thao tác. Không tạo hàng mới
// (chỉ update hàng đã có) — heartbeat không phải đường đăng ký.
//
// OFFLINE: đây là POST nên service worker BỎ QUA hẳn (không cache, không cứu).
// Client tự chặn khi mất sóng — xem src/lib/heartbeat.ts.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { countsAsOfflineReady, normalizePlatform } from "@/lib/app-usage";
import { isValidDeviceId } from "@/lib/device-id";
import { normalizeDataUntil, normalizeStorageMb } from "@/lib/app-usage";
import { needFromReason, serverNextInMs } from "@/lib/heartbeat-policy";

export async function POST(req: Request) {
  /*  DANH TÍNH THEO CHUỖI CỨNG (đổi 2026-08-02) — máy ngư dân không còn giữ
      phiên Supabase. `identityFromRequest` cũng nhận phiên cũ trong một nhịp
      phát hành, nên 15 máy đang chạy không bị hụt chân lúc deploy.

      ⚠️ NHỊP NÀY TUYỆT ĐỐI KHÔNG ĐƯỢC LÀM MÁY GỠ TÀI KHOẢN. Nó chạy nền 30 phút
      một lần; nếu nó trả 401 vì hạ tầng thì `authedFetch` sẽ hiểu là "bị đá" và
      xoá chuỗi của người đang ngoài biển — mà bà con không hề bấm gì. Nên mọi ca
      không-qua-cửa đều trả **HTTP 200** kèm `recorded:false`, đúng khuôn cũ của
      route này (client đọc `recorded`/`need`, không đọc status). */
  const who = await identityFromRequest(req);
  if (!who.ok) {
    const kicked = who.res.status === 401;
    return NextResponse.json({
      ok: true,
      recorded: false,
      reason: kicked ? "no_session" : "write_failed",
      attached: false,
      // chưa có chuỗi / chuỗi chết → đăng nhập lại mới gán được. Hạ tầng hỏng →
      // bám tiếp, gửi lại là có cửa.
      need: needFromReason(kicked ? "no_session" : "write_failed"),
      nextInMs: serverNextInMs(kicked ? "no_session" : "write_failed"),
    });
  }
  const phone = who.phone;

  const body = (await req.json().catch(() => null)) as {
    standalone?: boolean;
    offlineReady?: boolean;
    platform?: unknown;
    deviceId?: unknown;
    savedUntil?: unknown;
    storageQuotaMb?: unknown;
    storageUsedMb?: unknown;
    storageLsMb?: unknown;
    storageIdbMb?: unknown;
    storageCacheMb?: unknown;
    storageAvailableMb?: unknown;
    storagePersisted?: unknown;
    storagePersistAsked?: unknown;
    storageBackend?: unknown;
  } | null;

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const now = new Date().toISOString();
  const patch: Record<string, string> = body?.standalone
    ? { pwa_last_open_at: now }
    : { web_last_open_at: now };
  // "ĐỦ ĐỒ ĐI BIỂN" phải đo trên ĐÚNG CÁI KHO sẽ dùng ngoài biển ⇒ chỉ tính
  // khi nhịp gửi TỪ BẢN CÀI, mọi nền. Chưa cài thì đứng lại ở bậc web.
  if (
    countsAsOfflineReady({
      offlineReady: !!body?.offlineReady,
      standalone: !!body?.standalone,
    })
  ) {
    patch.offline_ready_at = now;
  }

  // KHÔNG đụng `updated_at`: cột đó là mốc dữ liệu KHÁCH đổi (hạng, tên…), để
  // heartbeat ghi vào là mọi tài khoản trông như vừa được sửa mỗi lần mở app.
  //
  // `.select("phone")` KHÔNG phải để lấy dữ liệu — để BIẾT CÓ GHI ĐƯỢC KHÔNG.
  // LỖI ĐÃ SỬA (2026-08-01g): `update().eq()` không khớp hàng nào thì Supabase
  // trả `error = null` y như khi ghi thành công ⇒ route cũ báo `recorded: true`
  // DÙ KHÔNG GHI GÌ. Ca có thật: SĐT suy từ email JWT không khớp
  // `customers.phone` (khách đăng nhập được nhưng chưa có hàng khách, hoặc SĐT
  // lưu khác dạng) — hỏng vĩnh viễn mà vẫn báo ổn, nên /quan-tri đứng mãi ở
  // "Chưa ghi nhận" và không ai biết vì sao.
  // LOẠI MÁY (0022) — thêm vào mẻ ghi NHƯNG PHẢI CÓ ĐƯỜNG LÙI: migration 0022
  // do chủ dự án tự apply, nên cột có thể CHƯA tồn tại trên prod. Nhét thẳng
  // vào patch mà cột chưa có là cả lệnh update HỎNG ⇒ mất luôn 3 mốc thời gian
  // vốn đang chạy tốt. Nên: thử kèm loại máy, hỏng thì ghi lại KHÔNG kèm.
  /*  NGÀY PHỦ DỮ LIỆU (0025) — chỉ nhận đúng dạng `YYYY-MM-DD` và đúng dải
      ngày dùng được. Client khai sai/rác thì BỎ QUA, không để một chuỗi lạ
      xuống thẳng cột `date` làm hỏng cả lệnh ghi (mất luôn 3 mốc đang chạy tốt
      — đúng khuôn lỗi 0022 đã dính). Đây là số liệu vận hành, khai sai chỉ hỏng
      thống kê của chính máy đó, không mở được quyền gì. */
  const savedUntil = normalizeDataUntil(body?.savedUntil);
  /*  KHO CỦA MÁY (0029) — số để quyết "dữ liệu đi biển nên nằm kho nào", và để
      gọi nhắc bà con dọn bớt ảnh/video TRƯỚC khi ra khơi. Ép qua
      `normalizeStorageMb`: một chuỗi lạ / số âm / Infinity xuống thẳng cột
      `integer` là CẢ LỆNH UPDATE HỎNG, mất luôn mấy mốc đang chạy tốt (đúng
      khuôn lỗi cột 0022 đã dính). */
  const khoQuota = normalizeStorageMb(body?.storageQuotaMb);
  const khoUsed = normalizeStorageMb(body?.storageUsedMb);
  /*  TÁCH THEO KHO (0030) — trả lời "ĐÃ LƯU Ở ĐÂU" chứ không chỉ "nặng bao
      nhiêu". Cùng luật ép kiểu như trên: một giá trị lạ xuống cột `integer` là
      CẢ LỆNH UPDATE HỎNG, mất luôn mấy mốc đang chạy tốt. */
  const khoLs = normalizeStorageMb(body?.storageLsMb);
  const khoIdb = normalizeStorageMb(body?.storageIdbMb);
  const khoCache = normalizeStorageMb(body?.storageCacheMb);
  const khoFree = normalizeStorageMb(body?.storageAvailableMb);
  const khoBen =
    typeof body?.storagePersisted === "boolean" ? body.storagePersisted : null;
  /*  ĐÃ HỎI CHƯA, HỎI RỒI THÌ ĐƯỢC GẬT KHÔNG (0031) — `null` = chưa hỏi lần nào.
      Đi cặp với `storage_persisted`: cột kia một mình gộp "bị trình duyệt từ
      chối" (giới hạn nền tảng, gọi điện vô ích) với "app chưa hỏi lại lần nào"
      (lỗi sửa được). Cùng luật ép kiểu: chỉ nhận boolean, thứ khác thành null. */
  const khoHoi =
    typeof body?.storagePersistAsked === "boolean"
      ? body.storagePersistAsked
      : null;
  /*  CHỈ NHẬN ĐÚNG HAI GIÁ TRỊ — cột này để nhân viên lọc "máy nào chưa dời được
      kho"; nhận chuỗi tự do là mở cửa cho rác làm hỏng bộ lọc. */
  const khoNoi =
    body?.storageBackend === "idb" || body?.storageBackend === "ls"
      ? body.storageBackend
      : null;
  const platform = normalizePlatform(body?.platform);
  const dev = isValidDeviceId(body?.deviceId) ? body.deviceId : null;
  /*  `.select` LẤY LUÔN HẠNG (2026-08-02g) — KHÔNG tốn thêm một lượt truy vấn
      nào: PostgREST trả về hàng vừa update, chỉ cần xin thêm cột.
      Từ bản này nhịp "đã mở app" là đường DUY NHẤT máy biết hạng của mình đã
      đổi (nhân viên gán premium ở /quan-tri sau khi bà con đã đăng nhập từ tuần
      trước). Nhịp tra hạng riêng đã xoá — nó chỉ đi hỏi lại đúng câu mà nhịp này
      đã hỏi, và còn chạy cả lúc mất sóng.
      ⚠️ `.select("phone")` vẫn phải giữ đúng vai trò cũ: BIẾT CÓ GHI ĐƯỢC KHÔNG
      (update không khớp hàng nào thì Supabase trả error=null y như ghi thành
      công). Thêm cột không đổi vai trò đó. */
  const write = (p: Record<string, string | boolean | null>) =>
    admin
      .from("customers")
      .update(p)
      .eq("phone", phone)
      .select("phone, tier, premium_until");

  // ĐỔI MÁY THÌ DỌN MỐC (0022). Ba cột mốc của 0021 nằm trên `customers` nên
  // chúng tích luỹ theo TÀI KHOẢN, không theo MÁY: đổi từ iPhone (đã mở bản
  // cài) sang Android (chỉ mở web) thì `pwa_last_open_at` cũ vẫn nằm đó ⇒
  // /quan-tri báo "Đã mở bản cài" cho cái máy CHƯA BAO GIỜ mở bản cài. Nhịp
  // đến từ mã máy KHÁC ⇒ xoá sạch rồi ghi lại theo máy mới.
  // `dev == null` (storage bị chặn) → KHÔNG reset: thà số liệu cũ còn hơn xoá
  // mốc mỗi lần mở app.
  /* `boolean` từ 0041 (`storage_persisted`) — trước chỉ có chuỗi/null */
  const extra: Record<string, string | boolean | null> = {};
  /*  ⚠️ `data_until` CHỈ NHẬN TỪ NHỊP CỦA BẢN CÀI (sửa 2026-08-02g — chủ dự án
      chỉ ra: *"user đã pass qua bước bản cài, đã có dữ liệu, nhưng sau đó toàn
      dùng bản web?"*).

      LỖI ĐÃ SỬA: bản trước ghi `data_until` từ MỌI nhịp. Trên iOS kho của bản
      Thêm-vào-Màn-hình-chính TÁCH RIÊNG với Safari, nên ca này có thật và im
      lặng: bà con tải đủ trong bản cài ngày 01/08 (`data_until = 17/08`), rồi
      mấy hôm sau mở app bằng Safari — nhịp web ghi đè `data_until` bằng con số
      của KHO SAFARI (thường là rỗng hoặc ít hơn hẳn). /quan-tri từ đó mô tả
      NHẦM KHO: nói về cái kho bà con sẽ KHÔNG mang ra biển.
      Chiều ngược lại cũng sai y vậy — kho web đầy hơn thì /quan-tri báo yên tâm
      trong khi bản cài (thứ thật sự ra khơi) đã cạn.

      Cùng đúng một luật với `countsAsOfflineReady`: **đo trên ĐÚNG CÁI KHO sẽ
      dùng ngoài biển**. Android tuy dùng chung kho nên web cũng đo đúng, nhưng
      giữ một luật cho mọi nền — đúng thang một chiều đã chốt 2026-08-01j, và
      GIỮ CẢ HAI CON SỐ, KHÔNG VỨT BỚT (chủ dự án chốt tiếp: *"dữ liệu tới ngày
      nào cũng cần rõ là dữ liệu đó trên bản cài hay bản web"*). Vứt số của kho
      web đi thì mất đúng thông tin cần để gọi điện cho nhóm "toàn dùng web":
      họ CÓ dữ liệu, chỉ là nằm nhầm kho.
        · `data_until`      = kho BẢN CÀI — kho sẽ ra khơi. Cột này giữ nguyên
                              tên (0025) nhưng từ nay chỉ nhịp bản cài mới ghi.
        · `data_until_web`  = kho WEB (migration 0038).
      Android dùng chung kho nên hai cột trùng nhau — vô hại. iOS thì chúng lệch
      nhau, và chính chỗ lệch đó là thứ /quan-tri cần bày ra. */
  if (savedUntil) {
    if (body?.standalone) extra.data_until = savedUntil;
    else extra.data_until_web = savedUntil;
  }
  if (khoQuota != null) extra.storage_quota_mb = String(khoQuota);
  if (khoUsed != null) extra.storage_used_mb = String(khoUsed);
  if (khoLs != null) extra.storage_ls_mb = String(khoLs);
  if (khoIdb != null) extra.storage_idb_mb = String(khoIdb);
  if (khoCache != null) extra.storage_cache_mb = String(khoCache);
  if (khoFree != null) extra.storage_available_mb = String(khoFree);
  if (khoBen != null) extra.storage_persisted = khoBen;
  if (khoHoi != null) extra.storage_persist_asked = khoHoi;
  if (khoNoi) extra.storage_backend = khoNoi;
  if (platform) extra.device_platform = platform;
  if (dev) {
    extra.device_id = dev;
    const { data: cur } = await admin
      .from("customers")
      .select("device_id")
      .eq("phone", phone)
      .maybeSingle();
    const prev = (cur as { device_id?: string | null } | null)?.device_id;
    if (prev && prev !== dev) {
      // máy mới: bắt đầu lại từ số không, rồi `patch` bên dưới ghi đè mốc của
      // chính nhịp này. `data_until` cũng phải dọn — dữ liệu tải trên máy CŨ
      // không nói được gì về cái máy đang cầm trong tay.
      extra.pwa_last_open_at = null;
      extra.web_last_open_at = null;
      extra.offline_ready_at = null;
      /*  ⚠️ ĐỔI MÁY CŨNG PHẢI TÁCH KHO (sửa 2026-08-03c — đánh giá cuối bắt).
          Bản trước ghi thẳng `extra.data_until = savedUntil` KHÔNG xét
          `standalone`, ngay dưới `pwa_last_open_at = null` — trong khi nhánh
          thường (vài chục dòng trên) thì tách đúng. Nên MỘT NHỊP WEB TỪ MÁY MỚI
          ghi số của kho WEB vào cột `data_until` (cột "bản cài") rồi để
          `pwa_last_open_at` null ⇒ /quan-tri in "bản cài: dữ liệu tới …" cho
          người CHƯA BAO GIỜ mở bản cài. Đó chính là mâu thuẫn chủ dự án bắt
          được trên màn hình thật — và tôi đã kết luận nhầm là "dữ liệu tồn từ
          trước 0027, mã hiện tại không đẻ được nữa". SAI: mã hiện tại VẪN đẻ
          được, qua đúng nhánh này.
          Hỏng theo chiều nguy hiểm: người trực thấy có ngày dữ liệu nên KHÔNG
          gọi, trong khi kho ra khơi của máy mới đang trống. Nay dọn CẢ HAI cột
          rồi ghi vào ĐÚNG cột theo `standalone`, cùng luật với nhánh thường. */
      extra.data_until = null;
      extra.data_until_web = null;
      if (savedUntil) {
        if (body?.standalone) extra.data_until = savedUntil;
        else extra.data_until_web = savedUntil;
      }
    }
  }

  let { data: hit, error } = await write({ ...extra, ...patch });
  // Cột 0022 có thể CHƯA tồn tại (chủ dự án tự apply) — nhét cột lạ vào là cả
  // lệnh hỏng ⇒ mất luôn 3 mốc vốn đang chạy tốt. Hỏng thì ghi lại bộ cũ.
  if (error && Object.keys(extra).length > 0) {
    ({ data: hit, error } = await write(patch));
  }
  // cột chưa có (0021 chưa apply) → nói thật cho client biết, nhưng KHÔNG lỗi
  if (error) {
    /*  NÓI RA CHO AI ĐÓ NGHE ĐƯỢC (2026-08-02e). Route này trước đây có ĐÚNG 0
        dòng `console`: mọi kiểu hỏng đều trả HTTP 200 kèm `recorded:false`, nên
        đường phát hiện duy nhất là chủ dự án tình cờ mở /quan-tri thấy số liệu
        đứng hình — đúng cách lỗi 500 gần một ngày lọt qua. Log ở đây là thứ
        biến "im lặng" thành "tra được trong Vercel logs".
        GIỮ HTTP 200: client đọc `recorded`/`need` chứ không đọc status, và đổi
        sang 5xx là đẩy chính client vào nhánh "máy chủ nổ" (bám 5 phút/lần). */
    console.error(
      "[heartbeat] ghi customers HỎNG:",
      (error as { code?: string }).code,
      error.message,
    );
    return NextResponse.json({
      ok: true,
      recorded: false,
      reason: "write_failed",
      attached: false,
      need: needFromReason("write_failed"), // "retry" — bám tiếp là có cửa
      nextInMs: serverNextInMs("write_failed"),
    });
  }
  // KHÔNG có hàng khách nào mang SĐT này — client sẽ thử lại (30 phút/lần)
  // thay vì im 12 tiếng. `reason` để gỡ lỗi, KHÔNG kèm SĐT (đừng vọng lại
  // định danh trong phản hồi).
  if (!hit || hit.length === 0) {
    return NextResponse.json({
      ok: true,
      recorded: false,
      reason: "no_customer_row",
      // nghe được, đọc được phiên, nhưng KHÔNG có hàng khách mang SĐT này —
      // máy sửa không được, đừng để nó bám đuổi vô ích
      attached: false,
      need: needFromReason("no_customer_row"),
      nextInMs: serverNextInMs("no_customer_row"),
    });
  }

  // LỊCH SỬ MÁY (bảng customer_devices, 0033) — mỗi (khách × máy) một hàng, để
  // biết một tài khoản đã đi qua những máy nào. Ghi SAU khi mốc chính đã xong
  // và nuốt mọi lỗi: bảng có thể chưa tồn tại, và đây là sổ phụ — hỏng nó
  // KHÔNG được làm hỏng nhịp (client sẽ tưởng chưa ghi được rồi thử lại mãi).
  if (dev) {
    try {
      /*  ⚠️ ĐƯỜNG LÙI BỎ CỘT LẠ (vòng soát 5 bắt, mức NẶNG). Bảng `customers` có
          sẵn khuôn "hỏng thì ghi lại bộ cũ" (xem `write(patch)` phía trên),
          nhưng hàng theo-MÁY thì KHÔNG — nó nhét thẳng 6 cột của 0030 vào một
          lệnh. Migration 0030 do chủ dự án tự apply, nên nếu commit này lên
          TRƯỚC lúc apply thì cột chưa tồn tại ⇒ **cả hàng theo-máy hỏng**, mất
          luôn `last_seen_at` · `data_until` · `data_until_web` · `platform` ·
          `storage_*_mb` (0029) vốn đang chạy tốt — im lặng, HTTP vẫn 200.
          Nay thử bộ ĐẦY ĐỦ trước, hỏng thì ghi lại bộ CŨ.
          2026-08-03: cột `storage_persist_asked` (0042) đi CHUNG bộ này — cùng
          một lý do, và 0031 cũng do chủ dự án tự apply. */
      const khoMoi0030 = {
        ...(khoLs != null ? { storage_ls_mb: khoLs } : {}),
        ...(khoIdb != null ? { storage_idb_mb: khoIdb } : {}),
        ...(khoCache != null ? { storage_cache_mb: khoCache } : {}),
        ...(khoFree != null ? { storage_available_mb: khoFree } : {}),
        ...(khoBen != null ? { storage_persisted: khoBen } : {}),
        ...(khoHoi != null ? { storage_persist_asked: khoHoi } : {}),
        ...(khoNoi ? { storage_backend: khoNoi } : {}),
      };
      const hangMay = {
          customer_phone: phone,
          device_id: dev,
          ...(platform ? { platform } : {}),
          last_seen_at: now,
          /*  NGÀY PHỦ DỮ LIỆU CỦA CHÍNH MÁY NÀY (0025) — trước đây cột này chỉ
              được HỨA trong migration ("đổi điện thoại vẫn tra được máy cũ tải
              tới đâu") mà KHÔNG ai ghi, nên nó null vĩnh viễn.
              Chỉ lấy `data_until`, KHÔNG spread cả `extra`: `extra` có thể đang
              mang `pwa/web/offline = null` của nhánh ĐỔI MÁY — mấy giá trị đó
              nói về hàng theo TÀI KHOẢN, vô nghĩa (và sai) với hàng theo MÁY. */
          /*  ĐÚNG KHO NÀO thì ghi cột đó (0027) — sổ theo máy cũng phải tách,
              không thì đổi điện thoại xong tra lại vẫn ra con số lẫn hai kho. */
          ...(khoQuota != null ? { storage_quota_mb: khoQuota } : {}),
          ...(khoUsed != null ? { storage_used_mb: khoUsed } : {}),
          /*  SÁU CỘT TÁCH KHO CỦA 0030 — ghi CẢ Ở ĐÂY, không chỉ ở `customers`.
              Thiếu vế này là lặp lại đúng lỗi vừa nêu ngay phía trên: migration
              HỨA "đổi điện thoại vẫn tra được máy cũ" rồi để cột null vĩnh viễn.
              Mà so iOS với Android — lý do chính khiến bảng theo-máy tồn tại —
              thì phải có đúng mấy cột này mới so được. */
          ...(savedUntil
            ? body?.standalone
              ? { data_until: savedUntil }
              : { data_until_web: savedUntil }
            : {}),
          ...patch,
      };
      const ghiMay = (them: Record<string, unknown>) =>
        admin.from("customer_devices").upsert(
          { ...hangMay, ...them },
          { onConflict: "customer_phone,device_id" },
        );
      let { error: devErr } = await ghiMay(khoMoi0030);
      if (devErr && Object.keys(khoMoi0030).length > 0) {
        /*  ĐỪNG NUỐT IM (vòng soát 6): lượt lùi thành công thì `devErr` về null
            và không còn dòng log nào — tức "0030 chưa apply" trở thành IM LẶNG
            TUYỆT ĐỐI, đúng khuôn `logActivity nuốt lỗi` mà route này vừa được
            vá để thoát. Log nguyên nhân THẬT của lượt đầu, vì thông điệp của
            lượt sau (nếu có) sẽ che mất nó. */
        console.error("[heartbeat] customer_devices lùi bỏ cột 0041:", devErr.message);
        ({ error: devErr } = await ghiMay({}));
      }
      /*  supabase-js KHÔNG NÉM với lỗi Postgres/RLS — nó trả `{ error }`. Vứt
          giá trị trả về đi (như bản cũ) nghĩa là bảng chưa tồn tại / cột lạ /
          RLS chặn đều IM LẶNG TUYỆT ĐỐI. Đúng khuôn `logActivity nuốt lỗi` đã
          biết. Vẫn KHÔNG làm hỏng nhịp — sổ phụ hỏng thì nhịp chính vẫn ổn. */
      if (devErr) {
        console.error(
          "[heartbeat] ghi customer_devices HỎNG:",
          devErr.code,
          devErr.message,
        );
      }
    } catch (e) {
      /* sổ phụ — hỏng thì thôi, nhưng phải để lại dấu vết tra được */
      console.error("[heartbeat] customer_devices NÉM:", e);
    }
  }
  /*  `nextInMs` = MÁY CHỦ XẾP LỊCH cho lượt sau (2026-08-02c). Đây là chiều
      ngược DUY NHẤT của kênh này: một con số điều tiết, KHÔNG phải kênh lệnh —
      app đi biển không được nhận lệnh từ xa để tải/xoá/đổi bất cứ thứ gì. Máy
      còn kẹp lại trong [30 giây, 6 giờ] (`SERVER_GAP_MIN_MS`/`SERVER_GAP_MAX_MS`)
      trước khi nghe theo — sàn 30 giây đúng bằng nấc đầu thang sự kiện: máy chủ
      được phép giục nhanh BẰNG, không được nhanh HƠN. */
  /*  HẠNG ĐI NHỜ NHỊP NÀY (2026-08-02g) — thay hẳn nhịp tra hạng riêng.
      Đây KHÔNG phải "kênh lệnh" (luật ở đoạn trên vẫn nguyên): máy chủ không sai
      máy làm gì cả, nó chỉ trả lời một dữ kiện về tài khoản — y như `nextInMs`
      là một dữ kiện về nhịp. Máy tự quyết mở hay khoá tính năng.
      Đọc từ hàng vừa update nên KHÔNG tốn thêm truy vấn. `resolveTier` dùng
      chung với middleware và /quan-tri để ba chỗ không nói ba kiểu. */
  const row = hit[0] as { tier?: string | null; premium_until?: string | null };
  return NextResponse.json({
    ok: true,
    recorded: true,
    // ĐÃ NHẬN **VÀ ĐÃ GÁN** — máy nhớ chữ ký này rồi thôi, không gửi lại nữa
    attached: true,
    need: needFromReason(null),
    nextInMs: serverNextInMs(null),
    /*  ⚠️ TRẢ CỘT `tier` THÔ, KHÔNG resolveTier (luật E4, 2026-08-02).
        Dấu hạng trong máy phải ghi theo cột THÔ + hạn lưu RIÊNG, rồi mới xét hạn
        lúc ĐỌC với biên 7 ngày. Trả bản đã resolve thì máy lưu thẳng "basic" cho
        một tài khoản mới quá hạn vài giờ, và biên chống-lệch-đồng-hồ-máy biến
        mất — máy hết pin sạch rồi nhảy ngày là bà con mất quyền đã trả tiền, mà
        gọi tổng đài cũng không ai giải thích được. */
    tier: row?.tier ?? null,
    premiumUntil: row?.premium_until ?? null,
  });
}
