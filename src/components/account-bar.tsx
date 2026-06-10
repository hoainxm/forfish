"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Thanh tài khoản nhỏ: nếu đã đăng nhập → hiện số điện thoại + nút "Đăng xuất";
 * nếu chưa → một liên kết nhỏ "Đăng nhập". Khi chưa cấu hình Supabase thì
 * coi như chưa đăng nhập (vẫn cho vào /login để thấy thông báo bình tĩnh).
 */
export function AccountBar() {
  const router = useRouter();
  const supabase = createClient();
  const [phone, setPhone] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let active = true;

    // SĐT lấy từ phần local của email ảo: 84xxx...@phone.forfish.app → 84xxx...
    const extract = (user: { email?: string | null; phone?: string | null } | null) =>
      user?.phone || (user?.email ? user.email.split("@")[0] : null);

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setPhone(extract(data.user));
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setPhone(extract(session?.user ?? null));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  if (!ready) return null;

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setPhone(null);
    router.replace("/login");
  }

  /** 84901234567 / +84... → 0901 234 567 cho dễ đọc. */
  function prettyPhone(p: string): string {
    let local = p.replace(/\D/g, "");
    if (local.startsWith("84")) local = "0" + local.slice(2);
    else if (!local.startsWith("0")) local = "0" + local;
    return local.replace(/(\d{4})(\d{3})(\d{0,3})/, "$1 $2 $3").trim();
  }

  if (!phone) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-[16px] font-bold text-sea"
      >
        Đăng nhập
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-[16px] font-semibold text-foreground/80">
        {prettyPhone(phone)}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-[16px] font-bold text-trim"
      >
        Đăng xuất
      </button>
    </div>
  );
}
