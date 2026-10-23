"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { AdminSkeleton } from "@/components/admin/admin-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { SELL_KINDS, SELL_KIND_LABEL, type SellContactDraft, type SellKind, validateSellContactDraft } from "@/lib/sell-contacts";
import { type TabPerms } from "@/lib/staff-permissions";
import { useCallback, useEffect, useState } from "react";
import { useEscape } from "@/lib/use-escape";

// ── Tab CHỖ BÁN — danh bạ "Bán ở đâu" (nậu vựa/chợ/nhà máy): sửa/ẩn/hiện/xóa/thêm ──

export type AdminSellContact = {
  id: string;
  kind: string;
  name: string;
  subLabel: string | null;
  province: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  species: string[];
  markets: string[];
  website: string | null;
  direct: boolean;
  visible: boolean;
  sortOrder: number;
};

export function SellContactsTab({ perms }: { perms: TabPerms }) {
  const [contacts, setContacts] = useState<AdminSellContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<SellKind | "all">("all");
  const [editing, setEditing] = useState<AdminSellContact | "new" | null>(null);
  const [toDelete, setToDelete] = useState<AdminSellContact | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setContacts(null);
    fetch(apiUrl("/api/admin/sell-contacts"), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          contacts?: AdminSellContact[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setContacts(j.contacts ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa kết nối được cơ sở dữ liệu (Supabase). Tính năng này yêu cầu chạy migration 0014_sell_contacts trước."
            : "Chưa tải được danh bạ. Vui lòng thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusyId(id);
      try {
        const r = await fetch(apiUrl("/api/admin/sell-contacts"), {
          method: "PATCH",
          headers: { "content-type": "application/json", ...tokenHeader() },
          body: JSON.stringify({ id, ...body }),
        });
        if (!((await r.json()) as { ok: boolean }).ok) throw new Error();
        load();
      } catch {
        setError("Không lưu được thay đổi. Vui lòng thử lại.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const r = await fetch(apiUrl(`/api/admin/sell-contacts?id=${id}`), {
          method: "DELETE",
          headers: tokenHeader(),
        });
        if (!((await r.json()) as { ok: boolean }).ok) throw new Error();
        load();
      } catch {
        setError("Xóa không thành công. Vui lòng thử lại.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  async function seedDefaults() {
    setSeeding(true);
    setError(null);
    try {
      const r = await fetch(apiUrl("/api/admin/sell-contacts"), {
        method: "POST",
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ action: "seed" }),
      });
      const j = (await r.json()) as { ok: boolean; code?: string };
      if (!j.ok) {
        setError(
          j.code === "not_empty"
            ? "Danh bạ đã có sẵn dữ liệu — hệ thống không hỗ trợ tải đè."
            : "Tải danh bạ mặc định không thành công.",
        );
      } else load();
    } finally {
      setSeeding(false);
    }
  }

  const shown = (contacts ?? []).filter(
    (c) => kindFilter === "all" || c.kind === kindFilter,
  );

  return (
    <section className="mt-5">
      <h2 className="display text-[1.375rem] font-bold text-navy">
        Danh bạ “Bán ở đâu”
      </h2>
      <p className="mt-1 text-[0.9375rem] text-foreground/70">
        Nậu vựa · Chợ đầu mối · Nhà máy hiện trong app ngư dân (mục Chợ cá →
        Bán ở đâu). Sửa / ẩn / hiện / xóa / thêm — áp dụng ngay. (“Mối quen” là
        sổ riêng của bà con, không quản lý ở đây.)
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-danger-bg px-3 py-2 text-[0.9375rem] font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["all", ...SELL_KINDS] as (SellKind | "all")[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={`rounded-full px-3.5 py-1.5 text-[0.875rem] font-bold ${
              kindFilter === k ? "bg-navy text-white" : "bg-field text-foreground/70"
            }`}
          >
            {k === "all" ? "Tất cả các loại" : SELL_KIND_LABEL[k]}
          </button>
        ))}
        {perms.create && (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="rounded-xl bg-sea px-4 py-2 text-[0.9375rem] font-bold text-white"
            >
              + Thêm đầu mối
            </button>
            {contacts?.length === 0 && (
              <button
                type="button"
                disabled={seeding}
                onClick={seedDefaults}
                className="rounded-xl bg-field px-4 py-2 text-[0.9375rem] font-bold text-navy disabled:opacity-50"
              >
                {seeding ? "Đang xử lý nạp dữ liệu…" : "Nạp danh bạ mặc định"}
              </button>
            )}
          </div>
        )}
      </div>

      {contacts === null && !error && (
        <div className="mt-3">
          <AdminSkeleton label="Đang tải thông tin…" rows={2} />
        </div>
      )}
      {contacts?.length === 0 && (
        <p className="mt-4 rounded-xl bg-field px-3 py-3 text-[0.9375rem] text-foreground/60">
          Danh bạ trống. Bấm “Nạp danh bạ mặc định” để đưa ~143 đầu mối có sẵn
          vào quản lý, hoặc tự thêm.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {shown.map((c) => (
          <div
            key={c.id}
            className={`rounded-xl border border-line bg-card p-3 ${
              c.visible ? "" : "opacity-60"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="rounded-full bg-t2-bg px-2 py-0.5 text-[0.75rem] font-bold text-t2">
                {SELL_KIND_LABEL[c.kind as SellKind] ?? c.kind}
              </span>
              <span className="text-[1rem] font-bold text-navy">{c.name}</span>
              {c.province && (
                <span className="text-[0.8125rem] text-foreground/60">
                  {c.province}
                </span>
              )}
              {c.phone && (
                <span className="text-[0.8125rem] tabular-nums text-foreground/60">
                  {c.phone}
                </span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {perms.edit && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="rounded-lg bg-field px-3 py-1.5 text-[0.8125rem] font-semibold text-sea"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => patch(c.id, { visible: !c.visible })}
                    className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold ${
                      c.visible ? "bg-field text-foreground/70" : "bg-warn-bg text-warn"
                    }`}
                  >
                    {c.visible ? "Đang hiển thị — chọn ẩn đi" : "Đang ẩn — chọn hiện lại"}
                  </button>
                </>
              )}
              {perms.delete && (
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => setToDelete(c)}
                  className="rounded-lg bg-danger-bg px-3 py-1.5 text-[0.8125rem] font-semibold text-danger"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <SellContactForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onError={setError}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Xóa đầu mối này khỏi danh bạ?"
          message={`Đối tác "${toDelete.name}" sẽ bị xóa khỏi danh bạ trên ứng dụng của ngư dân.`}
          confirmLabel="Xác nhận xóa"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            remove(toDelete.id);
            setToDelete(null);
          }}
        />
      )}
    </section>
  );
}

