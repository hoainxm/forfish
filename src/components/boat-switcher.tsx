"use client";

import { useState } from "react";
import {
  BOAT_PAPER_FIELDS,
  FISHING_ZONE_LABEL,
  HULL_MATERIAL_LABEL,
  VESSEL_CLASS_LABEL,
  countPaperFields,
  formatBoatNumber,
  kwToCv,
  parseBoatNumber,
  parseBuiltYear,
  type Boat,
  type FishingZone,
  type HullMaterial,
  type VesselClass,
} from "@/lib/boats";
import { useBoats } from "@/lib/boat-store";
import { purgeBoatData } from "@/lib/boat-cascade";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass } from "@/components/ui/primitives";
import { COASTAL_PROVINCES, REGION_LABEL } from "@/lib/region";
import { storageFullCopy } from "@/lib/user-store";
import {
  AnchorIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { useAuthUser } from "@/lib/use-auth";

/*
  Quản lý nhiều tàu + chọn tàu đang xem. Mọi màn dữ liệu gắn theo tàu này.
  useBoats() = store dùng chung ở @/lib/boat-store (đổi tàu cập nhật MỌI màn
  ngay — ba-spec 08 NV3/R5). Re-export ở đây để các component cũ import quen.
  BoatSwitcher: thanh gọn hiển thị tàu hiện tại + đổi tàu + thêm tàu.
*/

export { useBoats };

export function BoatSwitcher() {
  const { boats, current, ready, setCurrent, addBoat, updateBoat, removeBoat } =
    useBoats();
  const { signedIn, ready: authReady } = useAuthUser();
  const [pick, setPick] = useState(false);
  const [form, setForm] = useState<Boat | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Boat | null>(null);
  /*  Ghi hồ sơ tàu HỎNG (máy hết chỗ) — phải nói, không thì tàu hiện đúng trên
      màn hình rồi mở lại app là mất (2026-08-02h). */
  const [saveFailed, setSaveFailed] = useState(false);

  // Đang kiểm tra → đừng nháy UI.
  if (!ready || !authReady) return null;
  // Chưa đăng nhập → KHÔNG hiện quản lý tàu (data cá nhân). Ở /tau, các tab tự
  // hiện thẻ mời đăng nhập; ở đây ẩn hẳn để logged-out không thêm/sửa được tàu.
  if (!signedIn) return null;

  // Đã đăng nhập nhưng chưa có tàu → mời thêm tàu đầu tiên (không seed tàu mẫu).
  if (!current) {
    /*  Hàng chuẩn thay nút full-width (2026-08-29, luật A2/A3/A4): [thân cấp
        dữ liệu flex-1] + [ô nút w-16]. Nhãn bỏ chữ thừa "của bạn". */
    return (
      <div className="relative z-10 -mt-6 flex items-stretch gap-2 px-4">
        <div className="flex min-w-0 flex-1 items-center surface px-3.5 py-3">
          <p className="text-[1rem] font-bold text-navy">Chưa có thông tin tàu</p>
        </div>
        <button
          onClick={() => setForm({ id: `boat-${Date.now()}`, name: "" })}
          className={`${SQ_BTN} surface text-navy`}
        >
          <PlusIcon className="h-6 w-6" />
          Thêm tàu
        </button>
        {form && (
          <BoatForm
            initial={form}
            isNew
            onCancel={() => setForm(null)}
            onSave={(b) => {
              addBoat(b);
              setForm(null);
            }}
          />
        )}
      </div>
    );
  }

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

      {/*  MÁY HẾT CHỖ — vẽ NGOÀI sheet (S14, audit 2026-08-18): `saveFailed`
          được set lúc form đã đóng (`pick=false`), bản cũ chỉ vẽ trong
          `{pick && …}` nên lưu hỏng mà màn hình im, mở lại "Chọn tàu" mới thấy.
          Nay nằm ngay dưới chip tàu; lưu lại thành công là tự tắt. */}
      {saveFailed && (
        <div
          role="alert"
          className="mt-2 rounded-2xl bg-danger-bg px-4 py-3 text-[1rem] font-bold leading-snug text-danger"
        >
          {storageFullCopy("hồ sơ tàu")} Danh sách tàu và giấy tờ giữ NGUYÊN
          như cũ.
        </div>
      )}

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
                    aria-label={`Sửa thông tin tàu ${b.name}`}
                    className={`shrink-0 rounded-r-xl px-3 text-[0.875rem] font-bold ${b.id === current.id ? "text-white underline" : "text-sea"}`}
                  >
                    Sửa
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {/* Ô nút inline, không dải ngang ăn hàng (luật A2/A3) */}
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setForm({ id: `boat-${Date.now()}`, name: "" });
                setPick(false);
              }}
              className={`${SQ_BTN} bg-field text-navy`}
            >
              <PlusIcon className="h-6 w-6" />
              Thêm tàu
            </button>
          </div>
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
            /*  NÓI THẬT KHI MÁY HẾT CHỖ (2026-08-02h): trước đây bỏ kết quả
                nên tàu hiện đúng trên màn, mở lại app là mất. */
            const luuDuoc = boats.some((x) => x.id === b.id)
              ? updateBoat(b)
              : addBoat(b);
            setSaveFailed(!luuDuoc);
            setForm(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title={`Xóa tàu "${confirmDelete.name}"?`}
          message="Giấy tờ và lịch bảo dưỡng của tàu này sẽ bị xóa. Thuyền viên và đồ đã mua từ SDVICO vẫn được giữ lại."
          cancelLabel="Không xóa"
          confirmLabel="Xác nhận xóa"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            /*  Xoá hỏng cũng phải nói (2026-08-16): `removeBoat` nay ghi danh
                sách tàu TRƯỚC rồi mới xoá hồ sơ con, nên `false` = chưa xoá gì
                cả — màn hình giữ nguyên và bà con thấy đúng câu vì sao. */
            setSaveFailed(!removeBoat(confirmDelete.id, purgeBoatData));
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}

