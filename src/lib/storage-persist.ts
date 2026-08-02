// Offline WEB — GIỮ CACHE KHỎI BỊ TRÌNH DUYỆT DỌN.
//
// Vì sao cần: service worker + localStorage chạy được cả trong TAB trình duyệt
// (không chỉ PWA đã cài), NHƯNG là bộ nhớ "best-effort" — máy đầy thì trình
// duyệt tự xoá. `navigator.storage.persist()` xin trình duyệt GIỮ BỀN (không tự
// xoá khi thiếu chỗ). Riêng iOS Safari còn xoá SẠCH storage sau ~7 ngày không
// dùng NẾU CHƯA "Thêm vào màn hình chính" — cái đó không có API vượt được, chỉ
// cài về máy mới thoát (xem components/install-prompt.tsx).
//
// Toàn hàm thuần gọi browser API, best-effort (nuốt lỗi) — offline là tăng
// cường, không được làm hỏng app. Chỉ client component import.

/** Đang chạy ở chế độ đã cài (PWA / thêm vào màn hình chính)? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      // iOS Safari: cờ riêng, không theo chuẩn display-mode
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** Máy iOS (iPhone/iPad) — iPadOS 13+ báo "Mac", nhận thêm qua touch */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSClassic = /iphone|ipad|ipod/i.test(ua);
  const iPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  return iOSClassic || iPadOS;
}

/** Máy Android (loại trừ máy iOS — có UA lẫn chữ "Mobile" giống nhau) */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent || "");
}

/**
 * LOẠI MÁY THÔ để báo về /quan-tri — `"ios" | "android" | "khac"`.
 *
 * CHỈ loại máy, KHÔNG bao giờ gửi user-agent đầy đủ: chuỗi UA là dấu vân tay
 * nhận diện được từng máy, mà app của ngư dân không được biến thành thứ theo
 * dõi bà con (cùng luật với migration 0021/0022).
 *
 * Vì sao nhân viên cần biết: hướng dẫn cài đặt của hai nền KHÁC HẲN nhau, mà
 * bản cài trên iOS còn có kho riêng tách Safari — gọi điện nhắc mà không biết
 * máy gì thì dễ chỉ sai bước, bà con làm theo xong vẫn ra khơi tay trắng.
 */
export function devicePlatform(): "ios" | "android" | "khac" {
  if (isIOS()) return "ios";
  if (isAndroid()) return "android";
  return "khac";
}

/**
 * Xin bộ nhớ BỀN. Trả true nếu đang/được cấp bền. Idempotent (đã bền thì thôi).
 * Best-effort: máy không hỗ trợ / bị chặn → false, KHÔNG ném. Chrome cấp theo
 * mức dùng (đã cài / hay mở / đã cho thông báo); Safari thường cấp mặc định.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) {
      return false;
    }
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}


/**
 * BA KHO ĐANG CHIẾM BAO NHIÊU — tách riêng localStorage / IndexedDB / Cache API.
 *
 * VÌ SAO (chủ dự án chốt 2026-08-02k): *"Heartbeat đo được localStorage, cache,
 * Index."* Số tổng của `estimate()` không đủ để quyết chỗ cất: nó gộp cả ba kho
 * làm một, nên không trả lời được câu đang cần — *kho nào sắp chạm trần TRƯỚC*.
 * Trên iOS, localStorage bị chặn cứng 5 MB riêng, còn IndexedDB thì co giãn theo
 * đĩa; gộp lại thành một con số là mất đúng thông tin để xếp lại thứ tự.
 *
 * CÁCH ĐO, và giới hạn của từng con số (nói thẳng để người sau khỏi tin quá):
 *  · `lsMb`    — CHÍNH XÁC. Cộng thẳng độ dài khoá + giá trị (UTF-16, ~2 byte/ký
 *                tự). Rẻ, không ghi gì.
 *  · `idbMb`   — CHÍNH XÁC PHẦN CỦA APP. Lấy từ gương của `forecast-store`, tức
 *                chỉ tính dữ liệu app tự cất, không tính phần trình duyệt phụ trội.
 *  · `cacheMb` — ƯỚC LƯỢNG bằng PHẦN CÒN LẠI (`tổng − ls − idb`). Đọc kích thước
 *                thật của kho Cache API phải tải lại từng phản hồi — với hàng
 *                nghìn ô bản đồ là vài chục MB đọc đĩa mỗi nhịp, đắt hơn giá trị
 *                nó mang lại. Phần dư này còn gộp cả mã service worker và phần
 *                phụ trội của trình duyệt, nên chỉ dùng để SO ĐỘ LỚN, đừng dùng
 *                làm con số quyết định.
 *
 * ⚠️ KHÔNG BAO GIỜ đo bằng cách ghi thử (xem `storageEstimateMb`).
 * KHÔNG BAO GIỜ ném — thiếu API thì trả `null` ở đúng ô đó.
 */
