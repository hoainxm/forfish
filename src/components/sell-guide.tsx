"use client";

import { useEffect, useMemo, useState } from "react";
import { type SavedBuyer } from "@/data/market-channels";
import {
  fetchPublicSellContacts,
  STATIC_SELL_CONTACTS,
  type SellContact,
} from "@/lib/sell-contacts";
import { useHome, HomeBar, applyHome } from "@/components/ui/region-filter";
import { type HomePref } from "@/lib/region";
import { ChipRow } from "@/components/ui/chip-row";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  CallButton,
  Card,
  EmptyState,
  Field,
  PrimaryButton,
  RefNote,
  inputClass,
} from "@/components/ui/primitives";
import {
  EditIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";

/*
  "Bán ở đâu / bán cho ai" (trục GIAO DỊCH) — giúp bà con không bị ép giá.
  Vào thẳng DANH SÁCH ĐẦU MỐI (bỏ mục "Kênh bán" giải thích — chủ tàu đã
  rành, user chốt 2026-07-27). 4 mảng, chuyển bằng chip nhẹ:
   · Nậu vựa   — vựa/cơ sở thu mua công khai, lọc theo vùng
   · Chợ đầu mối — chợ công khai (địa chỉ, giờ họp)
   · Nhà máy    — DN thu mua/xuất khẩu, lọc theo loài cá (seafood-buyers)
   · Mối quen   — nậu/vựa/nhà máy bà con TỰ thêm (localStorage, riêng tư)
*/


type Section = "vua" | "cho" | "nhamay" | "moiquen";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "vua", label: "Nậu vựa" },
  { id: "cho", label: "Chợ đầu mối" },
  { id: "nhamay", label: "Nhà máy" },
  { id: "moiquen", label: "Mối quen" },
];

