"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SELL_CHANNELS,
  WHOLESALE_MARKETS,
  type SavedBuyer,
} from "@/data/market-channels";
import { SEAFOOD_BUYERS, buyersForSpecies } from "@/data/seafood-buyers";
import {
  WHOLESALER_KIND_LABEL,
  WHOLESALERS,
} from "@/data/wholesalers";
import { useHome, HomeBar, applyHome } from "@/components/ui/region-filter";
import { type HomePref } from "@/lib/region";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, EmptyState, Field, PrimaryButton, RefNote, inputClass } from "@/components/ui/primitives";
import {
  AlertIcon,
  CheckIcon,
  EditIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";

/*
  "Bán ở đâu / bán cho ai" (trục TIỀN) — giúp bà con không bị ép giá:
  4 mảng gọn, chuyển bằng chip nhẹ (không lồng segmented nặng):
   · Kênh bán  — 5 cách bán, ưu/nhược về GIÁ (research/08)
   · Chợ đầu mối — chợ công khai (địa chỉ, giờ họp)
   · Nhà máy    — DN thu mua/xuất khẩu, lọc theo loài cá (seafood-buyers)
   · Mối quen   — nậu/vựa/nhà máy bà con TỰ thêm (localStorage, riêng tư)
*/

/** Lấy 1 số gọi được từ chuỗi có thể chứa nhiều số (cách nhau "/", ",", "-"). */
function telHref(phone: string): string {
  const first = phone.split(/[/,;]| - | hoặc /i)[0] ?? phone;
  return `tel:${first.replace(/[^\d+]/g, "")}`;
}

type Section = "kenh" | "vua" | "cho" | "nhamay" | "moiquen";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "kenh", label: "Kênh bán" },
  { id: "vua", label: "Nậu vựa" },
  { id: "cho", label: "Chợ đầu mối" },
  { id: "nhamay", label: "Nhà máy" },
  { id: "moiquen", label: "Mối quen" },
];

