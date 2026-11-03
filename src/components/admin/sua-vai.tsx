"use client";

/*  Ô SỬA VAI ở hàng khách tab Tài khoản (spec 17 §3.3 — vai khoá trong app, chọn nhầm thì nhân viên sửa ở đây).
    Chọn vai mới ⇒ hiện nút Lưu (không ghi ngay khi chạm nhầm ô chọn) ⇒ PATCH /api/admin/accounts/vai, nhật ký ghi ở
    máy chủ ⇒ báo cha tải lại danh sách. */

import { useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { VAI, type Vai } from "@/lib/vai";

export function SuaVai({
  phone,
  vai,
  editable,
  onDone,
}: {
  phone: string;
  vai: Vai | null;
  editable: boolean;
  onDone: () => void;
}) {
  const [chon, setChon] = useState<Vai | "">(vai ?? "");
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  if (!editable) return null;
  const doi = (chon || null) !== vai;

  async function luu() {
    setBusy(true);
    setLoi(null);
    try {
      const r = await fetch(apiUrl("/api/admin/accounts/vai"), {
        method: "PATCH",
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ phone, vai: chon || null }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
      if (!j?.ok) throw new Error(j?.code ?? "luu");
      onDone();
    } catch (e) {
      setLoi((e as Error).message === "migration_needed" ? "Chưa chạy migration 0079" : "Chưa lưu được, thử lại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <label className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-muted">
        Vai
        <select
          value={chon}
          onChange={(e) => setChon(e.target.value as Vai | "")}
          disabled={busy}
          className="min-h-[2rem] rounded-lg border border-line bg-card px-2 text-[0.8125rem] text-navy focus-visible:ring-2 focus-visible:ring-sea"
        >
          <option value="">Chưa chọn</option>
          {VAI.map((v) => (
            <option key={v.id} value={v.id}>
              {v.ten}
            </option>
          ))}
        </select>
      </label>
      {doi && (
        <button
          type="button"
          onClick={() => void luu()}
          disabled={busy}
          className="min-h-[2rem] rounded-full bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-60"
        >
          {busy ? "Đang lưu…" : "Lưu vai"}
        </button>
      )}
      {loi && <span className="text-[0.75rem] text-danger">{loi}</span>}
    </span>
  );
}
