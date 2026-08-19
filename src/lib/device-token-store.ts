"use client";

// KHO CHUỖI CỨNG PHÍA MÁY + cách gắn nó vào mọi lượt gọi server.
//
// Chuỗi này là thứ DUY NHẤT chứng minh "tôi là ai" sau bản 2026-08-02. Không hạn,
// không xoay, không gia hạn. Máy giữ nó cho tới khi một trong ba chuyện xảy ra:
//   · bà con tự bấm Đăng xuất
//   · máy khác đăng nhập cùng SĐT (server thu hồi, máy này biết ở lượt gọi kế)
//   · hệ điều hành dọn kho (iOS Safari CHƯA CÀI: 7 ngày — xem ghi chú cuối file)
//
// ⚠️ KHÔNG CÓ ĐƯỜNG THỨ TƯ. Mất sóng, server nổ, DB nghẹt, hết giờ chờ — TẤT CẢ
// đều KHÔNG được đụng tới chuỗi. Đây là khuôn lỗi đã dính nhiều lần ở repo này
// (lib/auth-error.ts, lib/tier.ts): hạ tầng trục trặc đội lốt "đã đăng xuất".

import { apiUrl } from "@/lib/api-base";
import { DEVICE_TOKEN_HEADER, isValidTokenShape, shouldDropAccount, type TokenDenial } from "@/lib/device-token";
import { applyIdentityAction } from "@/lib/offline-identity";
import { timeoutSignal } from "@/lib/abort";

/** Quy ước khoá forfish.* (xem docs/app-map/ops/state-registry.md) */
export const DEVICE_TOKEN_KEY = "forfish.token.v1";

/** Máy vừa bị đá — màn hình nghe sự kiện này để nói thật với bà con */
export const TOKEN_KICKED_EVENT = "forfish:kicked";

/**
 * MỐC BỊ ĐÁ GẦN NHẤT (ISO) — `forfish.kicked.v1` (2026-08-18, audit G1).
 *
 * VÌ SAO CẦN thêm khoá ngoài sự kiện: sự kiện chỉ tới tai component ĐANG mount.
 * Cú 401 `token_revoked` hay về ở lượt gọi nền (heartbeat, hộp thư) lúc bà con
 * đang ở màn khác, hoặc lúc app mở lại từ nền — Trang chủ mount SAU, không nghe
 * được gì ⇒ premium biến mất không một lời. Khoá này để Trang chủ đọc lại lúc
 * mount. XOÁ khi cất chuỗi mới (đăng nhập lại) — thẻ đỏ tự tắt.
 */
export const KICKED_AT_KEY = "forfish.kicked.v1";

/** Xoá mốc bị đá — gọi khi đăng nhập lại (tự động trong `saveToken`), khi bà
 *  con tự đăng xuất, hoặc "Gỡ tài khoản khỏi máy này" (thẻ đỏ hết lý do). */
export function clearKickedMark(): void {
  try {
    window.localStorage.removeItem(KICKED_AT_KEY);
  } catch {
    /* bỏ qua */
  }
}

/** ISO lúc máy bị đá gần nhất, null nếu chưa/đã đăng nhập lại. */
export function readKickedAt(): string | null {
  try {
    const v = window.localStorage.getItem(KICKED_AT_KEY);
    return v && Number.isFinite(Date.parse(v)) ? v : null;
  } catch {
    return null;
  }
}

/**  KHO CHUỖI VỪA ĐỔI (cất mới / xoá đi) — màn hình nghe để vẽ lại NGAY.
 *
 *   VÌ SAO CẦN (2026-08-02h): `saveToken` trước đây ghi im lặng, không báo ai.
 *   Component đã mount giữ nguyên trạng thái "chưa có chuỗi" cho tới lần mount
 *   sau — mà bản cài PWA mở lại từ nền thì KHÔNG remount React. Trước nay đỡ
 *   được nhờ `router.replace` sau đăng nhập, tức dựa vào may.
 *   Từ bản này "máy có tài khoản chưa" là câu hỏi cả app đi hỏi (useAuthUser),
 *   nên nó phải có tín hiệu thật, không dựa vào may. */
export const TOKEN_STORE_EVENT = "forfish:token";

function announceToken(): void {
  try {
    window.dispatchEvent(new CustomEvent(TOKEN_STORE_EVENT));
  } catch {
    /* CustomEvent không có (WebView rất cũ) — màn vẽ lại ở lần mở sau */
  }
}

