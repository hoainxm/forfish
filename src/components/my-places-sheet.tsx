"use client";

/*
  "Điểm của tôi". Dùng ở 2 chỗ:
  · MyPlacesContent — phần thân, nhúng vào PANEL RAIL "Điểm đã lưu" (Phương án
    A: quản lý điểm là điều khiển lớp → ở rail, không mở bottom-sheet riêng).
  · MyPlacesSheet — wrapper bottom-sheet (legacy, nay map không dùng).
  Gồm: thêm điểm theo toạ độ, các điểm ghim (cảng nhà + bãi hay đánh), và lối
  đặt cảng nhà bằng cách TÌM trong 173 cảng (gõ để lọc).
*/
import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  makeHome,
  removePlace,
  renamePlace,
  sortedPlaces,
  upsertPlace,
  type SavedPlace,
} from "@/lib/places";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { parseCoordPair } from "@/lib/parse-coord";
import { useMapPrefs, fmtLat, fmtLon, fmtCoordPair } from "@/lib/map-prefs";
import {
  AnchorIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  EditIcon,
  HomeIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  TrashIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";

export function MyPlacesContent({
  places,
  onPlaces,
  onGo,
  cursor,
  prefillTick,
  addOpen: addOpenProp,
  onAddOpenChange,
  hideAddButton,
  onClose,
}: {
  places: SavedPlace[];
  onPlaces: (next: SavedPlace[]) => void;
  /** mở một điểm đã lưu (bay tới + xem dự báo) */
  onGo: (lat: number, lon: number) => void;
  /*  Chỗ đang trỏ trên bản đồ. Có nó thì form lưu điểm mới có đường
      "lấy chỗ đang trỏ" — không có thì bà con phải tự đọc toạ độ ở ô trên
      màn rồi gõ lại vào đây, chép tay một dãy số 15 ký tự trên tàu lắc. */
  cursor?: { lat: number; lon: number } | null;
  /*  >0 = form thêm điểm vừa mở DO MENU CHẠM-GIỮ trên bản đồ → điền sẵn hai ô
      toạ độ theo con trỏ (07 §10.7 K). Đổi số là một lượt điền mới; mở panel
      bằng nút rail thì số không đổi ⇒ KHÔNG điền, app không tự khai một toạ độ
      bà con chưa hề chỉ. */
  prefillTick?: number;
  /*  Nút "Thêm điểm" ĐƯỢC PHÉP nằm ngoài component này (2026-08-29): theo
      luật nút ở 03-design-system, nút không được ăn riêng một hàng — ở panel
      "Điểm đã lưu" nó phải nằm INLINE cuối hàng toggle "Hiện điểm trên bản
      đồ". Cha dựng nút, con vẫn giữ form; ba prop này nối hai bên. */
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
  hideAddButton?: boolean;
  onClose: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  // xác nhận xóa NGAY TRONG HÀNG (hội đồng UX 2026-06-11) — không xóa 1 chạm
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [portQuery, setPortQuery] = useState("");
  const [portOpen, setPortOpen] = useState(false);
  // thêm điểm theo toạ độ — gõ tên + vĩ độ + kinh độ
  const prefs = useMapPrefs();
  // ví dụ gõ theo hệ toạ độ đang chọn — khớp ô "Đến điểm" của rail
  const eg =
    prefs.coordFormat === "dms"
      ? { lat: "8 30", lon: "109 18" }
      : { lat: "8,5", lon: "109,3" };
  const [addOpenLocal, setAddOpenLocal] = useState(false);
  const addOpen = addOpenProp ?? addOpenLocal;
  const setAddOpen = (v: boolean) => {
    setAddOpenLocal(v);
    onAddOpenChange?.(v);
  };
  const [addName, setAddName] = useState("");
  const [addLat, setAddLat] = useState("");
  const [addLon, setAddLon] = useState("");
  /*  ĐỌC TOẠ ĐỘ QUA `parseCoordPair` — ĐÚNG HỆ BÀ CON ĐANG ĐẶT (2026-08-29).
      Lỗi cũ: chỗ này tự `parseFloat` nên CHỈ hiểu số thập phân, trong khi hệ
      mặc định của app là ĐỘ-PHÚT-GIÂY (07 §11) và ô "Đến điểm" trên rail thì
      đọc được cả hai. Bà con đọc toạ độ trên máy định vị ra "8 30" rồi gõ vào
      đây thì máy báo sai — mà cùng chuỗi đó gõ ở ô "Đến điểm" lại chạy. Một
      app không được có hai luật đọc toạ độ. Dùng lại đúng hàm đã có, không
      viết luật thứ hai. */
  const addPair = parseCoordPair(addLat, addLon);
  const addValid = addPair != null;
  /*  ĐIỀN SẴN THEO CON TRỎ khi form mở từ menu chạm-giữ (07 §10.7 K). Bà con
      vừa chỉ đúng chỗ mình muốn bằng ngón tay xong thì không phải bấm thêm một
      nút để máy lấy chính chỗ vừa chỉ.
      DÙNG LẠI ĐÚNG HAI DÒNG của nút "Lấy chỗ đang trỏ" bên dưới: chuỗi ra đọc
      lại được bằng chính `parseCoordPair` (có test round-trip). Viết formatter
      mới là đẻ ra luật đọc toạ độ thứ hai — đúng lỗi đã sửa ở trên.
      `handledPrefill` chốt mỗi lượt tín hiệu chỉ điền MỘT lần: sau đó bà con
      sửa tay hay chạm bản đồ dời con trỏ đều không bị máy ghi đè. */
  const handledPrefill = useRef(0);
  useEffect(() => {
    if (!prefillTick || prefillTick === handledPrefill.current) return;
    handledPrefill.current = prefillTick;
    if (!cursor) return;
    setAddLat(fmtLat(cursor.lat, prefs.coordFormat));
    setAddLon(fmtLon(cursor.lon, prefs.coordFormat));
  }, [prefillTick, cursor, prefs.coordFormat]);
  function submitAdd() {
    if (!addPair) return;
    onPlaces(
      upsertPlace(places, { name: addName, lat: addPair.lat, lon: addPair.lon }),
    );
    setAddName("");
    setAddLat("");
    setAddLon("");
    setAddOpen(false);
  }

  const sorted = sortedPlaces(places);
  /** cảng nhà đang đặt — hàng "Chọn cảng nhà" phải nói ra chứ không chỉ mời bấm */
  const home = places.find((p) => p.kind === "home") ?? null;

  // 173 cảng có toạ độ, lọc theo tên/tỉnh khi gõ
  const portResults = useMemo(() => {
    const q = portQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return FISHING_PORTS.filter((p) => {
      if (p.lat == null || p.lng == null) return false;
      const hay = `${p.name} ${p.province ?? ""} ${p.district ?? ""} ${
        p.ward ?? ""
      } ${p.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 12);
  }, [portQuery]);

  /*  TÊN MỘT TẦNG, HAI VIỆC PHỤ GOM SAU MỘT Ô NÚT (2026-08-29) — trả xong
      dòng `// nợ:` cũ ("nâng được khi hàng điểm được dựng lại cho tên nằm
      riêng một dòng").
      Trước: ba ô chạm bề ngang 44px xếp liền nhau, dưới sàn 56px và lệch khuôn
      SQ_BTN 64px của cả app; "Đổi tên" đứng SÁT "Xóa" ở bề ngang 44px — tay
      ướt, tàu lắc, bấm nhầm sang một hành động PHÁ HUỶ.
      Nay hàng chỉ còn [thân hàng = ĐI TỚI, flex-1] + [một ô SQ_BTN mở tầng
      dưới]. Ba việc phụ nằm trong tầng đó, cũng đúng khuôn SQ_BTN. Số cỡ nút
      trong panel: 4 → 1. Ổ chạm: 44 → 64px. Tên có gấp đôi chỗ.
      GIỮ NGUYÊN chạm thân hàng = ĐI TỚI: đó là việc dùng nhiều nhất của panel,
      biến nó thành cú xổ menu là cướp thao tác của đa số.
      Dùng chevron chứ không ⋮: repo không có sẵn icon ba chấm, mà chevron thì
      có sẵn VÀ nói thêm được trạng thái đang mở/đang đóng — không đẻ icon mới
      cho một việc icon cũ làm tốt hơn (nguyên tắc 1). */
  const [menuId, setMenuId] = useState<string | null>(null);

  return (
    <>
      {/* Thêm điểm theo toạ độ */}
      {!addOpen ? (
        hideAddButton ? null : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex min-h-[3.5rem] w-full items-center gap-3 rounded-xl border-2 border-dashed border-line px-4 text-left transition active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-t1 text-white">
            <PlusIcon className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[1rem] font-bold text-navy">
              Thêm điểm
            </span>
          </span>
        </button>
        )
      ) : (
        /*  SÀN TAP CHO CẢ SÁU Ô CỦA FORM (2026-08-29). Sáu ô này còn ở 3rem
             (48px) trong khi CHÍNH FILE NÀY đã dùng 3.25rem ở các hàng khác —
             sáu ngoại lệ đo được còn sót, KHÔNG phải chuyện cả app chưa đạt sàn.
             Vì sao đáng sửa: đây là ĐƯỜNG ĐI DUY NHẤT để lưu một điểm đánh cá —
             việc cốt lõi của app — và cũng đúng là chỗ lối tắt chạm-giữ trên bản
             đồ đổ vào (`prefillTick`). Chỗ tốt nhất của app đang dẫn thẳng vào
             sáu ô nhỏ nhất của app, tay ướt, tàu lắc, sáu ô liền nhau.
             "Hủy"/"Lưu điểm" đứng riêng một hàng `grid-cols-2` nên cho hẳn
             3.5rem; bốn ô còn lại 3.25rem cho khỏi đội chiều cao panel rail.
             Chỉ đổi token chiều cao, KHÔNG đụng bố cục ⇒ không có rủi ro tràn. */
        <div className="surface p-3">
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Tên điểm (vd: Bãi cá ngừ)"
            className="mb-2 min-h-[3.25rem] w-full rounded-xl bg-field px-3 text-[1rem] text-navy"
          />
          {/*  LẤY CHỖ ĐANG TRỎ (2026-08-29, chủ dự án: "cho chọn điểm đang trỏ
               trên bản đồ hoặc gõ toạ độ"). Điền vào hai ô theo ĐÚNG hệ toạ độ
               đang cài trong app — điền xong bà con vẫn sửa được, và chuỗi điền
               ra đọc lại được bằng chính `parseCoordPair` (có test round-trip). */}
          {cursor && (
            <button
              type="button"
              onClick={() => {
                setAddLat(fmtLat(cursor.lat, prefs.coordFormat));
                setAddLon(fmtLon(cursor.lon, prefs.coordFormat));
              }}
              className="mb-2 flex min-h-[3.25rem] w-full items-center gap-2 rounded-xl bg-field px-3 text-left text-[0.9375rem] font-bold text-t1 transition active:scale-[0.99]"
            >
              <PinIcon className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                Lấy chỗ đang trỏ —{" "}
                {fmtCoordPair(cursor.lat, cursor.lon, prefs.coordFormat)}
              </span>
            </button>
          )}
          <div className="mb-2 grid grid-cols-2 gap-2">
            <input
              value={addLat}
              onChange={(e) => setAddLat(e.target.value)}
              inputMode="text"
              placeholder={`Vĩ độ (vd ${eg.lat})`}
              className="min-h-[3.25rem] w-full rounded-xl bg-field px-3 text-[1rem] text-navy"
            />
            <input
              value={addLon}
              onChange={(e) => setAddLon(e.target.value)}
              inputMode="text"
              placeholder={`Kinh độ (vd ${eg.lon})`}
              className="min-h-[3.25rem] w-full rounded-xl bg-field px-3 text-[1rem] text-navy"
            />
          </div>
          {!addValid && (addLat || addLon) && (
            <p className="mb-2 text-[0.8125rem] font-semibold text-danger">
              Chưa đọc được toạ độ. Gõ như ví dụ: {eg.lat} / {eg.lon}.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="min-h-[3.5rem] rounded-xl bg-field text-[1rem] font-bold text-foreground/70"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={submitAdd}
              disabled={!addValid}
              className="min-h-[3.5rem] rounded-xl bg-t1 text-[1rem] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
            >
              Lưu điểm
            </button>
          </div>
        </div>
      )}

      {/* các điểm đã ghim */}
      {sorted.length > 0 && (
        <ul className="mt-3 space-y-2">
          {sorted.map((p) => {
            const isHome = p.kind === "home";
            return (
              <li key={p.id} className="surface overflow-hidden">
                {editId === p.id ? (
                  /*  MỘT KHUÔN NHƯ MỌI HÀNG: [thân flex-1] + [ô nút w-16].
                       Cặp pill bo tròn cũ (đo được 59×52 / 63×52 / 89×52) là
                       cỡ nút thứ hai và thứ ba trong cùng một panel. */
                  <div className="flex items-center gap-2 p-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      /*  `min-w-0` BẮT BUỘC: ô nhập có bề rộng bẩm sinh ~241px,
                          mà flex item mặc định `min-width:auto` nên `flex-1`
                          KHÔNG co lại được — đo được cặp nút bị đẩy tràn khỏi
                          mép panel (271px chứa 391px). Lỗi này có sẵn từ trước
                          khi thêm nút "Thôi" (đã tràn ~37px với riêng nút
                          "Lưu"); sửa gốc luôn ở đây. */
                      className="min-h-[3.25rem] min-w-0 flex-1 rounded-lg bg-field px-3 text-[1rem] font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onPlaces(renamePlace(places, p.id, editName));
                        setEditId(null);
                      }}
                      className={`${SQ_BTN} bg-t1 text-white`}
                    >
                      <CheckIcon className="h-6 w-6" />
                      Lưu
                    </button>
                    {/*  ĐƯỜNG LÙI CHO THAO TÁC GHI ĐÈ (2026-08-29): đổi tên là
                         ghi đè, mà hàng này trước đây chỉ có "Lưu" — lỡ gõ vào
                         ô chữ là không có cách nào thoát mà không ghi đè: hoặc
                         bấm Lưu (ghi cái vừa lỡ gõ), hoặc đóng cả panel. Hàng
                         "Xóa" kề bên đã có đủ "Xóa hẳn" + "Thôi" — hai hàng
                         cùng loại phải cùng một luật. */}
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className={`${SQ_BTN} bg-field text-foreground/70`}
                    >
                      <CloseIcon className="h-6 w-6" />
                      Thôi
                    </button>
                  </div>
                ) : confirmId === p.id ? (
                  <div className="flex items-center gap-2 p-3">
                    {/*  TÊN CHỖ KHÔNG `truncate`: câu hỏi này LÀ đường lùi của
                         một hành động phá huỷ — cắt cụt tên là bà con xác nhận
                         xoá một cái tên mình không đọc hết. Thà xuống dòng. */}
                    <p className="min-w-0 flex-1 text-[0.9375rem] font-bold leading-snug text-navy">
                      Xóa “{p.name}”?
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onPlaces(removePlace(places, p.id));
                        setConfirmId(null);
                      }}
                      className={`${SQ_BTN} bg-danger text-white`}
                    >
                      <TrashIcon className="h-6 w-6" />
                      Xóa hẳn
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className={`${SQ_BTN} bg-field text-foreground/70`}
                    >
                      <CloseIcon className="h-6 w-6" />
                      Thôi
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        onGo(p.lat, p.lon);
                        onClose();
                      }}
                      /*  `min-w-0` BẮT BUỘC (đo được 2026-08-29): flex item mặc
                          định `min-width:auto` nên nút tên KHÔNG co dưới bề
                          rộng chữ ⇒ hàng 271px chứa tới 345px và hai nút cuối
                          bị đẩy RA NGOÀI mép panel. Lỗi có sẵn từ trước (ở
                          44px vẫn tràn 50px); nay thân hàng co đúng phần còn
                          lại: ~159px (2 nút) / ~103px (3 nút), tên `truncate`. */
                      className="flex min-h-[3.5rem] min-w-0 flex-1 items-center gap-3 px-4 text-left transition active:bg-field"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${
                          isHome ? "bg-t1" : "bg-sun"
                        }`}
                      >
                        {isHome ? (
                          <HomeIcon className="h-5 w-5" />
                        ) : (
                          <StarIcon className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[1rem] font-bold text-navy">
                          {p.name}
                        </span>
                        <span className="block text-[0.8125rem] text-foreground/70">
                          {isHome ? "Cảng nhà" : "Chỗ hay đánh"}
                        </span>
                      </span>
                    </button>
                    {/*  MỘT Ô NÚT DUY NHẤT trên hàng — xổ tầng dưới của CHÍNH
                         hàng đó. Tầng chỉ tồn tại ở hàng đang mở nên danh sách
                         không phình; mở hàng khác là hàng cũ tự đóng. */}
                    <div className="shrink-0 pr-1">
                      <button
                        type="button"
                        onClick={() =>
                          setMenuId(menuId === p.id ? null : p.id)
                        }
                        aria-expanded={menuId === p.id}
                        aria-label={`Việc khác với ${p.name}`}
                        className={`${SQ_BTN} text-foreground/70 active:bg-field`}
                      >
                        {menuId === p.id ? (
                          <ChevronUpIcon className="h-6 w-6" />
                        ) : (
                          <ChevronDownIcon className="h-6 w-6" />
                        )}
                        Khác
                      </button>
                    </div>
                  </div>
                )}
                {/*  TẦNG VIỆC PHỤ — chỉ hàng đang mở mới có. Ba ô cùng khuôn
                     SQ_BTN, căn phải cho thẳng ô "Khác" ngay trên. Mở "Đổi
                     tên"/"Xoá" thì đóng tầng lại: hàng chuyển hẳn sang trạng
                     thái kia, để tầng nằm lại là hai lớp điều khiển chồng nhau
                     cho cùng một hàng. */}
                {menuId === p.id && editId !== p.id && confirmId !== p.id && (
                  <div className="flex justify-end gap-2 px-3 pb-3">
                    {!isHome && (
                      <button
                        type="button"
                        onClick={() => {
                          onPlaces(makeHome(places, p.id));
                          setMenuId(null);
                        }}
                        className={`${SQ_BTN} bg-field text-foreground/70`}
                      >
                        <AnchorIcon className="h-6 w-6" />
                        Cảng nhà
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(p.id);
                        setEditName(p.name);
                        setMenuId(null);
                      }}
                      className={`${SQ_BTN} bg-field text-foreground/70`}
                    >
                      <EditIcon className="h-6 w-6" />
                      Đổi tên
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmId(p.id);
                        setMenuId(null);
                      }}
                      className={`${SQ_BTN} bg-field text-danger`}
                    >
                      <TrashIcon className="h-6 w-6" />
                      Xóa
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sorted.length === 0 && (
        <p className="mt-3 px-1 text-[0.9375rem] leading-snug text-foreground/70">
          Chưa ghim chỗ nào. Chạm vào chỗ hay đánh trên bản đồ rồi bấm{" "}
          <b>Ghim chỗ này</b> — lần sau mở một chạm là tới.
        </p>
      )}

      {/* đặt cảng nhà bằng cách tìm trong danh mục cảng */}
      <div className="mt-4">
        {!portOpen ? (
          /*  KHUÔN HÀNG CHUẨN [thân bg-background flex-1] + [ô nút w-16]
               (03-design-system §Nút hành động, 2026-08-29). Trước đây đây là
               một dải nút chiếm trọn bề ngang panel — đúng thứ luật cấm. Vế
               trái nói CẤP DỮ LIỆU (cảng nhà đang đặt là gì), vế phải là ô
               vuông mở ô tìm. Không bóp cả nút thành ô vuông trơ: nó là nút MỞ
               Ô TÌM, cần nhãn nói nó làm gì. */
          <div className="flex items-center gap-2">
            <p className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-2 rounded-xl bg-background px-3 text-[0.9375rem] font-bold text-navy">
              <AnchorIcon className="h-5 w-5 shrink-0 text-t1" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                {/*  Tên cảng thường ĐÃ có chữ "Cảng" (vd "Cảng nhà Quy Nhơn",
                     "Cảng Sa Kỳ") — thêm tiền tố nữa thành "Cảng nhà: Cảng nhà
                     Quy Nhơn", đọc vấp. Có chữ rồi thì để nguyên tên. */}
                {home
                  ? /^cảng/i.test(home.name)
                    ? home.name
                    : `Cảng nhà: ${home.name}`
                  : "Cảng nhà: chưa đặt"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setPortOpen(true)}
              aria-label="Chọn cảng nhà"
              className={`${SQ_BTN} bg-field text-navy`}
            >
              <SearchIcon className="h-6 w-6" />
              Chọn
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 rounded-full bg-field px-3">
              <SearchIcon className="h-5 w-5 shrink-0 text-foreground/65" />
              <input
                value={portQuery}
                onChange={(e) => setPortQuery(e.target.value)}
                autoFocus
                placeholder="Gõ tên cảng hoặc tỉnh…"
                className="min-h-[3.25rem] flex-1 bg-transparent text-[1rem] font-semibold"
              />
            </div>
            {portResults.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {portResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = upsertPlace(places, {
                          name: p.name,
                          lat: p.lat as number,
                          lon: p.lng as number,
                          asHome: true,
                        });
                        onPlaces(next);
                        onGo(p.lat as number, p.lng as number);
                        onClose();
                      }}
                      className="flex min-h-[3.25rem] w-full items-center gap-2 rounded-lg bg-field px-4 text-left active:scale-[0.99]"
                    >
                      <AnchorIcon className="h-5 w-5 shrink-0 text-t1" />
                      <span className="min-w-0">
                        <span className="block truncate text-[1rem] font-semibold text-navy">
                          {p.name}
                        </span>
                        <span className="block truncate text-[0.8125rem] text-foreground/70">
                          {p.province}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {portQuery.trim().length >= 1 && portResults.length === 0 && (
              <p className="mt-2 px-1 text-[0.875rem] text-foreground/70">
                Không thấy cảng nào khớp. Thử gõ ngắn hơn, hoặc ghim thẳng chỗ
                trên bản đồ.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** Wrapper bottom-sheet (legacy — map nay dùng panel rail). */
export function MyPlacesSheet({
  places,
  onPlaces,
  onGo,
  onClose,
}: {
  places: SavedPlace[];
  onPlaces: (next: SavedPlace[]) => void;
  onGo: (lat: number, lon: number) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet title="Điểm của tôi" onClose={onClose}>
      <MyPlacesContent
        places={places}
        onPlaces={onPlaces}
        onGo={onGo}
        onClose={onClose}
      />
    </BottomSheet>
  );
}
