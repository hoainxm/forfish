"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BoatDocument,
  DOCUMENT_KINDS,
  DocumentKind,
  byUrgency,
  getExpiryStatus,
  kindLabel,
} from "@/lib/documents";
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  DocIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StatusBanner } from "@/components/ui/status-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass } from "@/components/ui/primitives";
import { formatVnDate } from "@/lib/format";
import { saveUserJson, storageFullCopy } from "@/lib/user-store";
import { readUserList } from "@/lib/user-list-store";
import { markLocalWrite, USER_SYNC_EVENT } from "@/lib/user-sync";
import { DocPhotoStrip } from "@/components/document-photos";
import { deleteDocPhoto } from "@/lib/doc-photos";
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
  Đọc tủ giấy tờ THẬT của user — export để checklist xuất bến dùng chung MỘT
  nguồn, không tự đọc localStorage rời rạc. KHÔNG seed demo (data giả dùng chung
  gây hiểu nhầm); rỗng → màn hình "chưa có, bấm thêm".

  HAI TRẠNG THÁI, KHÔNG PHẢI MỘT (2026-08-16, thẩm định P1).

  LỖI ĐÃ SỬA: `JSON.parse` ném (ghi dở lúc máy đầy / pin sập) rơi thẳng về tủ
  RỖNG, và `JSON.parse("null")` hay `{}` thì KHÔNG ném — trả thứ không phải mảng
  mà vẫn coi như đọc được. Cả hai đường đều dẫn tới cùng một chỗ: giấy thật đầu
  tiên bà con nhập sau đó sẽ GHI ĐÈ lên chuỗi gốc còn cứu được. Trục 4 là tuân
  thủ — mất tủ giấy tờ là ra cảng biên phòng hỏi không có gì trình.

  Khuôn ba nhánh đã có sẵn ở `lib/user-list-store.ts` (dựng cho danh bạ nậu vựa
  và danh sách tàu, K4 2026-08-02) — tủ giấy tờ là chỗ bị bỏ quên. Dùng lại,
  không viết bản thứ hai.
*/
export function loadDocs(): {
  docs: StoredDocument[];
  /** true = khoá đang giữ thứ ĐỌC KHÔNG ĐƯỢC ⇒ CẤM ghi đè, phải báo cho bà con */
  readFailed: boolean;
} {
  if (typeof window === "undefined") return { docs: [], readFailed: false };
  const r = readUserList<StoredDocument>(STORAGE_KEY);
  // Đọc hỏng: KHÔNG dựng tủ rỗng (trông y như "chưa có gì") và KHÔNG mở cửa ghi.
  if (!r.ok) return { docs: [], readFailed: true };
  return { docs: Array.isArray(r.list) ? r.list : [], readFailed: false };
}

/* Trả `false` khi máy KHÔNG giữ được (hết chỗ / trình duyệt chặn) — trước đây
   nuốt im: màn hình vẫn hiện giấy vừa nhập (nằm trong bộ nhớ) mà máy chẳng lưu
   gì, mở lại app là mất, tệ hơn là rơi về TỦ MẪU trông y như thật. Dự báo tải
   sẵn nhường chỗ cho giấy tờ (lib/user-store.ts), nhường vẫn không đủ thì BÁO. */
function saveDocs(docs: StoredDocument[]): boolean {
  const ok = saveUserJson(STORAGE_KEY, docs);
  if (ok) markLocalWrite("documents"); // đồng bộ lên server (P2 metadata, P3 ảnh)
  return ok;
}