export async function storageBreakdownMb(): Promise<{
  lsMb: number | null;
  idbMb: number | null;
  cacheMb: number | null;
  quotaMb: number | null;
  /** Còn ghi thêm được bao nhiêu — `quota − usage`, không âm. */
  availableMb: number | null;
  /** Máy CÓ THẬT SỰ cấp bộ nhớ bền không (`navigator.storage.persisted()`). */
  persisted: boolean | null;
} | null> {
  const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;
  let lsMb: number | null = null;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      let n = 0;
      const s = window.localStorage;
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (!k) continue;
        n += (k.length + (s.getItem(k)?.length ?? 0)) * 2;
      }
      lsMb = mb(n);
    }
  } catch {
    /* chặn lưu / SSR — để null, đừng đoán */
  }
  let idbMb: number | null = null;
  try {
    const { forecastStoreBytes } = await import("@/lib/forecast-store");
    idbMb = mb(forecastStoreBytes());
  } catch {
    /* chưa nạp được module kho — để null */
  }
  const tong = await storageEstimateMb();
  let cacheMb: number | null = null;
  if (tong && lsMb != null && idbMb != null) {
    cacheMb = Math.max(0, Math.round((tong.usedMb - lsMb - idbMb) * 10) / 10);
  }
  /*  ĐÃ ĐƯỢC CẤP BỘ NHỚ BỀN CHƯA — chỉ HỎI (`persisted()`), KHÔNG xin
      (`persist()`): xin là việc của `requestPersistentStorage` lúc mở app, còn
      đây là đường đo, không được đẻ tác dụng phụ.

      ⚠️ VÌ SAO ĐÁNG ĐO (vòng phản biện 2026-08-02k): app CÓ gọi `persist()` ở
      `sw-register.tsx` nhưng vứt kết quả đi, nên tới giờ **không ai biết máy bà
      con có thật sự được cấp hay không** — trong khi đó chính là hàng rào duy
      nhất chống vòng thu hồi LRU khi máy đầy. Một boolean đi nhờ nhịp 30 phút
      đang chạy sẵn là trả lời được cho cả đội tàu, không tốn thêm request nào. */
  let persisted: boolean | null = null;
  try {
    const st = navigator?.storage;
    if (st && typeof st.persisted === "function") persisted = await st.persisted();
  } catch {
    /* thiếu API / ngữ cảnh không bảo mật — để null, đừng đoán */
  }
  if (lsMb == null && idbMb == null && tong == null && persisted == null) {
    return null;
  }
  const quotaMb = tong?.quotaMb ?? null;
  return {
    lsMb,
    idbMb,
    cacheMb,
    quotaMb,
    availableMb:
      tong == null ? null : Math.max(0, Math.round((tong.quotaMb - tong.usedMb) * 10) / 10),
    persisted,
  };
}

/**
 * KHO CỦA MÁY CÒN BAO NHIÊU — `{quotaMb, usedMb}`, `null` khi không hỏi được.
 *
 * VÌ SAO CẦN (chủ dự án chốt 2026-08-02j): quyết định "để dữ liệu đi biển ở kho
 * nào" đang dựa trên phỏng đoán. Đo thật trên Chromium: localStorage chạm trần ở
 * **99,88 MB**, quota cả origin **1.425 MB** — tức con số "5 MB" mà cả ngày soát
 * dựa vào là SAI về mức độ. iOS/WKWebView thì chưa ai đo, mà đó mới là nền phần
 * lớn bà con dùng. Để nhịp 30 phút báo lên, một ngày là có số thật của cả đội.
 *
 * ⚠️ KHÔNG BAO GIỜ ĐO BẰNG CÁCH GHI THỬ. Cách duy nhất biết trần chính xác là
 * ghi tới lúc ném — trên máy bà con thì đó là đổ vài chục MB rác vào kho và có
 * cửa đẩy chính dữ liệu đi biển ra. `estimate()` là số trình duyệt tự khai, rẻ,
 * không ghi một byte nào.
 * KHÔNG BAO GIỜ ném: API này thiếu trên WebView cũ và trên ngữ cảnh không bảo mật.
 */
export async function storageEstimateMb(): Promise<{
  quotaMb: number;
  usedMb: number;
} | null> {
  try {
    if (typeof navigator === "undefined") return null;
    const st = navigator.storage;
    if (!st || typeof st.estimate !== "function") return null;
    const e = await st.estimate();
    if (!e || typeof e.quota !== "number") return null;
    return {
      quotaMb: Math.round(e.quota / 1048576),
      usedMb: Math.round((e.usage ?? 0) / 1048576),
    };
  } catch {
    return null;
  }
}
