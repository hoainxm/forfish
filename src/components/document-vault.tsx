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

export function DocumentVault({ supabaseReady }: { supabaseReady: boolean }) {
  const today = useMemo(() => new Date(), []);
  const [docs, setDocs] = useState<BoatDocument[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<BoatDocument | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Hydrate from localStorage on mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    setDocs(loadDocs(today));
    setReady(true);
  }, [today]);

  useEffect(() => {
    if (ready) saveDocs(docs);
  }, [docs, ready]);

  const sorted = useMemo(
    () => [...docs].sort(byUrgency(today)),
    [docs, today],
  );

  const counts = useMemo(() => {
    let expired = 0,
      soon = 0,
      ok = 0;
    for (const d of docs) {
      const lvl = getExpiryStatus(d, today).level;
      if (lvl === "expired") expired++;
      else if (lvl === "soon") soon++;
      else if (lvl === "ok") ok++;
    }
    return { expired, soon, ok };
  }, [docs, today]);

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
  }

  return (
    <div className="px-4 py-4">
      {!supabaseReady && (
        <p className="mb-3 rounded-xl bg-t3-bg px-3 py-2 text-xs text-t3">
          Chế độ thử nghiệm — dữ liệu lưu ngay trên máy bà con. Khi kết nối
          Supabase, giấy tờ sẽ được đồng bộ và nhắc qua điện thoại.
        </p>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Quá hạn" value={counts.expired} tone="danger" />
        <Stat label="Sắp hết hạn" value={counts.soon} tone="warn" />
        <Stat label="Còn hạn" value={counts.ok} tone="ok" />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500">
          Tất cả giấy tờ ({docs.length})
        </h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="rounded-full bg-t4 px-4 py-2 text-sm font-semibold text-white active:scale-95"
        >
          + Thêm
        </button>
      </div>

      {ready && docs.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-gray-400">
          Chưa có giấy tờ nào. Bấm “+ Thêm” để bắt đầu.
        </p>
      )}

      <ul className="space-y-2.5">
        {sorted.map((doc) => {
          const status = getExpiryStatus(doc, today);
          const badge =
            status.level === "expired"
              ? "bg-danger/10 text-danger"
              : status.level === "soon"
                ? "bg-warn/10 text-warn"
                : status.level === "ok"
                  ? "bg-ok/10 text-ok"
                  : "bg-gray-100 text-gray-500";
          return (
            <li
              key={doc.id}
              className="rounded-2xl border border-line bg-white p-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {kindLabel(doc.kind)}
                  </p>
                  <p className="truncate font-semibold text-navy">
                    {doc.label}
                  </p>
                  {doc.number && (
                    <p className="text-sm text-gray-500">Số: {doc.number}</p>
                  )}
                  {doc.expiresOn && (
                    <p className="text-sm text-gray-500">
                      Hết hạn: {formatVnDate(doc.expiresOn)}
                    </p>
                  )}
                  {doc.note && (
                    <p className="mt-1 text-sm text-gray-500">{doc.note}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}
                >
                  {status.label}
                </span>
              </div>
              <div className="mt-2 flex gap-4 border-t border-line pt-2 text-sm">
                <button
                  onClick={() => {
                    setEditing(doc);
                    setShowForm(true);
                  }}
                  className="font-medium text-steel"
                >
                  Sửa
                </button>
                <button
                  onClick={() => remove(doc.id)}
                  className="font-medium text-danger"
                >
                  Xóa
                </button>
              </div>
            </li>
          );
        })}
      </ul>

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
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warn" | "ok";
}) {
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "warn"
        ? "text-warn"
        : "text-ok";
  return (
    <div className="rounded-2xl border border-line bg-white py-3 text-center shadow-sm">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
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
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h3 className="mb-4 text-lg font-bold text-navy">
          {initial ? "Sửa giấy tờ" : "Thêm giấy tờ"}
        </h3>

        <Field label="Loại giấy tờ">
          <select
            value={kind}
            onChange={(e) => handleKind(e.target.value as DocumentKind)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base"
          >
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tên hiển thị">
          <input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setLabelTouched(true);
            }}
            className="w-full rounded-xl border border-line px-3 py-2.5 text-base"
            placeholder="VD: Đăng kiểm tàu cá"
          />
        </Field>

        <Field label="Số hiệu (nếu có)">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-full rounded-xl border border-line px-3 py-2.5 text-base"
            placeholder="VD: ĐK-2024-0571"
          />
        </Field>

        <Field label="Ngày hết hạn">
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className="w-full rounded-xl border border-line px-3 py-2.5 text-base"
          />
        </Field>

        <Field label="Ghi chú">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-line px-3 py-2.5 text-base"
            placeholder="VD: Liên hệ chi cục để gia hạn"
          />
        </Field>

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line py-3 font-semibold text-gray-600"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-t4 py-3 font-semibold text-white active:scale-95"
          >
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-gray-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatVnDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
