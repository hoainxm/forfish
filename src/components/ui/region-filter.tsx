"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { CheckIcon, PinIcon } from "@/components/icons";
import { Popover } from "@/components/ui/popover";
import { SearchField } from "@/components/ui/search-field";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { useBoats } from "@/lib/boat-store";
import { boDau } from "@/lib/cho-ca";
import { NHAN } from "@/lib/labels";
import {
  COASTAL_PROVINCES,
  docHomePhien,
  ghiHomePhien,
  HomePref,
  provinceKey,
  relevanceRank,
} from "@/lib/region";

/*
  Lọc theo "tàu của tôi ở đâu" — để chỉ hiện thông tin GẦN bà con.

  NGUỒN SỰ THẬT = `current boat.homeProvince` (khai báo ở BoatSwitcher). Trước đây có 1 nguồn
  localStorage riêng (`forfish.home.v1`) trùng với khai báo trong tàu → 3 chỗ hỏi cùng câu,
  không sync. Đã xóa, KHÔNG tạo lại.

  CHỌN TẠI CHỖ (CC-09 + BD-05, 2026-10-25, như chip địa điểm của FB Marketplace): nút "Chọn"
  mở Popover danh sách tỉnh ven biển ngay trên màn — bà con không phải rời Chợ cá sang Tàu tôi
  chỉ để xem vựa Khánh Hòa.
   · Có tàu đang chọn ⇒ ghi thẳng `homeProvince` của tàu đó (vẫn một nguồn).
   · Chưa có tàu ⇒ chỉ nhớ trong PHIÊN (`sessionStorage forfish.home.phien.v1`, lib/region) —
     đóng tab là quên, nên không có nguồn thứ hai sống lâu để lệch.
  useHome(): đọc tỉnh nhà từ tàu trước, phiên sau; `chonTinh()` ghi theo luật trên.
  HomeBar:   chưa có tỉnh ⇒ một hàng mảnh "Chưa có tỉnh cảng nhà · Chọn"; có tỉnh ⇒ toggle
             "Gần <Tỉnh> / Cả nước" + nút "Đổi" mở lại Popover.
*/

/* kho phiên không bắn sự kiện ⇒ tự thông báo cho mọi useHome() đang gắn khi đổi tỉnh */
const nghe = new Set<() => void>();
function theoDoiPhien(cb: () => void) {
  nghe.add(cb);
  return () => void nghe.delete(cb);
}
const docPhien = () => docHomePhien();
const docPhienServer = () => undefined;

export function useHome(): {
  home: HomePref;
  ready: boolean;
  /** ghi tỉnh: vào tàu đang chọn nếu có, không thì vào phiên. `false` = máy không ghi được. */
  chonTinh: (province: string) => boolean;
} {
  const { current, ready, updateBoat } = useBoats();
  const phien = useSyncExternalStore(theoDoiPhien, docPhien, docPhienServer);
  const chonTinh = useCallback(
    (province: string) => {
      if (current) return updateBoat({ ...current, homeProvince: province });
      const ok = ghiHomePhien(province);
      if (ok) nghe.forEach((f) => f());
      return ok;
    },
    [current, updateBoat],
  );
  return {
    home: current?.homeProvince
      ? { province: current.homeProvince, portId: current.homePortId }
      : { province: phien },
    ready,
    chonTinh,
  };
}

/** Lọc danh sách theo tỉnh nhà: near=true chỉ giữ cùng miền; luôn sắp gần→xa. */
export function applyHome<T>(
  items: T[],
  getProvince: (x: T) => string | undefined,
  homeProvince: string | undefined,
  near: boolean,
): T[] {
  const ranked = items.map((x) => ({
    x,
    r: relevanceRank(getProvince(x), homeProvince),
  }));
  const filtered =
    near && homeProvince ? ranked.filter((o) => o.r <= 1) : ranked;
  return filtered.sort((a, b) => a.r - b.r).map((o) => o.x);
}

/**
 * Thanh lọc "Gần tôi / Cả nước". Chưa có tỉnh ⇒ hàng mảnh + nút Chọn (mở Popover tỉnh).
 * `home` vẫn nhận từ caller (giữ chữ ký cũ); việc ghi đi qua `useHome().chonTinh`.
 */