export function readToken(): string | null {
  try {
    const v = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    return isValidTokenShape(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Cất chuỗi vào máy. Trả `true` khi ĐÃ ĐỌC LẠI ĐƯỢC đúng chuỗi vừa ghi.
 *
 * ⚠️ PHẢI TRẢ TRẠNG THÁI, KHÔNG ĐƯỢC NUỐT (sửa 2026-08-02h).
 * LỖI ĐÃ SỬA: bản trước nuốt mọi lỗi và trả `void`, nên màn đăng nhập cứ thế đi
 * tiếp — trong khi máy chủ ĐÃ thu hồi chuỗi của máy cũ và app thì sắp bỏ luôn
 * phiên Supabase tạm. Kho bị chặn (chế độ riêng tư iOS) hoặc đầy ⇒ chuỗi mới
 * mất vĩnh viễn, phiên tạm cũng mất ⇒ **tài khoản không còn credential nào trên
 * máy dù vừa đăng nhập đúng mật khẩu**, mà máy cũ thì cũng đã bị đá. Mất cả hai
 * đầu cùng lúc.
 *
 * ĐỌC LẠI để xác minh chứ không tin `setItem` im lặng: Safari chế độ riêng tư
 * đời cũ nhận `setItem` rồi vứt, không ném gì cả.
 */
export function saveToken(token: string): boolean {
  try {
    window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
    const ok = window.localStorage.getItem(DEVICE_TOKEN_KEY) === token;
    if (ok) {
      clearKickedMark(); // đăng nhập lại = hết "bị đá" — thẻ đỏ ở Trang chủ tự tắt
      announceToken();
    }
    return ok;
  } catch {
    return false;
  }
}

/*  ═══ HAI ĐƯỜNG RA, HAI HẬU QUẢ KHÁC HẲN NHAU ═══ (chủ dự án chốt 2026-08-02)

    ① BÀ CON TỰ BẤM ĐĂNG XUẤT → xoá SẠCH: chuỗi + danh tính + dấu premium.
       Ý định ở đây là **trao máy cho người khác**. Giữ dấu premium lại là chủ tàu
       đăng xuất ở cảng, đưa máy cho bạn thuyền, ra khơi mất sóng là bạn thuyền
       dùng quyền đã trả tiền của chủ tàu. Luật cũ, đúng, giữ nguyên
       (xem `forgetIdentity` ở lib/offline-identity.ts).

    ② BỊ MÁY KHÁC ĐÁ → chỉ xoá CHUỖI. Giữ danh tính, giữ dấu premium, giữ toàn bộ
       dự báo/bản đồ đã tải.
       Vì sao khác: đây KHÔNG phải hành động trao máy. Ca thật là chủ tàu ở nhà
       đăng nhập điện thoại mới, còn máy cũ đang ở TRÊN TÀU giữa biển với bạn
       thuyền. Khoá dữ liệu đã tải lúc đó là lấy mất đồ định hướng của người đang
       ngoài khơi vì một thao tác của người ở bờ — mà chẳng ai được lợi: máy mới
       không dùng được file nằm trong máy cũ.
       Chủ dự án chốt bằng đúng một câu: "máy nào tải rồi thì cứ dùng thôi, chứng
       tỏ đã là premium trước đó rồi." Máy bị đá **không lấy thêm được một byte
       nào** từ server — thế là đủ. */

export function signOutLocal(reason: "user" | "kicked"): void {
  try {
    window.localStorage.removeItem(DEVICE_TOKEN_KEY);
  } catch {
    /* bỏ qua */
  }
  announceToken();
  /*  QUA CỔNG `applyIdentityAction`, KHÔNG gọi thẳng `forgetIdentity` — luật K7:
      sổ danh tính chỉ có MỘT người ghi. Cổng `identity-gate.test.ts` bắt được
      đúng chỗ này lúc tôi viết tắt, và nó bắt đúng: mỗi đường ghi thứ hai là một
      đường để người sau đi lệch. */
  if (reason === "user") {
    clearKickedMark(); // tự đăng xuất thì không còn gì để nói về "bị đá"
    applyIdentityAction("user-signed-out", false);
  }
  if (reason === "kicked") {
    /*  GHI MỐC TRƯỚC, BẮN SỰ KIỆN SAU: component chưa mount đọc mốc lúc mount,
        component đang mount nghe sự kiện — cả hai đều thấy (audit G1). Ghi hỏng
        (máy hết chỗ) thì vẫn bắn sự kiện: có còn hơn không. */
    try {
      window.localStorage.setItem(KICKED_AT_KEY, new Date().toISOString());
    } catch {
      /* bỏ qua */
    }
    window.dispatchEvent(new CustomEvent(TOKEN_KICKED_EVENT));
  }
}

/**
 * Header mang chuỗi để rắc vào một lượt `fetch` bất kỳ. Rỗng khi máy chưa đăng
 * nhập — chỗ gọi cứ spread vô điều kiện.
 *
 * Cặp đôi bình thường của một chỗ gọi là: `tokenHeader()` lúc GỬI và
 * `noteResponse(r)` lúc NHẬN. `authedFetch` chỉ là bản gói sẵn cả hai cho những
 * chỗ không cần tự dựng request.
 */
export function tokenHeader(): Record<string, string> {
  const t = readToken();
  return t ? { [DEVICE_TOKEN_HEADER]: t } : {};
}

/**
 * SOI MỘT PHẢN HỒI xem máy có vừa bị đá không — **BỘ NÃO DUY NHẤT** của cả tính
 * năng. Chỗ gọi chỉ cần thêm đúng một dòng `noteResponse(r)` sau khi `fetch`.
 *
 * VÌ SAO KHÔNG ĐỂ MỖI CHỖ TỰ ĐỌC 401 (chủ dự án chốt 2026-08-02g): bỏ nhịp tra
 * hạng riêng rồi thì việc phát hiện bị đá phải đi nhờ **mọi lệnh sẵn có** — cái
 * nào tới trước bắt trước, nhanh hơn hẳn một nhịp hẹn giờ. Nhưng "nhiều chỗ GỌI"
 * không được kéo theo "nhiều chỗ HIỂU": mỗi nơi tự luận 401 là một nơi có thể
 * luận sai, mà luận sai ở đây = xoá chuỗi của người đang ngoài biển, tức dựng
 * lại đúng con bug vừa diệt. Nên: gọi ở đâu cũng được, hiểu thì chỉ ở đây.
 *
 * ⚠️ CHỈ `code` DỨT KHOÁT MỚI TÍNH. 401 trần (proxy, cổng wifi ở cảng chèn HTML),
 * 5xx, hết giờ, mất sóng — KHÔNG cái nào được coi là bị đá.
 * KHÔNG BAO GIỜ ném, và không đụng gì tới body mà chỗ gọi sắp đọc (dùng `clone`).
 */
export async function noteResponse(res: Response | null | undefined): Promise<TokenDenial | null> {
  if (!res || res.status !== 401) return null;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { code?: string } | null;
  const code = body?.code;
  const denial: TokenDenial | null =
    code === "token_revoked" || code === "unknown_token" || code === "no_token"
      ? (code as TokenDenial)
      : null;
  /*  `no_token` = chưa từng đăng nhập ⇒ KHÔNG có gì để dọn, và tuyệt đối không
      được bắn sự kiện "bị đá" cho người chưa đăng nhập bao giờ. */
  if (denial && shouldDropAccount(denial)) signOutLocal("kicked");
  return denial;
}

/** Kết quả một lượt gọi có gắn chuỗi. `denial` chỉ có khi SERVER TRẢ LỜI DỨT
 *  KHOÁT — mất sóng/hết giờ/5xx đều KHÔNG sinh ra `denial`. */
export interface AuthedResult {
  res: Response | null;
  denial: TokenDenial | null;
}

/**
 * Gọi API kèm chuỗi cứng.
 *
 * ⚠️ CHỖ NGUY HIỂM NHẤT CỦA CẢ TÍNH NĂNG nằm ở mấy dòng dưới. Chỉ **401 kèm mã
 * dứt khoát** mới được coi là "bị đá". Cụ thể KHÔNG được coi là bị đá:
 *   · fetch ném (mất sóng, hết giờ chờ)   → res = null, denial = null
 *   · 5xx (server nổ, DB nghẹt)           → denial = null
 *   · 503 `unavailable` từ cổng           → denial = null
 * Đọc `code` chứ không đọc mỗi status: 401 trần (route khác, proxy chen vào) cũng
 * KHÔNG đủ để xoá tài khoản của người đang ngoài biển.
 */
export async function authedFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<AuthedResult> {
  const token = readToken();
  const headers = new Headers(init.headers);
  if (token) headers.set(DEVICE_TOKEN_HEADER, token);
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      headers,
      signal: init.signal ?? timeoutSignal(timeoutMs),
    });
  } catch {
    return { res: null, denial: null };
  }
  // cùng BỘ NÃO với mọi chỗ gọi khác — xem `noteResponse`
  return { res, denial: await noteResponse(res) };
}

/*  ═══ CHUỖI SỐNG ĐƯỢC BAO LÂU TRONG MÁY ═══

    Android / Chrome: tới khi máy hết chỗ. Chặn được bằng `navigator.storage
    .persist()` — app đã xin ở lib/storage-persist.ts.

    iOS ĐÃ CÀI VỀ MÀN HÌNH: kho riêng của bản cài, không dính luật dọn 7 ngày.

    iOS CHƯA CÀI (mở bằng Safari): WebKit xoá SẠCH mọi thứ script ghi được sau 7
    ngày không mở — localStorage dính y hệt cookie. Chuyến biển 10 ngày về là mất
    chuỗi, dù không ai đăng nhập ở đâu cả.
    ⚠️ KHÔNG token nào né được: nó xoá theo THỜI GIAN, không theo nội dung. Đường
    duy nhất là bà con cài app về màn hình. Vì thế màn đăng nhập phải nói thẳng
    câu đó, và thang "web → bản cài" của app từ nay không còn là khuyến nghị. */
