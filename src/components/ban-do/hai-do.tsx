/*
  LỚP HẢI ĐỒ + CHÚ GIẢI THEO TẦNG — dời nguyên văn khỏi fishing-map-view.tsx
  (2026-10-19, rà Codex đợt 3: tách file 9.459 dòng theo trách nhiệm; KHÔNG đổi
  hành vi — mọi hằng/hàm giữ đúng giá trị, file gốc import lại).
*/
import { Layer } from "react-map-gl/maplibre";
import { CloseButton } from "@/components/ui/close-button";
import { CHART_FEATURE_ICON, CHART_ICON_SIZE } from "@/lib/chart-symbols";
import { ghiChuChatDayTrong } from "@/lib/chat-day";
import { CHART_TIER, CHAT_DAY_COLORS, CLUSTER_BADGE, DEPTH_BANDS, DEPTH_DANGER_COLOR, DEPTH_SAFE_COLOR, DEPTH_SHALLOW_COLOR, ISLAND_DOT_COLOR, SAFETY_CONTOUR_STYLE, SEA_CABLE_COLOR, SEA_LANE_COLOR, SEA_RESTRICTED_COLOR } from "@/lib/ocean-map";
import { type FilterSpecification } from "maplibre-gl";

/*  BÁO HIỆU HÀNG HẢI — id lớp bắt chạm, và NẤC ZOOM cho từng loại.

    Vì sao phải phân nấc: bộ dữ liệu có 5.851 báo hiệu. Đổ hết ra từ zoom vùng
    là bôi đen màn hình, mà bà con lại đang cần thấy đúng vài cái quanh mình.
    Luật chia theo GIÁ TRỊ Ở KHOẢNG CÁCH ĐÓ, không phải theo loại cho gọn:
     · z≥9  — thứ nhìn thấy từ xa ngoài khơi: đèn biển lớn, tàu đèn, phao ảo,
              giàn khoan, mốc bờ có đèn (~580 cái, thưa)
     · z≥11 — thứ có nghĩa khi đã áp bờ: đèn nhỏ, phao báo hướng, phao báo chỗ
              nguy hiểm, lồng bè, vùng neo, cảng
     · z≥13 — thứ chỉ dùng lúc vào luồng: phao luồng, phao chuyên dùng, tiêu,
              trụ buộc tàu, cửa âu
    Ngoài khơi mất sóng thì lớp này VẪN CÒN — nó là asset tĩnh trong máy, khác
    hẳn lớp ảnh OpenSeaMap trước đây. */
export const SEAMARK_HIT_LAYERS = ["seamark-far", "seamark-mid", "seamark-near"];
/*  Vòng "+N" (gom cụm) chạm được — chạm là PHÓNG TỚI, không mở thẻ. */
export const CLUSTER_HIT_LAYERS = ["seamark-mid-cum", "seamark-near-cum", "vn-aid-cum"];
/*  BA TẦNG theo GIÁ TRỊ Ở KHOẢNG CÁCH ĐÓ (2026-09-03c, xem CHART_TIER trong
    ocean-map): XA = thứ định hướng từ ngoài khơi · VỪA = mọi phao/tiêu luồng
    + đèn nhỏ (trước đây phao luồng OSM bị đẩy tới z13 vì "dày" — nay chỗ dày
    đã gom "+N", phao về đúng nấc z9 như phao Cục Hàng hải) · SÁT = phao chuyên
    dùng, nuôi trồng, neo, cọc — chuyện của cửa lạch. */
export const SEAMARK_FAR = [
  "light_major",
  "light_vessel",
  /*  "platform" ĐÃ BỎ (reviewer A.1 2026-09-03): 41/41 giàn trong seamarks
      trùng toạ độ <50 m với `kind=giankhoan` của sea-lanes → vẽ ĐÔI. Giữ bản
      sea-lanes vì có `ten` + chạm ra thẻ "cấm 500 m quanh". */
  "landmark",
];
export const SEAMARK_MID = [
  "light_minor",
  "light_float",
  "light",
  "virtual_aton",
  "buoy_cardinal",
  "buoy_isolated_danger",
  "buoy_safe_water",
  "buoy_lateral",
  "beacon",
  "beacon_lateral",
  "beacon_cardinal",
  "beacon_isolated_danger",
  "beacon_safe_water",
  "anchorage",
  "harbour",
];
/*  Không vẽ từ nguồn OSM: giàn khoan đã có bản sea-lanes (kind=giankhoan, có
    tên + vòng cấm) — để cả hai là vẽ đôi (reviewer A.1). */
