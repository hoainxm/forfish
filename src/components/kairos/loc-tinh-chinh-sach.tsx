"use client";

/*
  LỌC TỈNH CỦA TAB CHÍNH SÁCH (14 §21c) — MỘT nút nhỏ "📍 <Tỉnh> ▾" bên trái dưới thanh tab (anh Long 2026-10-26: "design
  cái lọc quá xấu quá thô" — thay HomeBar ba nút to chồng dưới segmented control). Chạm ⇒ hộp chọn tỉnh dùng chung
  (`ChonTinhPopover`, region-filter) có thêm hàng "Cả nước" + "Theo vị trí máy" ở đầu. Chọn tỉnh ⇒ ghi tỉnh nhà như Chợ cá
  (`useHome().chonTinh` — vào tàu đang chọn, không có tàu thì vào phiên) + về chế độ "Gần", thôi theo vị trí. Chưa có
  tỉnh ⇒ nút ghi "Cả nước" (dòng tin cả nước).
  VỊ TRÍ MÁY (sửa 2026-11-06, anh Long: "thêm cái cơ sở là vị trí gps của điện thoại đang sử dụng để chọn luôn các tin
  liên quan tỉnh đó"): tỉnh đo được (lib/tinh-vi-tri — cảng cá gần nhất ≤150 km, không mạng) THẮNG tỉnh cảng nhà; xa
  bờ / chưa đo / từ chối ⇒ lùi về cảng nhà. Không mạng: chỉ đổi tham số `province` của dòng tin.
*/

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, LayersIcon, PinIcon } from "@/components/icons";
import { Popover } from "@/components/ui/popover";
import { ChonTinhPopover } from "@/components/ui/region-filter";
import { LOAI_TIN } from "@/lib/kairos/chinh-sach.mjs";
import { tenTinhGon, type HomePref } from "@/lib/region";
import type { KetQuaDo } from "@/lib/use-tinh-vi-tri";
import { NHAN, NHAN_LOAI_TIN } from "@/lib/labels";

/** khuôn nút lọc nhỏ dùng chung cho Tỉnh + Loại tin (một hàng dưới thanh tab) */
const NUT = "inline-flex h-9 max-w-full items-center gap-1.5 rounded-full pl-3 pr-2.5 text-[0.875rem] font-semibold transition";
const NUT_THUONG = "bg-sea/8 text-navy active:bg-sea/15";
const NUT_DANG_LOC = "bg-navy text-white";

const LOI_VI_TRI: Record<Exclude<KetQuaDo, "ok">, string> = {
  "tu-choi": "Máy chưa cho xem vị trí — bật Vị trí trong cài đặt máy, hoặc chọn tỉnh bên dưới.",
  "xa-bo": "Máy đang ở xa bờ — chọn tỉnh bên dưới nhé.",
  loi: "Chưa bắt được vị trí — thử lại hoặc chọn tỉnh bên dưới.",
};