export function SellContactForm({
  initial,
  onClose,
  onSaved,
  onError,
}: {
  initial: AdminSellContact | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  useEscape(true, onClose); // rà bố cục 2026-10-22: hộp quản trị đóng được bằng Escape
  const [kind, setKind] = useState<SellKind>(
    (initial?.kind as SellKind) ?? "vua",
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [province, setProvince] = useState(initial?.province ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [hours, setHours] = useState(initial?.hours ?? "");
  const [species, setSpecies] = useState((initial?.species ?? []).join(", "));
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const draft: SellContactDraft = {
      kind,
      name,
      province: province.trim() || undefined,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      hours: hours.trim() || undefined,
      species: species
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      markets: initial?.markets ?? [],
      website: website.trim() || undefined,
      direct: initial?.direct ?? false,
      visible: initial?.visible ?? true,
    };
    const invalid = validateSellContactDraft(draft);
    if (invalid) {
      setMsg(invalid);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(apiUrl("/api/admin/sell-contacts"), {
        method: initial ? "PATCH" : "POST",
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify(initial ? { id: initial.id, ...draft } : draft),
      });
      if (!((await r.json()) as { ok: boolean }).ok) throw new Error();
      onSaved();
    } catch {
      onError("Lưu thông tin đầu mối không thành công. Vui lòng thử lại.");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-[27.5rem] overflow-y-auto rounded-2xl bg-card p-5"
      >
        <p className="display text-[1.25rem] font-bold text-navy">
          {initial ? "Sửa thông tin đầu mối" : "Thêm đầu mối mới"}
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <span className="text-[0.8125rem] font-semibold text-foreground/70">
              Nhóm
            </span>
            <div className="mt-1 flex gap-1.5">
              {SELL_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-lg px-2 py-2 text-[0.8125rem] font-semibold ${
                    kind === k ? "bg-navy text-white" : "bg-field text-foreground/70"
                  }`}
                >
                  {SELL_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <SellField label="Tên đầu mối (bắt buộc)" value={name} onChange={setName} />
          <SellField label="Tỉnh / Thành phố" value={province} onChange={setProvince} />
          <SellField label="Địa chỉ chi tiết" value={address} onChange={setAddress} />
          <SellField label="Số điện thoại liên hệ" value={phone} onChange={setPhone} />
          {kind === "cho" && (
            <SellField label="Thời gian họp chợ / giao dịch" value={hours} onChange={setHours} />
          )}
          <SellField
            label="Các loài hay thu mua (ngăn cách bằng dấu phẩy)"
            value={species}
            onChange={setSpecies}
          />
          {kind === "nhamay" && (
            <SellField
              label="Website"
              value={website}
              onChange={setWebsite}
            />
          )}
        </div>
        {msg && (
          <p className="mt-2 text-[0.875rem] font-semibold text-danger">{msg}</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[3rem] rounded-full bg-field text-[1rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="min-h-[3rem] rounded-xl bg-sea text-[1rem] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang lưu thông tin…" : "Lưu thông tin"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SellField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[0.8125rem] font-semibold text-foreground/70">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-[0.9375rem]"
      />
    </label>
  );
}
