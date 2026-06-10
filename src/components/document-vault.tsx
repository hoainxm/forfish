"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BoatDocument,
  DOCUMENT_KINDS,
  DocumentKind,
  byUrgency,
  demoDocuments,
  getExpiryStatus,
  kindLabel,
} from "@/lib/documents";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  DocIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { formatVnDate } from "@/lib/format";

/*
  Tủ giấy tờ — designed for users who have never used an app like this:
  · each document is ONE card with ONE colour-coded status banner
  · the banner pairs colour with an icon + bold words (colour-blind safe)
  · add/edit happens in a bottom sheet with big inputs and two big buttons
  Tone: a filing cabinet you trust, not a sticker book — no emoji.
*/

const STORAGE_KEY = "forfish.documents.v1";

function loadDocs(today: Date): BoatDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BoatDocument[];
  } catch {
    // corrupt storage — fall through to demo seed
  }
  return demoDocuments(today);
}

function saveDocs(docs: BoatDocument[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch {
    // storage full / disabled — keep working in-memory
  }
}

export function DocumentVault() {
  const today = useMemo(() => new Date(), []);
  const [docs, setDocs] = useState<BoatDocument[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<BoatDocument | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BoatDocument | null>(null);

  // Hydrate from localStorage on mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    setDocs(loadDocs(today));
    setReady(true);
  }, [today]);

  useEffect(() => {
    if (ready) saveDocs(docs);
  }, [docs, ready]);

  const sorted = useMemo(() => [...docs].sort(byUrgency(today)), [docs, today]);

  function upsert(doc: BoatDocument) {
    setDocs((prev) => {
      const idx = prev.findIndex((d) => d.id === doc.id);
      if (idx === -1) return [...prev, doc];
      const next = [...prev];
      next[idx] = doc;
      return next;
    });
    setShowForm(false);
    setEditing(null);
  }

  function remove(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setConfirmDelete(null);
  }

  return (
    <div className="px-4 pt-1">
      <button
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="display mb-4 flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-xl bg-trim text-[19px] font-bold text-white shadow-sm transition active:scale-[0.98]"
      >
        <PlusIcon className="h-6 w-6" />
        Thêm giấy tờ mới
      </button>

      {ready && docs.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-line bg-card px-4 py-12 text-center">
          <DocIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[17px] text-foreground/60">
            Chưa có giấy tờ nào.
            <br />
            Bấm nút cam ở trên để thêm.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {sorted.map((doc) => {
          const status = getExpiryStatus(doc, today);
          const pill =
            status.level === "expired"
              ? { bg: "var(--danger-bg)", fg: "var(--danger)", Icon: AlertIcon }
              : status.level === "soon"
                ? { bg: "var(--warn-bg)", fg: "var(--warn)", Icon: ClockIcon }
                : status.level === "ok"
                  ? { bg: "var(--ok-bg)", fg: "var(--ok)", Icon: CheckIcon }
                  : {
                      bg: "var(--background)",
                      fg: "var(--foreground)",
                      Icon: DocIcon,
                    };
          return (
            <li
              key={doc.id}
              className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-line"
            >
              {/* status banner — the first thing the eye lands on */}
              <p
                className="flex items-center gap-2 px-4 py-2.5 text-[16px] font-bold"
                style={{ backgroundColor: pill.bg, color: pill.fg }}
              >
                <pill.Icon className="h-5 w-5 shrink-0" />
                {status.label}
              </p>

              <div className="px-4 py-3">
                <p className="text-[13px] font-bold uppercase tracking-wide text-foreground/40">
                  {kindLabel(doc.kind)}
                </p>
                <p className="display text-[19px] font-bold leading-snug text-navy">
                  {doc.label}
                </p>
                {doc.number && (
                  <p className="text-[16px] text-foreground/60">
                    Số: {doc.number}
                  </p>
                )}
                {doc.expiresOn && (
                  <p className="text-[16px] text-foreground/60">
                    Hết hạn: <strong>{formatVnDate(doc.expiresOn)}</strong>
                  </p>
                )}
                {doc.note && (
                  <p className="mt-1.5 rounded-lg bg-background px-3 py-1.5 text-[15px] text-foreground/70">
                    {doc.note}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 border-t border-line">
                <button
                  onClick={() => {
                    setEditing(doc);
                    setShowForm(true);
                  }}
                  className="flex min-h-[52px] items-center justify-center gap-2 text-[17px] font-bold text-sea active:bg-background"
                >
                  <EditIcon className="h-5 w-5" />
                  Sửa
                </button>
                <button
                  onClick={() => setConfirmDelete(doc)}
                  className="flex min-h-[52px] items-center justify-center gap-2 border-l border-line text-[17px] font-bold text-danger active:bg-background"
                >
                  <TrashIcon className="h-5 w-5" />
                  Xóa
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="py-4 text-center text-[14px] text-foreground/40">
        Giấy tờ lưu ngay trên máy của bà con.
      </p>

      {showForm && (
        <DocumentForm
          initial={editing}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={upsert}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title="Xóa giấy tờ này?"
          message={`“${confirmDelete.label}” sẽ bị xóa, không lấy lại được.`}
          cancelLabel="Không xóa"
          confirmLabel="Xóa luôn"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete.id)}
        />
      )}
    </div>
  );
}

function DocumentForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: BoatDocument | null;
  onCancel: () => void;
  onSave: (doc: BoatDocument) => void;
}) {
  const [kind, setKind] = useState<DocumentKind>(initial?.kind ?? "dang_kiem");
  const [label, setLabel] = useState(initial?.label ?? kindLabel("dang_kiem"));
  const [labelTouched, setLabelTouched] = useState(Boolean(initial));
  const [number, setNumber] = useState(initial?.number ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expiresOn ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  function handleKind(next: DocumentKind) {
    setKind(next);
    // Keep the label in sync with the kind until the user edits it by hand.
    if (!labelTouched) setLabel(kindLabel(next));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      id: initial?.id ?? `doc-${Date.now()}`,
      kind,
      label: label.trim() || kindLabel(kind),
      number: number.trim() || undefined,
      expiresOn: expiresOn || undefined,
      note: note.trim() || undefined,
    });
  }

  return (
    <BottomSheet
      title={initial ? "Sửa giấy tờ" : "Thêm giấy tờ"}
      onClose={onCancel}
    >
      <form onSubmit={submit}>
        <Field label="Đây là giấy gì?">
          <select
            value={kind}
            onChange={(e) => handleKind(e.target.value as DocumentKind)}
            className={inputClass}
          >
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tên gọi (để bà con dễ nhớ)">
          <input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setLabelTouched(true);
            }}
            className={inputClass}
            placeholder="VD: Đăng kiểm tàu cá"
          />
        </Field>

        <Field label="Số giấy tờ (không nhớ thì bỏ qua)">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className={inputClass}
            placeholder="VD: ĐK-2024-0571"
          />
        </Field>

        <Field label="Ngày hết hạn (ghi trên giấy)">
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Ghi chú thêm">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="VD: Liên hệ chi cục để gia hạn"
          />
        </Field>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[60px] rounded-lg border-2 border-line text-[18px] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit">Lưu lại</PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}
