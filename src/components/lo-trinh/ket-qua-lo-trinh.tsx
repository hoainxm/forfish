"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NHAN } from "@/lib/labels";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { baoToast } from "@/lib/toast";
import { AlertIcon, CrosshairIcon, RouteIcon, StarIcon, TrashIcon } from "@/components/icons";
import { formatDigits } from "@/lib/format";
import { guiNoiDi, loadStops, persistStops } from "@/lib/route-stops";
import { chuoiChangTuMoc, mucVung, soViTri, type KetQuaSoViTri } from "@/lib/lo-trinh/so-vi-tri";
import { docKg } from "@/lib/lo-trinh/nhat-ky";
import { inputClass } from "@/components/ui/primitives";
import type { LoTrinhKetQua, YeuToNgay } from "@/lib/lo-trinh/types";
import { beaufort } from "@/lib/marine-weather";
import { SoDoLoTrinh } from "./so-do-lo-trinh";

/*
  KẾT QUẢ ĐỀ XUẤT LỘ TRÌNH (09-ba-spec §4 output, §5c) — dùng chung cho lộ trình VỪA TÍNH và lộ
  trình ĐÃ LƯU mở lại. Chữ theo thang 03 §0, nhỏ gọn (anh Long 2026-10-29: "chữ cho nhỏ đẹp"):
  ba con số là hàng 1rem 600 + nhãn 0.8125rem `text-muted` — KHÔNG số to. Có `chanBao` ⇒ băng đỏ
  THAY cho lộ trình (không lịch, không vùng, không nút Lưu/Bản đồ). Không in điểm số vùng — chỉ
  thang Được/Khá/Tốt. Disclaimer cố định nằm ở đầu màn (ManHeader sub), không lặp ở đây.
  Phase 2/3 (2026-11-08): dòng dầu theo pha (lít, không quy ra tiền — anh Long bỏ 08/11); sau "Vị trí" có nút
  "Tính lại" từ chỗ đang đứng; lộ trình đã lưu tới ngày về thì hỏi sản lượng (chỉ lưu trong máy, để tự so).
*/

const ngayVN = (iso: string) => {
  const [, m, d] = iso.split("-");
  return m && d ? `${d}/${m}` : iso;
};

/** Một dòng yếu tố của một ngày đánh — chữ, không in điểm cá (thang Được/Khá/Tốt như cả màn). */
function cauYeuTo(y: YeuToNgay): string {
  const so1 = (n: number) => String(n).replace(".", ",");
  const phan = [`Ngày ${y.ngay}`, `cá ${mucVung(y.ca)}`, `trăng ${y.trang}%`];
  if (y.songM != null) phan.push(`sóng ${so1(y.songM)} m`);
  if (y.gioKmh != null) phan.push(`gió cấp ${beaufort(y.gioKmh)}`);
  if (y.songM == null && y.gioKmh == null) phan.push("chưa có dự báo sóng gió");
  // bãi: KHÔNG in "tàu cùng nghề …" (anh Long 10/11 — chỉ nói "bãi được dự báo có cá"); hệ số bãi vẫn nằm trong "trừ X%"
  const tru = Math.round((1 - y.heSo) * 100);
  if (tru >= 1) phan.push(tru >= 100 ? "bỏ ngày này" : `trừ ${tru}%`);
  return phan.join(" · ");
}

/** "Dầu chạy 900 lít · lúc đánh 300 lít · chong đèn 200 lít." — bỏ pha bằng 0. */
function cauPha(p: { chay: number; danh: number; den: number }): string {
  const so = (n: number) => formatDigits(String(n < 10 ? Math.round(n) : Math.round(n / 10) * 10));
  const phan = [`Dầu chạy ${so(p.chay)} lít`];
  if (p.danh > 0) phan.push(`lúc đánh ${so(p.danh)} lít`);
  if (p.den > 0) phan.push(`chong đèn ${so(p.den)} lít`);
  return phan.join(" · ") + ".";
}

type ViTri =
  | { kind: "idle" }
  | { kind: "dang" }
  | { kind: "ok"; r: KetQuaSoViTri; pos: { lat: number; lon: number } }
  | { kind: "loi"; cau: string };