export function SellGuide() {
  const [section, setSection] = useState<Section>("vua");
  const { home } = useHome();
  const [near, setNear] = useState(true);
  // các mục danh bạ có lọc theo vùng (nậu vựa / chợ / nhà máy)
  const geo = section === "vua" || section === "cho" || section === "nhamay";

  // Danh bạ nay do admin quản lý (bảng sell_contacts): đọc DB, chưa cấu
  // hình/lỗi/rỗng → gộp tĩnh (STATIC_SELL_CONTACTS) — giữ nguyên hành vi cũ.
  const [contacts, setContacts] = useState<SellContact[]>(STATIC_SELL_CONTACTS);
  useEffect(() => {
    let alive = true;
    fetchPublicSellContacts().then((c) => {
      if (alive && c) setContacts(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="px-4">
      {/* tầng 2 — mục con của "Bán ở đâu" (nằm dưới chip Giao dịch tầng 1) */}
      <div className="-mx-4">
        <ChipRow
          options={SECTIONS}
          value={section}
          onChange={setSection}
          accent="t2"
          level={2}
          ariaLabel="Chỗ bán"
        />
      </div>

      {geo && (
        <HomeBar home={home} near={near} setNear={setNear} />
      )}

      {section === "vua" && (
        <Wholesalers
          list={contacts.filter((c) => c.kind === "vua")}
          home={home}
          near={near}
        />
      )}
      {section === "cho" && (
        <Markets
          list={contacts.filter((c) => c.kind === "cho")}
          home={home}
          near={near}
        />
      )}
      {section === "nhamay" && (
        <Factories
          list={contacts.filter((c) => c.kind === "nhamay")}
          home={home}
          near={near}
        />
      )}
      {section === "moiquen" && <MyBuyers />}
    </div>
  );
}

function Wholesalers({
  list: all,
  home,
  near,
}: {
  list: SellContact[];
  home: HomePref;
  near: boolean;
}) {
  const list = useMemo(
    () => applyHome(all, (w) => w.province, home.province, near),
    [all, home.province, near],
  );

  return (
    <div>
      <RefNote>
        Vựa/cơ sở thu mua có đăng tin công khai — gọi xác minh trước khi bán.
        Nậu quen tại bến của bà con thì lưu ở mục “Mối quen”.
      </RefNote>

      <p className="mb-2 mt-2 px-1 text-[0.875rem] font-semibold text-foreground/70">
        {list.length} vựa
        {home.province && near ? ` gần ${home.province}` : ""}
      </p>

      <ul className="space-y-2.5">
        {list.map((w) => (
          <li key={w.id}>
            <Card className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[0.75rem] font-bold uppercase tracking-wide text-foreground/65">
                    {w.subLabel ?? "Vựa"}
                  </p>
                  <p className="display text-[1.125rem] font-bold leading-snug text-navy">
                    {w.name}
                  </p>
                </div>
                {w.phone && <CallButton phone={w.phone} />}
              </div>
              {w.address && (
                <p className="mt-1 flex gap-1.5 text-[0.9375rem] text-foreground/70">
                  <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-t2" />
                  <span>{w.address}</span>
                </p>
              )}
              {w.phone && (
                <p className="text-[0.9375rem] text-foreground/70">SĐT: {w.phone}</p>
              )}
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
            </Card>
          </li>
        ))}
        {list.length === 0 && (
          <EmptyState icon={<UsersIcon className="h-9 w-9" />}>
            Chưa có vựa công khai ở tỉnh này. Bà con thêm mối quen ở mục
            “Mối quen”.
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
}: {
  list: SellContact[];
  home: HomePref;
  near: boolean;
}) {
  const list = applyHome(all, (m) => m.province, home.province, near);
  return (
    <div className="space-y-3">
      <RefNote>
        Địa chỉ và giờ họp chợ là tham khảo, có thể đã đổi — gọi hỏi trước khi
        chở hàng tới.
      </RefNote>
      {list.map((m) => (
        <Card key={m.id} className="p-4">
          <p className="display text-[1.125rem] font-bold leading-snug text-navy">
            {m.name}
          </p>
          {m.province && (
            <p className="text-[0.9375rem] font-semibold text-foreground/70">
              {m.province}
            </p>
          )}
          {m.address && (
            <p className="mt-1 flex gap-1.5 text-[0.9375rem] text-foreground/70">
              <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-t2" />
              <span>{m.address}</span>
            </p>
          )}
          {m.hours && (
            <p className="text-[0.9375rem] text-foreground/70">Giờ họp: {m.hours}</p>
          )}
          {m.species.length > 0 && (
            <p className="mt-1 text-[0.875rem] text-foreground/70">
              Loài chính: {m.species.join(", ")}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

function Factories({
  list: all,
  home,
  near,
}: {
  list: SellContact[];
  home: HomePref;
  near: boolean;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = query
      ? all.filter(
          (b) =>
            b.name.toLowerCase().includes(query) ||
            b.species.some((s) => s.toLowerCase().includes(query)),
        )
      : all;
    return applyHome(base, (b) => b.province, home.province, near);
  }, [all, q, home.province, near]);

  return (
    <div>
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/65" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo loài: cá ngừ, tôm, mực…"
          className="min-h-[3.25rem] w-full rounded-2xl border-0 bg-field pl-11 pr-4 text-[1.125rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
      </div>
      <RefNote>
        Danh sách tham khảo từ nguồn công khai (VASEP…). Phần lớn nhà máy mua qua
        đại lý — hỏi đại lý/cảng để bán được cho họ.
      </RefNote>
      <p className="mb-2 mt-2 px-1 text-[0.875rem] font-semibold text-foreground/70">
        {list.length} doanh nghiệp
      </p>
      <ul className="space-y-2.5">
        {list.map((b) => (
          <li key={b.id}>
            <Card className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="display text-[1.125rem] font-bold leading-snug text-navy">
                  {b.name}
                </p>
                {b.direct && (
                  <span className="shrink-0 rounded-full bg-ok-bg px-2 py-0.5 text-[0.75rem] font-bold text-ok">
                    Mua trực tiếp
                  </span>
                )}
              </div>
              {b.province && (
                <p className="text-[0.9375rem] font-semibold text-foreground/70">
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
                  className="mt-1 inline-block text-[0.9375rem] font-bold text-sea"
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
  { value: "nau-vua", label: "Nậu vựa" },
  { value: "vua-dai-ly", label: "Vựa / đại lý" },
  { value: "nha-may", label: "Nhà máy" },
  { value: "htx", label: "Hợp tác xã" },
  { value: "khach-le", label: "Khách lẻ / online" },
  { value: "khac", label: "Khác" },
];
const typeLabel = (t: SavedBuyer["type"]) =>
  BUYER_TYPES.find((x) => x.value === t)?.label ?? "Khác";

function loadBuyers(): SavedBuyer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedBuyer[];
  } catch {
    /* ignore */
  }
  return [];
}

function MyBuyers() {
  const [buyers, setBuyers] = useState<SavedBuyer[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<SavedBuyer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<SavedBuyer | null>(null);

  useEffect(() => {
    setBuyers(loadBuyers());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buyers));
      } catch {
        /* ignore */
      }
    }
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
      <RefNote tone="var(--t2)" bg="var(--t2-bg)">
        Lưu mối quen của riêng bà con — nậu, vựa, nhà máy hay mua, kèm giá
        thường trả, có ứng tổn không. Chỉ máy bà con thấy.
      </RefNote>

      <div className="my-3">
        <PrimaryButton
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <PlusIcon className="h-6 w-6" />
          Thêm mối quen
        </PrimaryButton>
      </div>

      {ready && buyers.length === 0 && (
        <EmptyState icon={<UsersIcon className="h-9 w-9" />}>
          Chưa lưu mối nào. Thêm nậu/vựa/nhà máy hay bán để so giá lần sau.
        </EmptyState>
      )}

      <ul className="space-y-2.5">
        {buyers.map((b) => (
          <li key={b.id}>
            <Card className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[0.75rem] font-bold uppercase tracking-wide text-foreground/65">
                    {typeLabel(b.type)}
                  </p>
                  <p className="display text-[1.125rem] font-bold leading-snug text-navy">
                    {b.name}
                  </p>
                </div>
                {b.phone && <CallButton phone={b.phone} />}
              </div>
              {b.port && (
                <p className="text-[0.9375rem] text-foreground/70">Cảng: {b.port}</p>
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
              <div className="mt-2 flex gap-4 border-t border-line pt-2">
                <button
                  onClick={() => {
                    setEditing(b);
                    setShowForm(true);
                  }}
                  className="flex items-center gap-1.5 text-[0.9375rem] font-bold text-sea"
                >
                  <EditIcon className="h-4 w-4" /> Sửa
                </button>
                <button
                  onClick={() => setConfirmDel(b)}
                  className="flex items-center gap-1.5 text-[0.9375rem] font-bold text-danger"
                >
                  <TrashIcon className="h-4 w-4" /> Xóa
                </button>
              </div>
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
          message={`“${confirmDel.name}” sẽ bị xóa khỏi sổ.`}
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
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<SavedBuyer["type"]>(initial?.type ?? "nau-vua");
  const [port, setPort] = useState(initial?.port ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [species, setSpecies] = useState((initial?.species ?? []).join(", "));
  const [note, setNote] = useState(initial?.note ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
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
    <BottomSheet
      title={initial ? "Sửa mối quen" : "Thêm mối quen"}
      onClose={onCancel}
    >
      <form onSubmit={submit}>
        <Field label="Tên (bắt buộc)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="VD: Vựa cô Ba, Nhà máy Bidifisco"
            required
          />
        </Field>
        <Field label="Loại">
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
        <Field label="Cảng / bến hay gặp">
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className={inputClass}
            placeholder="VD: Cảng Hòn Rớ"
          />
        </Field>
        <Field label="Số điện thoại">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            inputMode="tel"
            placeholder="VD: 0901234567"
          />
        </Field>
        <Field label="Loài hay mua (cách nhau dấu phẩy)">
          <input
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            className={inputClass}
            placeholder="VD: cá ngừ, cá thu"
          />
        </Field>
        <Field label="Ghi chú (giá thường, có ứng tổn, mức trừ hao…)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="VD: trả 95k/kg cá ngừ, ứng tổn 50tr, trừ hao 5%"
          />
        </Field>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit">Lưu lại</PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}
