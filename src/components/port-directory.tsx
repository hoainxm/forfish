"use client";

import { datCangNha as ghiCangNha } from "@/lib/cang-nha";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ACTIVE_PORTS, PORT_COORD_SAI, type FishingPortDir } from "@/data/fishing-ports";
import { PageHeader } from "@/components/page-header";
import { SearchField } from "@/components/ui/search-field";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { useHome, HomeBar, applyHome } from "@/components/ui/region-filter";
import { homeOf, loadPlaces, placeId } from "@/lib/places";
import { duongDanBanDoToi } from "@/lib/ban-do-link";
import { NHAN } from "@/lib/labels";
import { AnchorIcon, ChevronDownIcon, PinIcon } from "@/components/icons";

/*
  Danh bạ cảng cá chỉ định (nguồn chính thức). Lọc theo tỉnh nhà để chỉ hiện
  cảng GẦN tàu của bà con; tìm theo tên; chạm cả hàng ⇒ sang bản đồ ghim đúng
  cảng + ngăn gió sóng chỗ đó (BD-04, 2026-10-25); ô "Cảng nhà" cuối hàng đặt
  cảng nhà vào kho điểm (`lib/places`, cùng cơ chế "Cảng nhà" trên bản đồ). 2026-10-29: hai việc đó vào
  ngăn bung dưới hàng (chạm hàng ⇒ bung) thay cho link cả hàng + ô lặp ở mọi hàng — xem chú thích danh sách.
  Đường vào: hàng "Cảng gần đây ›" trong phần Xem đủ của ngăn gió sóng (BD-01).
  SĐT ban quản lý cảng: // nợ: data chưa có cột số máy, điều kiện nâng cấp = bổ
  sung `phone` vào fishing-ports.ts từ công bố của tỉnh — không bịa số.
*/

/** Tiêu đề màn — "gần tôi" chỉ khi đã có tỉnh cảng nhà, không thì là danh bạ cả nước (BD-05). */
export function CangHeader() {
  const { home } = useHome();
  return (
    <PageHeader
      kicker="Ra khơi · Cảng cá"
      title={home.province ? "Danh bạ cảng gần tôi" : "Danh bạ cảng"}
      toColor="var(--t1)"
    />
  );
}

