"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type SavedBuyer } from "@/data/market-channels";
import { banDoHref, boDau, datThamSo, docThamSo, tachSdt, telHref } from "@/lib/cho-ca";
import { NHAN } from "@/lib/labels";
import { SearchField } from "@/components/ui/search-field";
import {
  fetchPublicSellContacts,
  STATIC_SELL_CONTACTS,
  type SellContact,
} from "@/lib/sell-contacts";
import { useHome, HomeBar, applyHome } from "@/components/ui/region-filter";
import { type HomePref } from "@/lib/region";
import { ChipRow } from "@/components/ui/chip-row";
import { StatusBanner } from "@/components/ui/status-banner";
import { readUserList } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";
import { createClient } from "@/lib/supabase/client";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LienHe } from "@/components/ui/lien-he";
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
  PinIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";

/*
  "Bán ở đâu / bán cho ai" (trục GIAO DỊCH) — giúp bà con không bị ép giá.
  Vào thẳng DANH SÁCH ĐẦU MỐI (bỏ mục "Kênh bán" giải thích — chủ tàu đã
  rành, user chốt 2026-07-27). 4 mảng, chuyển bằng chip nhẹ:
   · Nậu vựa   — vựa/cơ sở thu mua công khai, lọc theo vùng
   · Chợ đầu mối — chợ công khai (địa chỉ, giờ họp)
   · Nhà máy    — DN thu mua/xuất khẩu, lọc theo loài cá (seafood-buyers)
   · Mối quen   — nậu/vựa/nhà máy bà con TỰ thêm (localStorage, riêng tư)
*/


/* id = giá trị `?cho=` trên URL (CC-06): chip tầng 2 được nhớ khi lùi về, link mở
   thẳng được một mục. Ghi bằng replaceState, không đẻ mục lịch sử. */
type Section = "vua" | "cho" | "nhamay" | "moiquen";
const SECTION_IDS: readonly Section[] = ["vua", "cho", "nhamay", "moiquen"];

const SECTIONS: { id: Section; label: string }[] = [
  { id: "vua", label: "Nậu vựa" },
  { id: "cho", label: "Chợ sỉ" },
  { id: "nhamay", label: "Nhà máy" },
  { id: "moiquen", label: "Mối quen" },
];

/** Khớp bỏ dấu một từ khoá với nhiều trường (tên, loài, tỉnh…) — rỗng thì khớp hết. */
function khop(q: string, ...fields: (string | undefined)[]): boolean {
  if (!q) return true;
  return fields.some((f) => f && boDau(f).includes(q));
}

/** "SĐT: 0905… / 0902…" — MỖI số là một đường `tel:` (CC-10). Trước đây chỉ `CallButton`
 *  gọi số đầu, ba số còn lại là chữ chết. */
function SdtLinks({ phone }: { phone: string }) {
  return (
    <p className="text-[0.875rem] text-foreground/70">
      SĐT:{" "}
      {tachSdt(phone).map((so, i) => (
        <span key={so}>
          {i > 0 ? " / " : ""}
          <a href={telHref(so)} className="font-semibold tabular-nums text-sea underline-offset-2 active:underline">
            {so}
          </a>
        </span>
      ))}
    </p>
  );
}

/** Địa chỉ vựa/chợ là LINK mở bản đồ máy (CC-19) — chữ địa chỉ chết là ngõ cụt; giữ icon ghim.
 *  Mất sóng vẫn giữ link (app bản đồ có bản đã tải). Địa chỉ quá ngắn ⇒ chữ thường. */
function DiaChi({ diaChi, tinh }: { diaChi: string; tinh?: string }) {
  const href = banDoHref(diaChi, tinh);
  const than = (
    <>
      <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-t2" />
      <span>{diaChi}</span>
    </>
  );
  if (!href) return <p className="mt-1 flex gap-1.5 text-[0.875rem] text-foreground/70">{than}</p>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={`Mở bản đồ: ${diaChi}`}
      className="mt-1 flex gap-1.5 text-[0.875rem] text-sea underline-offset-2 active:underline"
    >
      {than}
    </a>
  );
}

