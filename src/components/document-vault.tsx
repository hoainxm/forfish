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
  DocIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StatusBanner } from "@/components/ui/status-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { formatVnDate } from "@/lib/format";
import { saveUserJson, storageFullCopy } from "@/lib/user-store";
import { readUserList } from "@/lib/user-list-store";
import { useTodayVN } from "@/lib/use-today";
import { useBoats } from "@/components/boat-switcher";

// BoatDocument lives in @/lib/documents (shared, not edited). We attach a boat
// dimension here without touching that file: the localStorage shape is freeform
// JSON, so an extra `boatId` field rides along fine.
type StoredDocument = BoatDocument & { boatId?: string };

/*
  Tủ giấy tờ — designed for users who have never used an app like this:
  · each document is ONE card with ONE colour-coded status banner
  · the banner pairs colour with an icon + bold words (colour-blind safe)
  · add/edit happens in a bottom sheet with big inputs and two big buttons
  Tone: a filing cabinet you trust, not a sticker book — no emoji.
*/

export const DOCS_STORAGE_KEY = "forfish.documents.v1";
const STORAGE_KEY = DOCS_STORAGE_KEY;

/*
  Tủ mẫu tự xưng là mẫu (mirror crew-list 2026-06-11): lần đầu mở vẫn thấy ví dụ
  cho dễ hình dung, nhưng (1) app biết rõ đây là demo, (2) KHÔNG ghi demo xuống
  localStorage — dải "việc cần làm ngay" ngoài trang chủ không bao giờ báo đỏ vì
  giấy tờ mẫu, (3) thêm/sửa giấy thật đầu tiên là tủ mẫu tự biến mất.
  Export để checklist xuất bến dùng chung MỘT nguồn (lấy .docs).
*/
/*  BA TRẠNG THÁI, KHÔNG PHẢI HAI (sửa 2026-08-16, thẩm định P1).

    LỖI ĐÃ SỬA: `JSON.parse` ném (ghi dở lúc máy đầy / pin sập) rơi thẳng vào
    TỦ MẪU, và `JSON.parse("null")` hay `{}` thì KHÔNG ném — trả về thứ không
    phải mảng mà vẫn `isDemo: false`. Cả hai đường đều dẫn tới cùng một chỗ:
    giấy thật đầu tiên bà con nhập sau đó sẽ GHI ĐÈ lên chuỗi gốc còn cứu được.
    Trục 4 là tuân thủ — mất tủ giấy tờ là ra cảng biên phòng hỏi không có gì
    trình.

    Khuôn ba nhánh đã có sẵn ở `lib/user-list-store.ts` (dựng cho danh bạ nậu
    vựa và danh sách tàu, K4 2026-08-02) — tủ giấy tờ là chỗ bị bỏ quên. Dùng
    lại, không viết bản thứ hai. */
export function loadDocs(today: Date): {
  docs: StoredDocument[];
  isDemo: boolean;
  /** true = khoá đang giữ thứ ĐỌC KHÔNG ĐƯỢC ⇒ CẤM ghi đè, phải báo cho bà con */
  readFailed: boolean;
} {
  if (typeof window === "undefined")
    return { docs: [], isDemo: false, readFailed: false };
  const r = readUserList<StoredDocument>(STORAGE_KEY);
  if (!r.ok) {
    // Đọc hỏng: KHÔNG dựng tủ mẫu (trông y như thật) và KHÔNG mở cửa ghi.
    return { docs: [], isDemo: false, readFailed: true };
  }
  /*  MẢNG RỖNG LÀ DỮ LIỆU THẬT, KHÔNG PHẢI "CHƯA CÓ GÌ" (sửa 2026-08-18).
      LỖI ĐÃ SỬA: điều kiện cũ `r.list && r.list.length > 0` gộp `[]` chung với
      "chưa từng có khoá" ⇒ bà con xoá tờ giấy CUỐI CÙNG, app ghi `"[]"`, lần mở
      sau **tủ mẫu hiện lại như giấy thật** — và cú nhập tiếp theo ghi đè lên đó.
      Trục 4 là tuân thủ: giấy mẫu trông như giấy thật ở màn biên phòng hỏi là
      hỏng nặng. `readUserList` đã phân biệt sẵn ba nhánh, chỉ chỗ này đọc sai:
      `list === null` = chưa từng khởi tạo (mới cho dựng tủ mẫu), còn mảng —
      kể cả rỗng — là kho THẬT của bà con. */
  if (Array.isArray(r.list))
    return { docs: r.list, isDemo: false, readFailed: false };
  // Chưa từng có khoá nào trong máy → tủ mẫu (giữ nguyên hành vi cũ)
  return { docs: demoDocuments(today), isDemo: true, readFailed: false };
}