export function PortDirectory() {
  const { home } = useHome();
  const [near, setNear] = useState(true);
  const [q, setQ] = useState("");
  /*  Cảng nhà đọc một lần lúc dựng (kho trong máy, đồng bộ) rồi giữ trong state —
      đặt xong đổi ngay, không cần quét lại kho. Lưu hỏng ⇒ nói một dòng, không nuốt. */
  const [cangNhaId, setCangNhaId] = useState<string | null>(() => homeOf(loadPlaces())?.id ?? null);
  const [luuHong, setLuuHong] = useState(false);
  /** hàng đang bung (một hàng một lúc) */
  const [moId, setMoId] = useState<string | null>(null);

  const datCangNha = useCallback((p: FishingPortDir) => {
    if (p.lat == null || p.lng == null) return;
    // ghi qua cửa chung lib/cang-nha (ghim + forfish.home.v1) — Trang chủ, Sen Biển, Kairos cùng thấy
    const ok = ghiCangNha(p.id);
    setLuuHong(!ok);
    if (ok) setCangNhaId(placeId(p.lat, p.lng));
  }, []);

  const list = useMemo(() => {
    const byHome = applyHome(ACTIVE_PORTS, (p) => p.province, home.province, near);
    const query = q.trim().toLowerCase();
    if (!query) return byHome;
    return byHome.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.province ?? "").toLowerCase().includes(query),
    );
  }, [home.province, near, q]);

  return (
    <div className="px-4">
      {/*  Chưa có tỉnh ⇒ MỘT hàng mảnh + ô Chọn (BD-05), thay thẻ nhắc 3 dòng của
           HomeBar (vẫn dùng HomeBar cho nhánh đã có tỉnh — hai nút Gần/Cả nước). */}
      {/*  Lô 2 (QĐ C): HomeBar tự vẽ hàng mảnh "Chưa có tỉnh cảng nhà · Chọn" mở Popover chọn tỉnh
           TẠI CHỖ (ghi vào tàu đang chọn, chưa có tàu thì nhớ trong phiên) — không bắt sang /tau nữa. */}
      <HomeBar home={home} near={near} setNear={setNear} />

      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Tìm cảng theo tên…"
        label="Tìm cảng theo tên hoặc tỉnh"
        className="mb-3"
      />

      <p className="mb-2 px-1 text-[0.875rem] font-semibold text-foreground/70">
        {list.length} cảng{home.province && near ? ` gần ${home.province}` : ""}
      </p>

      {luuHong && (
        <p role="alert" className="mb-2 rounded-xl bg-warn-bg px-3 py-2 text-[0.875rem] font-semibold text-warn">
          Máy chưa lưu được cảng nhà — bà con thử lại sau nhé.
        </p>
      )}

      {/*  DANH SÁCH KẺ MẢNH — khuôn "bản ghi có thao tác" (03 §0b; review B-P2-8, 2026-10-29): trước mỗi hàng
           kèm ô "Cảng nhà" 112px ⇒ địa chỉ gói 4 dòng, hàng ≈140px. Nay hàng = tên + tỉnh (+ "Cảng nhà" chữ
           màu nếu đúng cảng nhà), chạm ⇒ bung NGAY DƯỚI (nền background/60): địa chỉ + Bản đồ + Cảng nhà.
           Một hàng bung một lúc. Chip "Cảng loại II" là thuật ngữ quản lý — ẩn (BD-16). */}
      <ul className="surface divide-y divide-line overflow-hidden">
        {list.map((p) => {
          const coToaDo = p.lat != null && p.lng != null && !PORT_COORD_SAI.has(p.id); // toạ độ sai trong danh mục ⇒ không hứa bản đồ
          const laNha = coToaDo && cangNhaId === placeId(p.lat as number, p.lng as number);
          const mo = moId === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-expanded={mo}
                onClick={() => setMoId(mo ? null : p.id)}
                className="flex min-h-(--h-row) w-full items-center gap-3 py-2.5 pl-3.5 pr-3 text-left transition active:bg-field"
              >
                <AnchorIcon className="h-5 w-5 shrink-0 text-t3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[1rem] font-semibold leading-snug text-navy">{p.name}</span>
                  {(p.province || laNha) && (
                    <span className="block text-[0.8125rem] leading-snug text-muted">
                      {p.province}
                      {laNha && <span className="font-semibold text-sea">{p.province ? " · " : ""}{NHAN.cangNha}</span>}
                    </span>
                  )}
                </span>
                <ChevronDownIcon className={`h-4 w-4 shrink-0 text-foreground/40 transition ${mo ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {mo && (
                <div className="bg-background/60 px-4 pb-3 pt-1">
                  {p.address && (
                    <p className="flex gap-1.5 py-1 text-[0.8125rem] leading-snug text-muted">
                      <PinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{p.address}</span>
                    </p>
                  )}
                  {coToaDo ? (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <Link
                        href={duongDanBanDoToi(p.lat as number, p.lng as number)}
                        aria-label={`${p.name} — xem trên bản đồ`}
                        className={`${SQ_BTN} bg-field text-sea`}
                      >
                        <PinIcon className="h-4 w-4" aria-hidden />
                        {NHAN.banDo}
                      </Link>
                      <button
                        type="button"
                        onClick={() => datCangNha(p)}
                        aria-pressed={laNha}
                        aria-label={laNha ? `${p.name} đang là cảng nhà` : `Đặt ${p.name} làm cảng nhà`}
                        className={`${SQ_BTN} ${laNha ? "bg-navy text-white" : "bg-field text-navy"}`}
                      >
                        <AnchorIcon className="h-4 w-4" aria-hidden />
                        {NHAN.cangNha}
                      </button>
                    </div>
                  ) : (
                    // cảng chưa có toạ độ đúng trong danh mục ⇒ không hứa bản đồ, không đặt được cảng nhà
                    <p className="py-1 text-[0.8125rem] text-muted">Chưa có toạ độ cảng này trong danh mục.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {list.length === 0 && (
        /*  Câu trống theo ĐÚNG trạng thái (BD-06): chỉ nhắc "Cả nước" khi nút đó
            đang có trên màn; còn lại nói việc vừa làm + lối thoát thật (× xoá chữ
            trong ô tìm). */
        <p className="rounded-xl border border-dashed border-line py-6 text-center text-[1rem] text-foreground/70">
          {home.province && near
            ? `Không có cảng gần ${home.province}${q.trim() ? ` tên “${q.trim()}”` : ""}. Thử chọn “Cả nước”.`
            : q.trim()
              ? `Không thấy cảng nào tên “${q.trim()}”. Thử gõ ngắn hơn.`
              : "Chưa có cảng nào trong danh mục."}
        </p>
      )}

      {/* nguồn: một dòng mờ cuối danh sách (BD-05) — không phải băng vàng đầu màn */}
      <p className="mt-3 px-1 text-[0.8125rem] text-muted">
        Nguồn chính thức, cập nhật theo công bố của tỉnh.
      </p>
    </div>
  );
}
