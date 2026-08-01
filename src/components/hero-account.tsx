"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  BellIcon,
  ChevronRightIcon,
  LockIcon,
  UsersIcon,
} from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { clearInbox } from "@/lib/inbox";
import { useAuthUser } from "@/lib/use-auth";
import { useFeatureAccess } from "@/lib/use-tier";
import { tierBadge } from "@/lib/tier";
import {
  fetchVapidPublicKey,
  getExistingPushSubscription,
  isPushSupported,
  subscribeToPush,
  syncPushAccount,
  type SyncPushResult,
  unsubscribeFromPush,
  detachPushAccount,
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
  // HẠNG CỦA TÔI (2026-08-01): premium gán ngoài đời ở /quan-tri, trong app
  // trước nay không có chỗ nào xác nhận ⇒ khách trả tiền phải vào Ra khơi thử
  // bật lớp Cá mới biết. `null` = chưa chắc, không bày gì (luật ở lib/tier.ts).
  const { access, premiumUntil } = useFeatureAccess();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("gon");
  const [pushState, setPushState] = useState<PushUiState>("checking");
  const [pushError, setPushError] = useState<string | null>(null);
  // Khoá VAPID lấy RUNTIME (DB-trước rồi env) — undefined = đang lấy.
  const [vapidKey, setVapidKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }
    let alive = true;
    fetchVapidPublicKey().then((key) => {
      if (!alive) return;
      setVapidKey(key);
      if (!key) {
        setPushState("unconfigured");
        return;
      }
      getExistingPushSubscription().then(
        (sub) => alive && setPushState(sub ? "on" : "off"),
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  /* GẮN MÁY ↔ TÀI KHOẢN có nói ra kết quả (2026-08-01p). Trước đây việc gắn
     chạy ngầm và im lặng, nên khi /quan-tri báo "chưa gán account nào" thì
     không ai biết hỏng ở khâu nào: chưa bật thông báo? máy chủ không đọc được
     phiên? hay mất sóng? Nay sheet Tài khoản nói thẳng. */
  const [attach, setAttach] = useState<SyncPushResult | null>(null);
  useEffect(() => {
    if (pushState !== "on" || !user) return;
    void syncPushAccount().then(setAttach);
  }, [pushState, user]);

  async function togglePush() {
    setPushError(null);
    if (pushState === "on") {
      setPushState("busy");
      await unsubscribeFromPush();
      setPushState("off");
      return;
    }
    if (!vapidKey) return; // chưa cấu hình khoá — nút đã ẩn/không bật
    setPushState("busy");
    const r = await subscribeToPush(vapidKey, phone);
    if (r.ok) {
      setPushState("on");
      // gắn ngay vào tài khoản đang đăng nhập, đừng đợi lần mở app sau
      void syncPushAccount().then(setAttach);
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
  const badge = tierBadge({ access, premiumUntil });

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
              {/* HẠNG — chỉ hiện khi đã CHẮC (tierBadge trả null lúc đang tra),
                  khỏi nháy "thường" rồi mới đổi thành "Premium" */}
              {badge && (
                <div className="mt-3 border-t border-line pt-3">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-[0.875rem] font-bold ${
                      badge.tone === "premium"
                        ? "bg-ok-bg text-ok"
                        : "bg-field text-foreground/75"
                    }`}
                  >
                    {badge.label}
                  </span>
                  <p className="mt-1.5 text-[0.875rem] leading-snug text-foreground/70">
                    {badge.detail}
                  </p>
                </div>
              )}
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
                    ? attach === "attached"
                      ? "Đã gắn với tài khoản này · nhấn để tắt"
                      : attach === "no-session"
                        ? "CHƯA gắn tài khoản — đăng nhập rồi mở lại app"
                        : attach === "failed"
                          ? "Chưa gắn được (mất sóng) — mở lại lúc có sóng"
                          : "Nhấn để tắt trên máy này"
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

          {/* Đổi mật khẩu tự nguyện (2026-07-29) — trang /doi-mat-khau hỏi
              mật khẩu hiện tại rồi mới cho đổi */}
          {user && (
            <Link
              href="/doi-mat-khau"
              onClick={() => setOpen(false)}
              className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl bg-field px-4 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
                <LockIcon className="h-5 w-5 text-navy" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-bold text-navy">
                  Đổi mật khẩu
                </span>
                <span className="block text-[0.8125rem] leading-snug text-foreground/70">
                  Đặt mật khẩu mới cho tài khoản của bạn
                </span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground/40" />
            </Link>
          )}

          {user && (
            <button
              type="button"
              onClick={async () => {
                // GỠ tài khoản khỏi máy này TRƯỚC khi mất phiên: máy vẫn nhận
                // thông báo chung, thôi nhận tin nhắm riêng. Tàu dùng chung
                // điện thoại thì tin của chủ tàu không được chạy tới máy đang
                // trong tay bạn thuyền. Bắn rồi quên — đăng xuất KHÔNG chờ nó.
                void detachPushAccount();
                // xoá hộp thư khỏi máy: tàu dùng chung điện thoại, thư của
                // người trước không được nằm lại cho người sau đọc
                clearInbox();
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