export function SellGuide() {
  const [section, setSection] = useState<Section>("vua");
  useEffect(() => {
    setSection(docThamSo(window.location.search, "cho", SECTION_IDS, "vua"));
  }, []);
  const chonCho = (c: Section) => {
    setSection(c);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${datThamSo(window.location.search, "cho", c === "vua" ? null : c)}`,
    );
  };
  /*  MỘT ô tìm cho cả bốn mục (CC-12): trước chỉ Nhà máy có ô tìm (khác khuôn ô tìm bảng
      giá), 93 vựa không tìm được. Lọc bỏ dấu theo tên / loài / tỉnh. */
  const [q, setQ] = useState("");
  const qf = boDau(q.trim());
  const { home } = useHome();
  const [near, setNear] = useState(true);
  // các mục danh bạ có lọc theo vùng (nậu vựa / chợ / nhà máy)
  const geo = section === "vua" || section === "cho" || section === "nhamay";

  // Danh bạ nay do admin quản lý (bảng sell_contacts): đọc DB, chưa cấu
  // hình/lỗi/rỗng → gộp tĩnh (STATIC_SELL_CONTACTS) — giữ nguyên hành vi cũ.
  const [contacts, setContacts] = useState<SellContact[]>(STATIC_SELL_CONTACTS);
  /** đang hiện bản TĨNH vì không hỏi được bản admin (mất sóng / lỗi) — nói một
   *  dòng nhỏ, không đội lốt bản mới (audit 2026-08-18 G10). Chỉ tính khi máy
   *  chủ CÓ cấu hình; demo mode thì bản tĩnh là bản chính, khỏi nói. */
  const [staticFallback, setStaticFallback] = useState(false);
  useEffect(() => {
    let alive = true;
    const configured = createClient() !== null;
    const tai = () =>
      fetchPublicSellContacts().then((c) => {
        if (!alive) return;
        if (c) {
          setContacts(c);
          setStaticFallback(false);
        } else if (configured) {
          setStaticFallback(true);
        }
      });
    void tai();
    // có sóng lại thì tự hỏi bản mới (đồng hồ 12s trong lib, hỏng thì giữ bản tĩnh)
    const onOnline = () => void tai();
    window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return (
    <div className="px-4">
      {/* tầng 2 — mục con của "Bán ở đâu" (nằm dưới chip Giao dịch tầng 1) */}
      <SearchField
        className="mb-2"
        value={q}
        onChange={setQ}
        placeholder={section === "moiquen" ? "Tìm mối quen…" : "Tìm tên, loài, tỉnh…"}
        label="Tìm đầu mối"
      />
      <div className="-mx-4">
        <ChipRow
          options={SECTIONS}
          value={section}
          onChange={chonCho}
          accent="t2"
          level={2}
          ariaLabel="Chỗ bán"
        />
      </div>

      {geo && staticFallback && (
        <p className="mb-2 px-1 text-[0.875rem] font-semibold text-foreground/65">
          Danh bạ tham khảo lưu sẵn — chưa hỏi được bản mới.
        </p>
      )}

      {geo && (
        <HomeBar home={home} near={near} setNear={setNear} />
      )}

      {/*  MỘT dòng chữ phụ thay 3 RefNote nền vàng (CC-08, 03 §0b: nền warn chỉ khi có
          việc cần biết; chữ giải thích ở trạng thái yên là chữ thường). */}
      {geo && (
        <p className="mb-2 px-1 text-[0.8125rem] leading-snug text-foreground/65">
          Danh bạ công khai, tham khảo · gọi hỏi trước khi chở hàng.
        </p>
      )}

      {section === "vua" && (
        <Wholesalers
          list={contacts.filter((c) => c.kind === "vua")}
          home={home}
          near={near}
          q={qf}
        />
      )}
      {section === "cho" && (
        <Markets
          list={contacts.filter((c) => c.kind === "cho")}
          home={home}
          near={near}
          q={qf}
        />
      )}
      {section === "nhamay" && (
        <Factories
          list={contacts.filter((c) => c.kind === "nhamay")}
          home={home}
          near={near}
          q={qf}
        />
      )}
      {section === "moiquen" && <MyBuyers q={qf} />}
    </div>
  );
}

function Wholesalers({
  list: all,
  home,
  near,
  q,
}: {
  list: SellContact[];
  home: HomePref;
  near: boolean;
  /** từ khoá đã bỏ dấu (ô tìm chung) */
  q: string;
}) {
  const list = useMemo(
    () =>
      applyHome(
        all.filter((w) => khop(q, w.name, w.province, w.subLabel, ...w.species)),
        (w) => w.province,
        home.province,
        near,
      ),
    [all, home.province, near, q],
  );

  return (
    <div>
      <p className="mb-2 px-1 text-[0.875rem] font-semibold text-foreground/70">
        {list.length} vựa
        {home.province && near ? ` gần ${home.province}` : ""}
      </p>

      <ul className="space-y-2.5">
        {list.map((w) => (
          <li key={w.id}>
            <Card className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[0.75rem] font-semibold text-foreground/65">
                    {w.subLabel ?? "Vựa"}
                  </p>
                  <p className="display text-[1rem] font-semibold leading-snug text-navy">
                    {w.name}
                  </p>
                </div>
              </div>
              {w.address && <DiaChi diaChi={w.address} tinh={w.province} />}
              {w.phone && <SdtLinks phone={w.phone} />}
              {w.species.length > 0 && (
                <p className="text-[0.875rem] text-foreground/70">
                  Thu mua: {w.species.join(", ")}
                </p>
              )}
              {w.website && (
                <a
                  href={w.website.startsWith("http") ? w.website : `https://${w.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[0.8125rem] font-semibold text-foreground/65 underline"
                >
                  Nguồn
                </a>
              )}
              {/* Gọi · Nhắn Zalo chia hai cột (CC-18) */}
              {w.phone && <LienHe phone={w.phone} className="mt-2" />}
            </Card>
          </li>
        ))}
        {list.length === 0 && (
          <EmptyState icon={<UsersIcon className="h-9 w-9" />}>
            {q
              ? "Không thấy vựa nào khớp. Bà con thử từ ngắn hơn."
              : "Chưa có vựa công khai ở tỉnh này. Bà con thêm mối quen ở mục “Mối quen”."}
          </EmptyState>
        )}
      </ul>
    </div>
  );
}