export function DocumentVault() {
  const { today } = useTodayVN();
  const { current, boats, ready: boatReady } = useBoats();
  const [docs, setDocs] = useState<StoredDocument[]>([]);
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
  // Có sóng không — ảnh giấy tờ (P3) cần mạng để thêm/xem (signed URL). Mặc
  // định true cho SSR (khớp hydrate), client cập nhật khi mount + online/offline.
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const upd = () =>
      setOnline(typeof navigator === "undefined" || navigator.onLine);
    upd();
    window.addEventListener("online", upd);
    window.addEventListener("offline", upd);
    return () => {
      window.removeEventListener("online", upd);
      window.removeEventListener("offline", upd);
    };
  }, []);

  // Hydrate from localStorage on mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    const loaded = loadDocs();
    setDocs(loaded.docs);
    setReadFailed(loaded.readFailed);
    setReady(true);
  }, []);

  // Máy khác kéo về (lib/user-sync) → đọc lại tủ giấy tờ từ localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSync = (e: Event) => {
      if ((e as CustomEvent<{ kind?: string }>).detail?.kind !== "documents") return;
      const loaded = loadDocs();
      setDocs(loaded.docs);
      setReadFailed(loaded.readFailed);
    };
    window.addEventListener(USER_SYNC_EVENT, onSync);
    return () => window.removeEventListener(USER_SYNC_EVENT, onSync);
  }, []);

  /*  ĐỌC HỎNG THÌ KHÔNG GHI (2026-08-16): chuỗi gốc còn cứu được, đè lên là mất
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
    const loaded = loadDocs();
    setDocs(loaded.docs);
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
    const idx = docs.findIndex((d) => d.id === withBoat.id);
    const next = [...docs];
    if (idx === -1) next.push(withBoat);
    else next[idx] = withBoat;
    commit(next);
    setShowForm(false);
    setEditing(null);
  }

  function remove(id: string) {
    // Dọn ảnh giấy tờ ở Storage (best-effort, nền) trước khi bỏ giấy tờ.
    docs.find((d) => d.id === id)?.photos?.forEach((p) => void deleteDocPhoto(p));
    const next = docs.filter((d) => d.id !== id);
    commit(next);
    setConfirmDelete(null);
  }

  return (
    <div className="px-4 pt-1">
      {/* ĐỌC KHÔNG ĐƯỢC — nói thẳng và KHOÁ cửa ghi. Thêm giấy mới lúc này là
          ghi đè lên chuỗi gốc còn cứu được, mất cả tủ. */}
      {/*  MỘT HÀNG CHUẨN thay nút cam full-width (2026-08-29, luật A2/A3/B1):
          [thân cấp dữ liệu flex-1] + [ô nút w-16]. Trước: dải 343×60 ở y=263
          ăn riêng một hàng cho MỘT việc. Hàng vẫn chừa đúng ô nút khi khoá cửa
          ghi để mép phải không nhảy giữa hai trạng thái (luật 3b). */}
      <div className="mb-4 flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-4 py-3">
          <p className="text-[1rem] font-bold text-navy">
            Tủ giấy tờ · {sorted.length} giấy
          </p>
        </div>
        {readFailed ? (
          <span className="w-16 shrink-0" aria-hidden />
        ) : (
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className={`${SQ_BTN} bg-trim text-white shadow-trim-cta`}
          >
            <PlusIcon className="h-6 w-6" />
            Thêm
          </button>
        )}
      </div>

      {readFailed && (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="danger" icon={<AlertIcon className="h-5 w-5" />}>
            Tủ giấy tờ trong máy đang ĐỌC KHÔNG ĐƯỢC — giấy cũ vẫn nằm trong máy
            nhưng app chưa mở ra được. Bà con ĐỪNG nhập giấy mới ở đây (nhập là
            đè mất bản cũ); thử tắt hẳn app mở lại, hoặc phục hồi từ tệp sao lưu.
          </StatusBanner>
        </div>
      )}

      {/* MÁY KHÔNG GIỮ ĐƯỢC — nói ngay, đừng để ra cảng biên phòng kiểm mới biết */}
      {saveFailed && (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="danger" icon={<AlertIcon className="h-5 w-5" />}>
            {storageFullCopy("giấy tờ vừa nhập")}
          </StatusBanner>
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
          const level =
            status.level === "expired"
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
                {status.label}
              </StatusBanner>

              {/*  THÂN THẺ theo khuôn hàng chung (2026-08-29, luật B1): mỗi dòng
                  dữ liệu là [thân bg-background flex-1 min-w-0] + [ô nút w-16];
                  hàng không mang nút vẫn chừa đúng ô đó ⇒ mép phải thẳng. Trước:
                  hàng grid-cols-2 chỉ để chứa hai nút, tốn 52px không nội dung. */}
              <div className="space-y-1.5 p-2">
                <div className="flex items-stretch gap-2">
                  <div className="min-w-0 flex-1 rounded-2xl bg-background px-3 py-2">
                    {/*  Loại giấy chỉ in khi KHÁC tên gọi (D1): DocumentForm khởi
                        tạo label = kindLabel(kind) và giữ label bám theo kind tới
                        khi user gõ tay ⇒ MẶC ĐỊNH luôn trùng, thẻ in hai lần cùng
                        một chuỗi ("ĐĂNG KIỂM TÀU CÁ" rồi "Đăng kiểm tàu cá"). */}
                    {doc.label !== kindLabel(doc.kind) && (
                      <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
                        {kindLabel(doc.kind)}
                      </p>
                    )}
                    <p className="display break-words text-[1.125rem] font-bold leading-snug text-navy">
                      {doc.label}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditing(doc);
                      setShowForm(true);
                    }}
                    className={`${SQ_BTN} bg-background text-sea`}
                  >
                    <EditIcon className="h-6 w-6" />
                    Sửa
                  </button>
                  <button
                    onClick={() => setConfirmDelete(doc)}
                    className={`${SQ_BTN} bg-background text-danger`}
                  >
                    <TrashIcon className="h-6 w-6" />
                    Xóa
                  </button>
                </div>

                {doc.number && (
                  <div className="flex items-stretch gap-2">
                    <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
                      <p className="text-[1rem] text-foreground/70">
                        Số: {doc.number}
                      </p>
                    </div>
                    <span className="w-16 shrink-0" aria-hidden />
                  </div>
                )}
                {doc.expiresOn && (
                  <div className="flex items-stretch gap-2">
                    <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
                      <p className="text-[1rem] text-foreground/70">
                        Hết hạn: <strong>{formatVnDate(doc.expiresOn)}</strong>
                      </p>
                    </div>
                    <span className="w-16 shrink-0" aria-hidden />
                  </div>
                )}
                {doc.note && (
                  <div className="flex items-stretch gap-2">
                    <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
                      <p className="text-[0.9375rem] text-foreground/70">
                        {doc.note}
                      </p>
                    </div>
                    <span className="w-16 shrink-0" aria-hidden />
                  </div>
                )}

                {/* Ảnh chụp giấy tờ (P3) — thêm/xem cần có sóng */}
                <div className="px-1">
                  <DocPhotoStrip
                    docId={doc.id}
                    photos={doc.photos ?? []}
                    online={online}
                    onChange={(photos) => upsert({ ...doc, photos })}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/*  Bỏ dòng chân trang "Giấy tờ lưu ngay trên máy của bà con." (D1):
          không phải cấp dữ liệu, không phải dặn dò an toàn — chỉ giải thích app
          hoạt động thế nào, lại đứng cuối danh sách nên không ai đọc lúc cần.
          Chỗ đúng của nó là màn cài đặt/sao lưu. Băng đỏ đọc-hỏng / máy-hết-chỗ
          GIỮ NGUYÊN. */}

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
          message={`“${confirmDelete.label}” sẽ bị xóa khỏi hồ sơ và không thể khôi phục.`}
          cancelLabel="Không xóa"
          confirmLabel="Xác nhận xóa"
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
  /*  Hai nhóm THU LẠI mặc định (luật C1). Mở sẵn khi SỬA một giấy đã có dữ liệu
      trong nhóm đó — không giấu thứ bà con đã nhập. */
  const [showLabel, setShowLabel] = useState(false);
  const [showMore, setShowMore] = useState(
    Boolean(initial?.number || initial?.note),
  );

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
      title={initial ? "Sửa thông tin giấy tờ" : "Thêm giấy tờ mới"}
      onClose={onCancel}
    >
      <form onSubmit={submit}>
        <Field label="Loại giấy tờ">
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

        {/*  TÊN GỌI: MÁY ĐÃ BIẾT (khởi tạo kindLabel("dang_kiem"), rồi bám theo
            kind tới khi user gõ tay) ⇒ form đang hỏi thứ mình vừa tự trả lời.
            Hạ xuống MỘT DÒNG đọc-được + ô nút "Sửa" (luật C1 câu hỏi 2). */}
        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="truncate text-[1rem] text-foreground/80">
              Tên gọi:{" "}
              <span className="font-bold text-navy">
                {label.trim() || kindLabel(kind)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLabel((v) => !v)}
            className={`${SQ_BTN} bg-background text-sea`}
          >
            <EditIcon className="h-6 w-6" />
            {showLabel ? "Thu" : "Sửa"}
          </button>
        </div>
        {showLabel && (
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
        )}

        <Field label="Ngày hết hạn (ghi trên giấy)">
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className={inputClass}
          />
        </Field>

        {/*  Số giấy tờ + ghi chú: cả hai tự nhãn đã nhận là tuỳ chọn, bỏ đi vẫn
            lưu được ⇒ không phải KEY, thu sau một nút (luật C1/C2 — sheet đo
            thật 690px = 85% màn, trần ~40%). */}
        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="truncate text-[1rem] text-foreground/80">
              Số giấy:{" "}
              <span className="font-bold text-navy">
                {number.trim() || "chưa ghi"}
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
            <Field label="Số giấy tờ (không nhớ có thể bỏ qua)">
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className={inputClass}
                placeholder="VD: ĐK-2024-0571"
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
          </>
        )}

        {/* Hàng cuối theo khuôn B1 — hai ô nút inline, không dải ngang ăn hàng */}
        <div className="mt-3 flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="text-[0.9375rem] text-foreground/70">
              {expiresOn
                ? "Thông tin đã đủ để app nhắc hạn."
                : "Chưa có ngày hết hạn — ứng dụng sẽ không thể nhắc nhở giúp bà con."}
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
            className={`${SQ_BTN} bg-trim text-white shadow-trim-cta`}
          >
            <CheckIcon className="h-6 w-6" />
            Lưu
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
