/*
  THẺ THÔNG TIN KHI CHẠM TRÊN BẢN ĐỒ — báo hiệu, đo sâu, đèn, xác tàu, chất đáy, khu trú
  bão, vùng quản lý, rạn/bãi, luồng/hạ tầng, địa danh ngầm, mốc bão. Dời NGUYÊN VĂN khỏi
  fishing-map-view.tsx (2026-10-19, rà Codex đợt 3 — tách theo trách nhiệm, KHÔNG đổi
  hành vi): mỗi thẻ nhận `info` + `onClose`, phần còn lại (prefs, bieuTuong…) qua props.
*/
import { type PlannedRoute } from "@/components/route-planner";
import { CloseButton } from "@/components/ui/close-button";
import { kepTheTrongKhung } from "@/components/ban-do/kep-the";
import { CHART_FEATURE_ICON, diaDanhNgamSymbolId, reefSymbolId } from "@/lib/chart-symbols";
import { chatDayLabel, laDayCung, type ChatDayMa } from "@/lib/chat-day";
import { moTaDenBien, tenDayDu, type DenBien } from "@/lib/den-bien";
import { nhanLoaiDiaDanhNgam } from "@/lib/dia-danh-ngam";
import { capLabel, tenTinhDep, type KhuTruBao } from "@/lib/khu-tru-bao";
import { fmtCoordPair, fmtDepthM, fmtDist, fmtLat, fmtLon, type CoordFormat } from "@/lib/map-prefs";
import { CHAT_DAY_COLORS, KHU_TRU_BAO_COLOR, RESTRICTED_FILL_COLOR, SEA_RESTRICTED_COLOR } from "@/lib/ocean-map";
import { formatHoursVN, type BoatProfile } from "@/lib/route-plan";
import { describeSeamark, huongDiQuaPhao, seamarkLabel, type Seamark } from "@/lib/seamarks";
import { soundingAgeDays, type Sounding } from "@/lib/soundings";
import { ESTIMATED_DATE_NOTE, ageLine, isStale } from "@/lib/soundings-verified";
import { nhanMoc } from "@/lib/storm-track";
import { nearestTideStation, tideDraftWarning, tideExtremesForDay, tideTrustText, type TideStation } from "@/lib/tides";
import { readUserRecord } from "@/lib/user-list-store";
import { type VnAid } from "@/lib/vn-aids";
import { LOAI_LABEL, dangVung, trangThaiText, type VungQuanLy } from "@/lib/vung-quan-ly";
import { moTaXacTau, type XacTau, xacTauLabel } from "@/lib/xac-tau";
import type { MapPrefs } from "@/lib/map-prefs";

/*  DÒNG TOẠ ĐỘ trong các thẻ chạm — vĩ độ / kinh độ XUỐNG DÒNG RIÊNG như máy
    định vị: thẻ chỉ rộng 15rem, để một dòng thì chữ gãy giữa chừng sau dấu
    chấm giữa. Không có toạ độ (đường/vùng) thì không vẽ gì. */
function DongToaDo({
  lat,
  lon,
  fmt,
}: {
  lat: number | null;
  lon: number | null;
  fmt: CoordFormat;
}) {
  if (lat == null || lon == null) return null;
  return (
    <p className="mt-1 text-[0.875rem] font-semibold leading-snug text-foreground/55">
      {fmtLat(lat, fmt)}
      <br />
      {fmtLon(lon, fmt)}
    </p>
  );
}

export type MarkInfo = {
  mark: Seamark;
  x: number;
  y: number;
};

export type DepthInfo = {
  s: Sounding;
  x: number;
  y: number;
};

export type DenInfo = {
  d: DenBien;
  x: number;
  y: number;
};

export type XacTauInfo = {
  x: XacTau;
  px: number;
  py: number;
};

export type ChatDayInfo = {
  ma: string;
  tyLe: number;
  soManh: number;
  x: number;
  y: number;
};

export type KhuTruBaoInfo = {
  k: KhuTruBao;
  x: number;
  y: number;
};

export type VungInfo = {
  v: VungQuanLy;
  x: number;
  y: number;
};

export type ReefInfo = {
  ten: string;
  type: string;
  /** ven-bo · hoang-sa · truong-sa · them-luc-dia — bãi ngầm DK1 sâu 20–50 m
      KHÔNG được nói "có thể ngập" (reviewer A.11 R3) */
  group: string;
  /** Toạ độ chỗ rạn/bãi/đá — xem `toaDoDiem` */
  lat: number | null;
  lon: number | null;
  x: number;
  y: number;
};

