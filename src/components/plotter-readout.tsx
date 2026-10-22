"use client";

/**
 * Ô TOẠ ĐỘ KIỂU MÁY ĐỊNH VỊ — Trục 1, màn "Ra khơi".
 *
 * Bà con Bình Định góp ý (VSS Quân, 2026-08-25): *"nên làm theo kiểu hiển thị
 * trên định vị thì hay hơn, ngư dân quen dùng — 1 cái hiển thị toạ độ mình
 * đang đứng, 1 cái con trỏ trỏ tới vị trí nào mình muốn xem"*. Máy định vị
 * (chartplotter) trên tàu luôn có đúng hai số này nằm cạnh nhau.
 *
 * BẢN THU GỌN (user 2026-08-25b: *"thấy chiếm chỗ"*, *"xem cách thể hiện ở các
 * app bản đồ khác để làm cho chuẩn"*; thu tiếp 2026-08-25c: *"làm gọn lại …
 * kích thước làm nhỏ lại, đang làm to quá"*): DẢI SỐ MỎNG — MỘT DÒNG cho mỗi
 * số, như thanh dữ liệu của máy định vị / Windy, không phải khối thẻ 3 dòng.
 *
 * HÌNH PHẢI KHỚP BẢN ĐỒ (user 2026-08-25c: *"nó đang bị ngược"*):
 *  · vị trí TÀU  = ẢNH GHIM TÀU CÁ (`/icons/boat-marker.png`, y hệt marker
 *    trên bản đồ — ảnh do chủ dự án cấp 2026-08-25l)
 *  · vị trí TRỎ  = CÁI GHIM (`PinIcon`, y hệt marker trên bản đồ)
 * Chốt 2026-08-25f. Hai hình đi qua nhiều nhịp (mũi tên → chấm → tàu; vòng ngắm
 * → mũi tên → ghim → cá → GHIM) — hễ đổi hình trên bản đồ thì PHẢI đổi ở đây cùng lúc,
 * hai chỗ khác hình là bà con không nối được đâu với đâu.
 *  · Đang chạy bình thường  → hai dòng chữ, KHÔNG phải nút (đọc, không bấm) —
 *    đúng cách các app bản đồ bày toạ độ; nút "Vị trí" ở rail phải mới là nút.
 *  · CHƯA có vị trí          → dòng TÀU TÔI thành NÚT THẬT cao 2.75rem (44px — chủ dự án 2026-10-17 chê hai hàng cách xa), chạm là
 *    xin quyền định vị ngay (user: *"click vào có request quyền"*).
 *
 * TRUNG THỰC là bất biến: chưa bật / máy từ chối / mất tín hiệu thì NÓI THẲNG,
 * KHÔNG để toạ độ cũ nằm im như số đang chạy.
 */

import { haversineKm, bearingDeg, type LatLon } from "@/lib/route-plan";
import { useMapPrefs, fmtLat, fmtLon, fmtDist, type CoordFormat } from "@/lib/map-prefs";
import type { NavStatus } from "@/lib/use-nav-tracking";
import { PinIcon, AlertIcon } from "@/components/icons";

/*  Dưới ngưỡng này coi như con trỏ trùng tàu (≈180 m — trong tầm sai số GPS
    thường của điện thoại trên tàu), không tính hướng nữa. */
const AT_BOAT_KM = 0.18;
/** Sai số lớn hơn mức này thì dặn bà con ra chỗ thoáng trời */
const ACCURACY_WARN_M = 100;

/** Giờ phút kiểu VN cho mốc fix cuối (mất tín hiệu thì nói số cũ từ lúc nào) */
function clockVN(ms: number): string {
  return new Date(ms).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** DẤU TÀU nhỏ — cùng ẢNH với marker trên bản đồ (nav-mode NavBoatMarker) */
function BoatMark({ stale, off }: { stale?: boolean; off?: boolean }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/boat-marker.png"
      srcSet="/icons/boat-marker.png 1x, /icons/boat-marker@2x.png 2x"
      alt=""
      aria-hidden
      className={`h-4 w-auto shrink-0 ${off ? "opacity-40" : stale ? "opacity-55" : ""}`}
    />
  );
}

/** Nhãn ngắn bên trái mỗi dòng — chữ nhỏ, không ăn chỗ của SỐ */
function RowLabel({ text }: { text: string }) {
  return (
    <span className="w-7 shrink-0 text-[0.75rem] font-medium leading-tight text-foreground/60">
      {text}
    </span>
  );
}

