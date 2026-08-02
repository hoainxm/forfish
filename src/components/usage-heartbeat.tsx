"use client";

/**
 * Máy tự báo "vừa mở app" — KHÔNG vẽ gì ra màn hình.
 *
 * ══ MẤT SÓNG: KHÔNG CÓ NHỊP NÀO ══
 *  Không request, không hẹn giờ, không đụng kho offline. Bất biến số một —
 *  heartbeat là tính năng cho NGƯỜI QUẢN TRỊ, không được tranh sóng với tin bão.
 *
 * ══ CÓ SÓNG: HAI LOẠI NHỊP (chủ dự án chốt 2026-08-02d) ══
 *  ① SỰ KIỆN — một điểm theo dõi vừa đổi (đổi tài khoản · web→bản cài · vừa đủ
 *    đồ đi biển · ĐỔI MÁY): gửi NGAY, và **bám 30 giây → 3 phút → 5 phút cho
 *    tới khi máy chủ xác nhận GÁN ĐƯỢC**. Tin này không được mất.
 *  ② ĐỊNH KỲ — 30 phút một lần, báo trạng thái hiện giờ. Lỡ lượt thì lượt sau
 *    bù, KHÔNG bám đuổi.
 *  Cộng ba cú gửi ngay: mở app · quay lại app (`visibilitychange`) · vừa có
 *  sóng lại (`online`) — CẢ BA đều qua độ trễ 3 giây `BEAT_DEFER_MS` để không
 *  tranh chỗ với việc dựng bản đồ, và qua CỔNG RẺ `heartbeatNeedsScan` để không
 *  quét kho offline khi chắc chắn không gửi (xem chú thích trong `beat`).
 *
 * VÌ SAO PHẢI CÓ HẸN GIỜ (lỗi cũ): nhịp chỉ gửi lúc component mount, mà **bản
 * cài PWA mở lại từ nền KHÔNG remount React** — một máy dùng cả ngày vẫn chỉ có
 * đúng một nhịp lúc cold-start. Ghép với cửa 12 giờ cũ thì /quan-tri gần như
 * đứng hình, nhân viên nhìn vào tưởng khách bỏ app.
 *
 * Luật + hợp đồng với máy chủ: `lib/heartbeat-policy.ts`. Chỗ này chỉ nối dây.
 *
 * Chỉ gửi khi ĐÃ ĐĂNG NHẬP (chưa đăng nhập thì không quy về ai được). Mọi hàng
 * rào còn lại nằm ở lib/heartbeat.ts. Không await gì ở đường vẽ màn, không
 * state, không render.
 */

import { useEffect } from "react";
import { useAuthUser } from "@/lib/use-auth";
import {
  coreSavedUntil,
  fishLockedFromMark,
  heartbeatNeedsScan,
  nextHeartbeatDelayNow,
  sendHeartbeat,
} from "@/lib/heartbeat";
import { devicePlatform, isStandalone } from "@/lib/storage-persist";
import { deviceId } from "@/lib/device-id";
import { isShellReady } from "@/lib/shell-ready";
import { savedCoverage } from "@/lib/pretrip";
import { savedGridUntil } from "@/lib/forecast-grid";
import { syncPushAccount } from "@/lib/push-client";

/** Đợi màn hình vẽ xong rồi hẵng nhịp — dùng cho CẢ BA đường vào (mở app · quay
 *  lại app · vừa có sóng), không riêng lúc mount. */
const BEAT_DEFER_MS = 3000;

/** SÀN hẹn giờ. Chống vòng quay CPU trong ca kho bị xoá lệch nhau (mốc "đã ghi
 *  được" mất mà chữ ký còn) khiến mốc hẹn tính ra 0 liên tục. 30 giây đúng bằng
 *  nấc đầu thang sự kiện nên không làm chậm tin nào. */
const MIN_RESCHEDULE_MS = 30_000;

