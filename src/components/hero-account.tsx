"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ChevronRightIcon, UsersIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth";

/*
  Tài khoản trên hero — GỌN (sửa 2026-06-11 theo góp ý "design thô"):
  hero chỉ bày MỘT chip kính mờ; mọi thứ phụ (cỡ giao diện, đăng xuất)
  nằm trong SHEET TÀI KHOẢN — cái gì trực tiếp thì show, còn lại menu phụ.

  Cỡ giao diện: MẶC ĐỊNH "Theo máy" — ăn theo cỡ chữ cài trong điện thoại
  (không đặt font gốc); "Chữ to"/"Gọn" là khóa tay (xem globals.css).
*/

const MODE_KEY = "forfish.displaymode.v1";

type Mode = "auto" | "to" | "gon";

// "Theo máy" là TRẠNG THÁI NỀN (auto) — không bày thành lựa chọn (góp ý
// user 2026-06-11). Chỉ 2 tùy chọn ghi đè; bấm lại cái đang chọn = về auto.
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

export function HeroAccount() {
  const router = useRouter();
  const { user, phone, ready } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");

  useEffect(() => {
    try {
      const m = window.localStorage.getItem(MODE_KEY);
      if (m === "to" || m === "gon") setMode(m);
    } catch {
      // storage bị chặn — dùng mặc định
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
