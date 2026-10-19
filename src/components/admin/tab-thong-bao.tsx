"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { describePushFailures } from "@/lib/push-delivery";
import { type TabPerms } from "@/lib/staff-permissions";
import { useCallback, useEffect, useState } from "react";
import { fmtDT } from "@/components/admin/quan-tri-chung";

/* ── THÔNG BÁO (Web Push per-user/broadcast, Phase 3) ─────────────────────
   Gửi qua PWA service worker (public/sw.js) — không cần app store update.
   Người dùng phải tự bấm "Bật thông báo" trong sheet Tài khoản trước. */

export type PushStats = {
  configured: boolean;
  total: number;
  named: number;
  anonymous: number;
  /** TÀI KHOẢN đã gắn máy — để CHỌN, không gõ tay số (2026-08-01) */
  accounts: { phone: string; name: string | null; devices: number }[];
  /** 10 tin gần nhất + biên nhận thật từ máy bà con (0023) */
  recent: {
    id: string;
    title: string;
    target: string;
    targetPhone: string | null;
    devices: number;
    sent: number;
    delivered: number;
    opened: number;
    createdAt: string;
  }[];
};

export function PushNotificationsTab({ perms }: { perms: TabPerms }) {
  const [stats, setStats] = useState<PushStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<"all" | "phone">("all");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetch(apiUrl("/api/admin/push"), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json()) as { ok: boolean; code?: string } & Partial<PushStats>;
        if (!j.ok) throw new Error(j.code ?? "load");
        setStats({
          configured: Boolean(j.configured),
          total: j.total ?? 0,
          named: j.named ?? 0,
          anonymous: j.anonymous ?? 0,
          accounts: j.accounts ?? [],
          recent: j.recent ?? [],
        });
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Máy chủ chưa được cấu hình (thiếu service-role của Supabase)."
            : "Chưa tải được thống kê. Vui lòng thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  async function send() {
    setBusy(true);
    setResult(null);
    const r = await fetch(apiUrl("/api/admin/push"), {
      method: "POST",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({
        target,
        phone: target === "phone" ? phone.trim() : undefined,
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
      found?: number;
      sent?: number;
      failed?: number;
      failedByStatus?: Record<string, number>;
      cleaned?: number;
    } | null;
    if (!r?.ok || !j?.ok) {
      setResult(
        j?.code === "vapid_not_configured"
          ? "Cấu hình hệ thống chưa có khoá kết nối thông báo (VAPID)."
          : j?.code === "missing_content"
            ? "Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo."
            : j?.code === "missing_phone"
              ? "Cần nhập số điện thoại khách hàng khi gửi thông báo cá nhân."
              : "Gửi thông báo không thành công. Vui lòng thử lại.",
      );
      return;
    }
    // GỬI HỤT PHẢI NÓI THẬT (2026-08-01): trước đây `sent: 0` cũng hiện câu
    // "Đã gửi 0 máy" trông như đã xong — người gửi tưởng khách đã nhận.
    if (!j.found) {
      setResult(
        target === "phone"
          ? "Chưa có thiết bị nào liên kết với tài khoản này. Khách hàng cần mở app, đăng nhập và bật quyền Thông báo thì mới nhận được tin."
          : "Hiện chưa có thiết bị nào đăng ký nhận thông báo trên hệ thống.",
      );
      return;
    }
    setResult(
      `Đã gửi tới ${j.sent}/${j.found} thiết bị${j.failed ? ` · lỗi ${j.failed}` : ""}${j.cleaned ? ` · dọn ${j.cleaned} đăng ký chết` : ""}.` +
        (j.failed ? ` ${describePushFailures(j.failedByStatus)}` : ""),
    );
    setTitle("");
    setBody("");
    setUrl("");
    load();
  }

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (target === "all" || phone.trim().length > 0);

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Gửi thông báo cho từng người (theo SĐT) hoặc toàn bộ người đã bấm{" "}
        <b>&ldquo;Bật thông báo&rdquo;</b> trong app (sheet Tài khoản). Không cần cập
        nhật app.
      </p>

      {error && (
        <div className="surface px-4 py-6 text-center">
          <p className="text-[1rem] text-danger">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 min-h-[2.75rem] rounded-xl bg-navy px-6 text-[0.9375rem] font-bold text-white"
          >
            Thử lại
          </button>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-2.5">
          {(
            [
              // "Có SĐT / Ẩn danh" nói sai bản chất: cột đó là CON TRỎ TỚI
              // TÀI KHOẢN, không phải số liên lạc (2026-08-01).
              ["Số máy đã đăng ký", stats.total],
              ["Số máy đã đăng nhập", stats.named],
              ["Số máy chưa đăng nhập", stats.anonymous],
            ] as [string, number][]
          ).map(([label, v]) => (
            <div key={label} className="surface px-3 py-3 text-center">
              <p className="display text-[1.5rem] font-bold tabular-nums text-navy">
                {v}
              </p>
              <p className="text-[0.8125rem] font-semibold text-foreground/65">
                {label}
              </p>
            </div>
          ))}
        </div>
      )}
      {stats && !stats.configured && (
        <p className="surface px-4 py-3 text-[0.875rem] font-semibold text-danger">
          Chưa cấu hình khoá VAPID. Dán 3 khoá ngay trong tab{" "}
          <span className="underline">Hệ thống → Cấu hình ứng dụng</span> (lưu
          vào DB, áp dụng ngay, KHÔNG cần env Vercel / redeploy). Tạo khoá bằng:
          npx web-push generate-vapid-keys.
        </p>
      )}

      {perms.create ? (
      <div className="surface space-y-2.5 px-4 py-3.5">
        <div
          className="grid grid-cols-2 gap-1.5"
          role="group"
          aria-label="Đối tượng nhận thông báo"
        >
          {(
            [
              ["all", "Toàn bộ khách hàng"],
              ["phone", "Một tài khoản cụ thể"],
            ] as ["all" | "phone", string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTarget(id)}
              aria-pressed={target === id}
              className={`min-h-[2.75rem] rounded-xl px-3 text-[0.875rem] font-bold transition ${
                target === id
                  ? "bg-navy text-white shadow-sm"
                  : "bg-field text-foreground/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* CHỌN TÀI KHOẢN, KHÔNG GÕ SỐ (2026-08-01). Việc thật là "gửi cho một
            TÀI KHOẢN" — SĐT chỉ tình cờ là id của tài khoản trong app này. Gõ
            tay sai một ký tự là bắn vào hư không mà không ai biết; và chỉ tài
            khoản ĐÃ GẮN MÁY mới gửi tới được, nên liệt kê đúng những tài khoản
            đó, kèm số máy sẽ nhận. */}
        {target === "phone" && (
          <div className="space-y-1.5">
            {(stats?.accounts.length ?? 0) === 0 ? (
              <p className="rounded-xl bg-warn-bg px-3.5 py-3 text-[0.875rem] font-semibold leading-snug text-warn">
                Chưa tài khoản nào gắn máy — gửi nhắm riêng sẽ không tới được
                ai. Bà con phải mở app, ĐĂNG NHẬP rồi bật Thông báo trong sheet
                Tài khoản.
              </p>
            ) : (
              <>
                <select
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-label="Chọn tài khoản sẽ nhận thông báo"
                  className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
                >
                  <option value="">— Chọn tài khoản người nhận —</option>
                  {stats?.accounts.map((a) => (
                    <option key={a.phone} value={a.phone}>
                      {a.phone}
                      {a.name ? ` · ${a.name}` : ""} — {a.devices} máy
                    </option>
                  ))}
                </select>
                {phone && (
                  <p className="px-1 text-[0.8125rem] font-semibold text-t1">
                    Sẽ gửi tới{" "}
                    {stats?.accounts.find((a) => a.phone === phone)?.devices ?? 0}{" "}
                    máy của tài khoản này.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        <input
          placeholder="Tiêu đề thông báo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <textarea
          placeholder="Nội dung chi tiết"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <input
          placeholder="Trang sẽ mở khi khách bấm vào thông báo (tuỳ chọn, ví dụ: /tien)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <button
          type="button"
          disabled={!canSend || busy || (stats ? !stats.configured : false)}
          onClick={() => setConfirmSend(true)}
          className="min-h-[2.75rem] w-full rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Đang gửi thông báo…" : "Gửi thông báo"}
        </button>
        {result && (
          <p className="text-[0.875rem] font-semibold text-foreground/75">
            {result}
          </p>
        )}
      </div>
      ) : (
        <p className="surface px-4 py-6 text-center text-[0.9375rem] text-foreground/65">
          Bạn chỉ có quyền xem thống kê thông báo. Cần quyền gửi thì báo quản trị
          viên bật thêm.
        </p>
      )}

      {/* LỊCH SỬ + BIÊN NHẬN THẬT (0023). "Đã đẩy" là biên nhận của Apple/
          Google, KHÁC HẲN "máy bà con đã nhận" — cột Nhận/Đọc do chính service
          worker trên máy báo về. Tin nằm trong hộp thư ở trang chủ nên kể cả
          đẩy hụt bà con vẫn đọc được khi mở app. */}
      {(stats?.recent.length ?? 0) > 0 && (
        <div className="surface px-4 py-3.5">
          <p className="text-[0.9375rem] font-bold text-navy">
            10 tin gần nhất
          </p>
          <ul className="mt-2 space-y-2">
            {stats?.recent.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-line pb-2 text-[0.875rem] last:border-b-0 last:pb-0"
              >
                <span className="font-bold text-navy">{m.title}</span>
                <span className="text-foreground/55">
                  {m.target === "account"
                    ? `→ ${m.targetPhone ?? "?"}`
                    : "→ toàn bộ danh sách"}
                </span>
                <span className="text-foreground/45">{fmtDT(m.createdAt)}</span>
                <span className="ml-auto tabular-nums">
                  <b className="text-navy">{m.devices}</b> máy · đẩy{" "}
                  <b className={m.sent > 0 ? "text-ok" : "text-danger"}>
                    {m.sent}
                  </b>{" "}
                  · nhận <b className="text-ok">{m.delivered}</b> · đọc{" "}
                  <b className="text-t1">{m.opened}</b>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.8125rem] leading-snug text-foreground/55">
            <b>Đã gửi đi</b> = máy chủ đã chuyển tới Apple/Google. <b>Thiết bị nhận</b> = máy bà
            con báo về đã nhận thật (đếm theo <b>máy</b>). <b>Đã đọc</b> = đếm theo{" "}
            <b>người dùng</b>: bấm vào thông báo, hoặc mở app xem tin ở mục Thông báo
            trang chủ — một người hai máy vẫn tính một. Tin luôn nằm trong mục
            Thông báo ở trang chủ, nên đẩy hụt thì mở app vẫn đọc được.
          </p>
          <p className="mt-1 text-[0.8125rem] leading-snug text-foreground/45">
            Đọc thấp hơn Nhận là <b>trạng thái bình thường</b>: bà con hay liếc thông báo
            trên màn khoá rồi vuốt tắt — đường đó không máy nào đo được.
          </p>
        </div>
      )}

      {confirmSend && (
        <ConfirmDialog
          title={
            target === "all"
              ? "Bạn xác nhận gửi thông báo này cho toàn bộ khách hàng đã bật nhận thông báo?"
              : `Xác nhận gửi thông báo cho thuê bao ${phone.trim()}?`
          }
          message={`"${title.trim()}" — ${body.trim()}`}
          confirmLabel="Gửi ngay"
          cancelLabel="Hủy thao tác"
          danger={target === "all"}
          onCancel={() => setConfirmSend(false)}
          onConfirm={() => {
            setConfirmSend(false);
            send();
          }}
        />
      )}
    </div>
  );
}