export function SellGuide() {
  const [section, setSection] = useState<Section>("kenh");
  const { home } = useHome();
  const [near, setNear] = useState(true);
  // các mục danh bạ có lọc theo vùng (nậu vựa / chợ / nhà máy)
  const geo = section === "vua" || section === "cho" || section === "nhamay";

  return (
    <div className="px-4">
      <div className="mb-3 flex gap-1.5 overflow-x-auto">
        {SECTIONS.map((s) => {
          const on = s.id === section;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-pressed={on}
              className={`min-h-[48px] shrink-0 rounded-xl px-4 text-[16px] font-bold transition ${
                on
                  ? "bg-t2 text-white"
                  : "bg-field text-navy/70 active:bg-card"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {geo && (
        <HomeBar home={home} near={near} setNear={setNear} />
      )}

      {section === "kenh" && <Channels />}
      {section === "vua" && <Wholesalers home={home} near={near} />}
      {section === "cho" && <Markets home={home} near={near} />}
      {section === "nhamay" && <Factories home={home} near={near} />}
      {section === "moiquen" && <MyBuyers />}
    </div>
  );
}

function Channels() {
  return (
    <div className="space-y-3">
      <RefNote tone="var(--t2)" bg="var(--t2-bg)">
        Xếp từ giá thấp → cao. Bán càng gần nhà máy/khách cuối càng được giá,
        nhưng tốn công và cần giấy tờ hơn.
      </RefNote>
      {SELL_CHANNELS.map((c, i) => (
        <Card key={c.id} className="p-4">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-t2 text-[14px] font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="display text-[18px] font-bold leading-snug text-navy">
                {c.name}
              </p>
              {c.bestFor && (
                <p className="text-[14px] font-semibold text-t2">
                  Hợp khi: {c.bestFor}
                </p>
              )}
            </div>
          </div>
          <ul className="mt-2 space-y-1">
            {c.pros.map((p) => (
              <li key={p} className="flex gap-2 text-[15px] text-foreground/80">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                <span>{p}</span>
              </li>
            ))}
            {c.cons.map((p) => (
              <li key={p} className="flex gap-2 text-[15px] text-foreground/80">
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Wholesalers({ home, near }: { home: HomePref; near: boolean }) {
  const list = useMemo(
    () => applyHome(WHOLESALERS, (w) => w.province, home.province, near),
    [home.province, near],
  );

  return (
    <div>
      <RefNote>
        Vựa/cơ sở thu mua có đăng tin công khai — gọi xác minh trước khi bán.
        Nậu quen tại bến của bà con thì lưu ở mục “Mối quen”.
      </RefNote>

      <p className="mb-2 mt-2 px-1 text-[14px] font-semibold text-foreground/55">
        {list.length} vựa
        {home.province && near ? ` gần ${home.province}` : ""}
      </p>

      <ul className="space-y-2.5">
        {list.map((w) => (
          <li key={w.id}>
            <Card className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-foreground/45">
                    {WHOLESALER_KIND_LABEL[w.kind] ?? "Vựa"}
                  </p>
                  <p className="display text-[18px] font-bold leading-snug text-navy">
                    {w.name}
                  </p>
                </div>
                {w.phone && (
                  <a
                    href={telHref(w.phone)}
                    className="shrink-0 rounded-xl bg-sea px-3 py-2 text-[15px] font-bold text-white"
                  >
                    Gọi
                  </a>
                )}
              </div>
              {w.address && (
                <p className="mt-1 flex gap-1.5 text-[15px] text-foreground/70">
                  <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-t2" />
                  <span>{w.address}</span>
                </p>
              )}
              {w.phone && (
                <p className="text-[15px] text-foreground/70">SĐT: {w.phone}</p>
              )}
              {w.species && w.species.length > 0 && (
                <p className="text-[14px] text-foreground/60">
                  Thu mua: {w.species.join(", ")}
                </p>
              )}
              {w.source && (
                <a
                  href={w.source.startsWith("http") ? w.source : `https://${w.source}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[13px] font-semibold text-foreground/45 underline"
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

function Markets({ home, near }: { home: HomePref; near: boolean }) {
  const list = applyHome(WHOLESALE_MARKETS, (m) => m.province, home.province, near);
  return (
    <div className="space-y-3">
      <RefNote>
        Địa chỉ và giờ họp chợ là tham khảo, có thể đã đổi — gọi hỏi trước khi
        chở hàng tới.
      </RefNote>
      {list.map((m) => (
        <Card key={m.id} className="p-4">
          <p className="display text-[18px] font-bold leading-snug text-navy">
            {m.name}
          </p>
          {m.province && (
            <p className="text-[15px] font-semibold text-foreground/70">
              {m.province}
            </p>
          )}
          {m.address && (
            <p className="mt-1 flex gap-1.5 text-[15px] text-foreground/70">
              <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-t2" />
              <span>{m.address}</span>
            </p>
          )}
          {m.hours && (
            <p className="text-[15px] text-foreground/70">Giờ họp: {m.hours}</p>
          )}
          {m.species && m.species.length > 0 && (
            <p className="mt-1 text-[14px] text-foreground/60">
              Loài chính: {m.species.join(", ")}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

function Factories({ home, near }: { home: HomePref; near: boolean }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const query = q.trim();
    const base = query ? buyersForSpecies(query) : SEAFOOD_BUYERS;
    return applyHome(base, (b) => b.province, home.province, near);
  }, [q, home.province, near]);

  return (
    <div>
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo loài: cá ngừ, tôm, mực…"
          className="min-h-[52px] w-full rounded-2xl border-0 bg-field pl-11 pr-4 text-[18px] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
      </div>
      <RefNote>
        Danh sách tham khảo từ nguồn công khai (VASEP…). Phần lớn nhà máy mua qua
        đại lý — hỏi đại lý/cảng để bán được cho họ.
      </RefNote>
      <p className="mb-2 mt-2 px-1 text-[14px] font-semibold text-foreground/55">
        {list.length} doanh nghiệp
      </p>
      <ul className="space-y-2.5">
        {list.map((b) => (
          <li key={b.id}>
            <Card className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="display text-[18px] font-bold leading-snug text-navy">
                  {b.name}
                </p>
                {b.direct && (
                  <span className="shrink-0 rounded-full bg-ok-bg px-2 py-0.5 text-[12px] font-bold text-ok">
                    Mua trực tiếp
                  </span>
                )}
              </div>
              {b.province && (
                <p className="text-[15px] font-semibold text-foreground/70">
                  {b.province}
                </p>
              )}
              <p className="mt-0.5 text-[14px] text-foreground/60">
                Loài: {b.species.join(", ")}
              </p>
              {b.markets && b.markets.length > 0 && (
                <p className="text-[14px] text-foreground/60">
                  Bán đi: {b.markets.join(", ")}
                </p>
              )}
              {b.website && (
                <a
                  href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[15px] font-bold text-sea"
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
                  <p className="text-[12px] font-bold uppercase tracking-wide text-foreground/45">
                    {typeLabel(b.type)}
                  </p>
                  <p className="display text-[18px] font-bold leading-snug text-navy">
                    {b.name}
                  </p>
                </div>
                {b.phone && (
                  <a
                    href={telHref(b.phone)}
                    className="shrink-0 text-[15px] font-bold text-sea"
                  >
                    Gọi
                  </a>
                )}
              </div>
              {b.port && (
                <p className="text-[15px] text-foreground/70">Cảng: {b.port}</p>
              )}
              {b.species && b.species.length > 0 && (
                <p className="text-[14px] text-foreground/60">
                  Hay mua: {b.species.join(", ")}
                </p>
              )}
              {b.note && (
                <p className="mt-1 rounded-xl bg-background px-3 py-1.5 text-[14px] text-foreground/70">
                  {b.note}
                </p>
              )}
              <div className="mt-2 flex gap-4 border-t border-line pt-2">
                <button
                  onClick={() => {
                    setEditing(b);
                    setShowForm(true);
                  }}
                  className="flex items-center gap-1.5 text-[15px] font-bold text-sea"
                >
                  <EditIcon className="h-4 w-4" /> Sửa
                </button>
                <button
                  onClick={() => setConfirmDel(b)}
                  className="flex items-center gap-1.5 text-[15px] font-bold text-danger"
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
            className="min-h-[60px] rounded-full bg-field text-[18px] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit">Lưu lại</PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}
