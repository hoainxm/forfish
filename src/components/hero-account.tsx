"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { BellIcon, ChevronRightIcon, UsersIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api-base";
import { useAuthUser } from "@/lib/use-auth";
import {
  getExistingPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

/*
  Tài khoản trên hero — GỌN (sửa 2026-06-11 theo góp ý "design thô"):
  hero chỉ bày MỘT chip kính mờ; mọi thứ phụ (cỡ giao diện, đăng xuất)
  nằm trong SHEET TÀI KHOẢN — cái gì trực tiếp thì show, còn lại menu phụ.

  Cỡ giao diện: MẶC ĐỊNH "Gọn" (user chốt 2026-07-28 — kể cả chưa đăng nhập);
  bấm lại lựa chọn đang chọn = về "auto" theo cỡ chữ máy (xem globals.css).
*/

const MODE_KEY = "forfish.displaymode.v1";

type Mode = "auto" | "to" | "gon";

// "Theo máy" (auto) không bày thành lựa chọn (góp ý user 2026-06-11) — chỉ
// 2 tùy chọn; bấm lại cái đang chọn = về auto. MẶC ĐỊNH là "gon" (2026-07-28).
const MODES: { id: Exclude<Mode, "auto">; label: string; sub: string }[] = [
  { id: "to", label: "Chữ to", sub: "Luôn to rõ, dễ đọc ngoài nắng" },
  { id: "gon", label: "Gọn", sub: "Mật độ như các app thường dùng" },
];

function prettyPhone(p: string): string {
  let local = p.replace(/\D/g, "");
  if (local.startsWith("84")) local = "0" + local.slice(2);
  else if (!local.startsWith("0")) local = "0" + local;
  return local.replace(/(\d{4})(\d{3})(\d{0,3})/, "$1 $2 $3").trim();
}

// NEXT_PUBLIC_* inline lúc build — vắng thì tắt hẳn khối "Bật thông báo"
// (Phase 3, 2026-07-28) thay vì hiện nút bấm không chạy được.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type PushUiState =
  | "checking"
  | "off"
  | "on"
  | "busy"
  | "unsupported"
  | "unconfigured";

export function HeroAccount() {
  const router = useRouter();
  const { user, phone, ready } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("gon");
  const [pushState, setPushState] = useState<PushUiState>("checking");
  const [pushError, setPushError] = useState<string | null>(null);
  // lối vào trang quản trị — CHỈ hiện cho STAFF (admin/manager). Dò quyền thật
  // qua /api/admin/health (200 = staff) thay vì đoán ở client. /quan-tri vẫn
  // tự bảo vệ ở API — nút này chỉ là lối tắt cho người có quyền.
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    // chưa đăng nhập → chắc chắn không phải staff, khỏi gọi API
    if (!user) {
      setIsStaff(false);
      return;
    }
    let alive = true;
    fetch(apiUrl("/api/admin/health"))
      .then((r) => {
        if (alive) setIsStaff(r.ok);
      })
      .catch(() => {
        if (alive) setIsStaff(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setPushState("unconfigured");
      return;
    }
    getExistingPushSubscription().then((sub) => setPushState(sub ? "on" : "off"));
  }, []);

  async function togglePush() {
    setPushError(null);
    if (pushState === "on") {
      setPushState("busy");
      await unsubscribeFromPush();
      setPushState("off");
      return;
    }
    setPushState("busy");
    const r = await subscribeToPush(VAPID_PUBLIC_KEY!, phone);
    if (r.ok) {
      setPushState("on");
      return;
    }
    setPushState("off");
    setPushError(
      r.error === "denied"
        ? "Trình duyệt đang chặn quyền thông báo — vào cài đặt trình duyệt để bật lại."
        : "Chưa bật được — kiểm tra mạng rồi thử lại.",
    );
  }

  useEffect(() => {
    try {
      const m = window.localStorage.getItem(MODE_KEY);
      if (m === "to" || m === "gon" || m === "auto") setMode(m);
    } catch {
      // storage bị chặn — dùng mặc định "gon"
    }
  }, []);

  function applyMode(next: Mode) {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // không lưu được thì vẫn đổi cho phiên này
    }
    // Cố ý mutate DOM toàn cục: data-mode trên <html> điều khiển cỡ giao diện
    // qua CSS (globals.css), nằm ngoài cây React nên không thể làm bất biến.
    // eslint-disable-next-line react-hooks/immutability
    if (next === "auto") delete document.documentElement.dataset.mode;
    // eslint-disable-next-line react-hooks/immutability
    else document.documentElement.dataset.mode = next;
  }

  if (!ready) return <div className="mt-3 h-[2.75rem]" aria-hidden />;

  const name = (user?.user_metadata?.full_name as string | undefined)?.trim();

  return (
    <>
      {/* MỘT chip duy nhất trên hero — bấm mở menu phụ */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex min-h-[2.75rem] max-w-full items-center gap-2 rounded-full bg-white/15 pl-2 pr-3.5 text-white backdrop-blur-sm transition active:scale-[0.97]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
          <UsersIcon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 truncate text-[0.9375rem] font-bold">
          {/* khách lạ thấy thẳng "Đăng nhập" — "Tài khoản" trung tính không
              mời ai làm gì (roadmap hội đồng UX 2026-06-11) */}
          {user && phone ? name || prettyPhone(phone) : "Đăng nhập"}
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 rotate-90 text-white/60" />
      </button>

      {open && (
        <BottomSheet title="Tài khoản" onClose={() => setOpen(false)}>
          {/* danh tính / đăng nhập */}
          {user && phone ? (
            <div className="mb-4 surface px-4 py-3">
              {name && (
                <p className="display text-[1.125rem] font-bold text-navy">
                  Bác {name}
                </p>
              )}
              <p className="text-[1rem] font-semibold text-foreground/70">
                {prettyPhone(phone)}
              </p>
            </div>
          ) : (
            <Link
              href="/login"
              className="display mb-4 flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
            >
              Đăng nhập / Đăng ký
            </Link>
          )}

          {/* cỡ giao diện — auto theo máy là NỀN; chỉ bày 2 tùy chọn ghi đè */}
          <p className="mb-1.5 px-1 text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
            Cỡ giao diện
          </p>
          <p className="mb-2 px-1 text-[0.875rem] leading-snug text-foreground/70">
            {mode === "auto"
              ? "Đang tự theo cỡ chữ cài trong điện thoại. Muốn khác thì chọn:"
              : "Bấm lại lựa chọn để quay về tự theo máy."}
          </p>
          <div className="mb-4 overflow-hidden surface">
            {MODES.map((m, i) => {
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => applyMode(on ? "auto" : m.id)}
                  aria-pressed={on}
                  className={`flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                      on ? "border-sea bg-sea" : "border-line"
                    }`}
                    aria-hidden
                  >
                    {on && (
                      <span className="m-auto mt-1 block h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[1rem] font-bold text-navy">
                      {m.label}
                    </span>
                    <span className="block text-[0.8125rem] leading-snug text-foreground/70">
                      {m.sub}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bật thông báo (Web Push, 2026-07-28) — ẩn hẳn nếu máy không hỗ
              trợ hoặc server chưa cấu hình VAPID (không hiện nút vô dụng) */}
          {pushState !== "unsupported" && pushState !== "unconfigured" && (
            <button
              type="button"
              onClick={togglePush}
              disabled={pushState === "checking" || pushState === "busy"}
              className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl bg-field px-4 text-left disabled:opacity-60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
                <BellIcon className="h-5 w-5 text-navy" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-bold text-navy">
                  {pushState === "on" ? "Đã bật thông báo" : "Bật thông báo"}
                </span>
                <span className="block text-[0.8125rem] leading-snug text-foreground/70">
                  {pushState === "on"
                    ? "Nhấn để tắt trên máy này"
                    : "Nhận tin nhắn từ SDVICO ngay trên điện thoại"}
                </span>
              </span>
            </button>
          )}
          {pushError && (
            <p className="-mt-2.5 mb-4 px-1 text-[0.8125rem] font-semibold text-danger">
              {pushError}
            </p>
          )}

          {/* Lối vào TRANG QUẢN TRỊ — chỉ STAFF thấy (isStaff dò từ
              /api/admin/health). Ngư dân thường không thấy; quyền thật vẫn ở API. */}
          {isStaff && (
            <Link
              href="/quan-tri"
              onClick={() => setOpen(false)}
              className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left surface"
            >
              <span className="min-w-0 flex-1 text-[1rem] font-bold text-navy">
                Trang quản trị
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
            </Link>
          )}

          {/* Chính sách quyền riêng tư — công khai, luôn tới được (App Store
              5.1.2 bắt buộc app có link trong ứng dụng, không chỉ trong hồ sơ). */}
          <Link
            href="/quyen-rieng-tu"
            onClick={() => setOpen(false)}
            className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left surface"
          >
            <span className="min-w-0 flex-1 text-[1rem] font-bold text-navy">
              Chính sách quyền riêng tư
            </span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
          </Link>

          {user && (
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                await supabase?.auth.signOut();
                setOpen(false);
                router.refresh();
              }}
              className="flex min-h-[3.25rem] w-full items-center justify-center rounded-full bg-field text-[1.0625rem] font-bold text-trim transition active:scale-[0.98]"
            >
              Đăng xuất
            </button>
          )}
        </BottomSheet>
      )}
    </>
  );
}
