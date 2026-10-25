"use client";

/*
  HỘP TÌM "ĐI ĐÂU?" (BD-02, rà FB 2026-10-25) — Popover neo ngay dưới ô tìm (03 §6
  mục 9), rộng bằng ô. MIỄN PHÍ cho mọi tài khoản đã đăng nhập: ô tìm không bao
  giờ là tường thu phí (Google Maps/FB); chỉ Dẫn đường còn Premium.
    (1) ô gõ (SearchField) tự focus · (2) "Đã lưu" ≤5 điểm từ lib/places (trống thì
    ẩn nhóm, KHÔNG câu nhắc) · (3) "Cảng" — chưa gõ: ≤6 cảng tỉnh nhà (hoặc loại I),
    gõ: lọc bỏ dấu ≤8 · (4) hàng "Toạ độ" mở ô toạ độ có sẵn; gõ chuỗi trông như
    toạ độ thì hàng này thành "Đến 10,52 · 108,21" và lên đầu.
  Dữ liệu đều trong máy ⇒ mất sóng vẫn chạy y hệt. Luật thuần ở lib/ban-do-tim.ts.
  Back/Esc/chạm ngoài: Popover tự lo.
*/
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnchorIcon, CrosshairIcon, PinIcon, StarIcon } from "@/components/icons";
import { Popover } from "@/components/ui/popover";
import { useHome } from "@/components/ui/region-filter";
import { SearchField } from "@/components/ui/search-field";
import {
  cauKhongThay,
  docToaDoNhanh,
  nhanToaDo,
  timCang,
  timDiemLuu,
  type KetQuaTim,
} from "@/lib/ban-do-tim";
import { NHAN } from "@/lib/labels";
import type { SavedPlace } from "@/lib/places";

// nợ: "Cảng"/"Toạ độ" chưa có trong labels.ts (chỉ khu chợ cá được thêm nhãn lô này); có nhãn thì trỏ NHAN.*
const NHAN_CANG = NHAN.cang;
const NHAN_TOA_DO = NHAN.toaDo;

export function TimDiemPopover({
  anchor,
  places,
  onChon,
  onToaDo,
  onClose,
}: {
  anchor: HTMLElement | null;
  places: SavedPlace[];
  /** chọn một chỗ ⇒ cha bay tới + ghim + mở ngăn gió sóng */
  onChon: (lat: number, lon: number) => void;
  /** mở ô gõ toạ độ có sẵn (neo cùng ô) */
  onToaDo: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const { home } = useHome();
  const tinhNha = home.province;
  const daLuu = useMemo(() => timDiemLuu(q, places), [q, places]);
  const cang = useMemo(() => timCang(q, tinhNha), [q, tinhNha]);
  const toaDo = useMemo(() => docToaDoNhanh(q), [q]);
  const trong = q.trim() !== "" && daLuu.length === 0 && cang.length === 0 && !toaDo;

  // SearchField không có autoFocus — focus ô gõ sau khi Popover đặt xong vị trí
  const oGo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => oGo.current?.querySelector("input")?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, []);

  const hangToaDo = (
    <Hang
      key="toa-do"
      icon={<CrosshairIcon className="h-5 w-5" aria-hidden />}
      ten={toaDo ? nhanToaDo(toaDo.lat, toaDo.lon) : `Gõ ${NHAN_TOA_DO.toLowerCase()}…`}
      onClick={() => (toaDo ? onChon(toaDo.lat, toaDo.lon) : onToaDo())}
    />
  );

  return (
    <Popover anchor={anchor} label="Đi đâu — tìm cảng, điểm đã lưu, toạ độ" onClose={onClose} className="max-w-[calc(100vw-1rem)]">
      {/* rộng bằng ô tìm: Popover co theo con, con lấy bề ngang của ô (padding nằm trong con, border-box) */}
      <div style={{ width: anchor ? anchor.getBoundingClientRect().width : undefined }} className="min-w-[16rem] max-w-full p-2">
        <div ref={oGo}>
          <SearchField value={q} onChange={setQ} placeholder="Tên cảng hoặc toạ độ" label="Tìm cảng, điểm đã lưu hoặc toạ độ" />
        </div>
        <ul className="mt-1">
          {toaDo && hangToaDo}
          {daLuu.length > 0 && (
            <>
              <Nhom>{NHAN.daLuu}</Nhom>
              {daLuu.map((r) => (
                <HangKetQua key={r.id} r={r} onChon={onChon} />
              ))}
            </>
          )}
          {cang.length > 0 && (
            <>
              <Nhom>{NHAN_CANG}</Nhom>
              {cang.map((r) => (
                <HangKetQua key={r.id} r={r} onChon={onChon} />
              ))}
            </>
          )}
          {trong && (
            <li className="px-3 py-2 text-[0.875rem] text-foreground/55" role="status">
              {cauKhongThay(q)}
            </li>
          )}
          {!toaDo && hangToaDo}
        </ul>
      </div>
    </Popover>
  );
}

function Nhom({ children }: { children: ReactNode }) {
  return <li className="px-3 pb-0.5 pt-2 text-[0.75rem] font-semibold text-foreground/55">{children}</li>;
}

function HangKetQua({ r, onChon }: { r: KetQuaTim; onChon: (lat: number, lon: number) => void }) {
  const icon =
    r.loai === "cang" ? (
      <AnchorIcon className="h-5 w-5" aria-hidden />
    ) : r.phu ? (
      <StarIcon className="h-5 w-5" aria-hidden />
    ) : (
      <PinIcon className="h-5 w-5" aria-hidden />
    );
  return <Hang icon={icon} ten={r.ten} phu={r.phu} onClick={() => onChon(r.lat, r.lon)} />;
}

/** một hàng kết quả: icon 1.25rem · tên 1rem · tỉnh 0.8125rem mờ · cao --h-row */
function Hang({ icon, ten, phu, onClick }: { icon: ReactNode; ten: string; phu?: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-(--h-row) w-full items-center gap-3 rounded-xl px-3 text-left text-navy transition active:bg-field"
      >
        <span className="shrink-0 text-sea">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-[1rem] font-semibold">{ten}</span>
        {phu && <span className="shrink-0 text-[0.8125rem] text-foreground/55">{phu}</span>}
      </button>
    </li>
  );
}