/* Trả `false` khi máy KHÔNG giữ được (hết chỗ / trình duyệt chặn) — trước đây
   nuốt im: màn hình vẫn hiện giấy vừa nhập (nằm trong bộ nhớ) mà máy chẳng lưu
   gì, mở lại app là mất, tệ hơn là rơi về TỦ MẪU trông y như thật. Dự báo tải
   sẵn nhường chỗ cho giấy tờ (lib/user-store.ts), nhường vẫn không đủ thì BÁO. */
function saveDocs(docs: StoredDocument[]): boolean {
  return saveUserJson(STORAGE_KEY, docs);
}

export function DocumentVault() {
  const { today } = useTodayVN();
  const { current, boats, ready: boatReady } = useBoats();
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);
  /** máy không giữ được giấy vừa nhập → phải nói ra, không im */
  const [saveFailed, setSaveFailed] = useState(false);
  /** tủ trong máy ĐỌC KHÔNG ĐƯỢC → cấm mọi đường ghi đè, báo đỏ */
  const [readFailed, setReadFailed] = useState(false);
  const [editing, setEditing] = useState<StoredDocument | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StoredDocument | null>(
    null,
  );

  // Hydrate from localStorage on mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    const loaded = loadDocs(today);
    setDocs(loaded.docs);
    setIsDemo(loaded.isDemo);
    setReadFailed(loaded.readFailed);
    setReady(true);
    // đọc một lần lúc mở; đổi ngày không cần đọc lại kho
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*  Tủ mẫu sống trong bộ nhớ thôi — chỉ giấy THẬT mới được ghi xuống máy.
      ĐỌC HỎNG THÌ KHÔNG GHI (2026-08-16): chuỗi gốc còn cứu được, đè lên là mất
      hẳn. Cùng luật với `saveBoats` khi `boatsReadFailed()`.
      GHI KHI BÀ CON THAO TÁC, KHÔNG GHI SAU HYDRATE (N5, audit 2026-08-18 —
      cùng khuôn crew-list/maintenance): effect cũ chạy ngay khi mở màn ⇒ máy
      đầy thì băng đỏ "CHƯA lưu được" bật dù chưa nhập gì. */
  function commit(next: StoredDocument[]) {
    setDocs(next);
    if (readFailed) return;
    setSaveFailed(!saveDocs(next));
  }

  // Xóa tàu → giấy tờ tàu đó đã bị purge khỏi máy (ba-spec 08 R3); đọc lại để
  // list đang mở bỏ theo, không tự ghi lại bản cũ.
  useEffect(() => {
    if (!ready) return;
    const loaded = loadDocs(today);
    setDocs(loaded.docs);
    setIsDemo(loaded.isDemo);
    setReadFailed(loaded.readFailed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boats.length]);

  // Only this boat's documents. Legacy items with no boatId belong to the
  // current boat for back-compat.
  const boatDocs = useMemo(
    () => docs.filter((d) => d.boatId === current?.id || d.boatId == null),
    [docs, current],
  );

  const sorted = useMemo(
    () => [...boatDocs].sort(byUrgency(today)),
    [boatDocs, today],
  );

  function upsert(doc: StoredDocument) {
    const withBoat: StoredDocument = { ...doc, boatId: current?.id };
    // Thêm/sửa giấy THẬT đầu tiên = tủ mẫu nhường chỗ luôn, không lẫn lộn.
    if (isDemo) {
      setIsDemo(false);
      commit([withBoat]);
      setShowForm(false);
      setEditing(null);
      return;
    }
    const idx = docs.findIndex((d) => d.id === withBoat.id);
    const next = [...docs];
    if (idx === -1) next.push(withBoat);
    else next[idx] = withBoat;
    commit(next);
    setShowForm(false);
    setEditing(null);
  }

  function remove(id: string) {
    const next = docs.filter((d) => d.id !== id);
    if (isDemo) setDocs(next); // xoá giấy mẫu = chỉ bỏ khỏi bộ nhớ
    else commit(next);
    setConfirmDelete(null);
  }

  return (
    <div className="px-4 pt-1">
      {/* ĐỌC KHÔNG ĐƯỢC — nói thẳng và KHOÁ cửa ghi. Thêm giấy mới lúc này là
          ghi đè lên chuỗi gốc còn cứu được, mất cả tủ. */}
      {readFailed ? (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="danger" icon={<AlertIcon className="h-5 w-5" />}>
            Tủ giấy tờ trong máy đang ĐỌC KHÔNG ĐƯỢC — giấy cũ vẫn nằm trong máy
            nhưng app chưa mở ra được. Bà con ĐỪNG nhập giấy mới ở đây (nhập là
            đè mất bản cũ); thử tắt hẳn app mở lại, hoặc phục hồi từ tệp sao lưu.
          </StatusBanner>
        </div>
      ) : (
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="display mb-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-trim-cta transition active:scale-[0.98]"
        >
          <PlusIcon className="h-6 w-6" />
          Thêm giấy tờ mới
        </button>
      )}

      {/* MÁY KHÔNG GIỮ ĐƯỢC — nói ngay, đừng để ra cảng biên phòng kiểm mới biết */}
      {saveFailed && (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="danger" icon={<AlertIcon className="h-5 w-5" />}>
            {storageFullCopy("giấy tờ vừa nhập")}
          </StatusBanner>
        </div>
      )}

      {/* Tủ mẫu phải TỰ XƯNG là mẫu (mirror crew-list) — giấy tờ mẫu trông y
          như giấy thật là kiểu nói dối nguy hiểm nhất của trục giấy tờ */}
      {ready && isDemo && (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="neutral" icon={<DocIcon className="h-5 w-5" />}>
            Đây là tủ mẫu cho bà con xem thử — chưa lưu vào máy.
          </StatusBanner>
          <button
            onClick={() => {
              setIsDemo(false);
              commit([]);
            }}
            className="flex min-h-[3.25rem] w-full items-center justify-center border-t border-line text-[1.0625rem] font-bold text-sea active:bg-background"
          >
            Xóa tủ mẫu, ghi giấy của tôi
          </button>
        </div>
      )}

      {/* KHỐI TRỐNG chỉ nói "bấm nút cam" khi NÚT ĐÓ CÒN Ở ĐÓ (2026-08-16, bắt
          được lúc kiểm trên trình duyệt thật): ca đọc-hỏng đã ẩn nút, mà câu cũ
          vẫn chỉ vào nó — bà con tìm một nút không tồn tại. Ca đó nói khác. */}
      {ready && boatReady && sorted.length === 0 && (
        <div className="rounded-[1.25rem] bg-field/70 px-4 py-12 text-center">
          <DocIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[1.125rem] text-foreground/70">
            {readFailed ? (
              <>
                Chưa mở được tủ giấy tờ trong máy.
                <br />
                Giấy cũ chưa mất — xem dải đỏ ở trên.
              </>
            ) : (
              <>
                Chưa có giấy tờ nào.
                <br />
                Bấm nút cam ở trên để thêm.
              </>
            )}
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {sorted.map((doc) => {
          const status = getExpiryStatus(doc, today);
          // thẻ MẪU không đeo băng đỏ/vàng — banner "đây là tủ mẫu" ở trên đã
          // nói rồi (T3, 2026-08-18)
          const level = isDemo
            ? ("neutral" as const)
            : status.level === "expired"
              ? ("danger" as const)
              : status.level === "soon"
                ? ("warn" as const)
                : status.level === "ok"
                  ? ("ok" as const)
                  : ("neutral" as const);
          return (
            <li
              key={doc.id}
              className="overflow-hidden surface"
            >
              {/* status banner — the first thing the eye lands on */}
              <StatusBanner
                level={level}
                icon={
                  level === "neutral" ? <DocIcon className="h-5 w-5" /> : undefined
                }
              >
                {isDemo ? `Ví dụ: ${status.label}` : status.label}
              </StatusBanner>

              <div className="px-4 py-3">
                <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
                  {kindLabel(doc.kind)}
                </p>
                <p className="display text-[1.1875rem] font-bold leading-snug text-navy">
                  {doc.label}
                </p>
                {doc.number && (
                  <p className="text-[1rem] text-foreground/70">
                    Số: {doc.number}
                  </p>
                )}
                {doc.expiresOn && (
                  <p className="text-[1rem] text-foreground/70">
                    Hết hạn: <strong>{formatVnDate(doc.expiresOn)}</strong>
                  </p>
                )}
                {doc.note && (
                  <p className="mt-1.5 rounded-xl bg-background px-3 py-1.5 text-[0.9375rem] text-foreground/70">
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
                  className="flex min-h-[3.25rem] items-center justify-center gap-2 text-[1.125rem] font-bold text-sea active:bg-background"
                >
                  <EditIcon className="h-5 w-5" />
                  Sửa
                </button>
                <button
                  onClick={() => setConfirmDelete(doc)}
                  className="flex min-h-[3.25rem] items-center justify-center gap-2 border-l border-line text-[1.125rem] font-bold text-danger active:bg-background"
                >
                  <TrashIcon className="h-5 w-5" />
                  Xóa
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="py-4 text-center text-[0.875rem] text-foreground/65">
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
  initial: StoredDocument | null;
  onCancel: () => void;
  onSave: (doc: StoredDocument) => void;
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