/* Ô "theo giấy tờ" dạng chữ trong form — số/năm parse khi Lưu (parseBoatNumber).
   Trần từng ô số đặt rộng rãi (chỉ chặn gõ nhầm kiểu thêm 2 số 0), KHÔNG phải
   luật đăng kiểm. */
type PaperKey = (typeof BOAT_PAPER_FIELDS)[number];
type Draft = Record<PaperKey | "lengthM", string>;

const NUMBER_RULES: Partial<Record<keyof Draft, { max: number; int?: boolean }>> = {
  lengthM: { max: 100 },
  breadthM: { max: 30 },
  depthM: { max: 20 },
  draughtM: { max: 15 },
  grossTonnage: { max: 5000 },
  deadweightT: { max: 5000 },
  engineKw: { max: 10000 },
  crewMax: { max: 100, int: true },
  engineCount: { max: 10, int: true },
};

function draftOf(b: Boat): Draft {
  const num = (n: number | undefined) => formatBoatNumber(n);
  return {
    lengthM: num(b.lengthM),
    ownerName: b.ownerName ?? "",
    callSign: b.callSign ?? "",
    regPort: b.regPort ?? "",
    gear: b.gear ?? "",
    fishingZone: b.fishingZone ?? "",
    vesselClass: b.vesselClass ?? "",
    hullMaterial: b.hullMaterial ?? "",
    builtYear: b.builtYear != null ? String(b.builtYear) : "",
    builtPlace: b.builtPlace ?? "",
    crewMax: num(b.crewMax),
    grossTonnage: num(b.grossTonnage),
    deadweightT: num(b.deadweightT),
    breadthM: num(b.breadthM),
    depthM: num(b.depthM),
    draughtM: num(b.draughtM),
    engineModel: b.engineModel ?? "",
    engineSerial: b.engineSerial ?? "",
    engineKw: num(b.engineKw),
    engineCount: num(b.engineCount),
  };
}

const BAD_NUMBER = "Số chưa đúng — chỉ gõ số, phần lẻ dùng dấu phẩy (VD 5,25).";

