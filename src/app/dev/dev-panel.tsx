"use client";

// Bảng persona dev (12 §6.4): liệt kê persona + shop, nút Đăng nhập → POST
// /api/dev/login → saveToken(token, tier, null) + applyIdentityAction("SIGNED_IN", true, phone) → router.push theo vai; Đăng
// xuất = signOutLocal("user"). API 404 ⇒ "Chỉ dùng khi chạy MARKET_STORE=file".
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockIcon } from "@/components/icons";
import { PrimaryButton } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { readToken, saveToken, signOutLocal, tokenHeader } from "@/lib/device-token-store";
import { applyIdentityAction } from "@/lib/offline-identity";
import type { DevPersona, ShopStatus } from "@/lib/market/types";

type PersonaRow = DevPersona & {
  shop: { id: string; name: string; slug: string; status: ShopStatus; paused: boolean } | null;
};
type State =
  | { kind: "loading" }
  | { kind: "off" }
  | { kind: "error"; msg: string }
  | { kind: "ok"; items: PersonaRow[]; me: DevPersona | null };

const ROLE_LABEL: Record<DevPersona["role"], string> = { buyer: "Người mua", seller: "Người bán", admin: "Quản trị" };
const SHOP_LABEL: Record<ShopStatus, string> = { cho_duyet: "Chờ duyệt", hoat_dong: "Đang hoạt động", tam_khoa: "Tạm khoá", tu_choi: "Bị từ chối" };
const HOME: Record<DevPersona["role"], string> = { buyer: "/cho", seller: "/ban-hang", admin: "/quan-tri" };

export function DevPanel() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(apiUrl("/api/dev/personas"), { headers: tokenHeader(), signal: timeoutSignal(12000), cache: "no-store" });
      if (res.status === 404) return setState({ kind: "off" });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; items?: PersonaRow[]; me?: DevPersona | null } | null;
      if (!res.ok || !body?.ok || !Array.isArray(body.items)) return setState({ kind: "error", msg: `Máy chủ trả ${res.status}` });
      setState({ kind: "ok", items: body.items, me: body.me ?? null });
    } catch {
      setState({ kind: "error", msg: "Không gọi được máy chủ dev — server có đang chạy không?" });
    }
    setHasToken(!!readToken());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function login(p: PersonaRow) {
    setBusy(p.phone);
    setNote(null);
    try {
      const res = await fetch(apiUrl("/api/dev/login"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: p.phone }),
        signal: timeoutSignal(12000),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; token?: string; persona?: DevPersona } | null;
      if (!res.ok || !body?.ok || !body.token || !body.persona) {
        setNote(`Đăng nhập hỏng (${res.status}).`);
        return;
      }
      if (!saveToken(body.token, body.persona.tier, null)) {
        setNote("Máy không giữ được chuỗi đăng nhập — thử lại.");
        return;
      }
      /*  GHI DANH TÍNH như /login thật (F-29, audit E1): không có dòng này thì
          `useAuthUser().phone` = null ⇒ giỏ/địa chỉ/yêu thích/bản lưu đơn của
          persona rơi vào ngăn khách lạ dù API nhận đúng người. Đi qua cổng
          `applyIdentityAction` (K7 — người ghi duy nhất của sổ danh tính). */
      applyIdentityAction("SIGNED_IN", true, body.persona.phone);
      router.push(HOME[body.persona.role]);
    } catch {
      setNote("Không gọi được máy chủ dev.");
    } finally {
      setBusy(null);
    }
  }

  function logout() {
    signOutLocal("user");
    setHasToken(false);
    setNote("Đã đăng xuất khỏi máy này.");
    void load();
  }

  if (state.kind === "loading") {
    return <p className="px-4 py-6 text-[1.125rem] text-foreground/70">Đang tải persona…</p>;
  }
  if (state.kind === "off") {
    return (
      <div className="px-4 py-4">
        <StatusBanner level="warn">Chỉ dùng khi chạy `MARKET_STORE=file npm run dev` (hoặc `npm run dev:cho`).</StatusBanner>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="px-4 py-4">
        <StatusBanner level="danger">{state.msg}</StatusBanner>
        <PrimaryButton className="mt-4" onClick={() => void load()}>Thử lại</PrimaryButton>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8">
      {state.me ? (
        <StatusBanner level="ok">
          Máy này đang là {state.me.name} · {state.me.phone} ({ROLE_LABEL[state.me.role]}) — identityFromRequest đi qua nhánh dev.
        </StatusBanner>
      ) : hasToken ? (
        <StatusBanner level="warn">Máy có chuỗi nhưng máy chủ không nhận — đăng xuất rồi đăng nhập lại.</StatusBanner>
      ) : (
        <StatusBanner level="neutral">Chưa đăng nhập. Chọn một persona bên dưới.</StatusBanner>
      )}
      {note && <p className="mt-3 text-[1rem] font-bold text-navy">{note}</p>}

      <ul className="mt-4 flex flex-col gap-2">
        {state.items.map((p) => (
          <li key={p.phone} className="surface flex min-h-[3.5rem] items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[1.125rem] font-bold text-navy">{p.name}</p>
              <p className="text-[1rem] text-foreground/70">
                {ROLE_LABEL[p.role]} · {p.phone} · {p.tier === "premium" ? "premium" : "basic"}
              </p>
              {p.shop && (
                <p className="text-[1rem] text-foreground/70">
                  Shop: {p.shop.name} — {SHOP_LABEL[p.shop.status]}{p.shop.paused ? " · tạm nghỉ" : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              className={SQ_BTN}
              style={{ backgroundColor: "var(--t4-bg)", color: "var(--t4)" }}
              disabled={busy !== null}
              onClick={() => void login(p)}
              aria-label={`Đăng nhập ${p.name}`}
            >
              <LockIcon className="h-6 w-6" />
              {busy === p.phone ? "Đang…" : "Đăng nhập"}
            </button>
          </li>
        ))}
      </ul>

      {hasToken && (
        <PrimaryButton className="mt-6" onClick={logout}>Đăng xuất khỏi máy này</PrimaryButton>
      )}
    </div>
  );
}
