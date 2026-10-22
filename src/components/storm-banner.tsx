"use client";

/**
 * Trục 1 — banner tin bão / áp thấp trên Biển Đông (nguồn qua lib/storms.ts).
 * BỐN trạng thái, không được nhập nhằng (xem stormStatus trong lib/storms.ts):
 *   · đang hỏi → chưa nói gì
 *   · có bão  → thẻ đỏ/vàng to, không thể bỏ qua, KÈM GIỜ CỦA BẢN TIN
 *   · hỏi được & không có bão → dòng xanh trấn an, KÈM GIỜ ĐÃ HỎI (chỉ bản đồ)
 *   · KHÔNG hỏi được (mất sóng / nguồn lỗi / tin quá cũ) → nền VÀNG, nói bằng
 *     TUỔI TIN (lib/storms.ts stormNoticeText), tuyệt đối không nói "không có bão"
 *
 * Hai chỗ mount (2026-08-18):
 *   · variant="overlay" — nổi trên bản đồ Ra khơi: chip gọn khi yên, thẻ đầy
 *     đủ khi có bão (tự thu sau 5 s, cơn danger 8 s; CHỈ nằm lì khi tàu đang
 *     trong vùng bão — prop myPos), nhánh chưa hỏi
 *     được thu về chip 1 dòng, bung đầy đủ 8s mỗi khi CÂU đổi.
 *   · variant="page" — Trang chủ, trên dải khẩn: CHỈ lên tiếng khi có bão hoặc
 *     tin đã quá cũ >24h / chưa từng có (shouldShowStormOnHome); còn lại IM.
 *   · variant="page" + `always` (2026-10-19, màn Sen Biển = cửa vào chính): THƯỜNG
 *     TRỰC — cả "đang hỏi" lẫn "không có bão, hỏi lúc …" đều có một dòng, vì màn
 *     đầu app không còn chỗ nào khác nói về bão (chủ dự án chốt: "cảnh báo bão hiện
 *     thường trực"). Chữ ≥1.125rem (18px) ở mọi nhánh của variant page.
 */
import { useEffect, useRef, useState } from "react";
import {
  shouldShowStormOnHome,
  stormNoticeShort,
  stormNoticeText,
  stormStatus,
} from "@/lib/storms";
import { useStormCheck } from "@/lib/use-storm-check";
import { useOnline } from "@/lib/use-online";
import { NOTIFY_HIDE_LONG_MS, NOTIFY_HIDE_MS } from "@/lib/notify";
import { clockVN } from "@/lib/day-labels";
import { beaufort } from "@/lib/marine-weather";
import { routeStormConflict } from "@/lib/route-storm";
import { AlertIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon } from "@/components/icons";

