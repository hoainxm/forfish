"use client";

/*
  /viec/ho-so — HỒ SƠ TÌM TÀU CỦA TÔI (spec 17 §6.2, §12.2). Một SĐT một hồ sơ; mọi vai đăng được (thường là đi bạn).
  Tên hiện = tên Kairos (không hỏi thêm). Bật/tắt "Đang tìm tàu": tắt thì ẩn khỏi danh sách, không xoá.
  Hồ sơ không bật lại trong 30 ngày ⇒ tự tắt; màn nói rõ và có nút Mở lại.
  Trạng thái: đang tải · lỗi + Thử lại · mất sóng (cần sóng để mở/lưu — chữ đang gõ vẫn nằm trên màn) · lỗi kiểm chữ
  ngay dưới ô (validateHoSo dùng chung với route).
*/

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OfflineLine } from "@/components/ui/offline-line";
import { Field, PrimaryButton, inputClass, textareaClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { ToastHost } from "@/components/ui/toast";
import { useLeaveGuard } from "@/components/market/shared/market-header";
import { docCangNha } from "@/lib/cang-nha";
import { NGHE } from "@/lib/kairos/ho-so";
import { NHAN } from "@/lib/labels";
import { baoToast } from "@/lib/toast";
import { useOnline } from "@/lib/use-online";
import { GIAY, HO_SO_LIMITS, VI_TRI, cauLoi, validateHoSo, type ViecHoSo } from "@/lib/viec";
import { goiViec, guiJson } from "@/lib/viec-client";
import { CangOptions, ChonNhieu, LoiThuLai, PORT_IDS_CLIENT, ViecSkeleton, tenCang } from "./viec-chung";

type Form = {
  nghe: string[];
  soNam: string;
  viTri: string[];
  ports: string[];
  giay: string[];
  sanSang: string;
  ghiChu: string;
  dangTim: boolean;
};

const TRONG: Form = { nghe: [], soNam: "", viTri: [], ports: [], giay: [], sanSang: "", ghiChu: "", dangTim: true };

type Resp = { ten: string | null; hoSo: ViecHoSo | null; dangTim: boolean; dangHien: boolean };

const tuHoSo = (h: ViecHoSo, dangTim: boolean): Form => ({
  nghe: h.nghe,
  soNam: h.soNam == null ? "" : String(h.soNam),
  viTri: h.viTri,
  ports: h.ports,
  giay: h.giay,
  sanSang: h.sanSang ?? "",
  ghiChu: h.ghiChu ?? "",
  dangTim,
});

const chuyen = (f: Form) => ({
  nghe: f.nghe,
  soNam: f.soNam.trim() === "" ? null : Number(f.soNam),
  viTri: f.viTri,
  ports: f.ports,
  giay: f.giay,
  sanSang: f.sanSang || null,
  ghiChu: f.ghiChu,
  dangTim: f.dangTim,
});

export function HoSoForm() {
  const router = useRouter();
  const online = useOnline();
  const [tai, setTai] = useState<{ kind: "dang" } | { kind: "loi"; cau: string } | { kind: "xong"; r: Resp }>({ kind: "dang" });
  const [f, setF] = useState<Form>(TRONG);
  const [sua, setSua] = useState(false);
  const [loi, setLoi] = useState<{ code: string; cau: string } | null>(null);
  const [dang, setDang] = useState(false);
  useLeaveGuard(sua);

  const load = useCallback(async () => {
    setTai({ kind: "dang" });
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setTai({ kind: "loi", cau: "Mất sóng — cần sóng để mở hồ sơ tìm tàu." });
      return;
    }
    const r = await goiViec<Resp>("/api/viec/ho-so");
    if (!r.ok) return setTai({ kind: "loi", cau: r.status === 0 ? "Mạng yếu, chưa mở được hồ sơ." : cauLoi(r.code) });
    setTai({ kind: "xong", r: r.data });
    if (r.data.hoSo) setF(tuHoSo(r.data.hoSo, r.data.dangTim));
    else {
      const cang = docCangNha()?.portId;
      setF({ ...TRONG, ports: cang && PORT_IDS_CLIENT.has(cang) ? [cang] : [] });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const doi = (p: Partial<Form>) => {
    setF((x) => ({ ...x, ...p }));
    setSua(true);
    setLoi(null);
  };

  const luu = async (ghiDe?: Partial<Form>) => {
    const body = chuyen({ ...f, ...ghiDe });
    const v = validateHoSo(body, { portIds: PORT_IDS_CLIENT });
    if (!v.ok) return setLoi({ code: v.code, cau: cauLoi(v.code) });
    if (!online) return baoToast(`${NHAN.canSong} để lưu hồ sơ — chữ vẫn còn trên màn.`, { loai: "xau" });
    setDang(true);
    const r = await goiViec<Resp>("/api/viec/ho-so", guiJson("PUT", body));
    setDang(false);
    if (!r.ok) {
      setLoi({ code: r.code ?? "", cau: r.message ?? (r.status === 0 ? "Mạng yếu, chưa lưu được — thử lại." : cauLoi(r.code)) });
      return;
    }
    setSua(false);
    setTai({ kind: "xong", r: r.data });
    if (r.data.hoSo) setF(tuHoSo(r.data.hoSo, r.data.dangTim));
    baoToast(r.data.dangTim ? "Đã lưu — chủ tàu tìm người sẽ thấy hồ sơ của bà con." : "Đã lưu — hồ sơ đang tắt.", { loai: "tot" });
  };

  if (tai.kind === "dang") return <div className="px-4"><ViecSkeleton count={1} /></div>;
  if (tai.kind === "loi") return <div className="px-4"><LoiThuLai cau={tai.cau} onThuLai={() => void load()} /></div>;

  const { r } = tai;
  const tuTat = !!r.hoSo && r.dangTim && !r.dangHien;
  const loiO = (ma: string) => (loi?.code === ma ? loi.cau : undefined);

  return (
    <form
      className="px-4 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        void luu();
      }}
    >
      {!online && (
        <div className="mb-3">
          <OfflineLine />
        </div>
      )}
      {tuTat && (
        <div className="mb-3">
          <StatusBanner level="warn">
            Hồ sơ đã tự tắt vì 30 ngày chưa bật lại. Bà con còn tìm tàu không?
            <button type="button" onClick={() => void luu({ dangTim: true })} className={`${SQ_BTN} mt-2 bg-field text-sea`}>
              {NHAN.moLai}
            </button>
          </StatusBanner>
        </div>
      )}

      <p className="mb-3 text-[0.9375rem] text-foreground/80">
        Tên hiện: <b className="text-navy">{r.ten ?? "tên Kairos của bà con"}</b>
        <span className="block text-[0.8125rem] text-muted">Đổi tên ở trang Kairos của bà con. Số điện thoại chỉ chủ tàu thấy.</span>
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={f.dangTim}
        onClick={() => doi({ dangTim: !f.dangTim })}
        className="mb-4 flex min-h-(--h-row) w-full items-center gap-3 rounded-xl bg-field px-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-navy">Đang tìm tàu</span>
          <span className="block text-[0.8125rem] text-muted">{f.dangTim ? "Chủ tàu thấy hồ sơ này" : "Đang ẩn — không ai thấy"}</span>
        </span>
        <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition ${f.dangTim ? "bg-sea" : "bg-line"}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow transition-all ${f.dangTim ? "left-[1.375rem]" : "left-0.5"}`} />
        </span>
      </button>

      <ChonNhieu ten="Nghề đã làm" options={NGHE} value={f.nghe} onChange={(v) => doi({ nghe: v })} max={HO_SO_LIMITS.ngheMax} loi={loiO("bad_nghe")} />
      <ChonNhieu ten="Vị trí muốn làm" options={VI_TRI} value={f.viTri} onChange={(v) => doi({ viTri: v })} max={HO_SO_LIMITS.viTriMax} loi={loiO("bad_vi_tri")} />

      <fieldset className="mb-3.5">
        <legend className="mb-1.5 block text-[0.875rem] font-semibold text-navy">Cảng muốn đi (tối đa {HO_SO_LIMITS.portsMax})</legend>
        {f.ports.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {f.ports.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => doi({ ports: f.ports.filter((x) => x !== p) })}
                  aria-label={`${NHAN.bo} ${tenCang(p)}`}
                  className="inline-flex min-h-(--h-chip) items-center gap-1.5 rounded-full bg-navy px-3 text-[0.875rem] font-semibold text-white"
                >
                  {tenCang(p)} <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {f.ports.length < HO_SO_LIMITS.portsMax && (
          <select
            value=""
            onChange={(e) => e.target.value && doi({ ports: [...new Set([...f.ports, e.target.value])] })}
            className={inputClass}
            aria-label="Thêm cảng"
          >
            <option value="">Chọn cảng…</option>
            <CangOptions />
          </select>
        )}
        {loiO("bad_port") && (
          <p role="alert" className="mt-1.5 text-[0.875rem] text-danger">
            {loiO("bad_port")}
          </p>
        )}
      </fieldset>

      <ChonNhieu ten="Giấy đang có" options={GIAY} value={f.giay} onChange={(v) => doi({ giay: v })} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Số năm đi biển" error={loiO("bad_so_nam")}>
          <input inputMode="numeric" value={f.soNam} onChange={(e) => doi({ soNam: e.target.value.replace(/\D/g, "").slice(0, 2) })} className={inputClass} />
        </Field>
        <Field label="Sẵn sàng từ" error={loiO("bad_ngay")}>
          <input type="date" value={f.sanSang} onChange={(e) => doi({ sanSang: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <Field label={`Ghi chú (${[...f.ghiChu].length}/${HO_SO_LIMITS.ghiChu})`} error={loiO("too_long") ?? (loi && ["bad_words", "sovereignty", "anti_state", "dangerous_link"].includes(loi.code) ? loi.cau : undefined)}>
        <textarea
          rows={2}
          maxLength={HO_SO_LIMITS.ghiChu}
          value={f.ghiChu}
          onChange={(e) => doi({ ghiChu: e.target.value })}
          placeholder="Ví dụ: quen câu mực, đi được chuyến dài"
          className={textareaClass}
        />
      </Field>

      {loi && !["bad_nghe", "bad_vi_tri", "bad_port", "bad_so_nam", "bad_ngay", "too_long", "bad_words", "sovereignty", "anti_state", "dangerous_link"].includes(loi.code) && (
        <p role="alert" className="mb-3 text-[0.875rem] text-danger">
          {loi.cau}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => router.push("/viec")} className={`${SQ_BTN} w-full bg-field text-sea`}>
          {NHAN.huy}
        </button>
        <PrimaryButton type="submit" disabled={dang}>
          {dang ? NHAN.dangGui : NHAN.luu}
        </PrimaryButton>
      </div>
      <ToastHost />
    </form>
  );
}
