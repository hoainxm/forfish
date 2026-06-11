"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth";

/*
  Dòng tài khoản NẰM TRONG HERO trang chủ (sửa 2026-06-11 — trước đây SĐT +
  Đăng xuất trôi mồ côi dưới thẻ tàu, không thuộc về đâu):
  · đã đăng nhập → "Bác <tên> · 09xx xxx xxx" + Đăng xuất, chữ trắng mờ
  · chưa → nút Đăng nhập kiểu kính mờ trên nền hero
*/

function prettyPhone(p: string): string {
  let local = p.replace(/\D/g, "");
  if (local.startsWith("84")) local = "0" + local.slice(2);
  else if (!local.startsWith("0")) local = "0" + local;
  return local.replace(/(\d{4})(\d{3})(\d{0,3})/, "$1 $2 $3").trim();
}

export function HeroAccount() {
  const router = useRouter();
  const { user, phone, ready } = useAuthUser();

  if (!ready) return <div className="mt-3 h-[44px]" aria-hidden />;

  if (!user || !phone) {
    return (
      <Link
        href="/login"
        className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-white/15 px-5 text-[16px] font-bold text-white backdrop-blur-sm transition active:scale-[0.97]"
      >
        Đăng nhập / Đăng ký
      </Link>
    );
  }

  const name = (user.user_metadata?.full_name as string | undefined)?.trim();

  return (
    <div className="mt-3 flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-[16px] font-semibold text-white/85">
        {name ? `Bác ${name} · ` : ""}
        {prettyPhone(phone)}
      </span>
      <button
        type="button"
        onClick={async () => {
          const supabase = createClient();
          await supabase?.auth.signOut();
          router.refresh();
        }}
        className="min-h-[44px] rounded-full px-2 text-[15px] font-bold text-white/70 underline underline-offset-4"
      >
        Đăng xuất
      </button>
    </div>
  );
}
