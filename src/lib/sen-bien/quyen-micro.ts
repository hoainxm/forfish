"use client";

/*  QUYỀN MICRO — module NHẸ, không phụ thuộc bộ nghe (icon Sen Biển ở mọi màn dùng).
    MICRO BỊ CHẶN THẬT (anh Long 2026-10-20: "chỉ báo không nghe được khi micro bị
    chặn thật, không báo khi chỉ là chưa xin quyền"). Trước đây icon Sen Biển báo
    "không nghe được" = `!micGranted()` — tức là CHƯA XIN cũng bị coi là chặn. Nay
    cờ riêng `denied`: bật khi trình duyệt báo quyền micro "denied" (Permissions
    API) hoặc một lượt nghe vừa bị từ chối (not-allowed); tắt khi nghe được. */

import { setSenSignal } from "@/lib/sen-bien-state";

let denied = false;
const deniedSubs = new Set<(v: boolean) => void>();
export function micDenied(): boolean {
  return denied;
}
export function setMicDenied(v: boolean): void {
  if (denied === v) return;
  denied = v;
  setSenSignal({ micDenied: v });
  for (const f of deniedSubs) f(v);
}
/** Báo khi cờ đổi; trả hàm huỷ. */
export function onMicDeniedChange(f: (v: boolean) => void): () => void {
  deniedSubs.add(f);
  return () => {
    deniedSubs.delete(f);
  };
}
/** Theo dõi quyền micro của trình duyệt (Chrome/Edge/Android; Safari/Firefox cũ
 *  không có tên "microphone" ⇒ bỏ qua, chỉ còn đường lỗi not-allowed). */
export function watchMicPermission(): () => void {
  let huy = () => {};
  try {
    const q = (navigator as Navigator & { permissions?: Permissions }).permissions?.query({ name: "microphone" as PermissionName });
    void q
      ?.then((st) => {
        setMicDenied(st.state === "denied");
        const doi = () => setMicDenied(st.state === "denied");
        st.addEventListener?.("change", doi);
        huy = () => st.removeEventListener?.("change", doi);
      })
      .catch(() => {});
  } catch {
    /* không có Permissions API */
  }
  return () => huy();
}
