"use client";

import { useCallback, useEffect, useState } from "react";
import { useLeaveGuard } from "@/components/market/shared/market-header";
import { Card, Field, PrimaryButton, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { OfflineLine } from "@/components/ui/offline-line";
import { XacMinhBadge } from "@/components/ui/xac-minh-badge";
import { NHAN } from "@/lib/labels";
import { COASTAL_PROVINCES } from "@/lib/region";
import { sanitizePhoneInput } from "@/lib/phone";
import { useOnline } from "@/lib/use-online";
import { parseVuaBody, VUA_KIND_LABEL, VUA_KINDS, VUA_MAX, type VuaField, type VuaKind } from "@/lib/vua-profile";
import { fetchMyVua, saveMyVua, type MyVua, type VuaLoi } from "@/lib/vua-store";

/*
  HỒ SƠ VỰA (spec 17 §12.4, màn /tien/vua) — vựa · nậu · nhà máy · chợ tự khai để hiện ở Chợ cá › Đầu mối.
  Nhân viên SDVICO duyệt rồi mới hiện. Trạng thái (thẻ đầu màn):
    chưa có    ⇒ chỉ form, nút Gửi
    chờ duyệt  ⇒ băng vàng · form sửa được
    bị từ chối ⇒ băng đỏ + lý do · sửa rồi gửi lại
    đang hiện  ⇒ băng xanh (+ dấu Xác minh nếu có) · đổi ô chính thì phải chờ duyệt lại (máy chủ quyết)
    bị khoá    ⇒ băng đỏ, KHÔNG form
  Ma trận tải: đang tải (khung chờ) · lỗi mạng / mất sóng (OfflineLine + Thử lại) · chưa sẵn sàng (503) · chưa đăng nhập.
  Không lưu bản nào trong máy — gửi hỏng thì chữ đang gõ vẫn nằm nguyên trên form.
*/

type Form = {
  name: string;
  kind: VuaKind;
  province: string;
  address: string;
  species: string;
  hours: string;
  contact: string;
};

const RONG: Form = { name: "", kind: "vua", province: "", address: "", species: "", hours: "", contact: "" };

function formTu(p: MyVua): Form {
  return {
    name: p.name,
    kind: p.kind,
    province: p.province ?? "",
    address: p.address ?? "",
    species: p.species.join(", "),
    hours: p.hours ?? "",
    contact: p.contact ?? "",
  };
}

const CAU_LOI_TAI: Record<Exclude<VuaLoi, "mang">, string> = {
  "chua-san-sang": "Phần hồ sơ vựa chưa mở. Bà con quay lại sau nhé.",
  "chua-dang-nhap": "Bà con đăng nhập lại để mở hồ sơ.",
};

export function VuaProfileForm() {
  const online = useOnline();
  const [tai, setTai] = useState<"dang" | "xong" | VuaLoi>("dang");
  const [profile, setProfile] = useState<MyVua | null>(null);
  const [xacMinh, setXacMinh] = useState(false);
  const [form, setForm] = useState<Form>(RONG);
  const [goc, setGoc] = useState<Form>(RONG);
  const [loiO, setLoiO] = useState<{ field: VuaField; message: string } | null>(null);
  const [dangGui, setDangGui] = useState(false);
  const [baoGui, setBaoGui] = useState<{ level: "ok" | "danger"; text: string } | null>(null);

  const napLai = useCallback(() => {
    setTai("dang");
    void fetchMyVua().then((r) => {
      if (!r.ok) {
        setTai(r.reason);
        return;
      }
      setProfile(r.profile);
      setXacMinh(r.xacMinh);
      const f = r.profile ? formTu(r.profile) : RONG;
      setForm(f);
      setGoc(f);
      setTai("xong");
    });
  }, []);
  useEffect(napLai, [napLai]);

  const dirty = tai === "xong" && JSON.stringify(form) !== JSON.stringify(goc);
  useLeaveGuard(dirty);

  const doi = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (loiO?.field === k) setLoiO(null);
    setBaoGui(null);
  };

  async function gui(e: React.FormEvent) {
    e.preventDefault();
    if (dangGui) return;
    setBaoGui(null);
    // cùng luật với máy chủ — báo ngay dưới ô, khỏi chờ mạng
    const p = parseVuaBody(form);
    if (!p.ok) {
      setLoiO({ field: p.field, message: p.message });
      return;
    }
    setLoiO(null);
    setDangGui(true);
    const r = await saveMyVua(form);
    setDangGui(false);
    if (r.ok) {
      const truoc = profile?.status;
      setProfile(r.profile);
      const f = formTu(r.profile);
      setForm(f);
      setGoc(f);
      setBaoGui({
        level: "ok",
        text:
          r.profile.status === "hoat_dong"
            ? "Đã lưu."
            : truoc === "hoat_dong"
              ? "Đã lưu. Bà con đổi thông tin chính nên hồ sơ chờ SDVICO duyệt lại."
              : "Đã gửi. SDVICO duyệt xong hồ sơ sẽ hiện ở Đầu mối.",
      });
      return;
    }
    if (r.reason === "khoa") {
      setProfile((p0) => (p0 ? { ...p0, status: "tam_khoa" } : p0));
      return;
    }
    if (r.reason === "sai") {
      setLoiO({ field: r.field ?? "name", message: "Thông tin chưa đúng, bà con xem lại ô này." });
      return;
    }
    setBaoGui({
      level: "danger",
      text:
        r.reason === "mang"
          ? online
            ? "Mạng yếu, chưa gửi được. Chữ vẫn giữ — bấm lại nhé."
            : "Mất sóng, chưa gửi được. Chữ vẫn giữ — có sóng bấm lại."
          : r.reason === "chua-dang-nhap"
            ? CAU_LOI_TAI["chua-dang-nhap"]
            : "Máy chủ đang bận, chưa gửi được. Bà con thử lại sau.",
    });
  }

  if (tai === "dang") {
    return (
      <div className="space-y-3 px-4" role="status" aria-label={`${NHAN.dangTai}…`}>
        <div className="h-12 animate-pulse rounded-xl bg-field" />
        <div className="h-64 animate-pulse rounded-2xl bg-field" />
      </div>
    );
  }

  if (tai !== "xong") {
    return (
      <div>
        {tai === "mang" ? (
          <OfflineLine />
        ) : (
          <StatusBanner level="warn">{CAU_LOI_TAI[tai]}</StatusBanner>
        )}
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={napLai}
            className="h-(--h-ctl) rounded-xl bg-field px-4 text-[0.9375rem] font-semibold text-sea transition active:bg-line"
          >
            {NHAN.thuLai}
          </button>
        </div>
      </div>
    );
  }

  const status = profile?.status ?? null;
  const loi = (f: VuaField) => (loiO?.field === f ? loiO.message : undefined);

  return (
    <div>
      {status === "cho_duyet" && <StatusBanner level="warn">Đang chờ SDVICO duyệt. Duyệt xong sẽ hiện ở Đầu mối.</StatusBanner>}
      {status === "tu_choi" && (
        <StatusBanner level="danger">
          SDVICO chưa duyệt: {profile?.statusNote ?? "không ghi lý do"}. Sửa lại rồi gửi lần nữa.
        </StatusBanner>
      )}
      {status === "hoat_dong" && (
        <StatusBanner level="ok">
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Đang hiện ở Đầu mối
            {xacMinh && <XacMinhBadge />}
          </span>
        </StatusBanner>
      )}
      {status === "tam_khoa" && (
        <StatusBanner level="danger">
          Hồ sơ đang bị khoá{profile?.statusNote ? `: ${profile.statusNote}` : ""}. Bà con gọi SDVICO để mở lại.
        </StatusBanner>
      )}

      {status !== "tam_khoa" && (
        <form onSubmit={gui} noValidate className="px-4 pt-3">
          {status === "hoat_dong" && (
            <p className="mb-3 text-[0.8125rem] leading-snug text-muted">
              Đổi loài hay giờ mua thì hiện ngay. Đổi tên, loại, tỉnh, địa chỉ hay số điện thoại thì chờ duyệt lại.
            </p>
          )}
          <Card className="p-4">
            <Field label="Tên vựa" error={loi("name")}>
              <input
                className={inputClass}
                value={form.name}
                maxLength={VUA_MAX.name}
                onChange={(e) => doi("name", e.target.value)}
                placeholder="Vd: Vựa Tư Hải"
                autoComplete="organization"
              />
            </Field>

            <div className="group mb-3.5" data-invalid={loi("kind") ? "" : undefined}>
              <span className="mb-1.5 block text-[0.875rem] font-semibold text-navy">Loại</span>
              <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Loại">
                {VUA_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={form.kind === k}
                    onClick={() => doi("kind", k)}
                    className={`h-(--h-ctl) rounded-xl text-[0.875rem] font-semibold transition ${
                      form.kind === k ? "bg-navy text-white" : "bg-field text-foreground/70"
                    }`}
                  >
                    {VUA_KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Tỉnh" error={loi("province")}>
              <select className={inputClass} value={form.province} onChange={(e) => doi("province", e.target.value)}>
                <option value="">Chọn tỉnh</option>
                {/* tỉnh cũ không còn trong danh sách vẫn hiện, để lưu lại không mất */}
                {form.province && !COASTAL_PROVINCES.some((p) => p.name === form.province) && (
                  <option value={form.province}>{form.province}</option>
                )}
                {COASTAL_PROVINCES.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Địa chỉ" error={loi("address")}>
              <input
                className={inputClass}
                value={form.address}
                maxLength={VUA_MAX.address}
                onChange={(e) => doi("address", e.target.value)}
                placeholder="Vd: Cảng cá Sa Huỳnh"
                autoComplete="street-address"
              />
            </Field>

            <Field label="Loài thu mua" error={loi("species")}>
              <input
                className={inputClass}
                value={form.species}
                onChange={(e) => doi("species", e.target.value)}
                placeholder="Vd: cá ngừ, mực, cá thu"
              />
            </Field>

            <Field label="Giờ mua" error={loi("hours")}>
              <input
                className={inputClass}
                value={form.hours}
                maxLength={VUA_MAX.hours}
                onChange={(e) => doi("hours", e.target.value)}
                placeholder="Vd: 4 giờ – 9 giờ sáng"
              />
            </Field>

            <Field label="Số điện thoại liên hệ" error={loi("contact")}>
              <input
                className={inputClass}
                value={form.contact}
                inputMode="tel"
                autoComplete="tel"
                onChange={(e) => doi("contact", sanitizePhoneInput(e.target.value))}
                placeholder="Để trống thì dùng số tài khoản"
              />
            </Field>
          </Card>

          {baoGui && (
            <p
              role={baoGui.level === "danger" ? "alert" : "status"}
              className={`mt-3 text-[0.875rem] font-semibold leading-snug ${baoGui.level === "ok" ? "text-ok" : "text-danger"}`}
            >
              {baoGui.text}
            </p>
          )}

          {/* bị từ chối: gửi lại được cả khi chưa sửa (có khi chỉ cần gọi SDVICO giải thích); còn lại chưa đổi gì thì khỏi gửi */}
          <PrimaryButton type="submit" disabled={dangGui || (!!profile && status !== "tu_choi" && !dirty)} className="mt-4">
            {dangGui ? `${NHAN.dangGui}…` : !profile ? NHAN.gui : status === "tu_choi" ? NHAN.guiLai : NHAN.luu}
          </PrimaryButton>
          <p className="mt-2 pb-6 text-center text-[0.8125rem] text-muted">
            SDVICO xem trước khi đưa lên danh bạ cho bà con.
          </p>
        </form>
      )}
    </div>
  );
}
