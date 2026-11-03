"use client";

/*  HÀNG DUYỆT HỒ SƠ VỰA (spec 17 §12.4 + §12.6) — nằm đầu tab Chỗ bán. Vựa tự khai ở /tien/vua; nhân viên duyệt rồi
    hồ sơ mới hiện ở Chợ cá › Đầu mối cạnh danh bạ bên dưới. Từ chối BẮT lý do 3–300 chữ (bà con thấy nguyên văn);
    khoá: lý do tuỳ. Máy chủ: /api/admin/vua-profiles (quyền tab cho-ban: xem=view, đổi=edit). */

import { useCallback, useEffect, useState } from "react";
import { AdminSkeleton } from "@/components/admin/admin-nav";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { type TabPerms } from "@/lib/staff-permissions";
import { useEscape } from "@/lib/use-escape";
import { useLichSuDong } from "@/lib/dialog-focus";
import {
  isVuaKind,
  VUA_KIND_LABEL,
  VUA_MAX,
  VUA_STATUSES,
  type VuaAdminAction,
  type VuaStatus,
} from "@/lib/vua-profile";

type AdminVua = {
  phone: string;
  name: string;
  kind: string;
  province: string | null;
  address: string | null;
  species: string[];
  hours: string | null;
  contact: string | null;
  status: VuaStatus;
  statusNote: string | null;
  updatedAt: string;
  xacMinh: boolean;
};

const STATUS_LABEL: Record<VuaStatus, string> = {
  cho_duyet: "Chờ duyệt",
  hoat_dong: "Đang hiện",
  tu_choi: "Đã từ chối",
  tam_khoa: "Đang khoá",
};

const LOI: Record<string, string> = {
  need_reason: "Cần ghi lý do từ chối (3–300 chữ).",
  note_too_long: "Lý do dài quá 300 chữ.",
  no_change: "Hồ sơ đã ở trạng thái này rồi.",
  changed: "Hồ sơ vừa được người khác đổi — đã tải lại.",
  not_found: "Không thấy hồ sơ này nữa.",
  no_permission: "Bạn chưa có quyền sửa mục này.",
};