export function HomeBar({
  home,
  near,
  setNear,
}: {
  home: HomePref;
  /** Giữ chữ ký cũ để caller không phải đổi — không dùng tới. */
  setHome?: (h: HomePref) => void;
  near: boolean;
  setNear: (v: boolean) => void;
}) {
  const { chonTinh } = useHome();
  const [nutEl, setNutEl] = useState<HTMLButtonElement | null>(null);
  const [mo, setMo] = useState(false);
  /** máy không ghi được tỉnh (kho tàu / phiên hỏng) — nói một dòng, không nuốt */
  const [luuHong, setLuuHong] = useState(false);

  const chon = (p: string) => {
    const ok = chonTinh(p);
    setLuuHong(!ok);
    setMo(false);
    if (ok) setNear(true);
  };

  const popover = mo && (
    <ChonTinhPopover anchor={nutEl} dangChon={home.province} onChon={chon} onClose={() => setMo(false)} />
  );
  const loi = luuHong && (
    <p role="alert" className="mb-2 rounded-xl bg-warn-bg px-3 py-2 text-[0.875rem] font-semibold text-warn">
      Máy chưa lưu được tỉnh — bà con thử lại nhé.
    </p>
  );

  if (!home.province) {
    return (
      <>
        {/* một hàng mảnh (BD-05) thay thẻ nhắc 3 dòng; "Chọn" mở danh sách ngay tại chỗ */}
        <div className="mb-3 flex min-h-(--h-row) items-center gap-2 border-b border-line">
          <p className="min-w-0 flex-1 text-[0.875rem] text-foreground/65">Chưa có tỉnh cảng nhà</p>
          <button
            ref={setNutEl}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={mo}
            onClick={() => setMo((v) => !v)}
            className={`${SQ_BTN} bg-field text-sea`}
          >
            <PinIcon className="h-4 w-4" />
            {NHAN.chon}
          </button>
        </div>
        {loi}
        {popover}
      </>
    );
  }
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setNear(true)}
          aria-pressed={near}
          className={`min-h-(--h-row) min-w-0 flex-1 truncate rounded-xl px-2 text-[0.875rem] font-semibold ${
            near ? "bg-navy text-white" : "bg-field text-foreground/70"
          }`}
        >
          Gần {home.province}
        </button>
        <button
          type="button"
          onClick={() => setNear(false)}
          aria-pressed={!near}
          className={`min-h-(--h-row) min-w-0 flex-1 rounded-xl px-2 text-[0.875rem] font-semibold ${
            !near ? "bg-navy text-white" : "bg-field text-foreground/70"
          }`}
        >
          Cả nước
        </button>
        {/* đổi tỉnh ngay tại chỗ — không bắt sang Tàu tôi */}
        <button
          ref={setNutEl}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={mo}
          aria-label={NHAN.chonTinh}
          onClick={() => setMo((v) => !v)}
          className={`${SQ_BTN} min-w-0 bg-field text-sea`}
        >
          {NHAN.doi}
        </button>
      </div>
      {loi}
      {popover}
    </>
  );
}

/** Danh sách tỉnh ven biển Bắc→Nam (`COASTAL_PROVINCES`), ✓ ở tỉnh đang chọn, cuộn trong
 *  Popover; ô lọc nhanh vì 22 hàng (>8). `caNuoc` (Kairos tab Chính sách, 14 §21c) ⇒ thêm hàng "Cả nước" ở đầu —
 *  `dangChon` rỗng + `caNuoc.on` thì ✓ ở hàng đó. Export để màn khác dùng lại hộp chọn, không chép. */
export function ChonTinhPopover({
  anchor,
  dangChon,
  onChon,
  onClose,
  caNuoc,
}: {
  anchor: HTMLElement | null;
  dangChon?: string;
  onChon: (province: string) => void;
  onClose: () => void;
  caNuoc?: { on: boolean; onChon: () => void };
}) {
  const [q, setQ] = useState("");
  const qf = boDau(q.trim());
  const kChon = provinceKey(dangChon);
  const ds = COASTAL_PROVINCES.filter((p) => !qf || boDau(p.name).includes(qf));
  return (
    <Popover anchor={anchor} label={NHAN.chonTinh} onClose={onClose} className="w-[16rem] p-2">
      <SearchField value={q} onChange={setQ} placeholder="Tìm tỉnh…" label="Tìm tỉnh" className="mb-1" />
      {/* cuộn TRONG danh sách (không để Popover tự cuộn): Popover đo lại khi cuộn và tạm bỏ
          maxHeight ⇒ scrollTop về 0 — kiểm thật 2026-10-25, chạm hàng dưới bị trượt */}
      <ul
        role="listbox"
        aria-label={NHAN.chonTinh}
        className="max-h-[42dvh] overflow-y-auto [overscroll-behavior:contain]"
      >
        {caNuoc && !qf && (
          <li className="border-b border-line">
            <button
              type="button"
              role="option"
              aria-selected={caNuoc.on}
              onClick={caNuoc.onChon}
              className={`flex min-h-(--h-row) w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-[0.9375rem] font-semibold ${
                caNuoc.on ? "text-sea" : "text-navy"
              }`}
            >
              <span>Cả nước</span>
              {caNuoc.on && <CheckIcon className="h-5 w-5 shrink-0" />}
            </button>
          </li>
        )}
        {ds.map((p) => {
          const on = !caNuoc?.on && kChon !== "" && provinceKey(p.name) === kChon;
          return (
            <li key={p.name}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onChon(p.name)}
                className={`flex min-h-(--h-row) w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-[0.9375rem] font-semibold ${
                  on ? "text-sea" : "text-navy"
                }`}
              >
                <span className="min-w-0 truncate">{p.name}</span>
                {on && <CheckIcon className="h-5 w-5 shrink-0" />}
              </button>
            </li>
          );
        })}
        {ds.length === 0 && (
          <li className="px-3 py-3 text-[0.875rem] text-foreground/65">Không có tỉnh ven biển tên này.</li>
        )}
      </ul>
    </Popover>
  );
}
