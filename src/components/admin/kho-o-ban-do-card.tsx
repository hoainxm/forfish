"use client";

/*  THẺ "KHO Ô BẢN ĐỒ" (2026-11-04) — /quan-tri › Hệ thống. Anh Long: "đưa vào quản trị rồi tự chạy cần gì lên env".
    Kho tự chọn thư mục (lib/kho-o-ban-do › chonThuMucKho); thẻ này cho xem kho nằm đâu, ghi được không, mỗi lớp
    bao nhiêu ô, máy nhà (gpu-desktop) đẩy lần cuối lúc nào, và xoá từng ngăn. Trần dung lượng đổi ở ô Cấu hình. */

import { useCallback, useEffect, useState } from "react";
import { AdminSkeleton } from "@/components/admin/admin-nav";
import { fmtDT } from "@/components/admin/quan-tri-chung";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";

type Nhom = { ngan: "song" | "may-nha"; src: string; so: number; byte: number; moiNhat: number | null };
type KhoO = { thuMuc: string; ghiDuoc: boolean; tranMb: number; nhom: Nhom[] };

const TEN_LOP: Record<string, string> = {
  chart: "Hải đồ độ sâu",
  seamark: "Phao đèn",
  sst: "Nước nóng lạnh",
  chlorophyll: "Vùng nhiều mồi",
};
const TEN_NGAN = { song: "Máy chủ tự tải", "may-nha": "Máy nhà đẩy lên" } as const;
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`;

export function KhoOBanDoCard() {
  const [kho, setKho] = useState<KhoO | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [hoi, setHoi] = useState<Nhom["ngan"] | null>(null);
  const [dangXoa, setDangXoa] = useState(false);

  const tai = useCallback(() => {
    setLoi(null);
    fetch(apiUrl("/api/admin/kho-o"), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json()) as { ok: boolean; code?: string } & Partial<KhoO>;
        if (!j.ok) throw new Error(j.code ?? "load");
        setKho(j as KhoO);
      })
      .catch((e: Error) =>
        setLoi(e.message === "admin_only" ? "Chỉ Quản trị viên xem được kho ô." : "Chưa tải được kho ô. Thử lại sau."),
      );
  }, []);
  useEffect(tai, [tai]);

  async function xoa(ngan: Nhom["ngan"]) {
    setHoi(null);
    setDangXoa(true);
    try {
      const r = await fetch(apiUrl("/api/admin/kho-o"), {
        method: "POST",
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ xoa: ngan }),
      });
      if (!r.ok) throw new Error();
      tai();
    } catch {
      setLoi("Chưa xoá được. Thử lại sau.");
    } finally {
      setDangXoa(false);
    }
  }

  const tong = (ngan: Nhom["ngan"]) => (kho?.nhom ?? []).filter((n) => n.ngan === ngan).reduce((s, n) => s + n.byte, 0);

  return (
    <div className="surface p-4">
      <p className="display text-[1.125rem] font-bold text-navy">Kho ô bản đồ</p>
      <p className="mt-0.5 text-[0.875rem] text-foreground/70">
        Máy chủ cất ô bản đồ đã tải (hải đồ, phao, ảnh vệ tinh) để khỏi gọi nguồn ngoài mỗi lượt; nguồn sập vẫn phát ô cũ.
        Máy nhà tải trước vùng biển Việt Nam 2 lượt mỗi ngày. Tự chạy, không cần cài đặt.
      </p>
      {loi && <p className="mt-2 text-[0.875rem] font-semibold text-danger">{loi}</p>}
      {!kho && !loi && (
        <div className="mt-3">
          <AdminSkeleton label="Đang đếm kho ô…" rows={2} />
        </div>
      )}
      {kho && (
        <>
          <p className="mt-2 break-all text-[0.8125rem] text-muted">Thư mục: {kho.thuMuc}</p>
          {!kho.ghiDuoc && (
            <p role="alert" className="mt-1 text-[0.875rem] font-semibold text-danger">
              Máy chủ không ghi được vào thư mục này — kho không lưu được ô mới, bản đồ vẫn chạy nhưng gọi nguồn ngoài mỗi lượt.
            </p>
          )}
          {(["may-nha", "song"] as const).map((ngan) => (
            <div key={ngan} className="mt-3 rounded-xl bg-field/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.9375rem] font-bold text-navy">
                  {TEN_NGAN[ngan]} · {mb(tong(ngan))}
                  {ngan === "song" && <span className="font-normal text-muted"> / trần {kho.tranMb} MB</span>}
                </span>
                <button
                  type="button"
                  disabled={dangXoa || tong(ngan) === 0}
                  onClick={() => setHoi(ngan)}
                  className="shrink-0 rounded-lg border border-line bg-card px-3 py-1.5 text-[0.875rem] font-bold text-navy disabled:opacity-50"
                >
                  Xoá
                </button>
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {kho.nhom
                  .filter((n) => n.ngan === ngan && (n.so > 0 || ngan === "song"))
                  .map((n) => (
                    <li key={n.src} className="flex justify-between gap-2 text-[0.8125rem] text-foreground/80">
                      <span>{TEN_LOP[n.src] ?? n.src}</span>
                      <span className="text-muted">
                        {n.so.toLocaleString("vi-VN")} ô · {mb(n.byte)}
                        {n.moiNhat ? ` · ${fmtDT(new Date(n.moiNhat).toISOString())}` : ""}
                      </span>
                    </li>
                  ))}
                {ngan === "may-nha" && tong("may-nha") === 0 && (
                  <li className="text-[0.8125rem] text-muted">Máy nhà chưa đẩy ô nào lên máy chủ này.</li>
                )}
              </ul>
              {hoi === ngan && (
                <div role="alertdialog" className="mt-2 rounded-xl bg-danger-bg p-3">
                  <p className="text-[0.9375rem] font-bold text-danger">Xoá hết {TEN_NGAN[ngan].toLowerCase()}?</p>
                  <p className="mt-1 text-[0.875rem] text-foreground/80">
                    Bản đồ vẫn chạy; ô sẽ tự đầy lại theo lượt xem
                    {ngan === "may-nha" ? " và lượt máy nhà đẩy tới" : ""}. Trong lúc đó máy chủ gọi nguồn ngoài nhiều hơn.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => xoa(ngan)}
                      className="rounded-lg bg-danger px-4 py-2 text-[0.875rem] font-bold text-white"
                    >
                      Xoá thật
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoi(null)}
                      className="rounded-lg border border-line bg-card px-4 py-2 text-[0.875rem] font-bold text-navy"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