export function LocTinhChinhSach({
  home,
  tinhTen,
  gan,
  setGan,
  chonTinh,
  viTri,
}: {
  home: HomePref;
  /** tỉnh đang lọc (vị trí máy hoặc cảng nhà); null = chưa có tỉnh */
  tinhTen: string | null;
  /** true = chỉ tỉnh đó (+ văn bản cả nước); false = cả nước */
  gan: boolean;
  setGan: (v: boolean) => void;
  chonTinh: (province: string) => boolean;
  viTri: { on: boolean; ten: string | null; dangDo: boolean; xin: () => Promise<KetQuaDo>; setOn: (v: boolean) => void };
}) {
  const [nut, setNut] = useState<HTMLButtonElement | null>(null);
  const [mo, setMo] = useState(false);
  const [hong, setHong] = useState(false);
  const [loiViTri, setLoiViTri] = useState<string | null>(null);
  const theoTinh = gan && !!tinhTen;
  const nhan = theoTinh && tinhTen ? tenTinhGon(tinhTen) : "Cả nước";
  return (
    <div className="min-w-0">
      <button
        ref={setNut}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={mo}
        aria-label={`${NHAN.chonTinh}: ${nhan}${theoTinh && viTri.on ? " (theo vị trí máy)" : ""}`}
        onClick={() => setMo((v) => !v)}
        className={`${NUT} ${NUT_THUONG}`}
      >
        <PinIcon className="h-4 w-4 shrink-0 text-sea" />
        <span className="min-w-0 truncate">{nhan}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-foreground/55 transition ${mo ? "rotate-180" : ""}`} />
      </button>
      {hong && (
        <p role="alert" className="mt-1.5 text-[0.875rem] text-warn">
          Máy chưa lưu được tỉnh — bà con thử lại nhé.
        </p>
      )}
      {mo && (
        <ChonTinhPopover
          anchor={nut}
          dangChon={tinhTen ?? home.province}
          caNuoc={{
            on: !theoTinh,
            onChon: () => {
              setGan(false);
              setMo(false);
            },
          }}
          viTri={{
            on: theoTinh && viTri.on,
            ten: viTri.ten,
            dangDo: viTri.dangDo,
            loi: loiViTri,
            onChon: () => {
              setLoiViTri(null);
              void viTri.xin().then((kq) => {
                if (kq !== "ok") return setLoiViTri(LOI_VI_TRI[kq]);
                viTri.setOn(true);
                setGan(true);
                setMo(false);
              });
            },
          }}
          onChon={(p) => {
            const ok = chonTinh(p);
            setHong(!ok);
            setMo(false);
            if (ok) {
              viTri.setOn(false); // bà con tự chọn tỉnh ⇒ thôi theo vị trí máy
              setGan(true);
            }
          }}
          onClose={() => {
            setLoiViTri(null);
            setMo(false);
          }}
        />
      )}
    </div>
  );
}

/*
  LỌC LOẠI TIN (14 §21d, anh Long 2026-10-26: "cho loại lọc thêm loại tin (ví dụ tin dầu, tin hỗ trợ, tin cảnh báo…)").
  Nút cùng khuôn nút tỉnh, đứng cạnh; đang lọc ⇒ nút đặc navy để bà con biết danh sách đang bị thu hẹp. Chạm ⇒ Popover:
  "Tất cả" + 6 loại (nhãn ≤2 chữ, NHAN_LOAI_TIN). Phân loại trong máy (chinh-sach.loaiTin), không mạng.
*/
export function LocLoaiTin({ loai, setLoai }: { loai: string | null; setLoai: (v: string | null) => void }) {
  const [nut, setNut] = useState<HTMLButtonElement | null>(null);
  const [mo, setMo] = useState(false);
  const ten = loai ? NHAN_LOAI_TIN[loai as keyof typeof NHAN_LOAI_TIN] : "Loại tin";
  const chon = (v: string | null) => {
    setLoai(v);
    setMo(false);
  };
  const hang = (v: string | null, nhan: string) => {
    const on = loai === v;
    return (
      <li key={v ?? "tat-ca"}>
        <button
          type="button"
          role="option"
          aria-selected={on}
          onClick={() => chon(v)}
          className={`flex min-h-(--h-row) w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-[0.9375rem] font-semibold ${on ? "text-sea" : "text-navy"}`}
        >
          <span>{nhan}</span>
          {on && <CheckIcon className="h-5 w-5 shrink-0" />}
        </button>
      </li>
    );
  };
  return (
    <div className="min-w-0">
      <button
        ref={setNut}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={mo}
        aria-label={`Loại tin: ${loai ? ten : "Tất cả"}`}
        onClick={() => setMo((v) => !v)}
        className={`${NUT} ${loai ? NUT_DANG_LOC : NUT_THUONG}`}
      >
        <LayersIcon className={`h-4 w-4 shrink-0 ${loai ? "text-white" : "text-sea"}`} />
        <span className="min-w-0 truncate">{ten}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 transition ${loai ? "text-white/80" : "text-foreground/55"} ${mo ? "rotate-180" : ""}`} />
      </button>
      {mo && (
        <Popover anchor={nut} label="Loại tin" onClose={() => setMo(false)} className="w-[13rem] p-2">
          <ul role="listbox" aria-label="Loại tin">
            {hang(null, "Tất cả")}
            {LOAI_TIN.map((l) => hang(l, NHAN_LOAI_TIN[l]))}
          </ul>
        </Popover>
      )}
    </div>
  );
}