export type LaneInfo = {
  ten: string;
  kind: string;
  loai: string | null;
  /** Chỉ giàn khoan / điểm cập bờ mới có — cáp, ống, vùng cấm trải dài nên
      `toaDoDiem` trả null (một điểm trên đường không phải vị trí của nó) */
  lat: number | null;
  lon: number | null;
  x: number;
  y: number;
};

export type DiaDanhInfo = {
  ten: string;
  loai: string;
  /*  Toạ độ CHỖ NGẦM (chủ dự án 2026-09-04: "click vào cho hiện ra cả toạ
      độ luôn") — bà con chép vào máy định vị để chạy tới. Lấy thẳng từ
      geometry của feature, không tra lại mảng. */
  lat: number | null;
  lon: number | null;
  x: number;
  y: number;
};

export type StormPtInfo = {
  ten: string;
  nhan: string;
  tuongLai: boolean;
  lat: number;
  lon: number;
  cap: number | null;
  giat: number | null;
  dangerKm: number | null;
  /** giờ phát của bản tin CŨ mà đường dự báo này mượn về (null = tin mới) */
  tinCuLuc: number | null;
  x: number;
  y: number;
};

export function TheBaoHieu({ info, onClose, prefs }: { info: MarkInfo; onClose: () => void; prefs: MapPrefs }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-60 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-semibold leading-tight text-navy">
            {seamarkLabel(info.mark.type)}
          </p>
          {/*  Câu mô tả gộp màu thân + đặc tính đèn thành tiếng Việt đọc
               được ("Chớp 2 nhịp, ánh trắng, 10 giây một vòng, xa 14 hải
               lý") — KHÔNG bày mã hải đồ Fl(2)W.10s14M, bà con không phải
               sĩ quan hàng hải. Không có gì để nói thì im, đừng bịa. */}
          {describeSeamark(info.mark) && (
            <p className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-foreground/75">
              {describeSeamark(info.mark)}
            </p>
          )}
          {/*  BÊN NÀO LUỒNG — bằng CHỮ (reviewer B.6): "để phao bên TRÁI
               tàu" là câu bà con cần lúc cầm lái, không phải nhớ đỏ/xanh. */}
          {(() => {
            const huong = huongDiQuaPhao(
              info.mark,
              (info.mark as Partial<VnAid>).tacDung ?? undefined,
            );
            return huong ? (
              <p className="mt-1 text-[0.9375rem] font-semibold leading-snug text-navy">
                {huong}
              </p>
            ) : null;
          })()}
          <p className="mt-1 text-[0.875rem] font-semibold text-foreground/55">
            {fmtCoordPair(
              info.mark.lat,
              info.mark.lon,
              prefs.coordFormat,
            )}
          </p>
        </div>
        <CloseButton variant="goc"
          onClose={() => onClose()}
          label="Đóng thông tin báo hiệu"
        />
      </div>
    </div>
  );
}