export const SEAMARK_AN = ["platform"];
/*  Layout chung cho icon báo hiệu ba tầng — CHO PHÉP CHỒNG. Ngược với nhãn
    số đo sâu (ở đó thà mất vài số): một cái phao bị giấu vì chồng lên cái bên
    cạnh là mất đúng thứ bà con cần thấy khi vào luồng ban đêm. Chồng hình vẫn
    đọc được; thiếu hình thì không. Chỗ QUÁ dày thì nguồn đã gom "+N" trước. */
export const SEAMARK_ICON_LAYOUT = {
  "icon-image": ["get", "ic"] as unknown as string,
  "icon-size": CHART_ICON_SIZE as unknown as number,
  "icon-allow-overlap": true,
  "icon-ignore-placement": true,
  "icon-anchor": "bottom" as const,
};
/** Vật lẻ (không phải cụm) — lọc cho lớp icon trên nguồn có cluster. */
export const KHONG_PHAI_CUM = ["!", ["has", "point_count"]] as unknown as FilterSpecification;
export const LA_CUM = ["has", "point_count"] as unknown as FilterSpecification;
/*  Hai lớp vòng "+N" cho một nguồn có cluster. Trả MẢNG (không Fragment):
    <Source> của react-map-gl chỉ gắn `source` cho con TRỰC TIẾP — bọc Fragment
    là hai lớp mất nguồn, im lặng không vẽ. */
export function cumLayers(id: string, minzoom: number) {
  return [
    <Layer
      key={`${id}-cum`}
      id={`${id}-cum`}
      type="circle"
      minzoom={minzoom}
      filter={LA_CUM}
      paint={{
        "circle-radius": CLUSTER_BADGE.radius,
        "circle-color": CLUSTER_BADGE.fill,
        "circle-stroke-color": CLUSTER_BADGE.stroke,
        "circle-stroke-width": 2,
      }}
    />,
    <Layer
      key={`${id}-cum-so`}
      id={`${id}-cum-so`}
      type="symbol"
      minzoom={minzoom}
      filter={LA_CUM}
      layout={{
        "text-field": ["concat", "+", ["to-string", ["get", "point_count"]]] as unknown as string,
        "text-font": ["Noto Sans Bold"],
        "text-size": 13,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      }}
      paint={{ "text-color": CLUSTER_BADGE.text }}
    />,
  ];
}
/*  CHÚ GIẢI THEO TẦNG (2026-09-03c) — sắp theo "phóng tới đâu thấy gì", đúng
    câu bà con hỏi, thay vì theo loại vật. Mỗi dòng: icon cắt từ sprite, hoặc
    vệt màu (đường/chấm/vùng), hoặc vòng "+6". */
