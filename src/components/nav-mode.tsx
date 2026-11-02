"use client";

/**
 * Trục 1 — DẪN ĐƯỜNG LIVE: HUD (thẻ nổi) + marker tàu sống.
 *
 * NavBoatMarker: chấm tàu tại vị trí GPS, mũi tên xoay theo hướng đang đi
 * (đặt BÊN TRONG <MapGL>). NavHud: thẻ nổi trên cùng hiện gợi ý lái + quãng/giờ
 * còn lại + cảnh báo lệch tuyến/mất định vị/tới nơi + nút Dừng. Luôn dặn dò
 * "dò hải đồ, nghe đài" — app KHÔNG phán đi/không đi (01 §product).
 */

import { useRef, useState } from "react";
import { HUD_TRAN, xepDongHud, type DongHud } from "@/lib/hud-tran";
import { Marker } from "react-map-gl/maplibre";

import type { LatLon } from "@/lib/route-plan";
import { formatHoursVN } from "@/lib/route-plan";
import type { NavProgress } from "@/lib/nav-progress";
import type { NavStatus } from "@/lib/use-nav-tracking";
import type { BorderLevel } from "@/lib/geofence";
import type { HudLine } from "@/lib/nav-context";
import type { VungTrong } from "@/lib/nav-vung";
import type { KhucRe } from "@/lib/nav-khuc-re";
import { useMapPrefs, fmtDist } from "@/lib/map-prefs";
import { NHAN } from "@/lib/labels";
import {
  AlertIcon,
  AnchorIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  MinusIcon,
  NavArrowIcon,
  RouteIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from "@/components/icons";

/** Ảnh dấu tàu — sinh từ `Workops/assets/sdfish/sdfish-fishing-vessel-map-marker.png`
    (653 KB → 5,5 KB) bằng `sharp`: trim viền trong suốt rồi hạ còn 72×100 (+ bản
    @2x cho màn retina). Đã ghim vào CRITICAL_SHELL của service worker: thiếu nó
    thì giữa biển mất sóng, bà con không thấy tàu mình đâu. */
const BOAT_MARKER_SRC = "/icons/boat-marker.png";

/**
 * VỊ TRÍ TÀU trên bản đồ (đặt trong <MapGL>) — **ẢNH GHIM TÀU CÁ** do chủ dự án
 * cấp (2026-08-25l), đặt trên quầng nhấp nháy.
 *
 * ⚠️ ẢNH LÀ CÁI GHIM (mũi nhọn chỉ xuống), KHÔNG phải hình tàu nhìn từ trên.
 * Ba hệ quả bắt buộc, đừng sửa lẻ một cái:
 *  1. `anchor="bottom"` — MŨI GHIM mới là toạ độ thật, không phải tâm ảnh.
 *  2. **KHÔNG xoay theo `headingDeg`.** Ghim mà xoay là nằm nghiêng/chổng ngược,
 *     và mũi ghim rời khỏi chỗ nó đang chỉ. Nghĩa là bản này KHÔNG còn chỉ hướng
 *     tàu đang chạy — mất một thông tin so với hình tàu-nhìn-từ-trên trước đó.
 *  3. Quầng nhấp nháy phải neo vào MŨI GHIM (`-bottom` + `left-1/2`), không neo
 *     giữa ảnh — neo sai là vòng nháy lệch lên nửa thân ghim.
 */
export function NavBoatMarker({
  pos,
  headingDeg,
  stale,
}: {
  pos: LatLon | null;
  /*  CÒN TRONG PROPS nhưng KHÔNG DÙNG: ảnh ghim không xoay được (xem trên).
      Giữ lại để nơi gọi không phải sửa và để lần sau ai muốn thêm mũi tên chỉ
      hướng thì đã có sẵn số. */
  headingDeg?: number | null;
  /** mất định vị → làm mờ + TẮT nhấp nháy: số cũ thì đừng giả vờ đang sống */
  stale?: boolean;
}) {
  if (!pos) return null;
  return (
    <Marker longitude={pos.lon} latitude={pos.lat} anchor="bottom">
      <span
        className={`relative flex flex-col items-center transition-opacity ${
          stale ? "opacity-45" : "opacity-100"
        }`}
      >
        {!stale && (
          <span
            className="pointer-events-none absolute -bottom-[1.3125rem] left-1/2 h-[2.625rem] w-[2.625rem] -translate-x-1/2 animate-ping rounded-full bg-t1/55"
            aria-hidden
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BOAT_MARKER_SRC}
          srcSet={`${BOAT_MARKER_SRC} 1x, /icons/boat-marker@2x.png 2x`}
          alt=""
          aria-hidden
          className="relative h-[3rem] w-auto drop-shadow-pin"
        />
      </span>
    </Marker>
  );
}

/**
 * Thẻ nổi dẫn đường — chỉ hiện khi đang ở chế độ dẫn đường.
 * Liquid glass (nhìn xuyên thấy bản đồ), GỌN một nửa so với bản cũ; kéo hàng
 * đầu để DI CHUYỂN cho khỏi che bản đồ, nút trừ để ẨN thành chip nhỏ
 * (user 2026-07-29).
 */
/** Ranh giới theo GPS — cha (fishing-map-view) tính từ lib/geofence, HUD chỉ vẽ */
export type NavBorderNotice = {
  /** mốc đang trong (15/10/6/3 hải lý) */
  step: number;
  distanceNm: number;
  level: BorderLevel;
  /** bà con đã chạm thu (chỉ được khi >6 hải lý) */
  dismissed: boolean;
};

/**
 * Lệch tuyến — cha (fishing-map-view) tính mốc từ lib/nav-progress, HUD chỉ vẽ.
 * KHÁC ranh giới ở hai chỗ, cố ý: (1) màu VÀNG, không bao giờ đỏ — đỏ giữ riêng
 * cho ranh giới IUU; (2) LUÔN thu được, kể cả lệch rất xa — lái khác đường đã
 * vẽ là quyền của thuyền trưởng (né tàu bạn, thả lưới, đổi ý), app là người
 * phụ việc chứ không phải người chấm đúng-sai (09-ba-spec §5c).
 */
export type NavOffRouteNotice = {
  /** mốc đang ở (km — 2/5/10/20) */
  step: number;
  km: number;
  /** bà con đã chạm thu dòng này */
  dismissed: boolean;
  /** vạch tuyến ở bên nào của tàu (null = không rõ) */
  ben?: "trái" | "phải" | null;
};

/** lệch từ mức này (km) mới hiện nút "Vẽ lại" — dưới đó lái về vạch là xong */
export const VE_LAI_TU_KM = 5;

/**
 * GIỌNG ĐỌC (chế độ Đang chạy, doc 15 §9) — cha giữ toàn bộ trạng thái ở
 * `lib/nav-voice/use-nav-voice`, HUD chỉ vẽ nút + câu đang đọc.
 */
export type NavHudVoice = {
  /** "Giọng: đầy đủ" / "Giọng: ít" / "Giọng: im 30 phút" / "Giọng: tắt" */
  label: string;
  /** đang đọc được (không tắt, không im) — để tô nút */
  on: boolean;
  onCycle: () => void;
  /** câu ĐANG đọc — in ra cho người nghe kém / máy rè */
  speaking: { text: string; red: boolean } | null;
  /** "Đã nghe" — thôi nhắc lại câu đỏ */
  onAck: () => void;
  /** máy không đọc được tiếng Việt: nói thật + cho tải giọng (Android) */
  noVoice: { canInstall: boolean; onInstall: () => void } | null;
};

/*  Mảng rỗng DÙNG CHUNG làm mặc định: `hazardLines = []` viết thẳng trong
    tham số sẽ tạo mảng MỚI mỗi lần vẽ — mà HUD vẽ lại theo nhịp GPS. */
const EMPTY_LINES: HudLine[] = [];
const EMPTY_VUNG: VungTrong[] = [];

/** Hai câu như nhau khi bỏ khoảng trắng thừa + dấu câu cuối */
function sameSentence(a: string, b: string): boolean {
  const n = (x: string) => x.replace(/\s+/g, " ").trim().replace(/[.!?…]+$/, "");
  return n(a) === n(b);
}

/*  Khoảng cách trên HUD: dưới 10 thì một số lẻ (rà trên iPhone 2026-11-02 — còn 0,3 hải
    lý tới đích mà làm tròn thành "còn 0 hải lý · 0 phút", bà con tưởng đã tới). */
const kc = (km: number, unit: Parameters<typeof fmtDist>[1]) => fmtDist(km, unit, km < 10 * 1.852 ? 1 : 0);

/** Nền + chữ cho từng mức cảnh báo — token màu, không hex (design-system §màu). */
const MUC_TONE: Record<HudLine["muc"], string> = {
  do: "bg-danger-bg text-danger",
  vang: "bg-warn-bg text-warn",
  // dòng TIN (phao, đèn) không phải cảnh báo: nền kính nhạt như ô "đang tìm vị trí"
  tin: "bg-white/45 text-navy",
};

/**
 * BIỂN "ĐANG TRONG VÙNG" (học VietMap: biển đang hiệu lực nằm lì trên màn tới
 * khi ra khỏi). Cha giữ danh sách đã khử nhiễu ở `lib/nav-vung`; đây chỉ vẽ.
 * Không thu được: tàu còn trong vùng cấm thì chữ còn đó. Tối đa 2 dòng, dư thì
 * "+N vùng nữa" — nhiều hơn là che bản đồ.
 */
export function BienVung({ vung, gon = false }: { vung: readonly VungTrong[]; gon?: boolean }) {
  if (vung.length === 0) return null;
  const hien = vung.slice(0, 2);
  const du = vung.length - hien.length;
  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      {hien.map((v) => (
        <p
          key={v.id}
          className={`pointer-events-auto flex min-h-[2.75rem] items-center gap-2 rounded-xl px-2.5 py-2 text-[0.875rem] font-semibold leading-snug ${
            v.muc === "do" ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"
          } ${gon ? "shadow-md" : ""}`}
        >
          <AlertIcon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">Đang trong {v.ten.replace(/^(khu|vùng)/i, (m) => m.toLowerCase())}</span>
        </p>
      ))}
      {du > 0 && <p className="px-2.5 text-[0.75rem] font-semibold text-navy/70">+{du} vùng nữa</p>}
    </div>
  );
}

export function NavHud({
  progress,
  status,
  onStop,
  border,
  onDismissBorder,
  offRoute,
  onDismissOffRoute,
  onVeLai,
  nextStop = null,
  hazardLines = EMPTY_LINES,
  rungOn = true,
  onToggleRung,
  ranhTay,
  onShelter,
  title = "Đang dẫn đường",
  cruiseLine = null,
  voice = null,
  vung = EMPTY_VUNG,
  khucRe = null,
}: {
  /** vùng tàu ĐANG ở trong (đã khử nhiễu, `lib/nav-vung`) — biển nằm lì */
  vung?: readonly VungTrong[];
  /** khúc rẽ kế tiếp trên tuyến (`lib/nav-khuc-re`) — dòng "còn X tới khúc rẽ" */
  khucRe?: KhucRe | null;
  /*  "Đang dẫn đường" (có tuyến) / "Đang chạy" (chỉ GPS, không tuyến — doc 15 §3B) */
  title?: string;
  /*  CHẾ ĐỘ ĐANG CHẠY không tuyến: dòng "hướng · tốc độ · nước dưới tàu" thay cho
      khối bám tuyến. null khi chưa có vị trí. */
  cruiseLine?: string | null;
  voice?: NavHudVoice | null;
  progress: NavProgress | null;
  status: NavStatus;
  onStop: () => void;
  border?: NavBorderNotice | null;
  onDismissBorder?: () => void;
  offRoute?: NavOffRouteNotice | null;
  onDismissOffRoute?: () => void;
  /** lệch xa ⇒ nút "Vẽ lại": cha mở bảng Lộ trình và tính từ chỗ tàu */
  onVeLai?: () => void;
  /*  CẢNH BÁO HIỂM HOẠ khi đang chạy (Đợt 3) — cha tính ở `lib/nav-hazards`
      rồi chọn dòng ở `lib/pickHudLines`; HUD chỉ VẼ, không xếp lại thứ tự,
      không tự viết câu. Tối đa 2 dòng: dòng `khoa` (đỏ) không thu được và
      hiện cả khi HUD đã thu thành chip — cùng luật với ranh giới ≤6 hải lý. */
  hazardLines?: HudLine[];
  /** cờ rung của bà con (`forfish.nav.rung.v1`) — cha giữ, HUD chỉ bật/tắt */
  rungOn?: boolean;
  onToggleRung?: () => void;
  /** gọi "Sen Biển ơi" không chạm (micro nghe liên tục bằng bộ nghe trong máy) — cha giữ cờ `forfish.nav.ranhtay.v1` */
  ranhTay?: { on: boolean; onToggle: () => void };
  /*  CHỖ TRÚ BÃO — cha chỉ truyền hàm này khi ĐANG CÓ BÃO (`stormInfo.kind ===
      "co-bao"`) và kho khu trú đã nạp. Không có bão thì không có nút: nút trú
      bão nằm sẵn quanh năm là dạy mắt bỏ qua nó đúng hôm cần. */
  /** nhận chính nút "Trú bão" để danh sách khu trú neo cạnh nó (03 §6 mục 9) */
  onShelter?: (nut: HTMLElement) => void;
  /*  CHỖ GHÉ KẾ TIẾP — chỉ có khi đường đi qua NHIỀU chỗ (chủ dự án
      2026-08-29g: *"rồi hiện thời gian và khoảng cách tới điểm tiếp theo"*).
      Đường đi một chỗ thì dòng "còn X · Y giờ" sẵn có ĐÃ nói đúng thứ này —
      thêm một dòng nữa là lặp. */
  nextStop?: { so: number; km: number; hours: number | null } | null;
}) {
  const prefs = useMapPrefs();
  /*  Thu từng dòng cảnh báo (chỉ dòng KHÔNG khoá). Nhớ theo `id` chứ không
      theo vị trí: `nav-hazards` chỉ nói mỗi vật tối đa 2 lần, nên thu một lần
      là thu đúng cái vật đó — vật khác tới vẫn nói. */
  const [thuIds, setThuIds] = useState<string[]>([]);
  const lines = hazardLines.filter((l) => l.khoa || !thuIds.includes(l.id));
  const linesKhoa = lines.filter((l) => l.khoa);
  /*  Câu loa đang đọc TRÙNG một dòng cảnh báo đang hiện ⇒ khỏi in lần hai
      (rà soát prod 2026-10-16: "Phía trước chừng 1,9 hải lý là đảo Lý Sơn." nằm
      hai thẻ liền nhau, HUD cao thêm một nấc che bản đồ). Câu ĐỎ vẫn in — nó
      mang nút "Đã nghe". */
  const dongTrung = voice?.speaking ? lines.find((l) => sameSentence(l.cau, voice.speaking!.text)) : undefined;
  // câu đỏ chỉ "đã hiện" khi trùng dòng ĐỎ (dòng đó mang nút Đã nghe); dòng vàng/tin không có nút
  const speakingIsShown = !!dongTrung && (!voice?.speaking?.red || dongTrung.khoa);
  /*  Câu ĐỎ đang đọc trùng một dòng cảnh báo ⇒ nút "Đã nghe" GẮN VÀO chính dòng đó
      (rà UI 2026-11-02: trước đây cùng một câu đỏ hiện HAI hộp đỏ liền nhau —
      dòng cảnh báo + hộp "câu đang đọc" — HUD cao thêm một nấc che bản đồ). */
  const ackId = voice?.speaking?.red && speakingIsShown ? (dongTrung?.id ?? null) : null;
  const lost = status === "lost";
  const denied = status === "denied";
  /* RANH GIỚI (2026-08-18, audit M3): dòng warn/danger theo GPS; ≤6 hải lý
     (very_near) KHÔNG thu được — cả khi HUD đã ẩn thành chip vẫn phải hiện. */
  const borderLocked = border != null && border.level === "very_near";
  const borderShow = border != null && (borderLocked || !border.dismissed);
  const borderLine = border
    ? `Còn ~${
        border.level === "very_near"
          ? border.distanceNm.toFixed(1)
          : Math.round(border.distanceNm)
      } hải lý tới ranh giới — giữ khoảng cách`
    : null;
  const borderTone = borderLocked
    ? "bg-danger-bg text-danger"
    : "bg-warn-bg text-warn";

  /*  TRẦN 2 DÒNG CẢNH BÁO (lib/hud-tran, rà Vietmap 2026-11-02): dòng đỏ luôn hiện,
      còn lại lấp cho đủ 2, thừa gộp "+N" chạm mở. Thứ tự đưa vào = thứ tự vẽ. */
  const [moRong, setMoRong] = useState(false);
  const speakingRow = !!voice?.speaking && !speakingIsShown;
  const dongHud: DongHud[] = [
    ...(borderShow && borderLine ? [{ id: "border", red: borderLocked }] : []),
    ...lines.map((l) => ({ id: `hz:${l.id}`, red: l.khoa })),
    ...vung.map((v) => ({ id: `vung:${v.id}`, red: v.muc === "do" })),
    ...(onShelter ? [{ id: "shelter", red: true }] : []),
    ...(speakingRow ? [{ id: "speaking", red: !!voice?.speaking?.red }] : []),
    ...(voice?.noVoice ? [{ id: "novoice", red: false }] : []),
  ];
  const { hien, an: dongAn } = xepDongHud(dongHud, moRong);
  const coDo = dongHud.some((d) => d.red);

  const [hidden, setHidden] = useState(false);
  /** hàng Giọng/Rung mở khi bấm nút loa ở hàng đầu — mặc định thu */
  const [showKenh, setShowKenh] = useState(false);
  // kéo-thả: offset so với chỗ gốc (đầu màn hình) — chip ẩn cũng giữ chỗ này
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(
    null,
  );
  const onDragStart = (e: React.PointerEvent) => {
    // capture để kéo nhanh ra ngoài handle vẫn bám — máy không hỗ trợ thì thôi
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* vẫn kéo được, chỉ không capture */
    }
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    // giữ trong màn hình để panel không "trôi mất"
    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));
    setPos({
      x: clamp(d.x + (e.clientX - d.px), -window.innerWidth * 0.8, window.innerWidth * 0.8),
      y: clamp(d.y + (e.clientY - d.py), -12, window.innerHeight * 0.72),
    });
  };
  const onDragEnd = () => {
    drag.current = null;
  };
  const floatStyle = { transform: `translate(${pos.x}px, ${pos.y}px)` };

  // ẨN → chỉ còn chip nhỏ (vẫn thấy quãng còn lại), chạm để mở lại
  if (hidden) {
    return (
      <div style={floatStyle} className="space-y-1.5 self-start">
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="pointer-events-auto glass flex h-(--h-ctl) items-center gap-2 px-4 text-[0.875rem] font-semibold text-navy transition active:scale-[0.97]"
          aria-label="Mở lại bảng dẫn đường"
        >
          <RouteIcon className="h-5 w-5 text-t1" />
          {progress
            ? `Còn ${kc(progress.remainingKm, prefs.distUnit)}`
            : title}
        </button>
        {/* rất gần ranh giới thì HUD ẩn vẫn phải nói — không thu được */}
        {borderLocked && borderLine && (
          <p
            role="alert"
            className={`pointer-events-auto flex items-center gap-2 rounded-xl px-3 py-2 text-[0.875rem] font-semibold leading-snug shadow-md ${borderTone}`}
          >
            <AlertIcon className="h-5 w-5 shrink-0" />
            {borderLine}
          </p>
        )}
        {/*  HIỂM HOẠ MỨC ĐỎ cũng theo luật đó: xác tàu/bãi cạn/vùng cấm ngay
             trước mũi là chuyện tính mạng, thu HUD thành chip không được làm
             nó biến mất. Dòng vàng/tin thì nhường — mở HUD ra là thấy. */}
        {linesKhoa.map((l) => (
          <p
            key={l.id}
            role="alert"
            className="pointer-events-auto flex items-center gap-2 rounded-xl bg-danger-bg px-3 py-2 text-[0.875rem] font-semibold leading-snug text-danger shadow-md"
          >
            <AlertIcon className="h-5 w-5 shrink-0" />
            {l.cau}
          </p>
        ))}
        {/*  VÙNG CẤM VÀO cũng không được biến mất khi thu HUD — chỉ dòng đỏ */}
        <BienVung vung={vung.filter((v) => v.muc === "do")} gon />
        {/*  Câu ĐỎ đang đọc (ranh giới, bão gần) cũng phải "Đã nghe" được khi HUD thu */}
        {voice?.speaking?.red && (
          <button
            type="button"
            onClick={voice.onAck}
            className="pointer-events-auto flex h-(--h-ctl) w-full items-center gap-2 rounded-xl bg-danger-bg px-3 py-2 text-left text-[0.875rem] font-semibold leading-snug text-danger shadow-md"
          >
            <SpeakerIcon className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1">Đã nghe</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={floatStyle}
      className="pointer-events-auto glass space-y-1.5 p-2.5"
    >
      {/* hàng đầu: giữ ngón tay KÉO để di chuyển · nút trừ = ẩn */}
      <div className="flex items-center gap-2">
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          style={{ touchAction: "none" }}
          className="flex min-h-[2.75rem] min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
          aria-label="Giữ và kéo để dời bảng dẫn đường"
        >
          <RouteIcon className="h-5 w-5 shrink-0 text-t1" />
          <h3 className="truncate whitespace-nowrap text-[0.875rem] font-semibold text-navy">{title}</h3>
          <span
            className="ml-1 h-1 w-8 rounded-full bg-navy/20"
            aria-hidden
          />
        </div>
        {/*  TẮT/BẬT RUNG — nhỏ nhưng phải bấm được bằng ngón cái ướt: 44 px
             (2.75rem) như nút ẩn bên cạnh. Chữ chứ không chỉ hình: bà con
             không đoán được biểu tượng rung, mà bấm nhầm là mất kênh cảnh báo
             duy nhất còn tới được khi máy trong túi áo mưa. */}
        {/*  KÊNH CẢNH BÁO thu vào một nút loa (tối ưu bố cục bản đồ, anh Long
             2026-10-19): hàng Giọng + Rung trước đây chiếm trọn một hàng thường
             trực. Icon loa GẠCH khi giọng đang tắt ⇒ trạng thái vẫn nhìn thấy;
             chạm mở hàng hai nút như cũ (chữ, không chỉ hình). */}
        {(voice || onToggleRung) && (
          <button
            type="button"
            onClick={() => setShowKenh((v) => !v)}
            aria-expanded={showKenh}
            aria-label={`Giọng đọc và rung${voice ? ` — ${voice.label}` : ""}${onToggleRung ? `, ${rungOn ? "rung bật" : "rung tắt"}` : ""}`}
            className={`flex h-(--h-ctl) w-(--h-ctl) shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
              showKenh ? "bg-sea/15 text-sea" : "bg-navy/10 text-navy"
            }`}
          >
            {voice && !voice.on ? (
              <SpeakerOffIcon className="h-5 w-5" />
            ) : (
              <SpeakerIcon className="h-5 w-5" />
            )}
          </button>
        )}
        {/*  RẢNH TAY đang bật ⇒ chấm đỏ nhỏ cạnh nút loa: micro đang mở là chuyện bà con phải luôn thấy */}
        {ranhTay?.on && (
          <span className="relative -ml-1.5 flex h-2.5 w-2.5 shrink-0" role="img" aria-label="Rảnh tay đang nghe">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
          </span>
        )}
        <button
          type="button"
          onClick={onStop}
          className="h-(--h-ctl) shrink-0 rounded-full bg-navy/10 px-4 text-[0.875rem] font-semibold text-navy transition active:scale-[0.97]"
        >
          Dừng
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Ẩn bảng dẫn đường"
          className="flex h-(--h-ctl) w-(--h-ctl) shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy transition active:scale-95"
        >
          <MinusIcon className="h-5 w-5" />
        </button>
      </div>

      {/*  HÀNG NÚT KÊNH CẢNH BÁO — Giọng + Rung cạnh nhau, chữ chứ không chỉ
           hình (bà con không đoán được biểu tượng). Chỉ hiện khi bấm nút loa. */}
      {showKenh && (voice || onToggleRung) && (
        <div className={`grid gap-1.5 ${ranhTay ? "grid-cols-3" : "grid-cols-2"}`}>
          {voice && (
            <button
              type="button"
              onClick={voice.onCycle}
              aria-label={`${voice.label} — chạm để đổi`}
              className={`flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl px-2 text-[0.875rem] font-semibold transition active:scale-95 ${
                voice.on ? "bg-t1/15 text-t1" : "bg-navy/10 text-navy/60"
              }`}
            >
              <SpeakerIcon className="h-5 w-5 shrink-0" />
              {voice.label}
            </button>
          )}
        {onToggleRung && (
            <button
              type="button"
              onClick={onToggleRung}
              aria-pressed={rungOn}
              aria-label={rungOn ? "Tắt rung khi có cảnh báo" : "Bật rung khi có cảnh báo"}
              className={`min-h-[2.75rem] rounded-xl px-2 text-[0.875rem] font-semibold transition active:scale-95 ${
                rungOn ? "bg-t1/15 text-t1" : "bg-navy/10 text-navy/60"
              }`}
            >
              {rungOn ? "Rung bật" : "Rung tắt"}
            </button>
          )}
          {ranhTay && (
            <button
              type="button"
              onClick={ranhTay.onToggle}
              aria-pressed={ranhTay.on}
              aria-label={ranhTay.on ? "Tắt Rảnh tay — thôi nghe câu gọi Sen Biển" : "Bật Rảnh tay — gọi Sen Biển ơi không cần chạm"}
              className={`min-h-[2.75rem] rounded-xl px-2 text-[0.875rem] font-semibold transition active:scale-95 ${
                ranhTay.on ? "bg-t1/15 text-t1" : "bg-navy/10 text-navy/60"
              }`}
            >
              {NHAN.ranhTay}
            </button>
          )}
        </div>
      )}

      {/* RANH GIỚI theo GPS — trên mọi thứ khác trong HUD; chạm để thu khi còn
          >6 hải lý, nói lại khi vượt mốc mới (cha lo), ≤6 hải lý nằm đó. */}
      {borderShow && borderLine && hien.has("border") && (
        <button
          type="button"
          role="alert"
          disabled={borderLocked}
          onClick={onDismissBorder}
          aria-label={
            borderLocked ? undefined : "Thu gọn dòng cảnh báo ranh giới"
          }
          className={`flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[0.875rem] font-semibold leading-snug ${borderTone}`}
        >
          <AlertIcon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">{borderLine}</span>
          {!borderLocked && <MinusIcon className="h-4 w-4 shrink-0" />}
        </button>
      )}

      {/*  HIỂM HOẠ TRÊN ĐƯỜNG (Đợt 3) — dưới ranh giới, trên mọi thứ khác.
           Thứ tự do `lib/nav-hazards` quyết (nặng nhất trước), HUD KHÔNG xếp
           lại. Đỏ: không thu được. Vàng/tin: chạm để thu, thu theo id nên vật
           khác tới vẫn nói. */}
      {lines.filter((l) => hien.has(`hz:${l.id}`)).map((l) =>
        l.khoa ? (
          <p
            key={l.id}
            role="alert"
            className={`flex min-h-[2.75rem] items-center gap-2 rounded-xl px-2.5 py-2 text-[0.875rem] font-semibold leading-snug ${MUC_TONE.do}`}
          >
            <AlertIcon className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1">{l.cau}</span>
            {l.id === ackId && voice && (
              <button
                type="button"
                onClick={voice.onAck}
                className="min-h-[2.75rem] shrink-0 rounded-xl bg-danger px-3 text-[0.875rem] font-semibold text-white transition active:scale-95"
              >
                Đã nghe
              </button>
            )}
          </p>
        ) : (
          <button
            key={l.id}
            type="button"
            role={l.muc === "vang" ? "alert" : "status"}
            onClick={() => setThuIds((ids) => [...ids.slice(-7), l.id])}
            aria-label="Thu gọn thông báo này"
            className={`flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[0.875rem] font-semibold leading-snug ${MUC_TONE[l.muc]}`}
          >
            {l.muc === "vang" && <AlertIcon className="h-5 w-5 shrink-0" />}
            <span className="min-w-0 flex-1">{l.cau}</span>
            <MinusIcon className="h-4 w-4 shrink-0" />
          </button>
        ),
      )}

      {/*  ĐANG TRONG VÙNG — dưới cảnh báo "sắp tới", không thu được */}
      <BienVung vung={vung.filter((v) => hien.has(`vung:${v.id}`))} />

      {/*  KHU TRÚ BÃO GẦN — CHỈ hiện khi đang có bão. App không phán "chạy vào
           đi": chỉ mở danh sách khu, còn bao xa, chừng bao lâu; vào hay không
           là quyết định của thuyền trưởng. */}
      {onShelter && hien.has("shelter") && (
        <button
          type="button"
          onClick={(e) => onShelter(e.currentTarget)}
          className="flex min-h-[3.5rem] w-full items-center gap-2 rounded-xl bg-warn-bg px-2.5 py-2 text-left text-[1rem] font-semibold leading-snug text-warn"
        >
          <AnchorIcon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">Trú bão</span>
          <ChevronRightIcon className="h-5 w-5 shrink-0" />
        </button>
      )}

      {voice?.noVoice && hien.has("novoice") && (
        <div className="flex items-center gap-2 rounded-xl bg-warn-bg px-2.5 py-2 text-[0.875rem] font-semibold leading-snug text-warn">
          <span className="min-w-0 flex-1">
            Máy chưa có giọng tiếng Việt — chỉ báo bằng chuông và chữ.
          </span>
          {voice.noVoice.canInstall && (
            <button
              type="button"
              onClick={voice.noVoice.onInstall}
              className="min-h-[2.75rem] shrink-0 rounded-xl bg-navy px-3 text-[0.875rem] font-semibold text-white transition active:scale-95"
            >
              Tải giọng
            </button>
          )}
        </div>
      )}

      {(dongAn > 0 || moRong) && dongHud.length > HUD_TRAN && (
        <button
          type="button"
          onClick={() => setMoRong((v) => !v)}
          aria-expanded={moRong}
          aria-label={moRong ? "Thu bớt dòng cảnh báo" : `Xem thêm ${dongAn} dòng cảnh báo`}
          className="flex h-(--h-ctl) items-center gap-1 self-start rounded-full bg-navy/10 px-3 text-[0.875rem] font-semibold text-navy transition active:scale-95"
        >
          {moRong ? <MinusIcon className="h-4 w-4" /> : `+${dongAn}`}
        </button>
      )}

      {denied ? (
        <p className="flex items-center gap-2 rounded-xl bg-warn-bg px-2.5 py-1.5 text-[0.875rem] font-semibold leading-snug text-warn">
          <AlertIcon className="h-4 w-4 shrink-0" />
          Chưa bật định vị (GPS) — bật rồi mở lại.
        </p>
      ) : (
        <>
          {lost && (
            <p className="flex items-center gap-2 rounded-xl bg-warn-bg px-2.5 py-1.5 text-[0.875rem] font-semibold leading-snug text-warn">
              <AlertIcon className="h-4 w-4 shrink-0" />
              Mất định vị — số dưới là lần bắt gần nhất.
            </p>
          )}

          {progress ? (
            <div className={lost ? "opacity-50" : ""}>
              {/* gợi ý lái + hướng đi */}
              <div className="flex items-center gap-2">
                {progress.steer && (
                  <span
                    className="flex shrink-0"
                    style={{ transform: `rotate(${progress.steer.turnDeg}deg)` }}
                  >
                    <NavArrowIcon className="h-6 w-6 text-t1" />
                  </span>
                )}
                <p className="display min-w-0 text-[1.125rem] font-semibold leading-tight text-navy">
                  {progress.arrived
                    ? "Đã tới gần điểm đến"
                    : progress.steer
                      ? progress.steer.label
                      : "Đang xác định hướng di chuyển…"}
                </p>
              </div>
              {/* một dòng: hướng · quãng còn lại · giờ chạy (thay 2 ô to cũ) */}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.875rem] font-semibold text-foreground/75">
                {progress.dirVN}
                <span aria-hidden>·</span>
                còn {kc(progress.remainingKm, prefs.distUnit)}
                <span aria-hidden>·</span>
                <ClockIcon className="h-4 w-4 shrink-0" aria-hidden />
                {progress.etaHours != null
                  ? formatHoursVN(progress.etaHours)
                  : "tàu chưa chạy"}
              </p>

              {/*  KHÚC RẼ KẾ TIẾP (học VietMap: biết trước chỗ đổi hướng) — mũi tên
                   xoay theo góc đổi hướng, chữ nói hướng đi tiếp. Không ra lệnh. */}
              {khucRe && !progress.arrived && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.875rem] font-semibold text-navy">
                  <span className="flex shrink-0" style={{ transform: `rotate(${khucRe.gocDeg}deg)` }} aria-hidden>
                    <NavArrowIcon className="h-4 w-4 text-t1" />
                  </span>
                  Còn {kc(khucRe.km, prefs.distUnit)} tới khúc rẽ
                  <span aria-hidden>·</span>
                  rồi đi {khucRe.huongVN}
                </p>
              )}

              {/*  CHỖ GHÉ KẾ TIẾP — dòng riêng, ĐẶT TRÊN dòng tổng vì đó mới là
                   thứ đang phải lái tới. Dòng trên nói tới ĐÍCH CUỐI: đi 3 chỗ
                   mà chỉ thấy "còn 491 hải lý" thì bà con không biết bao giờ
                   tới chỗ thả lưới đầu tiên.
                   Chỉ hiện khi đường đi nhiều chỗ VÀ chưa qua hết (`nextStop`
                   null ở hai ca đó) — không đẻ dòng thừa cho chuyến một chỗ. */}
              {/* có dòng đỏ ⇒ bớt dòng phụ này (giọng vẫn báo chỗ ghé) — giữ khung thấp */}
              {nextStop && !progress.arrived && !coDo && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.875rem] font-semibold text-t1">
                  Tới chỗ {nextStop.so}
                  <span aria-hidden>·</span>
                  {kc(nextStop.km, prefs.distUnit)}
                  {nextStop.hours != null && (
                    <>
                      <span aria-hidden>·</span>
                      <ClockIcon className="h-4 w-4 shrink-0" aria-hidden />
                      {formatHoursVN(nextStop.hours)}
                    </>
                  )}
                </p>
              )}

              {/* LỆCH TUYẾN — chỉ nói khi cha bảo (vượt sang mốc xa hơn), thu
                  được, giọng trung tính. Trước đây dòng này in lại MỖI NHỊP GPS
                  suốt thời gian còn lệch và không thu được. */}
              {offRoute && !offRoute.dismissed && !progress.arrived && (
                <div className="mt-1.5 flex items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={onDismissOffRoute}
                    aria-label="Thu gọn nhắc nhở lệch tuyến"
                    className="flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-2 rounded-xl bg-warn-bg px-2.5 py-2 text-left text-[0.875rem] font-semibold leading-snug text-warn"
                  >
                    <span className="min-w-0 flex-1">
                      Lệch đường đã vẽ ~{kc(offRoute.km, prefs.distUnit)}
                      {offRoute.ben ? ` — vạch ở bên ${offRoute.ben} tàu` : ""}.
                    </span>
                    <MinusIcon className="h-4 w-4 shrink-0" />
                  </button>
                  {/*  lệch xa: lối tính lại từ chỗ tàu — bấm mới tính, không tự đổi tuyến */}
                  {onVeLai && offRoute.km >= VE_LAI_TU_KM && (
                    <button
                      type="button"
                      onClick={onVeLai}
                      className="shrink-0 rounded-xl bg-t1 px-3 text-[0.875rem] font-semibold text-white transition active:scale-95"
                    >
                      {NHAN.veLai}
                    </button>
                  )}
                </div>
              )}
              {/*  TỚI NƠI: một câu (dòng to bên trên) + nút "Xong" dọn chuyến (học Vietmap
                   "Bạn đã hoàn thành lộ trình"). Trước đây câu in hai lần và chỉ có "bấm Dừng". */}
              {progress.arrived && (
                <button
                  type="button"
                  onClick={onStop}
                  className="mt-1.5 flex h-(--h-ctl) w-full items-center justify-center gap-2 rounded-xl bg-ok text-[1rem] font-semibold text-white transition active:scale-[0.98]"
                >
                  <CheckIcon className="h-5 w-5" aria-hidden />
                  {NHAN.xong}
                </button>
              )}
            </div>
          ) : cruiseLine ? (
            <p
              className={`display text-[1.125rem] font-semibold leading-snug text-navy ${lost ? "opacity-50" : ""}`}
            >
              {cruiseLine}
            </p>
          ) : (
            !lost && (
              <p className="rounded-xl bg-white/45 p-2.5 text-[0.875rem] font-semibold text-foreground/70">
                Đang tìm vị trí tàu…
              </p>
            )
          )}
        </>
      )}

      {/*  CÂU ĐANG ĐỌC — ĐẶT CUỐI KHUNG (thử iOS Simulator 2026-11-02): ở giữa thì mỗi lần câu
           hiện/tắt là dòng lái + nút "Xong" nhảy lên xuống dưới ngón tay, bấm trượt. Ở cuối thì
           chỉ đáy khung co giãn. — in ra đúng câu loa đang nói (người nghe kém một bên,
           máy rè, tiếng máy tàu át). Câu ĐỎ có nút "Đã nghe" để thôi nhắc lại. */}
      {voice?.speaking && speakingRow && hien.has("speaking") && (
        <div
          role="status"
          className={`flex min-h-[2.75rem] items-center gap-2 rounded-xl px-2.5 py-2 text-[0.875rem] font-semibold leading-snug ${
            voice.speaking.red ? "bg-danger-bg text-danger" : "bg-white/45 text-navy"
          }`}
        >
          <SpeakerIcon className="h-5 w-5 shrink-0" />
          {/*  Bản tin mở đầu dài 5 câu: in nguyên khối là chiếm nửa HUD trong lúc đọc
               (rà UI 2026-11-02) ⇒ câu thường gói 3 dòng; câu đỏ luôn in đủ. */}
          <span className={`min-w-0 flex-1 ${voice.speaking.red ? "" : "line-clamp-3"}`}>{voice.speaking.text}</span>
          {voice.speaking.red && (
            <button
              type="button"
              onClick={voice.onAck}
              className="min-h-[2.75rem] shrink-0 rounded-xl bg-danger px-3 text-[0.875rem] font-semibold text-white transition active:scale-95"
            >
              Đã nghe
            </button>
          )}
        </div>
      )}

    </div>
  );
}