export function TheDoSau({ info, onClose, prefs, tideStations, todayIso }: { info: DepthInfo; onClose: () => void; prefs: MapPrefs; tideStations: TideStation[] | null; todayIso: string }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-64 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        <div className="min-w-0 flex-1">
          <p className="text-[1.25rem] font-semibold leading-tight text-navy">
            Sâu {fmtDepthM(info.s.depthM)} m
          </p>
          {(() => {
            const tuoi = soundingAgeDays(
              info.s,
              new Date().toISOString().slice(0, 10),
            );
            const cu = isStale(tuoi);
            const uoc = info.s.notice.ngayUocLuong === true;
            const txt = ageLine(tuoi, uoc);
            return (
              <>
                {txt && (
                  <p
                    className={`mt-0.5 text-[0.9375rem] font-semibold leading-snug ${
                      cu ? "text-danger" : "text-foreground/75"
                    }`}
                  >
                    {txt}
                  </p>
                )}
                {/*  Ngày SUY RA từ đường dẫn chứ không phải ngày ký thì
                     phải nói ra. Câu tuổi phía trên đã tự làm thô (chỉ nói
                     số năm); dòng này giải thích vì sao. */}
                {uoc && (
                  <p className="mt-0.5 text-[0.8125rem] font-semibold leading-snug text-foreground/55">
                    {ESTIMATED_DATE_NOTE}
                  </p>
                )}
                {/*  Câu dặn CHỈ hiện khi số thật sự cũ — nói mọi lúc thì
                     thành tiếng ồn, và lúc cần thì không ai đọc nữa. */}
                {cu && (
                  <p className="mt-1 text-[0.875rem] font-semibold leading-snug text-danger/85">
                    Số cũ — cửa lạch có thể đã bồi lắng, đừng tin một mình
                    con số này.
                  </p>
                )}
              </>
            );
          })()}
          <p className="mt-1 text-[0.875rem] font-semibold text-foreground/55">
            {fmtCoordPair(
              info.s.lat,
              info.s.lon,
              prefs.coordFormat,
            )}
          </p>
          {/*  "LÀM MỚN" (2026-09-02) — món bà con đang trả 5 triệu để có.
               Độ sâu hải đồ + con nước RÒNG THẤP NHẤT hôm nay + mớn tàu
               MÌNH = câu trả lời cho đúng câu hỏi lúc cầm lái: "qua nổi
               không, hay chờ nước lên?".

               Ba cửa im lặng CÓ CHỦ Ý, đều là luật "không bịa":
               · chưa khai mớn nước → im (đoán mớn hộ là doạ sai người)
               · chưa nạp được trạm triều → im
               · trạm quá xa thì tideTrustText tự nói "giờ nước có thể lệch" */}
          {(() => {
            const boat = readUserRecord<Partial<BoatProfile>>("forfish.boat.v1").value;
            const mon = typeof boat?.draftM === "number" && boat.draftM > 0 ? boat.draftM : null;
            if (mon == null || !tideStations?.length) return null;
            const gan = nearestTideStation(tideStations, info.s.lat, info.s.lon);
            if (!gan) return null;
            // ngày theo giờ VN (trước đây lấy ngày UTC — 7 giờ tối đã sang "hôm qua")
            const cucTri = tideExtremesForDay(gan.station, todayIso);
            const canhBao = tideDraftWarning(cucTri, {
              draftM: mon,
              chartDepthM: info.s.depthM,
            });
            const tinCay = tideTrustText(gan.distanceKm, gan.station);
            if (!canhBao && !tinCay) return null;
            return (
              <>
                {canhBao && (
                  <p className="mt-1 text-[0.9375rem] font-semibold leading-snug text-danger">
                    {canhBao}
                  </p>
                )}
                {canhBao && tinCay && (
                  <p className="mt-0.5 text-[0.8125rem] font-semibold leading-snug text-foreground/55">
                    {tinCay} (trạm {gan.station.name})
                  </p>
                )}
              </>
            );
          })()}
          {/*  Số hiệu thông báo để bà con (hoặc cán bộ cảng vụ) tra lại tận
               gốc — ta không phải nguồn cuối cùng, và không giả vờ là. */}
          <p className="mt-0.5 text-[0.8125rem] font-semibold text-foreground/45">
            Thông báo hàng hải {info.s.notice.so}
          </p>
        </div>
        <CloseButton variant="goc"
          onClose={() => onClose()}
          label="Đóng thông tin độ sâu"
        />
      </div>
    </div>
  );
}

export function TheDen({ info, onClose, prefs }: { info: DenInfo; onClose: () => void; prefs: MapPrefs }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-64 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        <div className="min-w-0 flex-1">
          <p className="text-[1.125rem] font-semibold leading-tight text-navy">
            {tenDayDu(info.d)}
          </p>
          {moTaDenBien(info.d) && (
            <p className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-foreground/75">
              {moTaDenBien(info.d)}
            </p>
          )}
          {info.d.noi && (
            <p className="mt-1 text-[0.875rem] font-semibold text-foreground/55">
              {info.d.noi}
            </p>
          )}
          <p className="mt-0.5 text-[0.875rem] font-semibold text-foreground/55">
            {fmtCoordPair(info.d.lat, info.d.lon, prefs.coordFormat)}
          </p>
        </div>
        <CloseButton variant="goc" onClose={() => onClose()} label="Đóng thông tin đèn biển" />
      </div>
    </div>
  );
}

