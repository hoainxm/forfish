"use client";

/*  Ô SỐ KHÁC ở hàng khách tab Tài khoản (0086 — thay ô SĐT phụ một số của 0084).
    ≤3 số / tài khoản: máy S-Tracking đứng tên số khác, mua hàng SDVICO bằng số khác… Một số đã duyệt chỉ thuộc một
    tài khoản. Số bà con tự gửi từ app hiện "chờ duyệt" + nút Duyệt (gọi xác nhận trước). × = gỡ.
    POST/DELETE /api/admin/accounts/sdt-khac. */

import { useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { isValidVnPhone, sanitizePhoneInput } from "@/lib/phone";
import { SDT_KHAC_TOI_DA } from "@/lib/sdt-khac";

export interface SoKhacDong {
  sdt: string;
  duyet: boolean;
  /** bà con tự gửi từ app */
  khach: boolean;
}

const LOI: Record<string, string> = {
  migration_needed: "Chưa chạy migration 0086",
  bad_sdt: "SĐT chưa đúng",
  trung_sdt_chinh: "Trùng SĐT chính",
  toi_da: `Đã đủ ${SDT_KHAC_TOI_DA} số`,
  da_co: "Số này đã có",
  khong_co_ho_so: "Tài khoản chưa có hồ sơ",
};

export function SuaSoKhac({
  phone,
  soKhac,
  editable,
  onDone,
}: {
  phone: string;
  soKhac: SoKhacDong[];
  editable: boolean;
  onDone: () => void;
}) {
  const [go, setGo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  /** số đang chờ nhân viên xác nhận "vẫn gắn" (số đó tự đăng nhập app như tài khoản riêng) */
  const [hoiLai, setHoiLai] = useState<string | null>(null);

  if (!editable)
    return soKhac.length ? (
      <span className="text-[0.75rem] text-muted">
        Số khác {soKhac.map((s) => `${s.sdt}${s.duyet ? "" : " (chờ duyệt)"}`).join(", ")}
      </span>
    ) : null;

  async function goi(method: "POST" | "DELETE", sdt: string, xacNhan = false) {
    setBusy(true);
    setLoi(null);
    try {
      const r = await fetch(apiUrl("/api/admin/accounts/sdt-khac"), {
        method,
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ phone, sdt, xacNhan }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; code?: string; cua?: string } | null;
      if (j?.code === "co_tai_khoan_rieng") return setHoiLai(sdt);
      if (j?.code === "da_gan_nguoi_khac") return setLoi(`Số này đang gắn với tài khoản ${j.cua ?? "khác"} — gỡ bên đó trước`);
      if (!j?.ok) throw new Error(j?.code ?? "luu");
      setHoiLai(null);
      setGo("");
      onDone();
    } catch (e) {
      setLoi(LOI[(e as Error).message] ?? "Chưa lưu được, thử lại");
    } finally {
      setBusy(false);
    }
  }

  const nut = "min-h-[2rem] rounded-full px-3 text-[0.8125rem] font-bold disabled:opacity-60";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-[0.75rem] font-semibold text-muted">Số khác</span>
      {soKhac.map((s) => (
        <span key={s.sdt} className="inline-flex items-center gap-1 rounded-full bg-field py-0.5 pl-2.5 pr-0.5 text-[0.8125rem] text-navy">
          {s.sdt}
          {!s.duyet && <span className="text-warn">· chờ duyệt</span>}
          {!s.duyet && (
            <button type="button" disabled={busy} onClick={() => void goi("POST", s.sdt)} className={`${nut} bg-navy text-white`}>
              Duyệt
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            aria-label={`Gỡ số ${s.sdt}`}
            onClick={() => void goi("DELETE", s.sdt)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted disabled:opacity-60"
          >
            ×
          </button>
        </span>
      ))}
      {soKhac.length < SDT_KHAC_TOI_DA && (
        <>
          <input
            inputMode="numeric"
            value={go}
            onChange={(e) => setGo(sanitizePhoneInput(e.target.value))}
            disabled={busy}
            placeholder="Thêm số"
            aria-label="Thêm số khác"
            className="min-h-[2rem] w-[7.5rem] rounded-lg border border-line bg-card px-2 text-[0.8125rem] text-navy focus-visible:ring-2 focus-visible:ring-sea"
          />
          {go && (
            <button type="button" onClick={() => void goi("POST", go)} disabled={busy || !isValidVnPhone(go)} className={`${nut} bg-navy text-white`}>
              {busy ? "Đang lưu…" : "Gắn số"}
            </button>
          )}
        </>
      )}
      {hoiLai && (
        <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-warn">
          Số {hoiLai} đang đăng nhập app riêng — gắn là hai tài khoản cùng thấy đồ của số này.
          <button type="button" disabled={busy} onClick={() => void goi("POST", hoiLai, true)} className={`${nut} bg-warn text-white`}>
            Vẫn gắn
          </button>
          <button type="button" disabled={busy} onClick={() => setHoiLai(null)} className={`${nut} bg-field text-navy`}>
            Thôi
          </button>
        </span>
      )}
      {loi && <span className="text-[0.75rem] text-danger">{loi}</span>}
    </span>
  );
}
