"use client";

/*  NÚT "XÁC MINH THU MUA" ở hàng khách tab Tài khoản (spec 17 §5 + §12.6). Tự chứa: tải MỘT lần danh sách SĐT đã xác
    minh (GET /api/admin/accounts/xac-minh) cho mọi hàng, bật/tắt bằng PATCH cùng route — nhật ký ghi ở máy chủ.
    Bật = bà con thấy dấu "Xác minh" cạnh tin mua và hồ sơ vựa của người này. */

import { useEffect, useState, useSyncExternalStore } from "react";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";

type Kho = { phones: Set<string> | null; loi: string | null };
let kho: Kho = { phones: null, loi: null };
let dangTai: Promise<void> | null = null;
const nghe = new Set<() => void>();
const bao = () => nghe.forEach((f) => f());

function napKho(): Promise<void> {
  if (dangTai) return dangTai;
  dangTai = fetch(apiUrl("/api/admin/accounts/xac-minh"), { headers: tokenHeader() })
    .then(async (r) => {
      const j = (await r.json().catch(() => null)) as { ok?: boolean; code?: string; phones?: string[] } | null;
      if (!j?.ok) throw new Error(j?.code ?? "load");
      kho = { phones: new Set(j.phones ?? []), loi: null };
    })
    .catch((e: Error) => {
      kho = { phones: null, loi: e.message === "migration_needed" ? "Chưa chạy migration 0079" : "Chưa tải được" };
    })
    .finally(() => {
      dangTai = null;
      bao();
    });
  return dangTai;
}

function useKho(): Kho {
  return useSyncExternalStore(
    (f) => {
      nghe.add(f);
      return () => nghe.delete(f);
    },
    () => kho,
    () => kho,
  );
}

export function XacMinhThuMua({ phone, editable }: { phone: string; editable: boolean }) {
  const k = useKho();
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => {
    if (!k.phones && !k.loi) void napKho();
  }, [k.phones, k.loi]);

  if (k.loi) return <span className="text-[0.75rem] text-muted">Xác minh thu mua: {k.loi}</span>;
  if (!k.phones) return <span className="text-[0.75rem] text-muted">Xác minh thu mua…</span>;

  const on = k.phones.has(phone);
  const cls = on ? "bg-ok-bg text-ok" : "bg-field text-muted";
  const label = on ? "Đã xác minh thu mua" : "Chưa xác minh thu mua";

  async function doi() {
    setBusy(true);
    setLoi(null);
    try {
      const r = await fetch(apiUrl("/api/admin/accounts/xac-minh"), {
        method: "PATCH",
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ phone, on: !on }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean } | null;
      if (!j?.ok) throw new Error();
      const next = new Set(kho.phones ?? []);
      if (on) next.delete(phone);
      else next.add(phone);
      kho = { phones: next, loi: null };
      bao();
    } catch {
      setLoi("Chưa lưu được, thử lại");
    } finally {
      setBusy(false);
    }
  }

  if (!editable)
    return (
      <span className={`inline-flex min-h-[2rem] items-center rounded-full px-3 text-[0.75rem] font-bold ${cls}`}>{label}</span>
    );
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy}
        onClick={doi}
        className={`inline-flex min-h-[2rem] items-center rounded-full px-3 text-[0.75rem] font-bold transition disabled:opacity-50 ${cls}`}
      >
        {busy ? "Đang lưu…" : label}
      </button>
      {loi && <span className="text-[0.75rem] font-semibold text-danger">{loi}</span>}
    </>
  );
}
