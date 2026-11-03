"use client";

/*
  /viec/dang — ĐĂNG / SỬA TIN TUYỂN (spec 17 §6.1, §12.3). `?id=<tin>` = sửa tin của mình.
  · Chỉ vai chu-tau đăng được (route 403 `vai`, AC4) ⇒ vai khác thấy câu hỏi "Đổi sang Chủ tàu?" + nút Đổi.
  · Tin mới điền sẵn: cảng nhà (lib/cang-nha) · số hiệu + nghề theo tàu đang chọn (sổ tàu máy) nếu có.
  · NHÁP (§6.4): mỗi lần gõ ghi `forfish.viec.nhap.v1`; mất sóng bấm Đăng ⇒ báo cần sóng, nháp còn nguyên, mở lại màn
    là thấy lại. Đăng xong mới xoá nháp.
  · Kiểm ở máy bằng CÙNG validateTin của route (cấm thu phí AC6, chữ Kairos) ⇒ báo lỗi ngay dưới ô, không chờ mạng.
*/

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OfflineLine } from "@/components/ui/offline-line";
import { Field, PrimaryButton, inputClass, textareaClass } from "@/components/ui/primitives";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { StatusBanner } from "@/components/ui/status-banner";
import { ToastHost } from "@/components/ui/toast";
import { loadBoats, loadCurrentBoatId } from "@/lib/boats";
import { docCangNha } from "@/lib/cang-nha";
import { NGHE } from "@/lib/kairos/ho-so";
import { NHAN } from "@/lib/labels";
import { baoToast } from "@/lib/toast";
import { useOnline } from "@/lib/use-online";
import { useVai } from "@/lib/use-vai";
import { GIAY, TIN_LIMITS, VI_TRI, cauLoi, validateTin, type ViecTin } from "@/lib/viec";
import { docNhap, ghiNhap, goiViec, guiJson, xoaNhap } from "@/lib/viec-client";
import { chonVai } from "@/lib/vai-store";
import { CangOptions, ChonNhieu, LoiThuLai, PORT_IDS_CLIENT, ViecSkeleton } from "./viec-chung";

type Form = {
  nghe: string;
  portId: string;
  viTri: string[];
  soNguoi: string;
  ngayDi: string;
  soNgay: string;
  cong: string;
  giay: string[];
  ghiChu: string;
  boatReg: string;
  showBoat: boolean;
};

const TRONG: Form = { nghe: "", portId: "", viTri: [], soNguoi: "", ngayDi: "", soNgay: "", cong: "", giay: [], ghiChu: "", boatReg: "", showBoat: false };

const so = (s: string) => (s.trim() === "" ? null : Number(s));
const chuyen = (f: Form) => ({
  nghe: f.nghe,
  portId: f.portId,
  viTri: f.viTri,
  soNguoi: so(f.soNguoi),
  ngayDi: f.ngayDi || null,
  soNgay: so(f.soNgay),
  cong: f.cong,
  giay: f.giay,
  ghiChu: f.ghiChu,
  boatReg: f.boatReg,
  showBoat: f.showBoat,
});

/** Đoán nghề Kairos từ chữ "nghề chính" của tàu (giấy phép) — không chắc thì để trống. */
function ngheTuTau(gear: string | undefined): string {
  const g = (gear ?? "").toLowerCase();
  if (!g) return "";
  if (g.includes("mực")) return "cau-muc";
  if (g.includes("vây")) return "luoi-vay";
  if (g.includes("rê")) return "luoi-re";
  if (g.includes("kéo") || g.includes("cào")) return "luoi-keo";
  if (g.includes("câu")) return "cau-tay";
  if (g.includes("lặn")) return "lan";
  return "";
}

function dienSan(): Form {
  const f = { ...TRONG };
  try {
    const boats = loadBoats();
    const b = boats.find((x) => x.id === loadCurrentBoatId()) ?? boats[0];
    if (b?.maTau) f.boatReg = b.maTau.slice(0, TIN_LIMITS.boatReg);
    f.nghe = ngheTuTau(b?.gear);
    if (b?.homePortId && PORT_IDS_CLIENT.has(b.homePortId)) f.portId = b.homePortId;
  } catch {
    /* sổ tàu hỏng — để trống */
  }
  const cang = docCangNha()?.portId;
  if (!f.portId && cang && PORT_IDS_CLIENT.has(cang)) f.portId = cang;
  return f;
}