export type LegendRow = { chu: string; icon?: string; mau?: string; dang?: "duong" | "cham" | "vung"; cum?: boolean };
export type LegendTier = { tieuDe: string; zoom: number; dong: LegendRow[]; ghiChu?: string };
export const LEGEND_TIERS: LegendTier[] = [
  {
    tieuDe: "Luôn hiển thị khi bật Hải đồ chi tiết",
    zoom: CHART_TIER.LUON,
    dong: [
      { mau: ISLAND_DOT_COLOR, dang: "cham", chu: "Đảo nổi có tên (chữ navy)" },
      { mau: DEPTH_BANDS[DEPTH_BANDS.length - 1].color, dang: "vung", chu: "Dải màu độ sâu: càng sáng càng sâu (0–10 · 10–20 · 20–50 · trên 50 m)" },
      { mau: SEA_LANE_COLOR, dang: "duong", chu: "Tuyến tàu hàng lớn" },
      { icon: "tide-up-2", chu: "Trạm con nước — khối nước xanh có mũi tên lên là đang lên, đỏ mũi tên xuống là đang xuống, chỉ mặt sóng là nước đứng, kẻ sọc là ước tính; chạm xem giờ nước lớn, nước ròng. 11 trạm vùng thấy từ đây, trạm tại từng cảng cá hiện khi phóng vừa" },
      { icon: CHART_FEATURE_ICON.seamount, chu: "Núi ngầm — gò lớn dưới đáy, cá đáy hay tụ quanh sườn" },
      { icon: CHART_FEATURE_ICON.knoll, chu: "Đồi ngầm — gò thấp dưới đáy" },
      { icon: CHART_FEATURE_ICON.ridge, chu: "Sống núi ngầm — dải gò dài" },
      { icon: CHART_FEATURE_ICON.guyot, chu: "Núi chóp phẳng (guyot)" },
      { icon: CHART_FEATURE_ICON.deep, chu: "Hố ngầm — trũng sâu hơn quanh" },
      { icon: CHART_FEATURE_ICON.valley, chu: "Thung lũng / hẻm / kênh ngầm — rãnh sâu" },
      { icon: CHART_FEATURE_ICON.escarpment, chu: "Vách / dốc / đèo ngầm — độ sâu đổi nhanh" },
    ],
  },
  {
    tieuDe: "Phóng XA — nhìn cả vùng biển",
    zoom: CHART_TIER.XA,
    dong: [
      { icon: "lighthouse", chu: "Đèn biển lớn — chạm xem nhịp chớp" },
      { icon: "wreck", chu: "Xác tàu chìm (số độ sâu nước trên xác hiện khi phóng vừa)" },
      { icon: "obstruction", chu: "Chướng ngại vật dưới nước" },
      { icon: CHART_FEATURE_ICON.rockAwash, chu: "ĐÁ NGẦM — đâm là thủng, cần tránh xa" },
      { icon: CHART_FEATURE_ICON.coralReef, chu: "Rạn san hô ngoài khơi — cá tụ, neo trượt" },
      { icon: CHART_FEATURE_ICON.bank, chu: "Bãi cạn / cồn cát ngoài khơi — có thể ngập, nhìn con nước" },
      { icon: "platform", chu: "Giàn khoan / công trình biển" },
      { icon: CHART_FEATURE_ICON.noAnchor, chu: "CẤM NEO — vòng 500 m quanh công trình" },
      { icon: "anchorage", chu: "Khu neo đậu tránh trú bão" },
      { mau: SAFETY_CONTOUR_STYLE.color, dang: "duong", chu: "Đường 10 m đậm — nông hơn là phải nhìn con nước" },
    ],
  },
  {
    tieuDe: "Phóng VỪA — áp bờ, nhìn một tỉnh",
    zoom: CHART_TIER.VUA,
    dong: [
      { icon: "lat-port", chu: "Phao ĐỎ (mạn trái): vào luồng để nó bên TRÁI tàu" },
      { icon: "lat-stbd", chu: "Phao XANH (mạn phải): vào luồng để nó bên PHẢI tàu" },
      { icon: "card-n", chu: "Phao hướng (đen-vàng): đi về phía chữ ghi, nguy hiểm phía ngược lại" },
      { icon: "iso-danger", chu: "Phao chỗ nguy hiểm: nguy hiểm ngay dưới, tránh xa" },
      { icon: "safe-water", chu: "Phao nước sâu: đi qua hai bên đều được" },
      { icon: "light-minor", chu: "Đèn nhỏ / đèn cửa — tên đèn biển cũng hiện từ nấc này" },
      { icon: "harbour", chu: "Bến cảng, cửa lạch" },
      { cum: true, chu: "Chỗ nhiều phao gom thành vòng +N — chạm vào là phóng tới" },
      { mau: SEA_CABLE_COLOR, dang: "duong", chu: "Cáp quang/điện ngầm (tím, nét đứt) — đừng thả neo, đừng giã cào" },
      { icon: CHART_FEATURE_ICON.pipelineMark, chu: "Ống dẫn dầu/khí (đen, vạch-chấm) — đừng thả neo" },
      { icon: CHART_FEATURE_ICON.cableLanding, chu: "Điểm cáp cập bờ" },
      { mau: SEA_RESTRICTED_COLOR, dang: "vung", chu: "Vùng cấm / khu hạn chế (viền cam, nền cam nhạt)" },
      { mau: SEA_RESTRICTED_COLOR, dang: "vung", chu: "Khu bảo tồn biển (viền liền) · vùng cấm đánh bắt theo mùa (viền đứt — nền đậm là ĐANG cấm, mờ là ngoài mùa) · khu bảo vệ nguồn lợi (viền chấm) — chạm vào để đọc" },
      { mau: SEA_LANE_COLOR, dang: "duong", chu: "Luồng cảng, phân luồng" },
      { icon: CHART_FEATURE_ICON.bank, chu: "Rạn, bãi, đá VEN BỜ (cùng hình như ngoài khơi)" },
    ],
  },
  {
    tieuDe: "Phóng SÁT — cửa lạch, luồng hẹp",
    zoom: CHART_TIER.SAT,
    dong: [
      { icon: "special", chu: "Phao chuyên dùng (khu nuôi, cáp, đo đạc…)" },
      { icon: "marine-farm", chu: "Lồng bè nuôi" },
      { icon: "mooring", chu: "Phao neo / cọc neo" },
      { mau: DEPTH_DANGER_COLOR, dang: "cham", chu: "Số đo sâu dưới 4 m — KHÔNG NÊN VÀO" },
      { mau: DEPTH_SHALLOW_COLOR, dang: "cham", chu: "4–12 m — nhìn con nước" },
      { mau: DEPTH_SAFE_COLOR, dang: "cham", chu: "Từ 12 m — yên tâm" },
      { mau: CHAT_DAY_COLORS.Co, dang: "cham", chu: "Chất đáy: san hô — neo khó bám" },
      { mau: CHAT_DAY_COLORS.R, dang: "cham", chu: "Chất đáy: đá" },
      { mau: CHAT_DAY_COLORS.S, dang: "cham", chu: "Chất đáy: cát — neo bám tốt" },
      { mau: CHAT_DAY_COLORS.G, dang: "cham", chu: "Chất đáy: vụn san hô" },
      { mau: CHAT_DAY_COLORS.Sg, dang: "cham", chu: "Chất đáy: cỏ biển" },
    ],
    ghiChu: "Chấm đo sâu rỗng ruột = số đo cũ trên một năm, cửa lạch có thể đã bồi. " + ghiChuChatDayTrong(),
  },
];