export function VuaQueue({ perms }: { perms: TabPerms }) {
  const [st, setSt] = useState<VuaStatus>("cho_duyet");
  const [list, setList] = useState<AdminVua[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [hoiLyDo, setHoiLyDo] = useState<{ v: AdminVua; action: "tu-choi" | "khoa" } | null>(null);

  const load = useCallback(() => {
    setList(null);
    fetch(apiUrl(`/api/admin/vua-profiles?status=${st}`), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as { ok?: boolean; code?: string; profiles?: AdminVua[] } | null;
        if (!j?.ok) throw new Error(j?.code ?? "load");
        setList(j.profiles ?? []);
      })
      .catch((e: Error) => {
        setList([]);
        setError(
          e.message === "migration_needed"
            ? "Chưa có bảng hồ sơ vựa — cần chạy migration 0079 trước."
            : "Chưa tải được hồ sơ vựa. Vui lòng thử lại.",
        );
      });
  }, [st]);
  useEffect(load, [load]);

  async function doi(v: AdminVua, action: VuaAdminAction, note?: string): Promise<boolean> {
    setBusy(v.phone);
    setError(null);
    try {
      const r = await fetch(apiUrl("/api/admin/vua-profiles"), {
        method: "PATCH",
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ phone: v.phone, action, note }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
      if (!j?.ok) {
        setError(LOI[j?.code ?? ""] ?? "Không lưu được thay đổi. Vui lòng thử lại.");
        if (j?.code === "changed" || j?.code === "no_change") load();
        return false;
      }
      load();
      return true;
    } catch {
      setError("Không lưu được thay đổi. Vui lòng thử lại.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-card p-4">
      <h2 className="display text-[1.25rem] font-bold text-navy">Hồ sơ vựa tự khai</h2>
      <p className="mt-1 text-[0.875rem] text-foreground/70">
        Vựa, nậu, nhà máy, chợ tự gửi trong app. Duyệt xong hồ sơ hiện ở Chợ cá › Đầu mối. Chủ đổi tên, loại, tỉnh, địa
        chỉ hay SĐT thì hồ sơ quay lại chờ duyệt.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {VUA_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setError(null);
              setSt(s);
            }}
            className={`rounded-full px-3.5 py-1.5 text-[0.875rem] font-bold ${
              st === s ? "bg-navy text-white" : "bg-field text-foreground/70"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-danger-bg px-3 py-2 text-[0.9375rem] font-semibold text-danger">{error}</p>
      )}
      {list === null && (
        <div className="mt-3">
          <AdminSkeleton label="Đang tải hồ sơ vựa…" rows={2} />
        </div>
      )}
      {list?.length === 0 && !error && (
        <p className="mt-3 rounded-xl bg-field px-3 py-3 text-[0.9375rem] text-muted">
          Không có hồ sơ nào {STATUS_LABEL[st].toLowerCase()}.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {(list ?? []).map((v) => (
          <div key={v.phone} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="rounded-full bg-t2-bg px-2 py-0.5 text-[0.75rem] font-bold text-t2">
                {isVuaKind(v.kind) ? VUA_KIND_LABEL[v.kind] : v.kind}
              </span>
              <span className="text-[1rem] font-bold text-navy">{v.name}</span>
              {v.xacMinh && (
                <span className="rounded-full bg-ok-bg px-2 py-0.5 text-[0.75rem] font-bold text-ok">Đã xác minh</span>
              )}
              {v.province && <span className="text-[0.8125rem] text-muted">{v.province}</span>}
            </div>
            <p className="mt-1 text-[0.8125rem] tabular-nums text-muted">
              Tài khoản {v.phone}
              {v.contact && v.contact !== v.phone ? ` · liên hệ ${v.contact}` : ""}
            </p>
            {v.address && <p className="text-[0.8125rem] text-foreground/70">{v.address}</p>}
            {v.species.length > 0 && <p className="text-[0.8125rem] text-foreground/70">Mua: {v.species.join(", ")}</p>}
            {v.hours && <p className="text-[0.8125rem] text-foreground/70">Giờ: {v.hours}</p>}
            {v.statusNote && <p className="mt-1 text-[0.8125rem] font-semibold text-warn">Lý do: {v.statusNote}</p>}

            {perms.edit && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {v.status !== "hoat_dong" && (
                  <button
                    type="button"
                    disabled={busy === v.phone}
                    onClick={() => void doi(v, "duyet")}
                    className="rounded-lg bg-ok-bg px-3 py-1.5 text-[0.8125rem] font-semibold text-ok disabled:opacity-50"
                  >
                    {v.status === "tam_khoa" ? "Mở khoá" : "Duyệt"}
                  </button>
                )}
                {v.status !== "tu_choi" && v.status !== "tam_khoa" && (
                  <button
                    type="button"
                    disabled={busy === v.phone}
                    onClick={() => setHoiLyDo({ v, action: "tu-choi" })}
                    className="rounded-lg bg-warn-bg px-3 py-1.5 text-[0.8125rem] font-semibold text-warn disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                )}
                {v.status !== "tam_khoa" && (
                  <button
                    type="button"
                    disabled={busy === v.phone}
                    onClick={() => setHoiLyDo({ v, action: "khoa" })}
                    className="rounded-lg bg-danger-bg px-3 py-1.5 text-[0.8125rem] font-semibold text-danger disabled:opacity-50"
                  >
                    Khoá
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {hoiLyDo && (
        <LyDoDialog
          title={hoiLyDo.action === "tu-choi" ? `Từ chối “${hoiLyDo.v.name}”?` : `Khoá “${hoiLyDo.v.name}”?`}
          batBuoc={hoiLyDo.action === "tu-choi"}
          busy={busy === hoiLyDo.v.phone}
          onCancel={() => setHoiLyDo(null)}
          onConfirm={async (note) => {
            if (await doi(hoiLyDo.v, hoiLyDo.action, note)) setHoiLyDo(null);
          }}
        />
      )}
    </section>
  );
}

function LyDoDialog({
  title,
  batBuoc,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  batBuoc: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  // Back của máy / Escape / chạm nền đóng hộp trước (03 §6 mục 10). Hộp ở lại tới khi máy chủ nhận (cha gỡ).
  const { dongTay } = useLichSuDong(onCancel);
  useEscape(true, dongTay);
  const [note, setNote] = useState("");
  const t = note.trim();
  const hopLe = t.length <= VUA_MAX.note && (!batBuoc || t.length >= VUA_MAX.noteMin);
  return (
    <div role="presentation" className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4" onClick={dongTay}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[27.5rem] rounded-2xl bg-card p-5"
      >
        <p className="display text-[1.25rem] font-bold text-navy">{title}</p>
        <label className="mt-3 block">
          <span className="text-[0.8125rem] font-semibold text-foreground/70">
            {batBuoc ? "Lý do (bắt buộc, bà con sẽ thấy)" : "Lý do (không bắt buộc, bà con sẽ thấy)"}
          </span>
          <textarea
            value={note}
            maxLength={VUA_MAX.note}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-[0.9375rem]"
          />
        </label>
        <p className="mt-1 text-right text-[0.75rem] text-muted">
          {t.length}/{VUA_MAX.note}
          {batBuoc && t.length < VUA_MAX.noteMin ? ` · ít nhất ${VUA_MAX.noteMin} chữ` : ""}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={dongTay}
            className="min-h-[3rem] rounded-full bg-field text-[1rem] font-bold text-foreground/70"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={!hopLe || busy}
            onClick={() => onConfirm(t)}
            className="min-h-[3rem] rounded-xl bg-danger text-[1rem] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang lưu…" : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