export function StormBanner({
  variant = "page",
  myPos = null,
  always = false,
}: {
  /** page: luôn có một dòng tin bão (cả khi đang hỏi / không có bão) */
  always?: boolean;
  /** "overlay" = nổi trên bản đồ full-screen: chip gọn khi yên, thẻ đầy đủ khi có bão */
  variant?: "page" | "overlay";
  /** Vị trí tàu (GPS) — để biết tàu có TRONG vùng bão không; null = chưa định vị */
  myPos?: { lat: number; lon: number } | null;
}) {
  // Hỏi tin bão + TỰ THỬ LẠI khi có sóng lại / mở lại app / định kỳ.
  // KHÔNG gọi fetchStormCheck một lần rồi thôi — xem lib/use-storm-check.ts.
  const { check, nowMs } = useStormCheck();
  const online = useOnline();
  // Overlay: cho thu/mở để tin bão không chiếm hết view (user 2026-06-23).
  // Mặc định MỞ (an toàn — bà con phải thấy ít nhất 1 lần), thu lại thành 1
  // chip đỏ/vàng vẫn nổi bật, chạm để mở lại.
  const [open, setOpen] = useState(true);
  // Nhánh "chưa hỏi được" trên bản đồ: câu đầy đủ đang bung hay đã thu về chip
  const [noticeOpen, setNoticeOpen] = useState(false);

  // Trạng thái thật của tin bão — tin để lâu quá thì tự rớt về "chưa hỏi được"
  // (không bao giờ để tin cũ trông như tin mới).
  const status = stormStatus(check, nowMs);
  const noticeText = stormNoticeText(status, nowMs, online);
  const anyDanger =
    status.kind === "co-bao" && status.storms.some((s) => s.alert === "danger");
  /* KHOÁ THEO DANH SÁCH CƠN, KHÔNG THEO OBJECT `check` (sửa N4, 2026-08-18):
     deps `[check]` cũ làm mỗi nhịp hỏi lại 30 phút trả object mới ⇒ thẻ bà con
     vừa mở lại tự thu sau 3s. Nay chỉ thu khi CÓ CƠN MỚI/MẤT CƠN. */
  const stormKey =
    status.kind === "co-bao" ? status.storms.map((s) => s.id).join(",") : "";

  /*  TÀU CÓ TRONG VÙNG BÃO KHÔNG — cùng phép với chặn tuyến (route-storm):
      cách tâm/hành lang dự báo dưới 200 km hoặc nằm trong polygon vùng ảnh
      hưởng. Chưa định vị ⇒ false (không biết thì không giữ hộp che bản đồ —
      chip đỏ vẫn nằm đó). */
  const trongVungBao =
    anyDanger &&
    myPos != null &&
    status.kind === "co-bao" &&
    routeStormConflict([myPos], status.storms.filter((s) => s.alert === "danger")) != null;

  /*  Overlay có bão: hiện đầy đủ rồi TỰ THU thành chip — bà con thấy 1 lần,
      sau đó không chiếm view; chạm mở lại. Cơn thường 5 s (S12: 3→5), cơn cấp
      danger 8 s. CHỈ nằm lì khi cơn danger VÀ tàu đang trong vùng bão — đúng
      spec 07 §"1 Tính mạng" (audit-notify 2026-08-18: "danger + tàu trong bán
      kính: không tự thu"). Trước đây code chặn tự thu với MỌI cơn danger, kể
      cả bão ở tận Hoàng Sa khi tàu chưa định vị — chủ dự án hỏi hai lần "sao
      không tự ẩn" (2026-09-03c). Chip thu vẫn ĐỎ và ghi tên bão + cấp. */
  useEffect(() => {
    if (variant !== "overlay" || !stormKey) return;
    setOpen(true); // cơn mới / danh sách đổi / vừa lọt vào vùng bão → bung lại
    if (trongVungBao) return; // đang trong vùng bão: nằm đó, chỉ thu khi bà con tự chạm
    const t = setTimeout(() => setOpen(false), anyDanger ? NOTIFY_HIDE_LONG_MS : NOTIFY_HIDE_MS);
    return () => clearTimeout(t);
  }, [stormKey, anyDanger, trongVungBao, variant]);

  // Overlay chưa hỏi được: bung câu đầy đủ 8s (2 dòng) mỗi khi CÂU ĐỔI (tin
  // vừa quá 12h, tuổi nhảy giờ→ngày, mất sóng↔nguồn lỗi), rồi thu về chip.
  // Ref theo nội dung câu để hỏi lại 30 phút không làm bung lại.
  const spokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (variant !== "overlay") return;
    if (!noticeText) {
      spokenRef.current = null;
      setNoticeOpen(false);
      return;
    }
    if (spokenRef.current === noticeText) return;
    spokenRef.current = noticeText;
    setNoticeOpen(true);
    const t = setTimeout(() => setNoticeOpen(false), NOTIFY_HIDE_LONG_MS);
    return () => clearTimeout(t);
  }, [noticeText, variant]);

  if (status.kind === "dang-hoi") {
    // đang hỏi — bản đồ chưa nói gì; màn Sen Biển (always) giữ chỗ để dòng bão không nhảy
    if (variant === "page" && always) {
      return (
        <p role="status" className="flex min-h-(--h-row) items-center gap-2 rounded-xl bg-field px-3 py-2.5 text-[1rem] leading-snug text-foreground/80">
          <ClockIcon className="h-5 w-5 shrink-0" />
          Đang hỏi tin bão…
        </p>
      );
    }
    return null;
  }

  // TRANG CHỦ là màn yên: chỉ nói khi đáng nói (có bão / tin quá cũ / chưa có).
  // Màn Sen Biển (always) thì nói cả lúc yên — xem đầu file.
  if (variant === "page" && !always && !shouldShowStormOnHome(status, nowMs)) return null;

  // KHÔNG hỏi được (mất sóng / nguồn lỗi / tin trong máy đã quá cũ): nền VÀNG,
  // nói bằng TUỔI TIN — khác hẳn "không có bão".
  if (status.kind === "khong-hoi-duoc") {
    if (variant === "overlay") {
      if (!noticeOpen) {
        return (
          <button
            type="button"
            onClick={() => setNoticeOpen(true)}
            className="pointer-events-auto mx-auto flex h-(--h-ctl) w-fit items-center gap-1.5 rounded-full bg-warn-bg px-3 py-1.5 text-[0.875rem] font-semibold text-warn shadow-md"
          >
            <AlertIcon className="h-4 w-4 shrink-0" />
            {stormNoticeShort(status, nowMs)} — chạm xem
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        );
      }
      return (
        <button
          type="button"
          role="status"
          onClick={() => setNoticeOpen(false)}
          className="pointer-events-auto mx-auto flex w-fit max-w-[92%] items-start gap-1.5 rounded-2xl bg-warn-bg px-3 py-2 text-left text-[0.875rem] font-semibold leading-snug text-warn shadow-md"
        >
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{noticeText}</span>
        </button>
      );
    }
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-xl bg-warn-bg px-3 py-2.5 text-[1rem] font-semibold leading-snug text-warn"
      >
        <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <span>{noticeText}</span>
      </p>
    );
  }

  // Hỏi được thật và không có bão → nói kèm GIỜ ĐÃ HỎI (chỉ trên bản đồ —
  // Trang chủ đã return null ở trên).
  if (status.kind === "khong-co") {
    const at = clockVN(status.checkedAt);
    if (variant === "overlay") {
      return (
        /*  LÚC YÊN trên bản đồ = pill trắng nhỏ, chữ thường (tối ưu bố cục bản đồ
            2026-10-19): pill xanh đặc chữ đậm "Không có tin bão — hỏi lúc 22:38
            ngày 19/10" nặng ngang một cảnh báo và chiếm trọn hàng trên cùng. Có
            bão / không hỏi được vẫn nền màu như cũ (hai nhánh trên dưới). */
        <p role="status" className="pointer-events-auto mx-auto flex w-fit max-w-[92%] items-center gap-1.5 rounded-full border border-line bg-card/90 px-3 py-1 text-[0.8125rem] leading-snug text-foreground/75 shadow-sm">
          <CheckIcon className="h-4 w-4 shrink-0 text-ok" />
          {/* MỘT khối chữ (span bọc) — để riêng phần giờ thành ô flex thứ hai là
              chữ bị bẻ thành hai cột; chế độ gọn của bản đồ chỉ giấu phần giờ. */}
          <span>
            Không có bão<span className="@max-[15rem]/map:sr-only"> · hỏi {at}</span>
          </span>
        </p>
      );
    }
    if (!always) return null;
    /*  LÚC YÊN = MỘT HÀNG NHẸ (rà design Codex 2026-10-19): thường trực vẫn đúng,
        nhưng phủ nền xanh + chữ đậm làm tin "yên ổn" nặng như banner cảnh báo.
        Nền trạng thái chỉ dành cho có bão / không hỏi được (hai nhánh trên dưới). */
    return (
      <p role="status" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
        <CheckIcon className="h-5 w-5 shrink-0 text-ok" />
        <span className="min-w-0 leading-snug">
          <span className="block text-[1rem] text-navy">Không có tin bão trên Biển Đông</span>
          <span className="block text-[0.8125rem] text-foreground/65">Hỏi lúc {at}</span>
        </span>
      </p>
    );
  }

  // Overlay đã thu: 1 chip cảnh báo gọn, vẫn nổi bật, chạm để mở lại.
  if (variant === "overlay" && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`pointer-events-auto mx-auto flex h-(--h-ctl) w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold shadow-md ${
          anyDanger ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"
        }`}
      >
        <AlertIcon className="h-4 w-4 shrink-0" />
        {/* MỘT cơn thì gọi đích danh + cấp gió: chip thu vẫn phải nói được
            "bão gì, mạnh cỡ nào" — "1 tin bão" là giấu thông tin. */}
        {status.storms.length === 1
          ? (() => {
              const s = status.storms[0];
              const cap = s.windKmh != null ? ` cấp ${beaufort(s.windKmh)}` : "";
              return `${s.kindLabel}${s.name ? ` ${s.name}` : ""}${cap} — chạm để xem chi tiết`;
            })()
          : `Có ${status.storms.length} tin bão — chạm để xem chi tiết`}
        <ChevronDownIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      role="alert"
      className={
        variant === "overlay" ? "pointer-events-auto space-y-2 shadow-md" : "space-y-2"
      }
    >
      {status.storms.map((s) => {
        const danger = s.alert === "danger";
        return (
          <div
            key={s.id}
            role="alert"
            /*  nền màu cả thẻ + viền mảnh cùng tông, KHÔNG sọc màu dày bên trái
                (sàn chất lượng Impeccable 2026-10-22: sọc trái >1px là khuôn mặc định) */
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              danger
                ? "border-danger/30 bg-danger-bg"
                : "border-warn/30 bg-warn-bg"
            }`}
          >
            <span
              className={`mt-0.5 shrink-0 ${danger ? "text-danger" : "text-warn"}`}
              aria-hidden
            >
              <AlertIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p
                className={`text-[1rem] font-semibold leading-snug ${
                  danger ? "text-danger" : "text-warn"
                }`}
              >
                {/* TÊN CÓ THÌ GHÉP, KHÔNG CÓ THÌ THÔI (sửa 2026-08-18): bản tin
                    ATNĐ của NCHMF không đặt tên riêng (chỉ bão mới có "số N"),
                    ghép chuỗi rỗng cũ ra câu lặp "…trên Biển Đông đang trên
                    vùng Biển Đông". */}
                {s.kindLabel}
                {s.name ? ` ${s.name}` : ""} đang trên vùng Biển Đông
              </p>
              <p className={`mt-0.5 leading-snug text-foreground/80 ${variant === "page" ? "text-[1rem]" : "text-[1rem]"}`}>
                {s.windKmh != null &&
                  `Gió mạnh nhất khoảng ${s.windKmh} km/giờ (cấp ${beaufort(s.windKmh)}). `}
                Đừng ra khơi vùng ảnh hưởng — nghe ngay đài duyên hải hoặc
                đồn biên phòng.
              </p>
              {/* GIỜ THẬT của bản tin — bão đi rất nhanh, tin mấy hôm trước
                  không được để trông như tin vừa xong.

                  ⚠️ ƯU TIÊN GIỜ PHÁT BẢN TIN, KHÔNG PHẢI GIỜ APP HỎI (sửa
                  2026-08-18, thấy trên máy thật): `checkedAt` là lúc app gọi
                  nguồn — bản tin NCHMF phát 08h00 mà app hỏi lúc 09h12 thì
                  banner ghi "Tin lúc 09:12", lệch hẳn với thứ bà con vừa nghe
                  trên đài. Bản tin VN mang `updated` = GIỜ PHÁT TIN, dùng nó
                  thì hai bên khớp nhau. Không có `updated` (nguồn cũ) thì mới
                  lùi về `checkedAt`. */}
              <p
                className={`mt-1 font-semibold leading-snug ${variant === "page" ? "text-[1rem]" : "text-[0.875rem]"} ${
                  status.cu ? "text-warn" : "text-foreground/65"
                }`}
              >
                {(() => {
                  const phat = Date.parse(s.updated ?? "");
                  if (Number.isFinite(phat)) return `Bản tin ${clockVN(phat)}`;
                  return status.checkedAt != null
                    ? `Cập nhật lúc ${clockVN(status.checkedAt)}`
                    : "Chưa rõ giờ báo tin";
                })()}
                {status.cu && " — bản tin cũ lưu trong máy, bà con nhớ nghe thêm đài duyên hải nhé"}
              </p>
            </div>
            {variant === "overlay" && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Thu gọn tin bão"
                className={`-mr-1 -mt-1 ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  danger ? "text-danger" : "text-warn"
                }`}
              >
                <ChevronUpIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
