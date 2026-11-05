"use client";

/*  Ô SĐT PHỤ ở hàng khách tab Tài khoản (migration 0084, anh Long 05/11: "cho phép 1 acc 2 sdt").
    Tàu trên S-Tracking đứng tên SĐT khác ⇒ nhân viên gõ SĐT đó vào đây ⇒ khối Giám sát hành trình của khách hiện thêm
    máy của SĐT phụ. Gõ ⇒ hiện nút Lưu (không ghi khi gõ dở); xoá trắng + Lưu = gỡ. PATCH /api/admin/accounts/sdt-phu. */

import { useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { isValidVnPhone, sanitizePhoneInput } from "@/lib/phone";

const LOI: Record<string, string> = {
  migration_needed: "Chưa chạy migration 0084",
  bad_sdt_phu: "SĐT chưa đúng",
  trung_sdt_chinh: "Trùng SĐT chính",
};

export function SuaSdtPhu({
  phone,
  sdtPhu,
  editable,
  onDone,
}: {
  phone: string;
  sdtPhu: string | null;
  editable: boolean;
  onDone: () => void;
}) {
  const [go, setGo] = useState(sdtPhu ?? "");
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  if (!editable) return sdtPhu ? <span className="text-[0.75rem] text-muted">SĐT phụ {sdtPhu}</span> : null;
  const doi = go !== (sdtPhu ?? "");
  const hopLe = go === "" || isValidVnPhone(go);

  async function luu() {
    setBusy(true);
    setLoi(null);
    try {
      const r = await fetch(apiUrl("/api/admin/accounts/sdt-phu"), {
        method: "PATCH",
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ phone, sdtPhu: go || null }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
      if (!j?.ok) throw new Error(j?.code ?? "luu");
      onDone();
    } catch (e) {
      setLoi(LOI[(e as Error).message] ?? "Chưa lưu được, thử lại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <label className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-muted">
        SĐT phụ
        <input
          inputMode="numeric"
          value={go}
          onChange={(e) => setGo(sanitizePhoneInput(e.target.value))}
          disabled={busy}
          placeholder="Chưa có"
          className="min-h-[2rem] w-[7.5rem] rounded-lg border border-line bg-card px-2 text-[0.8125rem] text-navy focus-visible:ring-2 focus-visible:ring-sea"
        />
      </label>
      {doi && (
        <button
          type="button"
          onClick={() => void luu()}
          disabled={busy || !hopLe}
          className="min-h-[2rem] rounded-full bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-60"
        >
          {busy ? "Đang lưu…" : go ? "Lưu SĐT" : "Gỡ SĐT"}
        </button>
      )}
      {loi && <span className="text-[0.75rem] text-danger">{loi}</span>}
    </span>
  );
}
