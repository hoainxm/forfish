"use client";

import { useState } from "react";
import { type Boat } from "@/lib/boats";
import { useBoats } from "@/lib/boat-store";
import { purgeBoatData } from "@/lib/boat-cascade";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, PrimaryButton, inputClass } from "@/components/ui/primitives";
import { COASTAL_PROVINCES, REGION_LABEL } from "@/lib/region";
import {
  AnchorIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

/*
  Quản lý nhiều tàu + chọn tàu đang xem. Mọi màn dữ liệu gắn theo tàu này.
  useBoats() = store dùng chung ở @/lib/boat-store (đổi tàu cập nhật MỌI màn
  ngay — ba-spec 08 NV3/R5). Re-export ở đây để các component cũ import quen.
  BoatSwitcher: thanh gọn hiển thị tàu hiện tại + đổi tàu + thêm tàu.
*/

export { useBoats };

export function BoatSwitcher() {
  const { boats, current, setCurrent, addBoat, updateBoat, removeBoat } =
    useBoats();
  const [pick, setPick] = useState(false);
  const [form, setForm] = useState<Boat | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Boat | null>(null);

  if (!current) return null;

  return (
    // chip tàu NỔI đè lên mép hero (tràn viền hiện đại) — mọi trang dùng chung
    <div className="relative z-10 -mt-6 px-4">
      <button
        onClick={() => setPick(true)}
        className="flex w-full items-center gap-2.5 surface px-3.5 py-2.5 active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
          <AnchorIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[1rem] font-bold text-navy">
            {current.name}
          </span>
          <span className="block truncate text-[0.8125rem] text-foreground/70">
            {current.maTau
              ? `Mã tàu: ${current.maTau}`
              : "Chạm để ghi tên, mã tàu"}
            {boats.length > 1 ? ` · ${boats.length} tàu` : ""}
          </span>
        </span>
        <ChevronRightIcon className="h-5 w-5 shrink-0 rotate-90 text-foreground/65" />
      </button>

      {pick && (
        <BottomSheet title="Chọn tàu" onClose={() => setPick(false)}>
          <ul className="space-y-2">
            {boats.map((b) => (
              <li key={b.id}>
                {/* 2 nút THẬT cạnh nhau (chọn tàu / sửa) — không lồng nút trong nút */}
                <div
                  className={`flex w-full items-stretch gap-1 rounded-xl ${
                    b.id === current.id ? "bg-navy text-white" : "bg-field"
                  }`}
                >
                  <button
                    onClick={() => {
                      setCurrent(b.id);
                      setPick(false);
                    }}
                    className="min-w-0 flex-1 rounded-l-xl px-3.5 py-3 text-left"
                  >
                    <span className="block truncate text-[1rem] font-bold">
                      {b.name}
                    </span>
                    <span
                      className={`block truncate text-[0.8125rem] ${b.id === current.id ? "text-white/75" : "text-foreground/70"}`}
                    >
                      {b.maTau || "chưa có mã tàu"}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setForm(b);
                      setPick(false);
                    }}
                    aria-label={`Sửa tàu ${b.name}`}
                    className={`shrink-0 rounded-r-xl px-3 text-[0.875rem] font-bold ${b.id === current.id ? "text-white underline" : "text-sea"}`}
                  >
                    Sửa
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              setForm({ id: `boat-${Date.now()}`, name: "" });
              setPick(false);
            }}
            className="mt-3 flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-field text-[1rem] font-bold text-navy"
          >
            <PlusIcon className="h-5 w-5" />
            Thêm tàu mới
          </button>
        </BottomSheet>
      )}

      {form && (
        <BoatForm
          initial={form}
          isNew={!boats.some((b) => b.id === form.id)}
          // Chỉ cho xóa tàu đã lưu và khi còn >1 tàu (R7: luôn ≥1 tàu).
          onDelete={
            boats.some((b) => b.id === form.id) && boats.length > 1
              ? () => {
                  const target = form;
                  setForm(null);
                  setConfirmDelete(target);
                }
              : undefined
          }
          onCancel={() => setForm(null)}
          onSave={(b) => {
            if (boats.some((x) => x.id === b.id)) updateBoat(b);
            else addBoat(b);
            setForm(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title={`Xóa tàu "${confirmDelete.name}"?`}
          message="Giấy tờ và lịch bảo dưỡng của riêng tàu này sẽ bị xóa. Thuyền viên và đồ đã mua SDVICO vẫn giữ (về của chung)."
          cancelLabel="Không xóa"
          confirmLabel="Xóa tàu"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            removeBoat(confirmDelete.id, purgeBoatData);
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}

function BoatForm({
  initial,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: {
  initial: Boat;
  isNew: boolean;
  onCancel: () => void;
  onSave: (b: Boat) => void;
  /** Có giá trị → hiện nút xóa tàu (chỉ khi tàu đã lưu + còn >1 tàu). */
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [maTau, setMaTau] = useState(initial.maTau ?? "");
  const [province, setProvince] = useState(initial.homeProvince ?? "");
  const [lengthM, setLengthM] = useState(
    initial.lengthM != null ? String(initial.lengthM) : "",
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      ...initial,
      name: name.trim(),
      maTau: maTau.trim() || undefined,
      homeProvince: province || undefined,
      lengthM: lengthM ? parseFloat(lengthM) : undefined,
    });
  }

  return (
    <BottomSheet title={isNew ? "Thêm tàu" : "Sửa thông tin tàu"} onClose={onCancel}>
      <form onSubmit={submit}>
        <Field label="Tên tàu (để dễ nhớ)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="VD: Tàu câu Bình Minh"
            required
          />
        </Field>
        <Field label="Mã tàu / số đăng ký">
          <input
            value={maTau}
            onChange={(e) => setMaTau(e.target.value)}
            className={inputClass}
            placeholder="VD: BV-1234-TS"
          />
        </Field>
        <Field label="Tỉnh cảng nhà (để hiện nơi gần tàu)">
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className={inputClass}
          >
            <option value="">— Chọn tỉnh —</option>
            {(["bac", "trung", "nam"] as const).map((rg) => (
              <optgroup key={rg} label={REGION_LABEL[rg]}>
                {COASTAL_PROVINCES.filter((p) => p.region === rg).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Chiều dài tàu (m) — nếu biết">
          <input
            value={lengthM}
            onChange={(e) => setLengthM(e.target.value)}
            className={inputClass}
            inputMode="decimal"
            placeholder="VD: 15"
          />
        </Field>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit">Lưu tàu</PrimaryButton>
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="mt-3 flex min-h-[3.25rem] w-full items-center justify-center gap-2 text-[1.0625rem] font-bold text-danger active:opacity-70"
          >
            <TrashIcon className="h-5 w-5" />
            Xóa tàu này
          </button>
        )}
      </form>
    </BottomSheet>
  );
}