export function KetQuaLoTrinh({
  kq,
  ngayDi,
  cangTen,
  tuoiCa,
  daLuu,
  onLuu,
  luuLoi,
  onXoa,
  onSoViTri,
  onTinhLai,
  tinhLaiLoi = null,
  hoiSanLuong = false,
  onSanLuong,
  cauDo = null,
  nhatKyLoi = null,
}: {
  kq: LoTrinhKetQua;
  ngayDi: string;
  cangTen: string;
  /** câu tuổi dữ liệu (đã soạn ở màn cha) — "Tính lúc … · bản đồ cá lúc …" */
  tuoiCa: string | null;
  /** đã nằm trong kho chưa (lộ trình mở lại, hoặc vừa bấm Lưu) */
  daLuu: boolean;
  onLuu?: () => void;
  /** câu báo lưu hỏng — null khi không có lỗi */
  luuLoi: string | null;
  onXoa?: () => void;
  /** lộ trình đã lưu: ghi lần so vị trí vào nhật ký (Phase 3) */
  onSoViTri?: (pos: { lat: number; lon: number }, cachHaiLy: number) => void;
  /** tính lại từ chỗ đang đứng (Phase 2) — chỉ hiện sau một lần "Vị trí" thành công */
  onTinhLai?: (pos: { lat: number; lon: number }) => void;
  tinhLaiLoi?: string | null;
  /** hỏi sản lượng sau chuyến (Phase 3) */
  hoiSanLuong?: boolean;
  /** true = đã ghi */
  onSanLuong?: (kg: number) => boolean;
  /** câu tóm tắt nhật ký đo hiệu quả của chuyến này */
  cauDo?: string | null;
  nhatKyLoi?: string | null;
}) {
  const router = useRouter();
  const [viTri, setViTri] = useState<ViTri>({ kind: "idle" });
  const [hoiThayChuoi, setHoiThayChuoi] = useState<number | null>(null);
  const [hoiXoa, setHoiXoa] = useState(false);
  const [kgRaw, setKgRaw] = useState("");
  const [kgLoi, setKgLoi] = useState(false);
  /** nơi đi của chuỗi dẫn đường = mốc đầu (cảng, hoặc chỗ tàu đang đứng với lộ trình tính lại) */
  const tenDi = kq.moc[0]?.ten ?? cangTen;

  const moBanDo = () => {
    const chuoi = chuoiChangTuMoc(kq.moc);
    if (!persistStops(chuoi)) {
      baoToast("Máy chưa giữ được chuỗi điểm cho Dẫn đường — thử lại sau.", { loai: "xau" });
      return;
    }
    setHoiThayChuoi(null);
    // Dẫn đường đi từ CẢNG XUẤT BẾN, không từ vị trí điện thoại (người ngồi nhà ở TP.HCM ⇒ chặng đầu vướng đất)
    const cang = kq.moc[0];
    if (cang) guiNoiDi({ lat: cang.lat, lon: cang.lon, ten: tenDi });
    baoToast(`Đã nạp ${chuoi.length} điểm, đi từ ${tenDi} — ⋯ › ${NHAN.dauDuong}.`, { ms: 8000 });
    router.push("/ngu-truong");
  };
  const bamBanDo = () => {
    const dangCo = loadStops(); // đọc lại kho — cũng là bước đặt cờ đọc-hỏng (K4) trước khi ghi
    if (dangCo.length) setHoiThayChuoi(dangCo.length);
    else moBanDo();
  };

  const bamViTri = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setViTri({ kind: "loi", cau: "Máy này không có định vị." });
      return;
    }
    setViTri({ kind: "dang" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
        const r = soViTri(kq, ngayDi, pos, Date.now());
        setViTri({ kind: "ok", r, pos });
        onSoViTri?.(pos, r.cachTuyenHaiLy);
      },
      (e) =>
        setViTri({
          kind: "loi",
          cau:
            e.code === 1
              ? "Máy chưa cho dùng định vị — bật quyền vị trí cho app trong cài đặt máy."
              : "Chưa bắt được định vị — ra chỗ thoáng rồi bấm lại.",
        }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  if (kq.chanBao) {
    return (
      <section aria-label="Kết quả" className="mt-4">
        <div role="alert" className="rounded-2xl bg-danger-bg px-4 py-3 text-danger">
          <p className="flex items-start gap-2 text-[1rem] font-semibold leading-snug">
            <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
            {kq.chanBao}
          </p>
          <p className="mt-1 text-[0.875rem] leading-snug">Chưa đưa lộ trình — có tin bão mới thì tính lại.</p>
        </div>
        {tuoiCa && <p className="mt-2 text-[0.8125rem] text-muted">{tuoiCa}</p>}
      </section>
    );
  }

  return (
    <section aria-label="Kết quả" className="mt-4">
      <h2 className="display text-[1.125rem] font-semibold text-navy">{kq.tuChoDung ? "Lộ trình gợi ý từ chỗ đang đứng" : "Lộ trình gợi ý"}</h2>
      {tuoiCa && <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{tuoiCa}</p>}

      {/* BA CON SỐ — gọn một hàng, cùng cỡ chữ nội dung (không số to) */}
      <dl className="surface mt-3 grid grid-cols-3 divide-x divide-line">
        <div className="px-3 py-2.5">
          <dt className="text-[0.8125rem] text-muted">Dầu, khoảng</dt>
          <dd className="text-[1rem] font-semibold text-navy">{formatDigits(String(Math.round(kq.litDau)))} lít</dd>
        </div>
        <div className="px-3 py-2.5">
          <dt className="text-[0.8125rem] text-muted">Quãng, khoảng</dt>
          <dd className="text-[1rem] font-semibold text-navy">{formatDigits(String(Math.round(kq.haiLy)))} hải lý</dd>
        </div>
        <div className="px-3 py-2.5">
          <dt className="text-[0.8125rem] text-muted">Nên về</dt>
          <dd className="text-[1rem] font-semibold text-navy">{ngayVN(kq.ngayNenVe)}</dd>
        </div>
      </dl>
      {kq.dauTheoPha && <p className="mt-1.5 text-[0.8125rem] leading-snug text-muted">{cauPha(kq.dauTheoPha)}</p>}
      {kq.thieuDau && (
        <p className="mt-2 text-[0.875rem] font-semibold leading-snug text-warn">
          Két dầu có thể không đủ (đã tính dư 30% cho gió ngược, chờ đánh).
        </p>
      )}

      <SoDoLoTrinh kq={kq} />

      {kq.lich.length > 0 && (
        <>
          <h3 className="mt-4 text-[0.875rem] font-semibold text-navy">Lịch theo ngày</h3>
          <ol className="surface mt-1.5 divide-y divide-line">
            {kq.lich.map((l, i) => (
              <li key={i} className="flex gap-3 px-3 py-2.5 text-[1rem] leading-snug">
                <span className="w-[4.5rem] shrink-0 text-[0.8125rem] text-muted">
                  {l.tuNgay === l.denNgay ? `Ngày ${l.tuNgay}` : `Ngày ${l.tuNgay}–${l.denNgay}`}
                </span>
                <span className="min-w-0 flex-1 text-foreground">{l.cau}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {kq.vung.length > 0 && (
        <>
          <h3 className="mt-4 text-[0.875rem] font-semibold text-navy">Vùng đánh</h3>
          <ol className="surface mt-1.5 divide-y divide-line">
            {kq.vung.map((v, i) => (
              <li key={v.id} className="px-3 py-2.5">
                <div className="flex items-center gap-3 text-[1rem]">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[0.8125rem] font-semibold text-white"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {v.ten}
                    {v.loai && <span className="text-[0.8125rem] text-muted"> · {v.loai}</span>}
                    {v.laDiemQuen && <span className="text-[0.8125rem] text-muted"> · điểm quen</span>}
                  </span>
                  <span className="shrink-0 text-[0.8125rem] font-semibold text-sea">{mucVung(v.dinh)}</span>
                </div>
                {v.yeuTo && v.yeuTo.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-9">
                    {v.yeuTo.map((y) => (
                      <li key={y.ngay} className="text-[0.8125rem] leading-snug text-muted">
                        {cauYeuTo(y)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {kq.ghiChu.length > 0 && (
        <ul className="mt-3 space-y-1">
          {kq.ghiChu.map((g, i) => (
            <li key={i} className="text-[0.8125rem] leading-snug text-muted">
              {g}
            </li>
          ))}
        </ul>
      )}

      {/*  BA NÚT MỘT HÀNG ở 360px: ô đầu là Lưu khi chưa lưu, thành Xoá khi đã nằm trong kho
           (bốn nút rớt hai hàng — sửa bằng bố cục, không thu chữ). */}
      <div className="mt-4 flex flex-wrap gap-2">
        {daLuu && onXoa ? (
          <button type="button" onClick={() => setHoiXoa(true)} className={`${SQ_BTN} bg-field text-danger`}>
            <TrashIcon className="h-4 w-4" />
            {NHAN.xoa}
          </button>
        ) : onLuu ? (
          <button type="button" onClick={onLuu} disabled={daLuu} className={`${SQ_BTN} bg-field text-navy disabled:opacity-60`}>
            <StarIcon className="h-4 w-4" />
            {daLuu ? NHAN.daLuu : NHAN.luu}
          </button>
        ) : null}
        <button
          type="button"
          onClick={bamBanDo}
          disabled={kq.moc.length < 2}
          aria-label="Xem lộ trình trên bản đồ — nạp các mốc vào Dẫn đường"
          className={`${SQ_BTN} bg-field text-navy disabled:opacity-60`}
        >
          <RouteIcon className="h-4 w-4" />
          {NHAN.banDo}
        </button>
        <button
          type="button"
          onClick={bamViTri}
          disabled={viTri.kind === "dang"}
          aria-label="Tôi đang ở đâu so với lộ trình"
          className={`${SQ_BTN} bg-field text-navy disabled:opacity-60`}
        >
          <CrosshairIcon className="h-4 w-4" />
          {NHAN.viTri}
        </button>
      </div>
      {daLuu && <p className="mt-1.5 text-[0.8125rem] text-muted">Đã lưu trong máy — mở lại được khi mất sóng.</p>}

      {luuLoi && (
        <p role="alert" className="mt-2 text-[0.875rem] font-semibold leading-snug text-danger">
          {luuLoi}
        </p>
      )}

      <div aria-live="polite" className="mt-2">
        {viTri.kind === "dang" && <p className="text-[0.875rem] text-muted">Đang lấy định vị…</p>}
        {viTri.kind === "loi" && <p className="text-[0.875rem] leading-snug text-warn">{viTri.cau}</p>}
        {viTri.kind === "ok" && (
          <div className="space-y-0.5 text-[0.875rem] leading-snug text-foreground">
            <p>Cách tuyến {formatDigits(String(Math.round(viTri.r.cachTuyenHaiLy)))} hải lý.</p>
            <p>{viTri.r.theoKeHoach}</p>
            {viTri.r.lech && <p className="text-muted">Đang đi khác kế hoạch — không sao, thuyền trưởng quyết.</p>}
            {onTinhLai && (
              <button
                type="button"
                onClick={() => onTinhLai(viTri.pos)}
                aria-label="Tính lại lộ trình từ chỗ tàu đang đứng, với số ngày còn lại"
                className={`${SQ_BTN} mt-1.5 bg-field text-navy`}
              >
                <RouteIcon className="h-4 w-4" />
                {NHAN.tinhLai}
              </button>
            )}
          </div>
        )}
        {tinhLaiLoi && <p className="mt-1 text-[0.875rem] leading-snug text-warn">{tinhLaiLoi}</p>}
      </div>

      {hoiSanLuong && onSanLuong && (
        <div className="mt-4">
          <label className="block">
            <span className="mb-1 block text-[0.875rem] leading-snug text-navy">
              Chuyến này được bao nhiêu ký cá? <span className="text-muted">Chỉ lưu trong máy, để tự xem lộ trình có giúp được không.</span>
            </span>
            <span className="grid grid-cols-[1fr_auto] gap-2">
              <input
                inputMode="numeric"
                value={kgRaw}
                placeholder="Số ký"
                onChange={(e) => {
                  setKgRaw(e.target.value);
                  setKgLoi(false);
                }}
                aria-invalid={kgLoi}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  const kg = docKg(kgRaw);
                  if (kg == null || !onSanLuong(kg)) setKgLoi(true);
                  else setKgRaw("");
                }}
                className={`${SQ_BTN} bg-field text-navy`}
              >
                {NHAN.luu}
              </button>
            </span>
          </label>
          {kgLoi && <p className="mt-1 text-[0.8125rem] text-danger">Nhập số ký từ 1 trở lên.</p>}
        </div>
      )}
      {cauDo && <p className="mt-2 text-[0.8125rem] leading-snug text-muted">{cauDo}</p>}
      {nhatKyLoi && (
        <p role="alert" className="mt-2 text-[0.875rem] font-semibold leading-snug text-danger">
          {nhatKyLoi}
        </p>
      )}

      {hoiThayChuoi != null && (
        <ConfirmDialog
          title="Thay chuỗi điểm đang có?"
          message={`Dẫn đường đang giữ ${hoiThayChuoi} điểm bà con chấm. Nạp lộ trình này sẽ thay chuỗi đó.`}
          cancelLabel={NHAN.huy}
          confirmLabel={NHAN.dongY}
          danger={false}
          onCancel={() => setHoiThayChuoi(null)}
          onConfirm={moBanDo}
        />
      )}
      {hoiXoa && onXoa && (
        <ConfirmDialog
          title="Xoá lộ trình đã lưu?"
          message="Xoá rồi không lấy lại được."
          cancelLabel={NHAN.huy}
          confirmLabel={NHAN.xoa}
          onCancel={() => setHoiXoa(false)}
          onConfirm={() => {
            setHoiXoa(false);
            onXoa();
          }}
        />
      )}
    </section>
  );
}