export function UsageHeartbeat() {
  const { user, ready } = useAuthUser();

  /* GẮN MÁY ↔ TÀI KHOẢN — effect RIÊNG, chạy NGAY khi biết tài khoản.
     Lỗi đã sửa (2026-08-01p, chủ dự án thử trên máy thật: bật thông báo, đăng
     nhập, đổi tài khoản mà /quan-tri vẫn "chưa gán account nào"): trước đây nó
     nằm SAU chuỗi `setTimeout 3 giây → await isShellReady()` của nhịp
     heartbeat, nên đóng app sớm / kiểm vỏ chậm là không kịp chạy — mà việc gắn
     thì phải chắc chắn, nó là gốc của cả tính năng thông báo.
     Deps có `user` nên ĐỔI TÀI KHOẢN là gắn lại ngay. */
  useEffect(() => {
    if (!ready || !user) return;
    void syncPushAccount();
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !user) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    /*  ĐANG CHẠY DỞ — chống chạy chồng (2026-08-02e). Hai `visibilitychange`
        sát nhau (chuyển app qua lại) trước đây cho HAI lượt quét kho song song,
        mỗi lượt vài chục MB `JSON.parse` trên luồng chính. */
    let inFlight = false;

    const isOffline = () =>
      typeof navigator !== "undefined" && navigator.onLine === false;

    const clear = () => {
      if (timer != null) clearTimeout(timer);
      timer = null;
    };

    /** Hẹn một lượt sau `ms` — một đường duy nhất, không bao giờ hẹn khi mất
     *  sóng (bất biến: mất sóng = không hẹn giờ nào). */
    const scheduleIn = (ms: number) => {
      clear();
      if (!alive || isOffline()) return;
      timer = setTimeout(() => void beat(), Math.max(0, ms));
    };
    /** Hẹn LƯỢT KẾ của vòng nhịp — có SÀN. Chỉ dùng cho đường vòng lặp; đường
     *  sự kiện (quay lại app / có sóng lại) dùng thẳng `scheduleIn`. */
    const scheduleNext = (ms: number) => scheduleIn(Math.max(ms, MIN_RESCHEDULE_MS));

    // Gửi một nhịp rồi tự hẹn lượt kế. Mọi hàng rào (mất sóng · cửa 30 phút ·
    // mức hoãn · chữ ký) nằm trong sendHeartbeat — gọi sớm quá thì nó tự trả
    // false mà KHÔNG gửi gì, nên hẹn giờ ở đây luôn an toàn.
    const beat = async () => {
      if (!alive || isOffline() || inFlight) return;
      inFlight = true;
      try {
        const account = user.email ?? null;
        const standalone = isStandalone();
        const dev = deviceId();
        /*  CỔNG RẺ TRƯỚC, QUÉT KHO SAU (2026-08-02e). `isShellReady()` (34 lượt
            `caches.match`) + `savedCoverage()` (11 lượt `loadAll` + 9 lượt
            `bytesUnder`, trong đó `bytesUnder("")` dựng lại toàn bộ ~5 MB chuỗi)
            đều nằm ở đây, TRƯỚC khi biết có gửi hay không — mà gần như luôn là
            KHÔNG (chưa tới hạn 30 phút). Nay hỏi bằng ba mảnh RẺ của chữ ký
            trước; đắt thì mới trả. Xem chú thích `heartbeatNeedsScan`. */
        if (!heartbeatNeedsScan({ account, standalone, deviceId: dev })) {
          scheduleNext(nextHeartbeatDelayNow());
          return;
        }
        const shellOk = await isShellReady();
        if (!alive) return;
        // "đủ đồ" = vỏ app cài đủ VÀ mọi lớp dữ liệu đã tải. Máy chủ còn lọc
        // thêm: CHƯA MỞ BẢN CÀI thì không tính, mọi nền — thang một chiều
        // web → bản cài → tải (countsAsOfflineReady, lib/app-usage.ts).
        // `fishLocked` đọc từ DẤU premium đã lưu (không gọi mạng) — thiếu nó
        // thì khách hạng thường vĩnh viễn "chưa đủ đồ"; mà coi "chưa tra được
        // hạng" là khoá thì khách premium lại được báo THỪA. Luật + lý do ở
        // `fishLockedFromMark` (lib/heartbeat.ts, có test).
        const cov = savedCoverage({ fishLocked: fishLockedFromMark() });
        const r = await sendHeartbeat({
          // TÀI KHOẢN — chỉ dùng cho chữ ký PHÍA MÁY, `sendHeartbeat` cố ý
          // không gửi trường này lên máy chủ (server đọc từ phiên).
          account,
          standalone,
          offlineReady: shellOk && cov.allSaved,
          // loại máy THÔ (ios|android|khac) — để nhân viên gọi điện chỉ đúng
          // bước cài. KHÔNG gửi user-agent đầy đủ (dấu vân tay).
          platform: devicePlatform(),
          // mã máy — để máy chủ biết bà con vừa đổi điện thoại và dọn mốc cũ
          deviceId: dev,
          /*  DỮ LIỆU TRONG MÁY PHỦ TỚI NGÀY NÀO — phải là ngày SỚM NHẤT giữa
              LƯỚI CẢ VÙNG và ĐIỂM GHIM, không phải riêng điểm ghim (xem
              `coreSavedUntil`: `cov.untilIso` chỉ đo lớp `point`, mà lớp đó lại
              là bậc hy sinh đầu tiên khi máy hết chỗ).
              GIÁ PHẢI TRẢ (nói lại cho đúng, 2026-08-02f — câu cũ khai "ĐÚNG MỘT
              lượt đọc kho lưới" là sai): `savedGridUntil()` gọi `loadAll`, mà
              `loadAll` parse MỖI BẢN LƯỚI HAI LẦN (`entriesUnder` đọc `savedAt`
              rồi `loadForecast` parse lại cả bản) ⇒ cỡ ~7 MB `JSON.parse` trên
              luồng chính. Vẫn chấp nhận được vì nó CHỈ chạy ở lượt THẬT SỰ GỬI,
              tức nhiều nhất 30 phút một lần — nhưng đừng ai tưởng nó rẻ. */
          savedUntil: coreSavedUntil(savedGridUntil(), cov.untilIso),
        });
        if (!alive) return;
        /*  MỘT ĐƯỜNG HẸN GIỜ DUY NHẤT (2026-08-02d). `sendHeartbeat` mới là chỗ
            biết nhịp vừa rồi là SỰ KIỆN hay ĐỊNH KỲ, máy chủ có gán được không,
            và máy chủ dặn chờ bao lâu — nên nó trả luôn `nextInMs`. Ở đây không
            được tự đoán lại: đoán sai là hoặc bám quá gắt, hoặc bỏ rơi một tin
            mới (đổi tài khoản / đổi máy) suốt cả phiên. */
        scheduleNext(r.nextInMs);
      } catch {
        /* không bao giờ làm phiền app */
      } finally {
        inFlight = false;
      }
    };

    /*  QUAY LẠI APP / VỪA CÓ SÓNG LẠI → thử ngay, không chờ hết nhịp. Đây là
        hai mốc mà /quan-tri cần nhất: bà con vừa mở lại app, và máy vừa ra khỏi
        vùng mất sóng. `sendHeartbeat` tự chặn nếu chưa tới hạn.

        CẢ HAI ĐI QUA `scheduleIn` chứ KHÔNG gọi `beat()` thẳng (sửa 2026-08-02e):
        gọi thẳng là bỏ qua đúng độ trễ 3 giây mà chính file này đặt ra ở dưới —
        và bản cài PWA không remount, nên `visibilitychange` mới là đường vào
        PHỔ BIẾN NHẤT, tức đường vào hay tranh chỗ với việc dựng bản đồ nhất. */
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleIn(BEAT_DEFER_MS);
    };
    const onOnline = () => scheduleIn(BEAT_DEFER_MS);
    /*  MẤT SÓNG: dừng hẳn hẹn giờ. CỐ Ý KHÔNG có đường tự hồi bằng đồng hồ —
        đường hồi DUY NHẤT là sự kiện `online` ở trên. Thêm một hẹn giờ chạy
        giữa biển để "thăm dò xem có sóng chưa" là đi ngược bất biến số một của
        dự án (mất sóng = im lặng tuyệt đối), đắt hơn hẳn cái nó cứu. */
    const onOffline = () => clear();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Đợi một nhịp cho màn hình vẽ xong đã — heartbeat không được tranh chỗ
    // với việc dựng bản đồ lúc mở app.
    timer = setTimeout(() => void beat(), BEAT_DEFER_MS);
    return () => {
      alive = false;
      clear();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [ready, user]);

  return null;
}
