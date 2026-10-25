"use client";

// TIN MUA/BÁN (nhánh 2 khu GIAO DỊCH, user chốt 2026-07-27) — chủ tàu tự ĐĂNG
// tin bán (có cá cần bán) và tin mua (cần mua gì), cả làng cùng xem để gọi
// thẳng nhau. Đi qua route server `/api/market-listings` (chuỗi cứng, xem
// lib/market-listings.ts). Chưa có tin thật / chưa cấu hình máy chủ → hiện
// EMPTY STATE (2026-07-29: bỏ TIN MẪU, app đã lên thật); muốn đăng thì đăng
// nhập. MẤT SÓNG thì nói thật "chưa tải được" và GIỮ danh sách đang hiện,
// KHÔNG đội lốt "chợ chưa ai đăng" (2026-08-16, thẩm định P0).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChipRow } from "@/components/ui/chip-row";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Popover } from "@/components/ui/popover";
import { OfflineLine } from "@/components/ui/offline-line";
import { LienHe } from "@/components/ui/lien-he";
import { applyHome, HomeBar, useHome } from "@/components/ui/region-filter";
import {
  Card,
  EmptyState,
  Field,
  inputClass,
} from "@/components/ui/primitives";
import {
  CheckIcon,
  CloseIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { useBoats } from "@/components/boat-switcher";
import { useAuthUser } from "@/lib/use-auth";
import { formatVnDate } from "@/lib/format";
import { NHAN } from "@/lib/labels";
import { NOTIFY_HIDE_MS } from "@/lib/notify";
import { useOnline } from "@/lib/use-online";
import {
  laTinTam,
  tinTamTuDraft,
  validateDraftField,
  type DraftField,
} from "@/lib/market-listings-core";
import {
  POSTER_KIND_LABEL,
  SIDE_LABEL,
  createListing,
  deleteListing,
  fetchListings,
  setListingStatus,
  type ListingDraft,
  type ListingSide,
  type MarketListing,
  type PosterKind,
} from "@/lib/market-listings";

type Filter = "all" | ListingSide;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "ban", label: "Tin bán" },
  { id: "mua", label: "Tin mua" },
];

