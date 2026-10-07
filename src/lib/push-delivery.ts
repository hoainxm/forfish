// LUẬT GỬI WEB PUSH — thuần, có test (tách khỏi push-send.ts vì file đó
// "server-only" nên vitest không import được). 2026-10-07.
//
// Mã trả về của Apple/Google quyết định ba việc: xoá đăng ký, thử lại, hay chịu.
//  · 404/410 — endpoint chết (gỡ app, tắt quyền) → "gone", caller xoá hàng.
//  · 5xx / 429 / không có mã (mạng chớp, timeout) → thử lại đúng MỘT lần.
//  · 4xx còn lại — điển hình 403 khi khoá VAPID lệch với khoá máy đã đăng ký —
//    thử lại vô ích, và TUYỆT ĐỐI KHÔNG tự xoá: admin dán nhầm khoá là mọi lần
//    gửi đều 403, xoá theo 403 thì xoá sạch mọi đăng ký = mất hết tin bão.
//    Chỉ ĐẾM theo mã để /quan-tri và log cron thấy được.
// nợ: chưa biết đăng ký tạo bằng khoá nào, nâng cấp khi >50 đăng ký hoặc trước lần đổi khoá VAPID kế tiếp

export type SendPushResult = {
  ok: boolean;
  gone?: boolean;
  unconfigured?: boolean;
  /** mã HTTP của dịch vụ đẩy khi hỏng; không có = lỗi mạng/timeout */
  status?: number;
};

export type PushAttempt = { ok: true } | { ok: false; status?: number };

export function isGoneStatus(status: number | undefined): boolean {
  return status === 404 || status === 410;
}

/** Đáng thử lại không: lỗi tạm (5xx, 429, mạng) thì có; 4xx thì không. */
export function isRetryableStatus(status: number | undefined): boolean {
  return status === undefined || status === 429 || status >= 500;
}

/** Gửi một lần, lỗi tạm thì chờ rồi thử lại đúng MỘT lần — có trần, không vòng lặp. */
export async function deliverWithRetry(
  attempt: () => Promise<PushAttempt>,
  sleep: () => Promise<void>,
): Promise<SendPushResult> {
  const once = async (): Promise<SendPushResult> => {
    const r = await attempt();
    if (r.ok) return { ok: true };
    return { ok: false, gone: isGoneStatus(r.status), status: r.status };
  };
  const first = await once();
  if (first.ok || first.gone || !isRetryableStatus(first.status)) return first;
  await sleep();
  return once();
}

export type FanoutTally = {
  sent: number;
  goneIds: string[];
  failed: number;
  /** số máy hỏng theo mã: "403", "500"…; "network" = không có mã */
  failedByStatus: Record<string, number>;
};

export function tallyFanout(results: Array<SendPushResult & { id: string }>): FanoutTally {
  const t: FanoutTally = { sent: 0, goneIds: [], failed: 0, failedByStatus: {} };
  for (const r of results) {
    if (r.ok) t.sent++;
    else if (r.gone) t.goneIds.push(r.id);
    else {
      t.failed++;
      const k = r.status === undefined ? "network" : String(r.status);
      t.failedByStatus[k] = (t.failedByStatus[k] ?? 0) + 1;
    }
  }
  return t;
}

/**
 * Câu báo lỗi theo mã cho màn /quan-tri. Rỗng = không hỏng máy nào.
 * 403 được gọi đích danh vì gần như luôn là khoá VAPID lệch — người gửi cần
 * biết là lỗi CẤU HÌNH, không phải "mạng chập chờn, gửi lại là được".
 */
export function describePushFailures(byStatus: Record<string, number> | undefined): string {
  if (!byStatus) return "";
  const parts = Object.entries(byStatus)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, n]) => `${code === "network" ? "mất kết nối" : `mã ${code}`}: ${n}`);
  if (parts.length === 0) return "";
  const vapid = (byStatus["403"] ?? 0) > 0
    ? " Mã 403 thường do khoá VAPID lệch với khoá các máy đã đăng ký."
    : "";
  return `Lỗi theo mã — ${parts.join(" · ")}.${vapid}`;
}