const tuTin = (t: ViecTin & { boatRegRieng?: string | null; showBoat?: boolean }): Form => ({
  nghe: t.nghe,
  portId: t.portId,
  viTri: t.viTri,
  soNguoi: String(t.soNguoi),
  ngayDi: t.ngayDi ?? "",
  soNgay: t.soNgay == null ? "" : String(t.soNgay),
  cong: t.cong ?? "",
  giay: t.giay,
  ghiChu: t.ghiChu ?? "",
  boatReg: t.boatRegRieng ?? t.boatReg ?? "",
  showBoat: t.showBoat ?? !!t.boatReg,
});

const O_LOI: Record<string, keyof Form> = {
  bad_nghe: "nghe",
  bad_port: "portId",
  bad_vi_tri: "viTri",
  bad_so_nguoi: "soNguoi",
  bad_ngay: "ngayDi",
  bad_so_ngay: "soNgay",
  bad_giay: "giay",
};

export function DangTin() {
  const router = useRouter();
  const online = useOnline();
  const { vai, phone, biet } = useVai();
  const [id, setId] = useState<string | null | undefined>(undefined);
  const [tai, setTai] = useState<{ kind: "dang" } | { kind: "loi"; cau: string } | { kind: "xong" }>({ kind: "dang" });
  const [f, setF] = useState<Form>(TRONG);
  const [loi, setLoi] = useState<{ code: string; cau: string } | null>(null);
  const [dang, setDang] = useState(false);
  const [canDoiVai, setCanDoiVai] = useState(false);
  const daNap = useRef(false);
  // Không hỏi "Bỏ phần đang ghi?" khi chạm ‹: nháp đã giữ trong máy, mở lại màn là thấy lại.

  // ?id= đọc sau mount (trang dựng tĩnh, không Suspense)
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("id");
    setId(v && /^[0-9a-f-]{36}$/i.test(v) ? v.toLowerCase() : null);
  }, []);

  const cho = id ?? "moi";

  useEffect(() => {
    if (id === undefined || daNap.current) return;
    daNap.current = true;
    const nhap = docNhap<Form>(cho);
    if (!id) {
      setF(nhap ?? dienSan());
      setTai({ kind: "xong" });
      return;
    }
    (async () => {
      if (nhap) {
        setF(nhap);
        setTai({ kind: "xong" });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setTai({ kind: "loi", cau: "Mất sóng — cần sóng để mở tin cần sửa." });
        return;
      }
      const r = await goiViec<{ tin: ViecTin }>(`/api/viec/tin/${id}`);
      if (!r.ok) return setTai({ kind: "loi", cau: r.status === 0 ? "Mạng yếu, chưa mở được tin." : cauLoi(r.code) });
      setF(tuTin(r.data.tin));
      setTai({ kind: "xong" });
    })();
  }, [id, cho]);

  const doi = (p: Partial<Form>) => {
    setF((x) => {
      const n = { ...x, ...p };
      ghiNhap(cho, n);
      return n;
    });
    setLoi(null);
  };

  const gui = async () => {
    const body = chuyen(f);
    const v = validateTin(body, { portIds: PORT_IDS_CLIENT });
    if (!v.ok) return setLoi({ code: v.code, cau: cauLoi(v.code) });
    if (!online) return baoToast(`${NHAN.canSong} để đăng — nháp đã giữ trong máy.`, { loai: "xau", ms: 4000 });
    setDang(true);
    const r = id
      ? await goiViec<{ tin: ViecTin }>(`/api/viec/tin/${id}`, guiJson("PATCH", { action: "sua", tin: body }))
      : await goiViec<{ tin: ViecTin }>("/api/viec", guiJson("POST", body));
    setDang(false);
    if (!r.ok) {
      if (r.code === "vai") setCanDoiVai(true);
      setLoi({ code: r.code ?? "", cau: r.message ?? (r.status === 0 ? "Mạng yếu, chưa gửi được — nháp vẫn giữ trong máy." : cauLoi(r.code)) });
      return;
    }
    xoaNhap();
    baoToast(id ? "Đã sửa tin." : "Đã đăng tin — hiện 14 ngày.", { loai: "tot" });
    router.push("/viec/cua-toi");
  };

  if (tai.kind === "dang" || id === undefined) return <div className="px-4"><ViecSkeleton count={1} /></div>;
  if (tai.kind === "loi") return <div className="px-4"><LoiThuLai cau={tai.cau} onThuLai={() => location.reload()} /></div>;

  const khongPhaiChuTau = !id && ((biet && vai !== "chu-tau") || canDoiVai);
  const loiO = (k: keyof Form) => (loi && O_LOI[loi.code] === k ? loi.cau : undefined);
  const loiChung = loi && !O_LOI[loi.code] ? loi.cau : null;

  return (
    <form
      className="px-4 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        void gui();
      }}
    >
      {!online && (
        <div className="mb-3">
          <OfflineLine extra=" · nháp giữ trong máy" />
        </div>
      )}
      {khongPhaiChuTau && (
        <div className="mb-3">
          <StatusBanner level="warn">
            Chỉ tài khoản Chủ tàu mới đăng được tin tuyển. Đổi sang Chủ tàu?
            <button
              type="button"
              disabled={!phone}
              onClick={async () => {
                if (!phone) return;
                await chonVai(phone, "chu-tau");
                setCanDoiVai(false);
                setLoi(null);
                baoToast("Đã đổi sang Chủ tàu.", { loai: "tot" });
              }}
              className={`${SQ_BTN} mt-2 bg-field text-sea`}
            >
              {NHAN.doi}
            </button>
          </StatusBanner>
        </div>
      )}

      <Field label="Nghề" error={loiO("nghe")}>
        <select value={f.nghe} onChange={(e) => doi({ nghe: e.target.value })} className={inputClass}>
          <option value="">Chọn nghề…</option>
          {NGHE.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cảng xuất bến" error={loiO("portId")}>
        <select value={f.portId} onChange={(e) => doi({ portId: e.target.value })} className={inputClass}>
          <option value="">Chọn cảng…</option>
          <CangOptions />
        </select>
      </Field>
      <ChonNhieu ten="Vị trí cần" options={VI_TRI} value={f.viTri} onChange={(v) => doi({ viTri: v })} max={TIN_LIMITS.viTriMax} loi={loiO("viTri")} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Số người" error={loiO("soNguoi")}>
          <input inputMode="numeric" value={f.soNguoi} onChange={(e) => doi({ soNguoi: e.target.value.replace(/\D/g, "").slice(0, 2) })} className={inputClass} placeholder="1–30" />
        </Field>
        <Field label="Chuyến dài (ngày)" error={loiO("soNgay")}>
          <input inputMode="numeric" value={f.soNgay} onChange={(e) => doi({ soNgay: e.target.value.replace(/\D/g, "").slice(0, 3) })} className={inputClass} placeholder="Không bắt buộc" />
        </Field>
      </div>
      <Field label="Ngày đi dự kiến" error={loiO("ngayDi")}>
        <input type="date" value={f.ngayDi} onChange={(e) => doi({ ngayDi: e.target.value })} className={inputClass} />
      </Field>
      <Field label={`Công (${[...f.cong].length}/${TIN_LIMITS.cong})`}>
        <input value={f.cong} maxLength={TIN_LIMITS.cong} onChange={(e) => doi({ cong: e.target.value })} className={inputClass} placeholder="Ví dụ: chia phần, lương chuyến" />
      </Field>
      <ChonNhieu ten="Giấy cần có" options={GIAY} value={f.giay} onChange={(v) => doi({ giay: v })} loi={loiO("giay")} />
      <Field label={`Ghi chú (${[...f.ghiChu].length}/${TIN_LIMITS.ghiChu})`}>
        <textarea rows={3} maxLength={TIN_LIMITS.ghiChu} value={f.ghiChu} onChange={(e) => doi({ ghiChu: e.target.value })} className={textareaClass} placeholder="Ví dụ: bao ăn, tàu 400 CV" />
      </Field>
      <Field label="Số hiệu tàu">
        <input value={f.boatReg} maxLength={TIN_LIMITS.boatReg} onChange={(e) => doi({ boatReg: e.target.value })} className={inputClass} placeholder="Không bắt buộc" />
      </Field>
      <label className="mb-4 flex min-h-(--h-ctl) items-center gap-2 text-[0.9375rem] text-foreground/85">
        <input type="checkbox" checked={f.showBoat} disabled={!f.boatReg.trim()} onChange={(e) => doi({ showBoat: e.target.checked })} className="h-4 w-4 accent-navy" />
        Hiện số hiệu tàu trong tin
      </label>

      {loiChung && (
        <p role="alert" className="mb-3 rounded-xl bg-danger-bg px-3 py-2 text-[0.875rem] font-semibold text-danger">
          {loiChung}
        </p>
      )}
      <p className="mb-3 text-[0.8125rem] text-muted">Tin tuyển không được thu tiền người đi bạn (phí, đặt cọc, chuyển khoản trước).</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => router.back()} className={`${SQ_BTN} w-full bg-field text-sea`}>
          {NHAN.huy}
        </button>
        <PrimaryButton type="submit" disabled={dang || khongPhaiChuTau}>
          {dang ? NHAN.dangGui : id ? NHAN.luu : NHAN.dangTin}
        </PrimaryButton>
      </div>
      <ToastHost />
    </form>
  );
}