/*  SHEET "KÝ HIỆU LÀ GÌ?" (reviewer B.2/B.3) — dời nguyên văn khỏi fishing-map-view
    (2026-10-19, lát 3). `kyHieu` vẽ ô ký hiệu từ sprite (phụ thuộc meta nạp lúc chạy)
    nên đi qua props; gợi ý "phóng to thêm" tính từ `mapZoom`. */
export function BangChuGiai({
  mapZoom,
  kyHieu,
  onClose,
}: {
  mapZoom: number;
  kyHieu: (d: LegendRow) => React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute inset-x-2 bottom-2 top-16 z-50 flex flex-col overflow-hidden rounded-2xl bg-card/98 shadow-2xl"
      role="dialog"
      aria-label="Ký hiệu trên hải đồ"
    >
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
        <p className="text-[1.125rem] font-semibold text-navy">Ký hiệu trên hải đồ</p>
        <CloseButton onClose={onClose} label="Đóng chú giải" />
      </div>
      <p className="border-b border-foreground/10 bg-field/60 px-4 py-2 text-[0.875rem] font-semibold leading-snug text-foreground/75">
        Hải đồ hiện dần theo <b>ba mức phóng to</b> (như máy hải đồ thương mại): phóng XA thấy
        đèn lớn + vật chìm, phóng VỪA thấy phao + cáp, phóng SÁT thấy số đo sâu + chất đáy —
        và chỉ ở nơi có vật đó. Chỗ nhiều phao gom thành vòng <b>+6</b>, chạm vào là phóng tới.
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[0.9375rem] font-semibold text-foreground/85">
        {LEGEND_TIERS.map((tang) => (
          <div key={tang.tieuDe} className="mb-4">
            <p className="mb-1 text-[0.875rem] font-semibold text-foreground/60">
              {tang.tieuDe}
              <span className="normal-case tracking-normal text-danger/80">{mapZoom < tang.zoom ? " — phóng to thêm mới thấy" : ""}</span>
            </p>
            {tang.dong.map((d) => (
              <div key={d.chu} className="flex min-h-[2.5rem] items-center gap-3 py-0.5">
                {kyHieu(d)}
                <span>{d.chu}</span>
              </div>
            ))}
            {tang.ghiChu && <p className="mt-1 text-[0.875rem] text-foreground/65">{tang.ghiChu}</p>}
          </div>
        ))}
        <p className="mb-2 text-[0.875rem] text-foreground/65">
          Chạm bất kỳ vật nào trên bản đồ để xem tên và chi tiết.
        </p>
      </div>
    </div>
  );
}