function Markets({
  list: all,
  home,
  near,
  q,
}: {
  list: SellContact[];
  home: HomePref;
  near: boolean;
  q: string;
}) {
  const list = applyHome(
    all.filter((m) => khop(q, m.name, m.province, ...m.species)),
    (m) => m.province,
    home.province,
    near,
  );
  return (
    <div className="space-y-3">
      <p className="px-1 text-[0.875rem] font-semibold text-foreground/70">
        {list.length} chợ
        {home.province && near ? ` gần ${home.province}` : ""}
      </p>
      {list.map((m) => (
        <Card key={m.id} className="p-4">
          {/* Gọi cùng vị trí thẻ vựa — chợ có số BQL thì gọi hỏi giờ họp được (CC-11) */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {m.province && (
                <p className="text-[0.75rem] font-semibold text-foreground/65">
                  {m.province}
                </p>
              )}
              <p className="display text-[1rem] font-semibold leading-snug text-navy">
                {m.name}
              </p>
            </div>
          </div>
          {m.address && <DiaChi diaChi={m.address} tinh={m.province} />}
          {m.phone && <SdtLinks phone={m.phone} />}
          {m.hours && (
            <p className="text-[0.875rem] text-foreground/70">Giờ họp: {m.hours}</p>
          )}
          {m.species.length > 0 && (
            <p className="mt-1 text-[0.875rem] text-foreground/70">
              Loài chính: {m.species.join(", ")}
            </p>
          )}
          {m.phone && <LienHe phone={m.phone} className="mt-2" />}
        </Card>
      ))}
      {list.length === 0 && (
        <EmptyState icon={<SearchIcon className="h-9 w-9" />}>
          {q ? "Không thấy chợ nào khớp." : "Chưa có chợ đầu mối ở vùng này."}
        </EmptyState>
      )}
    </div>
  );
}

function Factories({
  list: all,
  home,
  near,
  q,
}: {
  list: SellContact[];
  home: HomePref;
  near: boolean;
  q: string;
}) {
  const list = useMemo(
    () =>
      applyHome(
        all.filter((b) => khop(q, b.name, b.province, ...b.species)),
        (b) => b.province,
        home.province,
        near,
      ),
    [all, q, home.province, near],
  );

  return (
    <div>
      <p className="mb-2 px-1 text-[0.875rem] font-semibold text-foreground/70">
        {list.length} nhà máy
        {home.province && near ? ` gần ${home.province}` : ""}
      </p>
      <ul className="space-y-2.5">
        {list.map((b) => (
          <li key={b.id}>
            <Card className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="display text-[1rem] font-semibold leading-snug text-navy">
                  {b.name}
                </p>
                {b.direct && (
                  <span className="shrink-0 rounded-full bg-ok-bg px-2 py-0.5 text-[0.75rem] font-semibold text-ok">
                    Mua trực tiếp
                  </span>
                )}
              </div>
              {b.province && (
                <p className="text-[0.875rem] font-semibold text-foreground/70">
                  {b.province}
                </p>
              )}
              <p className="mt-0.5 text-[0.875rem] text-foreground/70">
                Loài: {b.species.join(", ")}
              </p>
              {b.markets.length > 0 && (
                <p className="text-[0.875rem] text-foreground/70">
                  Bán đi: {b.markets.join(", ")}
                </p>
              )}
              {b.website && (
                <a
                  href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[0.875rem] font-semibold text-sea"
                >
                  Xem trang web
                </a>
              )}
            </Card>
          </li>
        ))}
        {list.length === 0 && (
          <EmptyState icon={<SearchIcon className="h-9 w-9" />}>
            Không tìm thấy nhà máy mua loài này. Thử từ khác (vd: cá, tôm, mực).
          </EmptyState>
        )}
      </ul>
    </div>
  );
}

// ── Mối quen của tôi (localStorage) ──────────────────────────────────────
const STORAGE_KEY = "forfish.buyers.v1";

const BUYER_TYPES: { value: SavedBuyer["type"]; label: string }[] = [
  { value: "nau-vua", label: "Nậu, vựa" },
  { value: "vua-dai-ly", label: "Vựa / đại lý" },
  { value: "nha-may", label: "Nhà máy" },
  { value: "htx", label: "Hợp tác xã" },
  { value: "khach-le", label: "Khách lẻ / online" },
  { value: "khac", label: "Khác" },
];
const typeLabel = (t: SavedBuyer["type"]) =>
  BUYER_TYPES.find((x) => x.value === t)?.label ?? "Khác";

/* MỐI QUEN LÀ DỮ LIỆU BÀ CON GÕ TAY (tên nậu vựa + số điện thoại) — mất là mất
   luôn, không tải lại được như dự báo. Hai lỗi đã sửa (K4, 2026-08-02):
    · `JSON.parse` hỏng → `catch` → trả `[]` → `ready = true` → effect ghi `"[]"`
      ĐÈ LÊN chuỗi gốc: cú "khôi phục" tự xoá sổ mối quen của bà con.
    · `setItem` trần trong `try/catch` RỖNG: máy đầy là mất im lặng, mở lại app
      mới biết. Nay ghi qua `saveUserJson` (dự báo nhường chỗ) + BÁO ĐỎ. */
function MyBuyers({ q }: { q: string }) {
  const [buyers, setBuyers] = useState<SavedBuyer[]>([]);
  const shown = buyers.filter((b) => khop(q, b.name, b.port, b.phone, ...(b.species ?? [])));
  const [ready, setReady] = useState(false);
  /** máy KHÔNG ĐỌC ĐƯỢC sổ đã lưu → không mở cửa ghi, và nói ra */
  const [readFailed, setReadFailed] = useState(false);
  /** máy không giữ được thứ vừa nhập → phải nói ra, không nuốt im */
  const [saveFailed, setSaveFailed] = useState(false);
  const [editing, setEditing] = useState<SavedBuyer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<SavedBuyer | null>(null);

  useEffect(() => {
    const r = readUserList<SavedBuyer>(STORAGE_KEY);
    if (!r.ok) {
      setReadFailed(true); // `ready` GIỮ NGUYÊN false ⇒ effect ghi không chạy
      return;
    }
    setBuyers(r.list ?? []);
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) setSaveFailed(!saveUserJson(STORAGE_KEY, buyers));
  }, [buyers, ready]);

  function upsert(b: SavedBuyer) {
    setBuyers((prev) => {
      const i = prev.findIndex((x) => x.id === b.id);
      if (i === -1) return [...prev, b];
      const next = [...prev];
      next[i] = b;
      return next;
    });
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div>
      {/* KHÔNG ĐỌC ĐƯỢC SỔ CŨ — nói ngay, và KHÔNG ghi đè lên nó (thêm mới lúc
          này là xoá mất sổ gốc). */}
      {readFailed && (
        <div className="mt-3 overflow-hidden surface">
          <StatusBanner level="danger">
            Máy chưa đọc được sổ mối quen đã lưu. Đóng app rồi mở lại; đừng thêm
            mối mới lúc này để khỏi mất sổ cũ.
          </StatusBanner>
        </div>
      )}
      {/* MÁY KHÔNG GIỮ ĐƯỢC — nói ngay, đừng để ra cảng mới biết mất số điện
          thoại thương lái */}
      {saveFailed && (
        <div className="mt-3 overflow-hidden surface">
          <StatusBanner level="danger">
            Máy không giữ được — xoá bớt dữ liệu rồi thử lại.
          </StatusBanner>
        </div>
      )}

      {/*  Nút "Thêm mối" về INLINE cuối hàng cấp dữ liệu (luật A2 + A3): trước
          là dải 343×60 nằm một mình trong <div className="my-3"> — một dải
          ngang cho MỘT việc, ăn trọn một hàng. Khuôn hàng lấy lại của mục Nậu
          vựa ("{list.length} vựa"). */}
      <div className="my-3 flex items-stretch gap-2">
        <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
          <p className="text-[0.875rem] font-semibold text-foreground/70">
            {q ? `${shown.length}/${buyers.length}` : buyers.length} mối quen
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className={`${SQ_BTN} bg-trim text-white `}
        >
          <PlusIcon className="h-6 w-6" />
          {NHAN.themMoi}
        </button>
      </div>
      {/* một dòng chữ phụ thay RefNote nền xanh (CC-08) */}
      <p className="mb-2 px-1 text-[0.8125rem] leading-snug text-foreground/65">
        Sổ riêng của bà con — chỉ máy này thấy.
      </p>

      {ready && buyers.length === 0 && (
        <EmptyState icon={<UsersIcon className="h-9 w-9" />}>
          Chưa lưu mối nào. Thêm nậu/vựa/nhà máy hay bán để so giá lần sau.
        </EmptyState>
      )}
      {ready && buyers.length > 0 && shown.length === 0 && (
        <EmptyState icon={<SearchIcon className="h-9 w-9" />}>
          Không thấy mối nào khớp. Bà con thử từ ngắn hơn.
        </EmptyState>
      )}

      <ul className="space-y-2.5">
        {shown.map((b) => (
          <li key={b.id}>
            <Card className="p-3.5">
              {/*  "Sửa"/"Xóa" về INLINE cuối hàng tên mối quen (luật A3/A5):
                  trước là hàng footer border-t riêng, hai nút KHÔNG khai min-h
                  nào (đo thật 50×24px — chưa bằng một nửa sàn 52px), mà "Xóa"
                  lại là hành động phá huỷ (xoá số thương lái bà con gõ tay). */}
              <div className="flex items-stretch gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.75rem] font-semibold text-foreground/65">
                    {typeLabel(b.type)}
                  </p>
                  <p className="display break-words text-[1rem] font-semibold leading-snug text-navy">
                    {b.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditing(b);
                    setShowForm(true);
                  }}
                  className={`${SQ_BTN} bg-background text-sea`}
                >
                  <EditIcon className="h-6 w-6" />
                  Sửa
                </button>
                <button
                  onClick={() => setConfirmDel(b)}
                  className={`${SQ_BTN} bg-background text-danger`}
                >
                  <TrashIcon className="h-6 w-6" />
                  Xóa
                </button>
              </div>
              {/* SĐT là DỮ LIỆU (đọc/chép được); nút GỌI inline cuối chính
                  hàng đó — hàng nó thao tác lên (luật A3/B1). */}
              {b.phone && (
                <div className="mt-1.5">
                  <SdtLinks phone={b.phone} />
                </div>
              )}
              {b.port && (
                <p className="text-[0.875rem] text-foreground/70">Cảng: {b.port}</p>
              )}
              {b.species && b.species.length > 0 && (
                <p className="text-[0.875rem] text-foreground/70">
                  Hay mua: {b.species.join(", ")}
                </p>
              )}
              {b.note && (
                <p className="mt-1 rounded-xl bg-background px-3 py-1.5 text-[0.875rem] text-foreground/70">
                  {b.note}
                </p>
              )}
              {b.phone && <LienHe phone={b.phone} className="mt-2" />}
            </Card>
          </li>
        ))}
      </ul>

      {showForm && (
        <BuyerForm
          initial={editing}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={upsert}
        />
      )}
      {confirmDel && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title="Xóa mối quen này?"
          message={`“${confirmDel.name}” sẽ bị xóa khỏi danh bạ.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            setBuyers((prev) => prev.filter((x) => x.id !== confirmDel.id));
            setConfirmDel(null);
          }}
        />
      )}
    </div>
  );
}

function BuyerForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: SavedBuyer | null;
  onCancel: () => void;
  onSave: (b: SavedBuyer) => void;
}) {
  const { home } = useHome();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<SavedBuyer["type"]>(initial?.type ?? "nau-vua");
  /*  Cảng/bến ĐIỀN SẴN từ cảng nhà bà con đã khai (luật C1 câu hỏi 2 — máy đã
      biết thì đừng hỏi). Vẫn sửa được: bấm ô "Sửa" của hàng đọc-được. */
  const [port, setPort] = useState(initial?.port ?? home.province ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [species, setSpecies] = useState((initial?.species ?? []).join(", "));
  const [note, setNote] = useState(initial?.note ?? "");
  /*  Chỉ bày 2 ô KEY (Tên + SĐT): sổ này tồn tại để GỌI ĐƯỢC người ta sau. Bốn
      ô còn lại bỏ đi vẫn lưu được ⇒ thu lại (luật C1/C2 — panel đo thật 690px
      = 85% màn, trần ~40%). */
  const [showType, setShowType] = useState(false);
  const [showMore, setShowMore] = useState(false);
  /** lỗi ô Tên — hiện dưới ô + con trỏ vào ô (CC-22: trước `return` im lặng, chỉ nhờ
   *  bong bóng `required` của trình duyệt — tiếng Anh, tuỳ WebView) */
  const [loiTen, setLoiTen] = useState<string | null>(null);
  const oTen = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setLoiTen("Nhập tên mối (vựa, nậu, nhà máy).");
      oTen.current?.focus();
      return;
    }
    onSave({
      id: initial?.id ?? `buyer-${Date.now()}`,
      name: name.trim(),
      type,
      port: port.trim() || undefined,
      phone: phone.trim() || undefined,
      species: species
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      note: note.trim() || undefined,
    });
  }

  return (
    <BottomSheet kieu="form"
      title={initial ? "Sửa thông tin mối quen" : "Thêm mối quen"}
      onClose={onCancel}
    >
      <form onSubmit={submit}>
        {/* Hàng KEY 1: tên. Nút Lưu về hàng đáy cùng Hủy — một khuôn với form Đăng tin
            (CC-13); trước Lưu nằm cạnh ô Tên ở đầu, Hủy lẻ loi dưới. */}
        <Field label="Tên (bắt buộc)" error={loiTen ?? undefined}>
          <input
            ref={oTen}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (loiTen) setLoiTen(null);
            }}
            className={inputClass}
            placeholder="VD: Vựa cô Ba"
          />
        </Field>

        {/* Hàng KEY 2: số điện thoại — mục đích của cả sổ này */}
        <Field label="Số điện thoại liên hệ">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            inputMode="tel"
            placeholder="VD: 0901234567"
          />
        </Field>

        {/* Loại: đã có mặc định "Nậu vựa" ⇒ dòng đọc-được + ô sửa */}
        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="text-[1rem] text-foreground/80">
              Loại:{" "}
              <span className="font-semibold text-navy">{typeLabel(type)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowType((v) => !v)}
            className={`${SQ_BTN} bg-background text-sea`}
          >
            <EditIcon className="h-6 w-6" />
            {showType ? "Thu" : "Sửa"}
          </button>
        </div>
        {showType && (
          <Field label="Loại hình">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SavedBuyer["type"])}
              className={inputClass}
            >
              {BUYER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {/* Cảng/bến + loài + ghi chú: thu sau một nút */}
        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="truncate text-[1rem] text-foreground/80">
              Bến:{" "}
              <span className="font-semibold text-navy">
                {port.trim() || "chưa ghi"}
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
            <Field label="Cảng / bến hay giao dịch">
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className={inputClass}
                placeholder="VD: Cảng Hòn Rớ"
              />
            </Field>
            <Field label="Loài hay thu mua (ngăn cách bằng dấu phẩy)">
              <input
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className={inputClass}
                placeholder="VD: cá ngừ, cá thu"
              />
            </Field>
            <Field label="Ghi chú (giá thường mua, có ứng vốn, tỷ lệ trừ hao…)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="VD: trả 95k/kg cá ngừ, ứng trước 50tr, trừ hao 5%"
              />
            </Field>
          </>
        )}

        {/* Hàng cuối theo khuôn B1 (như ListingForm): dòng trạng thái · Hủy · Lưu */}
        <div className="mt-2 flex items-stretch gap-2">
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="text-[0.875rem] text-foreground/70">Chỉ lưu trong máy này.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className={`${SQ_BTN} bg-background text-foreground/70`}
          >
            <CloseIcon className="h-6 w-6" />
            {NHAN.huy}
          </button>
          <button type="submit" className={`${SQ_BTN} bg-trim text-white `}>
            <CheckIcon className="h-6 w-6" />
            {NHAN.luu}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
