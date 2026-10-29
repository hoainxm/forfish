"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NHAN } from "@/lib/labels";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { baoToast } from "@/lib/toast";
import { AlertIcon, CrosshairIcon, RouteIcon, StarIcon, TrashIcon } from "@/components/icons";
import { formatDigits } from "@/lib/format";
import { loadStops, persistStops } from "@/lib/route-stops";
import { chuoiChangTuMoc, mucVung, soViTri, type KetQuaSoViTri } from "@/lib/lo-trinh/so-vi-tri";
import type { LoTrinhKetQua } from "@/lib/lo-trinh/types";

/*
  KẾT QUẢ ĐỀ XUẤT LỘ TRÌNH (09-ba-spec §4 output, §5c) — dùng chung cho lộ trình VỪA TÍNH và lộ
  trình ĐÃ LƯU mở lại. Chữ theo thang 03 §0, nhỏ gọn (anh Long 2026-10-29: "chữ cho nhỏ đẹp"):
  ba con số là hàng 1rem 600 + nhãn 0.8125rem `text-muted` — KHÔNG số to. Có `chanBao` ⇒ băng đỏ
  THAY cho lộ trình (không lịch, không vùng, không nút Lưu/Bản đồ). Không in điểm số vùng — chỉ
  thang Được/Khá/Tốt. Disclaimer cố định nằm ở đầu màn (ManHeader sub), không lặp ở đây.
*/

const ngayVN = (iso: string) => {
  const [, m, d] = iso.split("-");
  return m && d ? `${d}/${m}` : iso;
};

type ViTri =
  | { kind: "idle" }
  | { kind: "dang" }
  | { kind: "ok"; r: KetQuaSoViTri }
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
}) {
  const router = useRouter();
  const [viTri, setViTri] = useState<ViTri>({ kind: "idle" });
  const [hoiThayChuoi, setHoiThayChuoi] = useState<number | null>(null);
  const [hoiXoa, setHoiXoa] = useState(false);

  const moBanDo = () => {
    const chuoi = chuoiChangTuMoc(kq.moc);
    if (!persistStops(chuoi)) {
      baoToast("Máy chưa giữ được chuỗi điểm cho Dẫn đường — thử lại sau.", { loai: "xau" });
      return;
    }
    setHoiThayChuoi(null);
    baoToast(`Đã nạp ${chuoi.length} điểm — ⋯ › ${NHAN.loTrinh}, Đi từ: ${cangTen}.`, { ms: 8000 });
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
      (p) =>
        setViTri({
          kind: "ok",
          r: soViTri(kq, ngayDi, { lat: p.coords.latitude, lon: p.coords.longitude }, Date.now()),
        }),
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
      <h2 className="display text-[1.125rem] font-semibold text-navy">Lộ trình gợi ý</h2>
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
      {kq.thieuDau && (
        <p className="mt-2 text-[0.875rem] font-semibold leading-snug text-warn">
          Két dầu có thể không đủ (đã tính dư 30% cho gió ngược, chờ đánh).
        </p>
      )}

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
              <li key={v.id} className="flex items-center gap-3 px-3 py-2.5 text-[1rem]">
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[0.8125rem] font-semibold text-white"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {v.ten}
                  {v.laDiemQuen && <span className="text-[0.8125rem] text-muted"> · điểm quen</span>}
                </span>
                <span className="shrink-0 text-[0.8125rem] font-semibold text-sea">{mucVung(v.dinh)}</span>
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
          </div>
        )}
      </div>

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