export function BoatForm({
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
  const [d, setD] = useState<Draft>(() => draftOf(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  /*  CÁC Ô THEO GIẤY THU LẠI MẶC ĐỊNH (luật C1/C2 — sheet không quá ~40% màn).
      Tàu ĐÃ ghi ô nào thì mở sẵn — không giấu thứ bà con đã nhập. */
  const [showPaper, setShowPaper] = useState(countPaperFields(initial) > 0);
  const filled = countPaperFields({ ...initial, ...draftAsLoose(d) });

  const set = (k: keyof Draft) => (v: string) => {
    setD((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    /*  KIỂM Ở RANH GIỚI (CLAUDE.md quy tắc 4): số gõ sai thì NÓI và KHÔNG lưu,
        đừng lặng lẽ cắt "55,60" thành 55 như parseFloat cũ. */
    const errs: Partial<Record<keyof Draft, string>> = {};
    const nums: Partial<Record<keyof Draft, number | undefined>> = {};
    for (const [k, rule] of Object.entries(NUMBER_RULES) as [keyof Draft, { max: number; int?: boolean }][]) {
      const r = parseBoatNumber(d[k], rule.max);
      if (!r.ok || (rule.int && r.value != null && !Number.isInteger(r.value))) {
        errs[k] = BAD_NUMBER;
      } else nums[k] = r.value;
    }
    const year = parseBuiltYear(d.builtYear, new Date().getFullYear());
    if (!year.ok) errs.builtYear = "Năm đóng gõ đủ 4 số (VD 2018).";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      if (Object.keys(errs).some((k) => k !== "lengthM")) setShowPaper(true);
      return;
    }
    const txt = (v: string) => v.trim() || undefined;
    onSave({
      ...initial,
      name: name.trim(),
      maTau: maTau.trim() || undefined,
      homeProvince: province || undefined,
      lengthM: nums.lengthM,
      ownerName: txt(d.ownerName),
      callSign: txt(d.callSign),
      regPort: txt(d.regPort),
      gear: txt(d.gear),
      fishingZone: (d.fishingZone || undefined) as FishingZone | undefined,
      vesselClass: (d.vesselClass || undefined) as VesselClass | undefined,
      hullMaterial: (d.hullMaterial || undefined) as HullMaterial | undefined,
      builtYear: year.ok ? year.value : undefined,
      builtPlace: txt(d.builtPlace),
      crewMax: nums.crewMax,
      grossTonnage: nums.grossTonnage,
      deadweightT: nums.deadweightT,
      breadthM: nums.breadthM,
      depthM: nums.depthM,
      draughtM: nums.draughtM,
      engineModel: txt(d.engineModel),
      engineSerial: txt(d.engineSerial),
      engineKw: nums.engineKw,
      engineCount: nums.engineCount,
    });
  }

  const kw = parseBoatNumber(d.engineKw, 10000);

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
        <NumField
          label="Chiều dài tàu Lmax (m) — nếu biết"
          value={d.lengthM}
          onChange={set("lengthM")}
          error={errors.lengthM}
          placeholder="VD: 18,00"
        />

        {/*  HÀNG MỞ HỒ SƠ THEO GIẤY — khuôn [thân flex-1] + [ô nút], như "Chi
            tiết" của form giấy tờ. Đếm số ô đã ghi để bà con biết còn thiếu. */}
        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="text-[1rem] leading-snug text-foreground/80">
              Theo giấy đăng ký, đăng kiểm, giấy phép:{" "}
              <span className="font-bold text-navy">
                đã ghi {filled}/{BOAT_PAPER_FIELDS.length} mục
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPaper((v) => !v)}
            aria-expanded={showPaper}
            className={`${SQ_BTN} bg-background text-sea`}
          >
            <PlusIcon className="h-6 w-6" />
            {showPaper ? "Thu" : "Chi tiết"}
          </button>
        </div>

        {showPaper && (
          <>
            <GroupTitle>Giấy đăng ký &amp; giấy phép khai thác</GroupTitle>
            <TextField label="Chủ tàu" value={d.ownerName} onChange={set("ownerName")} placeholder="VD: Nguyễn Văn Ba" />
            <div className="grid grid-cols-2 gap-x-2">
              <TextField label="Hô hiệu" value={d.callSign} onChange={set("callSign")} placeholder="Nếu có" />
              <TextField label="Cảng đăng ký" value={d.regPort} onChange={set("regPort")} placeholder="VD: Tam Quan" />
            </div>
            <TextField label="Nghề chính" value={d.gear} onChange={set("gear")} placeholder="VD: Câu cá ngừ" />
            <SelectField
              label="Vùng hoạt động"
              value={d.fishingZone}
              onChange={set("fishingZone")}
              options={FISHING_ZONE_LABEL}
            />

            <GroupTitle>Giấy an toàn kỹ thuật (đăng kiểm)</GroupTitle>
            <div className="grid grid-cols-2 gap-x-2">
              <SelectField
                label="Cấp tàu"
                value={d.vesselClass}
                onChange={set("vesselClass")}
                options={VESSEL_CLASS_LABEL}
              />
              <SelectField
                label="Vật liệu vỏ"
                value={d.hullMaterial}
                onChange={set("hullMaterial")}
                options={HULL_MATERIAL_LABEL}
              />
              <NumField label="Năm đóng" value={d.builtYear} onChange={set("builtYear")} error={errors.builtYear} placeholder="VD: 2018" />
              <TextField label="Nơi đóng" value={d.builtPlace} onChange={set("builtPlace")} placeholder="VD: Gia Lai" />
              <NumField label="Số thuyền viên" value={d.crewMax} onChange={set("crewMax")} error={errors.crewMax} placeholder="VD: 8" />
            </div>

            <GroupTitle>Kích thước &amp; trọng tải</GroupTitle>
            <div className="grid grid-cols-2 gap-x-2">
              <NumField label="Rộng Bmax (m)" value={d.breadthM} onChange={set("breadthM")} error={errors.breadthM} placeholder="VD: 5,25" />
              <NumField label="Cao mạn D (m)" value={d.depthM} onChange={set("depthM")} error={errors.depthM} placeholder="VD: 2,50" />
              <NumField label="Chiều chìm d (m)" value={d.draughtM} onChange={set("draughtM")} error={errors.draughtM} placeholder="VD: 1,80" />
              <NumField label="Dung tích GT" value={d.grossTonnage} onChange={set("grossTonnage")} error={errors.grossTonnage} placeholder="VD: 55,60" />
              <NumField label="Trọng tải (tấn)" value={d.deadweightT} onChange={set("deadweightT")} error={errors.deadweightT} placeholder="VD: 61,60" />
            </div>

            <GroupTitle>Máy chính</GroupTitle>
            <div className="grid grid-cols-2 gap-x-2">
              <TextField label="Ký hiệu máy" value={d.engineModel} onChange={set("engineModel")} placeholder="VD: KOMATSU" />
              <TextField label="Số máy" value={d.engineSerial} onChange={set("engineSerial")} placeholder="VD: 12221" />
              <NumField
                label="Công suất (kW)"
                value={d.engineKw}
                onChange={set("engineKw")}
                error={errors.engineKw}
                placeholder="VD: 566"
                hint={kw.ok && kw.value != null ? `= ${kwToCv(kw.value)} CV (mã lực)` : undefined}
              />
              <NumField label="Số máy chính" value={d.engineCount} onChange={set("engineCount")} error={errors.engineCount} placeholder="VD: 1" />
            </div>
          </>
        )}

        {/*  BA hành động về MỘT hàng cuối form (2026-08-29, luật A2/A3): trước
            là ba dải ngang xếp chồng (cặp Hủy/Lưu grid-cols-2 + "Xóa tàu này"
            full-width). "Xoá" giữ màu danger và GIỮ NGUYÊN ConfirmDialog ở phía
            gọi — không bỏ đường lùi. */}
        <div className="mt-2 flex items-stretch justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`${SQ_BTN} bg-field text-foreground/70`}
          >
            <CloseIcon className="h-6 w-6" />
            Hủy
          </button>
          <button
            type="submit"
            className={`${SQ_BTN} bg-trim text-white shadow-trim-cta`}
          >
            <CheckIcon className="h-6 w-6" />
            Lưu
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className={`${SQ_BTN} bg-field text-danger`}
            >
              <TrashIcon className="h-6 w-6" />
              Xoá
            </button>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}

/** Draft (toàn chuỗi) → dạng lỏng để đếm ô đã ghi (rỗng = chưa ghi). */
function draftAsLoose(d: Draft): Partial<Boat> {
  const out: Record<string, string | undefined> = {};
  for (const k of BOAT_PAPER_FIELDS) out[k] = d[k].trim() || undefined;
  return out as Partial<Boat>;
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-1 text-[0.875rem] font-bold uppercase tracking-wide text-foreground/65">
      {children}
    </p>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
    </Field>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${error ? "ring-2 ring-danger" : ""}`}
        inputMode="decimal"
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <span role="alert" className="mt-1 block text-[0.9375rem] font-bold leading-snug text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[0.9375rem] text-foreground/70">{hint}</span>
      ) : null}
    </Field>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">— Chọn —</option>
        {Object.entries(options).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}