export function MarketBoard() {
  /*  `signedIn`, KHÔNG phải `user`: phiên Supabase đã bỏ sau khi cấp chuỗi cứng
      nên `user` null vĩnh viễn — hỏi nó là khoá nút đăng tin của ĐÚNG những
      người đang đăng nhập (sửa 2026-08-02h). */
  const { signedIn, ready } = useAuthUser();
  const online = useOnline();
  const [filter, setFilter] = useState<Filter>("all");
  /** lọc nơi "Gần tôi / Cả nước" (CC-07) — tái dùng HomeBar + applyHome, lọc tại máy theo `province` */
  const { home } = useHome();
  const [near, setNear] = useState(true);
  const [real, setReal] = useState<MarketListing[] | null>(null);
  const [loading, setLoading] = useState(true);
  /** chưa tải được vì SÓNG (khác hẳn "chợ chưa có tin nào") */
  const [netFailed, setNetFailed] = useState(false);
  /** nút vừa bấm không ăn — phải nói, không im (2026-08-16) */
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<MarketListing | null>(null);
  /** tin đang xoá — thẻ đó khoá nút + "Đang xoá…" (audit G8) */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** biên nhận ngắn sau khi đăng ("Đã đăng.") — tự tắt theo nhịp chung (CC-05) */
  const [daDang, setDaDang] = useState(false);
  useEffect(() => {
    if (!daDang) return;
    const t = window.setTimeout(() => setDaDang(false), NOTIFY_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [daDang]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await fetchListings();
    if (r.ok) {
      setReal(r.listings);
      setNetFailed(false);
    } else {
      /*  GIỮ NGUYÊN DANH SÁCH ĐANG HIỆN khi mất sóng (2026-08-16). Bản cũ
          `setReal(null)` ⇒ rơi về `useDemo` ⇒ tin thật của bà con BIẾN MẤT khỏi
          màn hình, thay bằng tin mẫu — sau một cú bấm "Đã xong" hụt thì trông
          y như app vừa xoá mất tin của mình. */
      setNetFailed(r.reason === "mang");
      // chưa đăng nhập / chưa nối máy chủ → xem TIN MẪU (đúng hành vi cũ);
      // KHÔNG phải lỗi mạng nên không hiện dải "đang mất sóng".
      if (r.reason !== "mang") setReal(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, signedIn]);

  /*  CÓ SÓNG LẠI THÌ TỰ TẢI LẠI (2026-08-17, chủ dự án: "có mạng thì tự chạy
      tự đồng bộ lại chứ yêu cầu gì"). Trước đây mất sóng là màn đứng ở câu lỗi
      cho tới khi bà con TỰ bấm Thử lại — mà tay ướt, nắng chói, ai ngồi bấm
      lại. Khuôn lấy từ `inbox-section.tsx`. Chỉ chạy khi màn này đang mở
      (effect gắn theo component) và bỏ qua nếu đang tải (chống chạy chồng lúc
      sóng nhấp nháy ven bờ). ADR 0004 bất biến 6. */
  useEffect(() => {
    const onOnline = () => {
      if (!loading) void refresh();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh, loading]);

  // App đã lên thật (2026-07-29): KHÔNG còn TIN MẪU — chợ rỗng thì hiện empty
  // state, tin thật hiện khi bà con đăng. real=null (chưa cấu hình / lỗi) coi
  // như rỗng; mất sóng thì `netFailed` lo phần báo, danh sách cũ giữ nguyên.
  const source = real ?? [];
  /** lần tải ĐẦU chưa về — chưa có số nào để in (CC-04: trước đây in "0 tin đang
   *  mở" suốt lúc chờ, trông như chợ trống) */
  const dangTaiLanDau = loading && real === null;
  // server đã lọc "đang mở + tin của mình"; ở đây chỉ còn lọc theo chip + nơi (gần → xa)
  const listings = applyHome(
    source.filter(
      (l) =>
        (filter === "all" || l.side === filter) &&
        (l.status === "open" || l.mine),
    ),
    (l) => l.province,
    home.province,
    near,
  );
  const locGan = Boolean(home.province) && near;

  return (
    <div>

      {/* MẤT SÓNG NÓI THẬT — trước đây ca này im lặng đổi sang tin mẫu, bà con
          tưởng chợ vắng hoặc tưởng tin mình vừa biến mất. */}
      {netFailed && (
        <div className="mt-3 overflow-hidden rounded-2xl">
          <OfflineLine extra={real && real.length > 0 ? " · đang xem bản tải gần nhất" : undefined} />
        </div>
      )}

      {/* Nút vừa bấm không ăn (mất sóng / hết quyền) — nói ngay tại chỗ */}
      {actionErr && (
        <p
          role="alert"
          className="mt-3 rounded-2xl px-3.5 py-3 text-[1rem] font-semibold"
          style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
        >
          {actionErr}
        </p>
      )}
      {daDang && (
        <p
          role="status"
          className="mt-3 rounded-2xl bg-ok-bg px-3.5 py-3 text-[1rem] font-semibold text-ok"
        >
          Đã đăng.
        </p>
      )}

      {/*  Ô nút INLINE cuối hàng cấp dữ liệu (2026-08-29, luật A2/A3/A4): trước
          là nút full-width nằm một mình trong <div className="my-3"> ở CẢ HAI
          nhánh, ăn trọn một hàng. Hàng cấp dữ liệu dùng lại khuôn của sell-guide
          ("{list.length} vựa") và thay luôn RefNote 343×97px (12% chiều cao màn
          toàn chữ giải thích) mà chip "Tin mua/bán" ngay trên đã nói xong. */}
      <div className="my-3 flex items-stretch gap-2">
        <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
          <p className="text-[0.875rem] font-semibold text-foreground/70">
            {dangTaiLanDau ? "Đang tải…" : `${listings.length} tin đang mở`}
          </p>
        </div>
        {ready && signedIn ? (
          <button
            onClick={() => setShowForm(true)}
            className={`${SQ_BTN} bg-trim text-white `}
          >
            <PlusIcon className="h-6 w-6" />
            Đăng tin
          </button>
        ) : ready && online ? (
          /* lời mời đăng nhập ẨN khi mất sóng — /login cần sóng (tầng 5, 2026-08-18) */
          <Link
            href="/login"
            className={`${SQ_BTN} bg-trim text-white `}
          >
            <PlusIcon className="h-6 w-6" />
            Đăng nhập
          </Link>
        ) : (
          <span className="w-16 shrink-0" aria-hidden />
        )}
      </div>

      <div className="-mx-4">
        <ChipRow
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          accent="t2"
          level={2}
          ariaLabel="Lọc tin mua bán"
        />
      </div>

      {/* lọc nơi như FB Marketplace (CC-07): chưa có tỉnh ⇒ hàng "Chọn" tại chỗ (CC-09) */}
      <HomeBar home={home} near={near} setNear={setNear} />

      {/* MẤT SÓNG mà chưa có bản nào → CHỈ băng vàng ở trên, KHÔNG mời "đăng tin
          đầu tiên" (audit 2026-08-18 G8: hai câu trái nhau cùng màn) */}
      {!loading && listings.length === 0 && !netFailed && (
        <EmptyState icon={<UsersIcon className="h-9 w-9" />}>
          {locGan && source.length > 0
            ? `Chưa có tin nào gần ${home.province}. Bà con xem "Cả nước" nhé.`
            : "Chưa có tin nào ở mục này. Bà con đăng tin đầu tiên đi."}
        </EmptyState>
      )}

      {/* đang tải lần đầu → 2 khung thẻ đúng hình, không in số đếm (CC-04) */}
      {dangTaiLanDau && !netFailed && <ListingSkeleton />}

      <ul className="space-y-3">
        {listings.map((l) => (
          <li key={l.id}>
            <ListingCard
              listing={l}
              deleting={deletingId === l.id}
              onDelete={() => setConfirmDel(l)}
              onChanged={refresh}
              onFailed={setActionErr}
            />
          </li>
        ))}
      </ul>

      {showForm && (
        <ListingForm
          tinhNha={home.province}
          onCancel={() => setShowForm(false)}
          onSaved={(tin) => {
            /*  HIỆN NGAY (CC-05): máy chủ đã nhận (POST ok) nên chèn thẻ tạm lên đầu
                rồi mới tải lại nền — bà con không phải nhìn màn trống chờ một vòng
                mạng. Máy chủ trả id ⇒ thẻ có ⋯ ngay; không trả ⇒ chưa đóng/xoá được tới khi tải xong. */
            setShowForm(false);
            setReal((prev) => [tin, ...(prev ?? [])]);
            setDaDang(true);
            void refresh();
          }}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title="Xóa tin này?"
          message={`Tin rao “${confirmDel.species}” sẽ bị gỡ khỏi chợ giao dịch.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={async () => {
            /*  ĐỌC KẾT QUẢ (2026-08-16): bản cũ `await deleteListing(...)` rồi
                vứt boolean — mất sóng thì hộp thoại đóng, tin còn nguyên, không
                một câu nào. Đúng khuôn "nút bấm không được gì". */
            const id = confirmDel.id;
            setConfirmDel(null); // hộp thoại đã tự đóng — thẻ tin nói "Đang xoá…"
            setDeletingId(id);
            const xong = await deleteListing(id);
            setDeletingId(null);
            setActionErr(
              xong ? null : "Chưa xoá được tin. Bà con thử lại khi có mạng nhé.",
            );
            if (xong) void refresh();
          }}
        />
      )}
    </div>
  );
}

function ListingCard({
  listing: l,
  deleting,
  onDelete,
  onChanged,
  onFailed,
}: {
  listing: MarketListing;
  /** đang xoá tin này (cha giữ, vì hộp xác nhận đóng trước khi máy chủ trả lời) */
  deleting: boolean;
  onDelete: () => void;
  onChanged: () => void;
  /** đổi trạng thái không ăn → đưa câu báo lên khối chung của màn */
  onFailed: (msg: string | null) => void;
}) {
  const sell = l.side === "ban";
  /** đang gửi đổi trạng thái — khoá nút, nói "Đang gửi…" (audit G8: trước đây
   *  bấm được liên tiếp suốt 20 giây chờ) */
  const [pending, setPending] = useState(false);
  const busy = pending || deleting;
  /** menu ⋯ của tin mình — neo nút (03 §6 mục 9) */
  const [menuEl, setMenuEl] = useState<HTMLButtonElement | null>(null);
  const [menuMo, setMenuMo] = useState(false);
  // thẻ tạm (vừa đăng, chưa tải lại) chưa có id thật ⇒ chưa có ⋯
  const coMenu = l.mine && !laTinTam(l.id);

  async function doiTrangThai() {
    // ĐỌC KẾT QUẢ (2026-08-16) — xem ghi chú ở nút Xoá.
    setPending(true);
    const xong = await setListingStatus(l.id, l.status === "open" ? "closed" : "open");
    setPending(false);
    onFailed(xong ? null : "Chưa cập nhật được trạng thái. Bà con thử lại khi có mạng nhé.");
    if (xong) onChanged();
  }

  return (
    <Card className="p-4">
      {/*  Thao tác của tin MÌNH nằm sau ⋯ góc trên-phải (CC-03/CC-15, 2026-10-25, như FB):
          trước là hai nút "Đã xong" / "Xác nhận xóa" chen cùng hàng pill ⇒ pill vỡ hai
          dòng, và nhãn "Xác nhận xóa" trên thẻ trùng nút đỏ trong hộp — bà con tưởng
          bấm là xoá thẳng. Thân thẻ nay giống hệt thẻ người khác. */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {/*  Thẻ kiểu Marketplace (CC-07): hàng đầu = TÊN LOÀI đậm (trái) + GIÁ to (phải) —
              hai thứ bà con nhìn trước; hàng 2 = meta mờ một dòng. Trước đây giá là chữ
              thường "Giá: …" giữa thân thẻ. */}
          <div className="flex items-start justify-between gap-3">
            <p className="display min-w-0 flex-1 break-words text-[1rem] font-semibold leading-snug text-navy">
              {l.species}
            </p>
            <p
              className={`shrink-0 text-right text-[1.125rem] font-semibold leading-snug tabular-nums ${
                l.priceText ? "text-navy" : "text-foreground/65"
              }`}
            >
              {l.priceText || "Thoả thuận"}
            </p>
          </div>
          <p className="mt-0.5 truncate text-[0.75rem] font-semibold text-foreground/65">
            <span style={sell ? { color: "var(--ok)" } : { color: "var(--t2)" }}>
              {SIDE_LABEL[l.side]}
              {l.status === "closed" ? " · đã đóng" : ""}
            </span>
            {` · ${POSTER_KIND_LABEL[l.posterKind]}`}
            {l.province ? ` · ${l.province}` : ""}
            {` · ${formatVnDate(l.postedOn).slice(0, 5)}`}
          </p>
        </div>
        {coMenu && (
          <button
            ref={setMenuEl}
            type="button"
            aria-label="Thêm"
            aria-haspopup="menu"
            aria-expanded={menuMo}
            disabled={busy}
            onClick={() => setMenuMo((v) => !v)}
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.25rem] font-bold text-foreground/65 transition active:scale-[0.95] disabled:opacity-50"
          >
            ⋯
          </button>
        )}
      </div>

      {(l.quantity || l.note) && (
        <div className="mt-2 space-y-1">
          {l.quantity && (
            <p className="text-[0.875rem] text-foreground/80">
              Khối lượng: <strong>{l.quantity}</strong>
            </p>
          )}
          {l.note && (
            <p className="rounded-xl bg-background px-3 py-1.5 text-[0.875rem] text-foreground/70">
              {l.note}
            </p>
          )}
        </div>
      )}

      <p className="mt-2 truncate text-[0.8125rem] text-foreground/65">
        {l.posterName}
        {busy ? ` · ${pending ? NHAN.dangGui : NHAN.dangXoa}…` : ""}
      </p>
      {/* Gọi · Nhắn (Zalo) chia hai cột — như FB/Zalo (CC-18); pill đã nói ngữ cảnh ⇒ nhãn ≤2 chữ */}
      {l.phone ? <LienHe phone={l.phone} className="mt-2" /> : null}

      {menuMo && (
        <Popover anchor={menuEl} label="Tin của tôi" role="menu" onClose={() => setMenuMo(false)} className="w-[11rem] py-1">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuMo(false);
              void doiTrangThai();
            }}
            className="flex h-11 w-full items-center gap-2 px-4 text-left text-[0.9375rem] font-semibold text-navy"
          >
            <CheckIcon className="h-5 w-5" />
            {l.status === "open" ? NHAN.daXong : NHAN.moLai}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuMo(false);
              onDelete();
            }}
            className="flex h-11 w-full items-center gap-2 px-4 text-left text-[0.9375rem] font-semibold text-danger"
          >
            <TrashIcon className="h-5 w-5" />
            {NHAN.xoa}
          </button>
        </Popover>
      )}
    </Card>
  );
}

/** Khung chờ 2 thẻ đúng hình thẻ tin (pill+meta · tên · 2 dòng · chân) — lúc tải về
 *  không nhảy bố cục (CC-04). `animate-pulse` tự dừng khi máy bật giảm chuyển động. */
function ListingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải tin" className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="surface animate-pulse p-4">
          <div className="flex items-center gap-2">
            <span className="h-5 w-16 rounded-full bg-field" />
            <span className="h-3 w-1/3 rounded bg-field" />
          </div>
          <div className="mt-2 h-4 w-1/2 rounded bg-field" />
          <div className="mt-3 h-3.5 w-2/3 rounded bg-field" />
          <div className="mt-2 h-3.5 w-1/2 rounded bg-field" />
          <div className="mt-3 flex items-center justify-between">
            <span className="h-3 w-2/5 rounded bg-field" />
            <span className="h-(--h-ctl) w-[5.5rem] rounded-full bg-field" />
          </div>
        </div>
      ))}
    </div>
  );
}

const POSTER_KINDS: { value: PosterKind; label: string }[] = [
  { value: "ngu-dan", label: "Ngư dân / chủ tàu" },
  { value: "nau", label: "Nậu" },
  { value: "vua", label: "Vựa / đại lý" },
  { value: "nha-may", label: "Nhà máy" },
  { value: "cho", label: "Chợ đầu mối" },
];

function ListingForm({
  tinhNha,
  onCancel,
  onSaved,
}: {
  /** tỉnh đang lọc (tàu hoặc tỉnh tạm của phiên) — điền sẵn ô Tỉnh khi tàu chưa khai */
  tinhNha?: string;
  onCancel: () => void;
  /** máy chủ đã nhận — trả thẻ tạm để cha hiện ngay (CC-05) */
  onSaved: (tin: MarketListing) => void;
}) {
  /*  ĐIỀN SẴN thứ MÁY ĐÃ BIẾT (luật C1 câu hỏi 2): tên hiển thị + tỉnh/bến lấy
      từ hồ sơ tàu đang chọn, SĐT lấy từ tài khoản — chính nhãn cũ đã tự thú
      "để trống thì lấy SĐT tài khoản", tức là biết mà vẫn hỏi. Vẫn sửa được:
      mở hàng "Người đăng". */
  const { current } = useBoats();
  const { phone: accountPhone } = useAuthUser();
  const [side, setSide] = useState<ListingSide>("ban");
  const [posterKind, setPosterKind] = useState<PosterKind>("ngu-dan");
  const [posterName, setPosterName] = useState(current?.name ?? "");
  const [species, setSpecies] = useState("");
  const [quantity, setQuantity] = useState("");
  const [priceText, setPriceText] = useState("");
  const [province, setProvince] = useState(current?.homeProvince ?? tinhNha ?? "");
  const [phone, setPhone] = useState(accountPhone ?? "");
  const [note, setNote] = useState("");
  /** lỗi MÁY CHỦ / MẠNG — hàng đáy. Lỗi từng ô nằm dưới ô (`loiO`) */
  const [error, setError] = useState<string | null>(null);
  /** lỗi của một ô — hiện ngay dưới ô đó, ô tự mở + nhận con trỏ (CC-02) */
  const [loiO, setLoiO] = useState<{ field: DraftField; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  /* Hai nhóm THU LẠI mặc định — 9 ô bày sẵn trong sheet trần 85dvh là quá tay */
  const [showWho, setShowWho] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const oTen = useRef<HTMLInputElement>(null);
  const oLoai = useRef<HTMLInputElement>(null);
  const oSdt = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoiO(null);
    const draft: ListingDraft = {
      side,
      posterKind,
      posterName,
      species,
      quantity,
      priceText,
      province,
      phone,
      note,
    };
    /*  Ô SAI THÌ MỞ Ô ĐÓ RA (CC-02): "Nhập tên" từng báo ở hàng đáy trong khi ô Tên
        đang thu sau nút "Sửa" — bà con không thấy ô nào để sửa. Nay nhóm ô đang thu
        tự mở, câu lỗi nằm ngay dưới ô, con trỏ nhảy vào ô. */
    const loi = validateDraftField(draft);
    if (loi) {
      setLoiO(loi);
      const trongNhomNguoiDang = loi.field === "posterName" || loi.field === "phone";
      if (trongNhomNguoiDang) setShowWho(true);
      // chờ ô vẽ ra (nhóm vừa mở) rồi mới đưa con trỏ vào
      window.requestAnimationFrame(() => {
        const o =
          loi.field === "posterName" ? oTen.current : loi.field === "phone" ? oSdt.current : oLoai.current;
        o?.focus();
        o?.scrollIntoView?.({ block: "center" });
      });
      return;
    }
    setSaving(true);
    const res = await createListing(draft);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Hiện chưa đăng được, bà con thử lại sau ít phút nhé.");
      return;
    }
    // máy chủ trả id thật ⇒ thẻ có ⋯ ngay (không chờ tải lại); máy chủ cũ ⇒ id tạm
    onSaved(
      tinTamTuDraft(draft, {
        id: String(Date.now()),
        idThat: res.id,
        accountPhone: accountPhone ?? null,
        today: (res.createdAt ?? new Date().toISOString()).slice(0, 10),
      }),
    );
  }


  return (
    <BottomSheet kieu="form" title="Đăng tin mua/bán" onClose={onCancel}>
      <form onSubmit={submit}>
        <div className="mb-3.5">
          <span className="mb-1.5 block text-[1rem] font-semibold text-navy">
            Loại tin
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(["ban", "mua"] as ListingSide[]).map((s) => {
              const on = side === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  aria-pressed={on}
                  className={`min-h-(--h-row) rounded-2xl text-[1rem] font-semibold transition active:scale-[0.98] ${
                    on ? "text-white" : "bg-field text-navy/65"
                  }`}
                  style={on ? { backgroundColor: "var(--t2)" } : undefined}
                >
                  {s === "ban" ? "Tôi cần bán" : "Tôi cần mua"}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Loài cá (bắt buộc)" error={loiO?.field === "species" ? loiO.message : undefined}>
          <input
            ref={oLoai}
            value={species}
            onChange={(e) => {
              setSpecies(e.target.value);
              if (loiO?.field === "species") setLoiO(null);
            }}
            className={inputClass}
            placeholder="VD: cá ngừ đại dương, mực ống"
          />
        </Field>

        {/* Người đăng — máy đã biết, chỉ hiện dòng đọc-được + đường sửa */}
        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="truncate text-[1rem] text-foreground/80">
              Người đăng:{" "}
              <span className="font-semibold text-navy">
                {posterName.trim() || "chưa đặt tên"}
              </span>
              {province.trim() ? ` · ${province}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWho((v) => !v)}
            className={`${SQ_BTN} bg-background text-sea`}
          >
            <EditIcon className="h-6 w-6" />
            {showWho ? "Thu" : "Sửa"}
          </button>
        </div>

        {showWho && (
          <>
            <Field
              label="Tên người đăng (bắt buộc)"
              error={loiO?.field === "posterName" ? loiO.message : undefined}
            >
              <input
                ref={oTen}
                value={posterName}
                onChange={(e) => {
                  setPosterName(e.target.value);
                  if (loiO?.field === "posterName") setLoiO(null);
                }}
                className={inputClass}
                placeholder="VD: Tàu ông Bảy, Vựa cô Ba"
              />
            </Field>
            <Field label="Bà con là">
              <select
                value={posterKind}
                onChange={(e) => setPosterKind(e.target.value as PosterKind)}
                className={inputClass}
              >
                {POSTER_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tỉnh / bến cập tàu">
              <input
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className={inputClass}
                placeholder="VD: Khánh Hòa"
              />
            </Field>
            <Field
              label="Số điện thoại (nếu để trống sẽ dùng số tài khoản)"
              error={loiO?.field === "phone" ? loiO.message : undefined}
            >
              <input
                ref={oSdt}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (loiO?.field === "phone") setLoiO(null);
                }}
                className={inputClass}
                inputMode="tel"
                placeholder="VD: 0901234567"
              />
            </Field>
          </>
        )}

        {/* Khối lượng · giá · ghi chú: bỏ đi vẫn đăng được ⇒ thu sau một nút */}
        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="truncate text-[1rem] text-foreground/80">
              Khối lượng, giá:{" "}
              <span className="font-semibold text-navy">
                {[quantity.trim(), priceText.trim()]
                  .filter(Boolean)
                  .join(" · ") || "chưa ghi"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={`${SQ_BTN} bg-background text-sea`}
          >
            <PlusIcon className="h-6 w-6" />
            {showMore ? "Thu" : "Chi tiết"}
          </button>
        </div>

        {showMore && (
          <>
            <Field label="Khối lượng">
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass}
                placeholder="VD: ~1,2 tấn/chuyến, 500 kg"
              />
            </Field>
            <Field label="Giá mong muốn">
              <input
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                className={inputClass}
                placeholder="VD: 130 nghìn/kg trở lên, theo giá chợ"
              />
            </Field>
            <Field label="Ghi chú">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="VD: cá ướp đá chuẩn, sáng mai về bến"
              />
            </Field>
          </>
        )}

        {/* Hàng cuối theo khuôn B1 — hai ô nút inline, không dải ngang ăn hàng */}
        <div className="mt-2 flex items-stretch gap-2">
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p
              className={`text-[0.875rem] ${error ? "font-semibold text-danger" : "text-foreground/70"}`}
            >
              {error ?? "Đăng tin công khai trên hệ thống."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className={`${SQ_BTN} bg-background text-foreground/70`}
          >
            <CloseIcon className="h-6 w-6" />
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`${SQ_BTN} bg-trim text-white  disabled:opacity-40 disabled:shadow-none`}
          >
            <CheckIcon className="h-6 w-6" />
            {saving ? "Đang đăng bài" : "Đăng tin"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