export function TheXacTau({ info, onClose, prefs }: { info: XacTauInfo; onClose: () => void; prefs: MapPrefs }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.px, info.py)}
      className="pointer-events-auto absolute z-40 w-64 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        <div className="min-w-0 flex-1">
          <p className="text-[1.125rem] font-semibold leading-tight text-navy">
            {xacTauLabel(info.x.loai)}
            {info.x.ten ? ` — ${info.x.ten}` : ""}
          </p>
          <p className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-foreground/75">
            {moTaXacTau(info.x)}
          </p>
          <p className="mt-1 text-[0.875rem] font-semibold text-foreground/55">
            {fmtCoordPair(info.x.lat, info.x.lon, prefs.coordFormat)}
          </p>
          {info.x.soThongBao && (
            <p className="mt-0.5 text-[0.8125rem] font-semibold text-foreground/45">
              Thông báo hàng hải {info.x.soThongBao}
            </p>
          )}
        </div>
        <CloseButton variant="goc" onClose={() => onClose()} label="Đóng thông tin vật chìm" />
      </div>
    </div>
  );
}

export function TheChatDay({ info, onClose }: { info: ChatDayInfo; onClose: () => void }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-60 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        <span
          className="mt-1 inline-block h-4 w-4 flex-none rounded-full"
          style={{
            backgroundColor:
              CHAT_DAY_COLORS[info.ma] ?? CHAT_DAY_COLORS.khac,
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[1.125rem] font-semibold leading-tight text-navy">
            Đáy: {chatDayLabel(info.ma)}
          </p>
          {/*  Gợi ý neo — đúng thứ chất đáy dùng để làm gì. Không phải luật
               cấm, chỉ nhắc: đá/san hô/vụn thì neo hay trượt. */}
          <p
            className={`mt-0.5 text-[0.9375rem] font-semibold leading-snug ${
              laDayCung(info.ma as ChatDayMa)
                ? "text-danger"
                : "text-foreground/75"
            }`}
          >
            {laDayCung(info.ma as ChatDayMa)
              ? "Đáy cứng — neo khó bám, dễ trượt"
              : "Đáy mềm — neo thường bám tốt"}
          </p>
          {/*  Câu đời thường, không %, không tên tổ chức (reviewer B.4) —
               cùng lời với `moTaChatDay` trong lib. */}
          {info.tyLe > 0 && (
            <p className="mt-0.5 text-[0.875rem] font-semibold leading-snug text-foreground/75">
              {info.tyLe >= 80
                ? `Gần như toàn bộ ${chatDayLabel(info.ma).toLowerCase()}`
                : "Lẫn nhiều loại đáy"}
            </p>
          )}
          <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-foreground/60">
            Theo ảnh vệ tinh — tham khảo
          </p>
        </div>
        <CloseButton variant="goc" onClose={() => onClose()} label="Đóng thông tin chất đáy" />
      </div>
    </div>
  );
}

export function TheKhuTruBao({ info, onClose }: { info: KhuTruBaoInfo; onClose: () => void }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-64 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        <span
          className="mt-1 inline-block h-4 w-4 flex-none rounded-full"
          style={{ backgroundColor: KHU_TRU_BAO_COLOR }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[1.125rem] font-semibold leading-tight text-navy">
            Trú bão: {info.k.ten}
          </p>
          <p className="mt-0.5 text-[0.875rem] font-semibold leading-snug text-foreground/70">
            {capLabel(info.k.cap)}
            {info.k.tinh ? ` · ${tenTinhDep(info.k.tinh)}` : ""}
          </p>
          {(info.k.sucChua || info.k.coTauM) && (
            <p className="mt-0.5 text-[0.875rem] font-semibold leading-snug text-foreground/60">
              {[
                info.k.sucChua
                  ? `sức chứa ~${info.k.sucChua.toLocaleString("vi-VN")} tàu`
                  : null,
                info.k.coTauM ? `phù hợp tàu dài tới ${info.k.coTauM} m` : null,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          {/*  Độ tin toạ độ nói thẳng: "vua" = suy từ đèn/phao gần cửa, lệch
               vài km — không được để bà con tưởng chấm là ranh giới vùng neo. */}
          {info.k.tin === "vua" && (
            <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-danger/80">
              Vị trí gần đúng — chấm chỉ đánh dấu cửa/cảng, không phải ranh vùng neo.
            </p>
          )}
          <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-foreground/60">
            Vị trí theo {info.k.nguonToaDo} · theo quy hoạch nhà nước (tham khảo)
          </p>
        </div>
        <CloseButton variant="goc" onClose={() => onClose()} label="Đóng thông tin khu trú bão" />
      </div>
    </div>
  );
}

export function TheVung({ info, onClose }: { info: VungInfo; onClose: () => void }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-72 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        <span
          className="mt-1 inline-block h-4 w-4 flex-none rounded-sm border-2"
          style={{
            borderColor: SEA_RESTRICTED_COLOR,
            backgroundColor: RESTRICTED_FILL_COLOR,
            opacity: dangVung(info.v, new Date()) === "ngoai-mua" ? 0.45 : 1,
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[1.125rem] font-semibold leading-tight text-navy">{info.v.ten}</p>
          {/*  Loại chỉ in khi TÊN chưa tự nói ("Khu bảo tồn biển Cù Lao Chàm" đã
               đủ; "Vùng biển Long Châu - Hạ Mai" thì cần "Vùng cấm khai thác có
               thời hạn" đứng trước). Cùng luật `moTaVung`. */}
          <p className="mt-0.5 text-[0.875rem] font-semibold leading-snug text-foreground/70">
            {[
              /^khu bảo tồn/i.test(info.v.ten) ? null : LOAI_LABEL[info.v.loai],
              info.v.tinh || null,
            ]
              .filter(Boolean)
              .join(" · ")}
            {info.v.dienTichHa
              ? ` · ${Math.round(info.v.dienTichHa).toLocaleString("vi-VN")} ha`
              : ""}
          </p>
          {/*  Trạng thái HÔM NAY nói thẳng: đang cấm (đỏ) / đã có hiệu lực (đỏ)
               / ngoài mùa, quy hoạch (thường). Đây là câu bà con cần nhất. */}
          {(() => {
            const dang = dangVung(info.v, new Date());
            const nong = dang === "dang-cam" || dang === "hieu-luc";
            return (
              <p
                className={`mt-1 text-[0.9375rem] font-semibold leading-snug ${nong ? "text-danger" : "text-foreground/70"}`}
              >
                {nong ? "Không thả lưới ở đây — " : ""}
                {trangThaiText(info.v, new Date())}
              </p>
            );
          })()}
          {/*  Danh sách loài có vùng dài 9 họ cá — cắt 3 dòng để thẻ không
               trôi khỏi màn (thẻ neo theo điểm chạm, không cuộn). */}
          {info.v.doiTuong && (
            <p
              className="mt-0.5 line-clamp-3 text-[0.8125rem] font-semibold leading-snug text-foreground/60"
              title={info.v.doiTuong}
            >
              Bảo vệ: {info.v.doiTuong}
            </p>
          )}
          {info.v.thoiGianKhac && (
            <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-danger/80">
              Hai bảng nhà nước ghi mùa cấm khác nhau ({info.v.thoiGian} · {info.v.thoiGianKhac}) — app lấy cả hai, cần hỏi lại chi cục thủy sản.
            </p>
          )}
          <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-foreground/60">
            Theo quy hoạch, thông tư nhà nước (tham khảo)
            {info.v.tinCay === "vi_tri" || info.v.loai === "bao-ve-nguon-loi"
              ? " · tên ghép theo vị trí, có thể lệch"
              : ""}
          </p>
        </div>
        <CloseButton variant="goc" onClose={() => onClose()} label="Đóng thông tin khu bảo tồn, vùng cấm" />
      </div>
    </div>
  );
}

export function TheRan({ info, onClose, bieuTuong, prefs }: { info: ReefInfo; onClose: () => void; bieuTuong: (id: string) => React.ReactNode; prefs: MapPrefs }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-60 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        {bieuTuong(reefSymbolId(info.type))}
        <div className="min-w-0 flex-1">
          <p className="text-[1.125rem] font-semibold leading-tight text-navy">{info.ten}</p>
          <p
            className={`mt-0.5 text-[0.9375rem] font-semibold leading-snug ${
              info.type === "da" ? "text-danger" : "text-foreground/75"
            }`}
          >
            {info.group === "them-luc-dia"
              ? "Bãi ngầm thềm lục địa — sâu 20–50 m, khu nhà giàn DK1"
              : info.type === "da"
                ? "Đá ngầm — đâm là thủng, cần tránh xa"
                : info.type === "ran"
                  ? "Rạn san hô — cá tụ, neo trượt"
                  : info.type === "con"
                    ? "Cồn cát — có thể ngập, nhìn con nước"
                    : "Bãi cạn — có thể ngập, nhìn con nước"}
          </p>
          <DongToaDo lat={info.lat} lon={info.lon} fmt={prefs.coordFormat} />
          <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-foreground/60">
            Tên theo danh mục địa danh nhà nước (tham khảo)
          </p>
        </div>
        <CloseButton variant="goc" onClose={() => onClose()} label="Đóng thông tin rạn" />
      </div>
    </div>
  );
}

export function TheLuong({ info, onClose, bieuTuong, prefs }: { info: LaneInfo; onClose: () => void; bieuTuong: (id: string) => React.ReactNode; prefs: MapPrefs }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-60 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        {bieuTuong(
          info.kind === "giankhoan"
            ? "platform"
            : info.kind === "cap-bo"
              ? CHART_FEATURE_ICON.cableLanding
              : info.kind === "ong"
                ? CHART_FEATURE_ICON.pipelineMark
                : info.loai === "cam-neo"
                  ? CHART_FEATURE_ICON.noAnchor
                  : "special",
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[1.125rem] font-semibold leading-tight text-navy">
            {info.ten || "Hạ tầng trên biển"}
          </p>
          <p
            className={`mt-0.5 text-[0.9375rem] font-semibold leading-snug ${
              info.kind === "ong" || info.loai === "cam-neo" || info.kind === "giankhoan"
                ? "text-danger"
                : "text-foreground/75"
            }`}
          >
            {info.kind === "ong"
              ? "Ống dẫn dầu/khí dưới đáy — ĐỪNG thả neo gần"
              : info.kind === "cap"
                ? "Cáp ngầm dưới đáy — đừng thả neo, mắc là đứt cáp"
                : info.kind === "giankhoan"
                  ? "Giàn khoan — cấm neo/đánh bắt trong phạm vi 500 m"
                  : info.kind === "cap-bo"
                    ? "Điểm cáp cập bờ — cấm neo, cấm giã cào quanh đây"
                    : info.loai === "cam-neo"
                      ? "Khu cấm neo — tránh thả neo trong vùng này"
                      : info.loai === "cam-danh-bat"
                        ? "Khu cấm đánh bắt"
                        : info.loai === "cam-vao"
                          ? "Khu CẤM VÀO — không được đi vào vùng này"
                          : "Khu hạn chế — xem kỹ quy định trước khi vào"}
          </p>
          <DongToaDo lat={info.lat} lon={info.lon} fmt={prefs.coordFormat} />
          <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-foreground/60">
            Tham khảo — không thay hải đồ chính thức
          </p>
        </div>
        <CloseButton variant="goc" onClose={() => onClose()} label="Đóng thông tin hạ tầng" />
      </div>
    </div>
  );
}

export function TheDiaDanh({ info, onClose, bieuTuong, prefs }: { info: DiaDanhInfo; onClose: () => void; bieuTuong: (id: string) => React.ReactNode; prefs: MapPrefs }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-60 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        {bieuTuong(diaDanhNgamSymbolId(info.loai))}
        <div className="min-w-0 flex-1">
          <p className="text-[1.125rem] font-semibold leading-tight text-navy">{info.ten}</p>
          <p className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-foreground/75">
            {nhanLoaiDiaDanhNgam(info.loai) || "Địa hình đáy biển"} —{" "}
            {["nui", "day", "guyot", "song"].includes(info.loai)
              ? "gò nổi dưới đáy, cá đáy hay tụ quanh sườn"
              : info.loai === "doi"
                ? "gò thấp dưới đáy biển"
                : ["ho", "thunglung", "hem", "kenh"].includes(info.loai)
                  ? "chỗ trũng/rãnh sâu hơn xung quanh"
                  : ["vach", "doc", "deo"].includes(info.loai)
                    ? "đáy đổ dốc gấp, độ sâu đổi nhanh"
                    : info.loai === "baivenbo"
                      ? "bãi ngầm gần bờ — coi chừng cạn"
                      : "dưới mặt nước, không nhìn thấy"}
          </p>
          {/*  TOẠ ĐỘ CHỖ NGẦM — cùng kiểu hiển thị với ô toạ độ máy định vị
               (theo hệ bà con đã chọn trong Cài đặt bản đồ). */}
          <DongToaDo
            lat={info.lat}
            lon={info.lon}
            fmt={prefs.coordFormat}
          />
          <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-foreground/60">
            Tên theo danh mục địa danh nhà nước (tham khảo)
          </p>
        </div>
        <CloseButton variant="goc" onClose={() => onClose()} label="Đóng thông tin địa danh" />
      </div>
    </div>
  );
}

export function TheMocBao({ info, onClose, prefs }: { info: StormPtInfo; onClose: () => void; prefs: MapPrefs }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-56 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-semibold leading-tight text-navy">
            {info.ten}
            <span className="ml-1.5 align-middle text-[0.8125rem] font-semibold text-danger">
              {info.tuongLai ? "· dự báo" : "· đã qua"}
            </span>
          </p>
          {info.nhan && (
            <p className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-foreground/75">
              Lúc {info.nhan}
            </p>
          )}
          {Number.isFinite(info.lat) &&
            Number.isFinite(info.lon) && (
              <p className="mt-1 text-[0.875rem] font-semibold text-foreground/55">
                {fmtCoordPair(
                  info.lat,
                  info.lon,
                  prefs.coordFormat,
                )}
              </p>
            )}
          {info.cap != null && (
            <p className="mt-1 text-[0.9375rem] font-semibold text-danger">
              Cấp {info.cap}
              {info.giat != null
                ? `, giật cấp ${info.giat}`
                : ""}
            </p>
          )}
          {info.tuongLai && info.dangerKm != null && (
            <p className="mt-1 text-[0.875rem] font-semibold text-foreground/60">
              Vùng nguy hiểm ~{info.dangerKm} km quanh tâm
            </p>
          )}
          {/*  KHAI THẬT KHI MƯỢN TIN CŨ (chủ dự án 2026-09-02): tin mới
               parse hụt đường dự báo thì app lấy của tin trước để màn không
               câm — nhưng phải nói ra, đừng để bà con tưởng đây là số mới
               nhất. Tâm bão thì vẫn của tin mới, chỉ đường dự báo là cũ. */}
          {info.tuongLai && info.tinCuLuc != null && (
            <p className="mt-1 text-[0.875rem] font-semibold text-warn">
              Đường dự báo lấy từ tin {nhanMoc(info.tinCuLuc)} — tin
              mới nhất chưa có
            </p>
          )}
        </div>
        <CloseButton variant="goc"
          onClose={() => onClose()}
          label="Đóng thông tin mốc bão"
        />
      </div>
    </div>
  );
}

/*  THẺ THÔNG TIN CHẶNG — "khúc màu này bị gì" (quãng · giờ · cớ). Dời nguyên văn
    (2026-10-19, lát 3); chỉ gọi khi `route.legs[info.idx]` tồn tại. */
export type LegInfo = {
  idx: number;
  x: number;
  y: number;
};

export function TheChang({ info, route, prefs, onClose }: { info: LegInfo; route: PlannedRoute; prefs: MapPrefs; onClose: () => void }) {
  return (
    <div
      ref={(el) => kepTheTrongKhung(el, info.x, info.y)}
      className="pointer-events-auto absolute z-40 w-60 max-w-[calc(100%-1rem)] rounded-2xl bg-card/97 p-3 shadow-xl"
    >
      <div className="flex max-h-[50dvh] items-start gap-2 overflow-y-auto">
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-semibold leading-tight text-navy">
            {route.stops.length > 1
              ? `Chặng ${info.idx + 1} — tới điểm ${info.idx + 1}`
              : "Toàn bộ tuyến đường"}
          </p>
          <p className="mt-0.5 text-[0.9375rem] font-semibold text-foreground/75">
            {fmtDist(route.legs[info.idx].distKm, prefs.distUnit)} ·{" "}
            {formatHoursVN(route.legs[info.idx].hours)}
          </p>
          {/*  CỚ chỉ hiện khi CÓ cớ. Chặng xanh thì nói thẳng là không có
               gì đáng nói — im lặng ở đây dễ bị đọc thành "máy chưa kiểm". */}
          <p
            className={`mt-1 text-[0.9375rem] font-semibold leading-snug ${
              route.legs[info.idx].risk === "red"
                ? "text-danger"
                : route.legs[info.idx].risk === "amber"
                  ? "text-warn"
                  : "text-foreground/70"
            }`}
          >
            {route.legs[info.idx].reason ??
              "Không có thông tin đáng lưu ý ở chặng này"}
          </p>
        </div>
        <CloseButton variant="goc" onClose={() => onClose()} label="Đóng thông tin chặng" />
      </div>
    </div>
  );
}
