"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Boat,
  loadBoats,
  loadCurrentBoatId,
  saveBoats,
  saveCurrentBoatId,
} from "@/lib/boats";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, PrimaryButton, inputClass } from "@/components/ui/primitives";
import { COASTAL_PROVINCES, REGION_LABEL } from "@/lib/region";
import { AnchorIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";

/*
  Quản lý nhiều tàu + chọn tàu đang xem. Mọi màn dữ liệu gắn theo tàu này.
  useBoats(): nguồn sự thật chung (hydrate sau mount). BoatSwitcher: thanh
  gọn hiển thị tàu hiện tại + đổi tàu + thêm tàu (khai báo mã tàu, cảng nhà).
*/

export function useBoats() {
  const [boats, setBoats] = useState<Boat[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const list = loadBoats();
    setBoats(list);
    const saved = loadCurrentBoatId();
    const cur = list.find((b) => b.id === saved) ?? list[0];
    setCurrentId(cur?.id ?? "");
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveBoats(boats);
  }, [boats, ready]);

  const setCurrent = useCallback((id: string) => {
    setCurrentId(id);
    saveCurrentBoatId(id);
  }, []);

  const addBoat = useCallback(
    (b: Boat) => {
      setBoats((prev) => [...prev, b]);
      setCurrent(b.id);
    },
    [setCurrent],
  );

  const updateBoat = useCallback((b: Boat) => {
    setBoats((prev) => prev.map((x) => (x.id === b.id ? b : x)));
  }, []);

  const current = boats.find((b) => b.id === currentId) ?? boats[0] ?? null;
  return { boats, current, currentId, ready, setCurrent, addBoat, updateBoat };
}

export function BoatSwitcher() {
  const { boats, current, setCurrent, addBoat, updateBoat } = useBoats();
  const [pick, setPick] = useState(false);
  const [form, setForm] = useState<Boat | null>(null);

  if (!current) return null;

  return (
    <div className="px-4 pt-3">
      <button
        onClick={() => setPick(true)}
        className="flex w-full items-center gap-2.5 rounded-xl bg-card px-3.5 py-2.5 shadow-sm ring-1 ring-line active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
          <AnchorIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[16px] font-bold text-navy">
            {current.name}
          </span>
          <span className="block truncate text-[13px] text-foreground/55">
            {current.maTau ? `Mã tàu: ${current.maTau}` : "Chưa có mã tàu"}
            {boats.length > 1 ? ` · ${boats.length} tàu` : ""}
          </span>
        </span>
        <ChevronRightIcon className="h-5 w-5 shrink-0 rotate-90 text-foreground/40" />
      </button>

      {pick && (
        <BottomSheet title="Chọn tàu" onClose={() => setPick(false)}>
          <ul className="space-y-2">
            {boats.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => {
                    setCurrent(b.id);
                    setPick(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3.5 py-3 text-left ${
                    b.id === current.id
                      ? "bg-navy text-white"
                      : "bg-card ring-1 ring-line"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-bold">
                      {b.name}
                    </span>
                    <span
                      className={`block truncate text-[13px] ${b.id === current.id ? "text-white/75" : "text-foreground/55"}`}
                    >
                      {b.maTau || "chưa có mã tàu"}
                    </span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setForm(b);
                      setPick(false);
                    }}
                    className={`shrink-0 rounded px-2 py-1 text-[14px] font-bold ${b.id === current.id ? "text-white underline" : "text-sea"}`}
                  >
                    Sửa
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              setForm({ id: `boat-${Date.now()}`, name: "" });
              setPick(false);
            }}
            className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line text-[16px] font-bold text-navy"
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
          onCancel={() => setForm(null)}
          onSave={(b) => {
            if (boats.some((x) => x.id === b.id)) updateBoat(b);
            else addBoat(b);
            setForm(null);
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
}: {
  initial: Boat;
  isNew: boolean;
  onCancel: () => void;
  onSave: (b: Boat) => void;
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
            className="min-h-[60px] rounded-lg border-2 border-line text-[18px] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit">Lưu tàu</PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}
