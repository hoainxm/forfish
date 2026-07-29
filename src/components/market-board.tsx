"use client";

// TIN MUA/BÁN (nhánh 2 khu GIAO DỊCH, user chốt 2026-07-27) — chủ tàu tự ĐĂNG
// tin bán (có cá cần bán) và tin mua (cần mua gì), cả làng cùng xem để gọi
// thẳng nhau. Ghi thật vào Supabase `market_listings` (RLS owner-write). Chưa
// đăng nhập / chưa cấu hình máy chủ → chỉ xem TIN MẪU, muốn đăng thì đăng nhập.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { CheckIcon, PlusIcon, TrashIcon, UsersIcon } from "@/components/icons";
import { useAuthUser } from "@/lib/use-auth";
import { formatVnDate } from "@/lib/format";
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
  const { user, ready } = useAuthUser();
  const [filter, setFilter] = useState<Filter>("all");
  const [real, setReal] = useState<MarketListing[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<MarketListing | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setReal(await fetchListings());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.id]);

  // App đã lên thật (2026-07-29): KHÔNG còn TIN MẪU — chợ rỗng thì hiện empty
  // state, tin thật hiện khi bà con đăng. real=null (chưa cấu hình/ lỗi) coi rỗng.
  const source = real ?? [];
  const listings = source.filter(
    (l) =>
      (filter === "all" || l.side === filter) &&
      (l.status === "open" || l.mine),
  );

  return (
    <div>
      <RefNote tone="var(--t2)" bg="var(--t2-bg)">
        Nơi đăng tin bán cá và tin cần mua — cả làng cùng xem, gọi thẳng nhau
        đỡ bị ép giá. Đầu nậu, vựa, nhà máy cũng đăng tin cần mua ở đây.
      </RefNote>

      <div className="my-3">
        {ready && user ? (
          <PrimaryButton onClick={() => setShowForm(true)}>
            <PlusIcon className="h-6 w-6" />
            Đăng tin mua/bán
          </PrimaryButton>
        ) : ready ? (
          <Link
            href="/login"
            className="display flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
          >
            <PlusIcon className="h-6 w-6" />
            Đăng nhập để đăng tin
          </Link>
        ) : null}
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

      {!loading && listings.length === 0 && (
        <EmptyState icon={<UsersIcon className="h-9 w-9" />}>
          Chưa có tin nào ở mục này. Bà con đăng tin đầu tiên đi.
        </EmptyState>
      )}

      <ul className="space-y-3">
        {listings.map((l) => (
          <li key={l.id}>
            <ListingCard listing={l} onDelete={() => setConfirmDel(l)} onChanged={refresh} />
          </li>
        ))}
      </ul>

      {showForm && (
        <ListingForm
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            void refresh();
          }}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title="Xóa tin này?"
          message={`Tin “${confirmDel.species}” sẽ bị gỡ khỏi chợ.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={async () => {
            await deleteListing(confirmDel.id);
            setConfirmDel(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function ListingCard({
  listing: l,
  onDelete,
  onChanged,
}: {
  listing: MarketListing;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const sell = l.side === "ban";
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold"
            style={
              sell
                ? { backgroundColor: "var(--ok-bg)", color: "var(--ok)" }
                : { backgroundColor: "var(--t2-bg)", color: "var(--t2)" }
            }
          >
            {SIDE_LABEL[l.side]}
          </span>
          <p className="mt-1 text-[0.75rem] font-bold uppercase tracking-wide text-foreground/65">
            {POSTER_KIND_LABEL[l.posterKind]}
            {l.province ? ` · ${l.province}` : ""}
          </p>
          <p className="display text-[1.1875rem] font-bold leading-snug text-navy">
            {l.species}
          </p>
        </div>
        {l.status === "closed" && (
          <span className="shrink-0 rounded-full bg-field px-2.5 py-1 text-[0.75rem] font-bold text-foreground/70">
            Đã đóng
          </span>
        )}
      </div>

      <div className="mt-2 space-y-1">
        {l.quantity && (
          <p className="text-[1rem] text-foreground/80">
            Khối lượng: <strong>{l.quantity}</strong>
          </p>
        )}
        {l.priceText && (
          <p className="text-[1rem] text-foreground/80">
            Giá: <strong>{l.priceText}</strong>
          </p>
        )}
        {l.note && (
          <p className="rounded-xl bg-background px-3 py-1.5 text-[0.9375rem] text-foreground/70">
            {l.note}
          </p>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[0.8125rem] text-foreground/65">
          {l.posterName} · đăng {formatVnDate(l.postedOn)}
        </p>
        {l.phone ? (
          <CallButton phone={l.phone} label={sell ? "Gọi hỏi mua" : "Gọi chào bán"} />
        ) : (
          <span className="shrink-0 text-[0.8125rem] font-semibold text-foreground/65">
            Tin thật sẽ có nút gọi thẳng
          </span>
        )}
      </div>

      {l.mine && (
        <div className="mt-2 flex gap-4 border-t border-line pt-2">
          <button
            onClick={async () => {
              await setListingStatus(l.id, l.status === "open" ? "closed" : "open");
              onChanged();
            }}
            className="flex items-center gap-1.5 text-[0.9375rem] font-bold text-sea"
          >
            <CheckIcon className="h-4 w-4" />
            {l.status === "open" ? "Đánh dấu đã xong" : "Mở lại tin"}
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-[0.9375rem] font-bold text-danger"
          >
            <TrashIcon className="h-4 w-4" /> Xóa
          </button>
        </div>
      )}
    </Card>
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
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [side, setSide] = useState<ListingSide>("ban");
  const [posterKind, setPosterKind] = useState<PosterKind>("ngu-dan");
  const [posterName, setPosterName] = useState("");
  const [species, setSpecies] = useState("");
  const [quantity, setQuantity] = useState("");
  const [priceText, setPriceText] = useState("");
  const [province, setProvince] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
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
    const res = await createListing(draft);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Đăng chưa được, thử lại.");
      return;
    }
    onSaved();
  }

  return (
    <BottomSheet title="Đăng tin mua/bán" onClose={onCancel}>
      <form onSubmit={submit}>
        <div className="mb-3.5">
          <span className="mb-1.5 block text-[1rem] font-bold text-navy">
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
                  className={`min-h-[3.25rem] rounded-2xl text-[1.0625rem] font-bold transition active:scale-[0.98] ${
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

        <Field label="Tên hiển thị (bắt buộc)">
          <input
            value={posterName}
            onChange={(e) => setPosterName(e.target.value)}
            className={inputClass}
            placeholder="VD: Tàu ông Bảy, Vựa cô Ba"
            required
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
        <Field label="Loài cá (bắt buộc)">
          <input
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            className={inputClass}
            placeholder="VD: cá ngừ đại dương, mực ống"
            required
          />
        </Field>
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
            placeholder="VD: 130 nghìn/kg trở lên, theo chợ"
          />
        </Field>
        <Field label="Tỉnh / bến">
          <input
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className={inputClass}
            placeholder="VD: Khánh Hòa"
          />
        </Field>
        <Field label="Số điện thoại (để trống thì lấy SĐT tài khoản)">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            inputMode="tel"
            placeholder="VD: 0901234567"
          />
        </Field>
        <Field label="Ghi chú">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="VD: cá ướp đá chuẩn, về bến sáng mai"
          />
        </Field>

        {error && (
          <p className="mb-2 rounded-xl bg-danger-bg px-3 py-2 text-[0.9375rem] font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Đang đăng…" : "Đăng tin"}
          </PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}