export function PlotterReadout({
  myPos,
  status,
  blocked,
  lastFixAt,
  accuracyM,
  cursor,
  onGoMyPos,
}: {
  myPos: LatLon | null;
  status: NavStatus;
  /** máy từ chối / không có GPS — biết từ `permissions.query` hoặc sau khi hỏi */
  blocked?: boolean;
  lastFixAt: number | null;
  accuracyM: number | null;
  /** chỗ đang xem dự báo = "con trỏ" của máy định vị. `null` = bản đồ đang
      TRỐNG (user trả về trống bằng cú chạm) → ẩn hàng TRỎ, chỉ còn hàng TÀU. */
  cursor: LatLon | null;
  /** chạm hàng TÀU TÔI khi chưa có vị trí: xin quyền + bay tới tàu */
  onGoMyPos: () => void;
}) {
  const prefs = useMapPrefs();

  const denied = status === "denied" || blocked === true;
  const stale = status === "lost" && myPos != null;

  // Quãng + hướng từ tàu tới con trỏ — chỉ có khi BIẾT tàu ở đâu. Không biết
  // thì bỏ trống, KHÔNG đo từ một điểm đoán. Con trỏ nằm ngay trên tàu thì
  // hướng là số vô nghĩa — nói "ngay tại tàu", đừng in "0° Bắc".
  const rng =
    myPos != null && cursor != null
      ? (() => {
          const km = haversineKm(myPos, cursor);
          if (km < AT_BOAT_KM) return "ngay tại tàu";
          const deg = bearingDeg(myPos, cursor);
          /*  CHỈ quãng + số độ, KHÔNG kèm tên hướng ("Đông Bắc") — dải phải
              GỌN (user 2026-08-25c). Tên hướng bằng chữ vẫn còn ở dòng "ở đâu"
              trong sheet dưới, nên không mất thông tin, chỉ hết in hai lần. */
          return `${fmtDist(km, prefs.distUnit, km < 10 ? 1 : 0)} · ${Math.round(deg)}°`;
        })()
      : null;

  // Đuôi câu của dòng TÀU TÔI — ghép vào CÙNG DÒNG để không đẻ thêm hàng.
  const myTail = stale
    ? `· toạ độ lúc ${lastFixAt != null ? clockVN(lastFixAt) : "trước"}`
    : myPos != null && accuracyM != null && accuracyM > ACCURACY_WARN_M
      ? `· ±${Math.round(accuracyM)} m`
      : null;

  return (
    <div className="pointer-events-auto w-fit max-w-[calc(100vw-5.5rem)] overflow-hidden rounded-xl border border-line bg-card px-3 py-1 shadow-sm">
      {/* ── TÀU TÔI ───────────────────────────────────────────────────────
          Có toạ độ = DÒNG CHỮ (đọc, không bấm — như mọi app bản đồ).
          Chưa có = NÚT THẬT cao 2.75rem: chạm là xin quyền định vị. */}
      {myPos != null ? (
        /*  CHẠM DÒNG "TÀU" = BAY VỀ TÀU, một chạm (anh Long 2026-10-19 mục 8 — thay nút
            Vị trí trên rail). Dòng vẫn là chữ đọc, chỉ thêm vùng chạm + mũi tên nhỏ. */
        <button
          type="button"
          onClick={onGoMyPos}
          aria-label="Về vị trí tàu"
          className="flex min-h-[1.75rem] w-full items-center gap-1.5 text-left transition active:opacity-70"
        >
          <BoatMark stale={stale} />
          <RowLabel text="Tàu" />
          <ToaDo lat={myPos.lat} lon={myPos.lon} fmt={prefs.coordFormat} mo={stale} />
          {myTail && (
            <span className="shrink-0 whitespace-nowrap text-[0.75rem] font-medium leading-snug text-warn">
              {myTail}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onGoMyPos}
          aria-label={
            denied
              ? "Tính năng định vị đang bị chặn — chạm để cấp quyền lại nhé"
              : "Bật định vị để hiển thị toạ độ tàu"
          }
          className="flex min-h-[2.75rem] w-full items-center gap-1.5 text-left transition active:scale-[0.98]"
        >
          {denied ? (
            <AlertIcon className="h-3.5 w-3.5 shrink-0 text-warn" />
          ) : (
            <BoatMark off />
          )}
          <RowLabel text="Tàu" />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.8125rem] font-semibold leading-snug text-navy">
              {/* DANH TỪ NGẮN, không nguyên câu (chủ dự án 2026-10-17: "bị rộng quá, chiếm màn
                  hình, viết ngắn gọn thôi, dùng danh từ") — câu đủ nằm ở aria-label */}
              {denied ? "Định vị bị chặn" : status === "idle" ? "Bật định vị" : "Đang dò…"}
            </span>
            {/* CHỈ trạng thái bị chặn mới được thêm dòng thứ hai — bà con phải
                biết đi đâu mà bật. Các trạng thái khác giữ đúng một dòng. */}
            {denied && (
              <span className="block text-[0.625rem] font-semibold leading-tight text-warn">
                Cài đặt › Vị trí
              </span>
            )}
          </span>
        </button>
      )}

      {/* ── CON TRỎ (chỗ đang xem dự báo) — luôn là DÒNG CHỮ, một dòng ────
          Ẩn khi bản đồ TRỐNG (cursor == null): không có điểm xem thì không in
          toạ độ trỏ (tránh "cứ chạm là tính vị trí nhìn rối" — user 2026-08-29). */}
      {cursor != null && (
      <p className="flex min-h-[1.75rem] items-center gap-1.5">
        <PinIcon className="h-4 w-4 shrink-0 text-trim" />
        <RowLabel text="Trỏ" />
        <ToaDo lat={cursor.lat} lon={cursor.lon} fmt={prefs.coordFormat} />
        {rng && (
          <span className="shrink-0 whitespace-nowrap text-[0.75rem] font-medium leading-snug text-foreground/55">
            · {rng}
          </span>
        )}
      </p>
      )}
    </div>
  );
}

/*  TOẠ ĐỘ HAI HÀNG — vĩ độ trên, kinh độ dưới, chữ nhỏ (chủ dự án 2026-10-17: "toạ độ cho hàng
    trên hàng dưới, làm nhỏ lại, cái ô nó ngắn lại được"). Một hàng "13°00'00"N · 110°30'00"E"
    kéo thẻ rộng gấp đôi; hai hàng thì thẻ hẹp lại, vẫn đọc trọn số. */
function ToaDo({ lat, lon, fmt, mo = false }: { lat: number; lon: number; fmt: CoordFormat; mo?: boolean }) {
  return (
    <span className={`whitespace-nowrap text-[0.8125rem] font-semibold tabular-nums leading-tight ${mo ? "text-foreground/55" : "text-navy"}`}>
      {fmtLat(lat, fmt)} · {fmtLon(lon, fmt)}
    </span>
  );
}
