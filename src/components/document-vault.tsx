"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BoatDocument,
  DOCUMENT_KINDS,
  DocumentKind,
  byUrgency,
  getExpiryStatus,
  kindLabel,
  kindUsuallyNoExpiry,
} from "@/lib/documents";
import {
  AlertIcon,
  ChevronDownIcon,
  DocIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { TAU_ACTION as SQ_BTN } from "@/components/tau-ui";
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
import { showsUnderBoat } from "@/lib/boats";
import { DocReminderBell } from "@/components/doc-reminder-bell";
import { NHAN } from "@/lib/labels";
import { useXoaCho } from "@/lib/xoa-cho";

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
  /** giấy đang bung chi tiết (số, ngày, ghi chú, ảnh, Sửa/Xóa) — một hàng một lúc */
  const [openId, setOpenId] = useState<string | null>(null);
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

  /*  Xoá chờ 5 s + Hoàn tác (TAU-12, lib/xoa-cho): hàng biến ngay, ghi máy sau. Ảnh trên Storage
      chỉ dọn khi ĐÃ chốt (`khiChot`) — Hoàn tác không mất ảnh. */
  const xoaCho = useXoaCho<StoredDocument>({
    list: docs,
    hien: setDocs,
    ghi: commit,
    ten: (d) => d.label,
    khiChot: (d) => d.photos?.forEach((ph) => void deleteDocPhoto(ph)),
  });

  // Xóa tàu → giấy tờ tàu đó đã bị purge khỏi máy (ba-spec 08 R3); đọc lại để
  // list đang mở bỏ theo, không tự ghi lại bản cũ.
  useEffect(() => {
    if (!ready) return;
    const loaded = loadDocs();
    setDocs(loaded.docs);
    setReadFailed(loaded.readFailed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boats.length]);

  // Only this boat's documents. Legacy items with no boatId — và mục trỏ vào
  // tàu không còn trong danh sách (showsUnderBoat) — thuộc tàu đang xem.
  const boatDocs = useMemo(() => {
    const known = boatReady ? new Set(boats.map((b) => b.id)) : null;
    return docs.filter((d) => showsUnderBoat(d.boatId, current?.id, known));
  }, [docs, current, boats, boatReady]);

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

  return (
    <div className="px-4 pt-1">
      {/* ĐỌC KHÔNG ĐƯỢC — nói thẳng và KHOÁ cửa ghi. Thêm giấy mới lúc này là
          ghi đè lên chuỗi gốc còn cứu được, mất cả tủ. */}
      {/*  MỘT HÀNG CHUẨN thay nút cam full-width (2026-08-29, luật A2/A3/B1):
          [thân cấp dữ liệu flex-1] + [ô nút w-16]. Trước: dải 343×60 ở y=263
          ăn riêng một hàng cho MỘT việc. Hàng vẫn chừa đúng ô nút khi khoá cửa
          ghi để mép phải không nhảy giữa hai trạng thái (luật 3b). */}
      <div className="tau-section-heading">
        <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-4 py-3">
          <p className="text-[1rem] font-semibold text-navy">
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
            className={`${SQ_BTN} bg-field text-navy`}
          >
            <PlusIcon className="h-6 w-6" />
            Thêm
          </button>
        )}
      </div>

      {/* Mời bật chuông nhắc hạn — chỉ khi có giấy có hạn, chưa bật, có sóng */}
      {!readFailed && (
        <DocReminderBell hasExpiring={sorted.some((d) => Boolean(d.expiresOn))} />
      )}

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
        <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
          <DocIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[1rem] text-foreground/70">
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
                Bấm “Thêm” ở trên để thêm.
              </>
            )}
          </p>
        </div>
      )}

      {/*  MỖI GIẤY MỘT HÀNG (rà design Codex lần 2, 2026-10-19): trước mỗi giấy
          là một hộp — băng trạng thái đặc trên đầu, rồi hộp nền tên + Sửa/Xóa,
          hộp số giấy, hộp ngày, hộp ghi chú (mỗi hộp chừa ô đệm w-16) ⇒ một biểu
          mẫu nhỏ rất cao chỉ để đọc vài dữ kiện. Nay: MỘT .surface kẻ mảnh; hàng =
          tên (+ loại khi khác tên) · tình trạng hạn chữ nhỏ có màu bên phải. Chạm
          ⇒ bung chi tiết ngay dưới: số, ngày cấp/hết hạn, ghi chú, ảnh, Sửa · Xóa.
          Màu tình trạng vẫn kèm CHỮ (không màu đứng một mình). */}
      {sorted.length > 0 && (
        <ul className="surface divide-y divide-line overflow-hidden">
          {sorted.map((doc) => {
            const status = getExpiryStatus(doc, today);
            const tone =
              status.level === "expired"
                ? "text-danger"
                : status.level === "soon"
                  ? "text-warn"
                  : status.level === "ok"
                    ? "text-ok"
                    : "text-foreground/65";
            const open = openId === doc.id;
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : doc.id)}
                  aria-expanded={open}
                  className="flex min-h-(--h-row) w-full items-center gap-3 px-4 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    {/*  Loại giấy chỉ in khi KHÁC tên gọi (D1): DocumentForm khởi
                        tạo label = kindLabel(kind) ⇒ mặc định trùng, in hai lần. */}
                    {doc.label !== kindLabel(doc.kind) && (
                      <span className="block text-[0.8125rem] text-foreground/60">
                        {kindLabel(doc.kind)}
                      </span>
                    )}
                    <span className="block break-words text-[1rem] font-semibold leading-snug text-navy">
                      {doc.label}
                    </span>
                    <span className={`mt-0.5 block text-[0.8125rem] leading-snug ${tone}`}>
                      {status.label}
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 text-foreground/40 transition ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open && (
                  <div className="space-y-1.5 bg-background/60 px-4 pb-3 pt-1">
                    {doc.number && (
                      <p className="text-[0.875rem] text-foreground/75">Số: {doc.number}</p>
                    )}
                    {(doc.expiresOn || doc.issuedOn) && (
                      <p className="text-[0.875rem] text-foreground/75">
                        {doc.expiresOn && (
                          <>
                            Hết hạn: <strong>{formatVnDate(doc.expiresOn)}</strong>
                          </>
                        )}
                        {doc.expiresOn && doc.issuedOn && " · "}
                        {doc.issuedOn && <>Cấp: {formatVnDate(doc.issuedOn)}</>}
                      </p>
                    )}
                    {doc.note && (
                      <p className="text-[0.875rem] text-foreground/75">{doc.note}</p>
                    )}
                    {/* Ảnh chụp giấy tờ (P3) — thêm/xem cần có sóng */}
                    <DocPhotoStrip
                      docId={doc.id}
                      photos={doc.photos ?? []}
                      online={online}
                      onChange={(photos) => upsert({ ...doc, photos })}
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => {
                          setEditing(doc);
                          setShowForm(true);
                        }}
                        className={`${SQ_BTN} bg-field text-navy`}
                      >
                        <EditIcon className="h-4 w-4" />
                        {NHAN.sua}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(doc)}
                        className={`${SQ_BTN} bg-field text-danger`}
                      >
                        <TrashIcon className="h-4 w-4" />
                        {NHAN.xoa}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/*  Bỏ dòng chân trang "Giấy tờ lưu ngay trên máy của bà con." (D1):
          không phải cấp dữ liệu, không phải dặn dò an toàn — chỉ giải thích app
          hoạt động thế nào, lại đứng cuối danh sách nên không ai đọc lúc cần.
          Chỗ đúng của nó là màn cài đặt/sao lưu. Băng đỏ đọc-hỏng / máy-hết-chỗ
          GIỮ NGUYÊN. */}

      {showForm && (
        <DocumentForm
          initial={editing}
          daCo={boatDocs.filter((d) => d.id !== editing?.id)}
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
          title="Xoá giấy tờ này?"
          message={`“${confirmDelete.label}” sẽ bị xoá khỏi hồ sơ. Có 5 giây để hoàn tác.`}
          cancelLabel={NHAN.khongXoa}
          confirmLabel={NHAN.xoa}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            xoaCho(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}

function DocumentForm({
  initial,
  daCo,
  onCancel,
  onSave,
}: {
  initial: StoredDocument | null;
  /** giấy ĐÃ CÓ trong tủ của tàu này (trừ chính giấy đang sửa) — chặn hàng rỗng + hỏi khi trùng loại (TAU-11) */
  daCo: StoredDocument[];
  onCancel: () => void;
  onSave: (doc: StoredDocument) => void;
}) {
  const [kind, setKind] = useState<DocumentKind>(initial?.kind ?? "dang_kiem");
  const [label, setLabel] = useState(initial?.label ?? kindLabel("dang_kiem"));
  const [labelTouched, setLabelTouched] = useState(Boolean(initial));
  const [number, setNumber] = useState(initial?.number ?? "");
  const [issuedOn, setIssuedOn] = useState(initial?.issuedOn ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expiresOn ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  /*  Hai nhóm THU LẠI mặc định (luật C1). Mở sẵn khi SỬA một giấy đã có dữ liệu
      trong nhóm đó — không giấu thứ bà con đã nhập. */
  const [showLabel, setShowLabel] = useState(false);
  const [showMore, setShowMore] = useState(
    Boolean(initial?.number || initial?.note || initial?.issuedOn),
  );
  /** giấy mới trùng loại với giấy đã có — đang hỏi "cập nhật giấy cũ hay thêm mới?" */
  const [hoiTrung, setHoiTrung] = useState<StoredDocument | null>(null);

  /*  KHÔNG TẠO HÀNG RỖNG (TAU-11, rà FB 2026-10-25): bấm Thêm → Lưu ngay 3 lần là 3 hàng
      "Giấy an toàn kỹ thuật · Không có hạn" y hệt. Lưu chỉ bật khi có ít nhất một thông tin
      (hạn ∨ số giấy ∨ ảnh) HOẶC loại này chưa có trong tủ của tàu (giấy không thời hạn như
      đăng ký tàu vẫn thêm được một lần). Sửa giấy cũ luôn lưu được. */
  const giayTrungLoai = daCo.find((d) => d.kind === kind) ?? null;
  const coThongTin = Boolean(expiresOn || number.trim() || initial?.photos?.length);
  const luuDuoc = Boolean(initial) || coThongTin || !giayTrungLoai;

  function handleKind(next: DocumentKind) {
    setKind(next);
    // Keep the label in sync with the kind until the user edits it by hand.
    if (!labelTouched) setLabel(kindLabel(next));
  }

  function giayTuForm(): StoredDocument {
    /*  GIỮ MỌI THỨ FORM KHÔNG SỬA (2026-10-06): bản cũ dựng object mới từ đầu
        nên bấm "Sửa → Lưu" một giấy đã có ẢNH là đường dẫn ảnh rơi mất (ảnh
        vẫn nằm ở Storage mà thẻ không còn biết) — `...initial` giữ `photos`. */
    return {
      ...initial,
      id: initial?.id ?? `doc-${Date.now()}`,
      kind,
      label: label.trim() || kindLabel(kind),
      number: number.trim() || undefined,
      issuedOn: issuedOn || undefined,
      expiresOn: expiresOn || undefined,
      note: note.trim() || undefined,
    };
  }

  /** Gọi từ Enter trong form (có event) lẫn nút Lưu ở chân ngăn (không event). */
  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!luuDuoc) return;
    const doc = giayTuForm();
    // giấy MỚI trùng loại với giấy đã có ⇒ hỏi, không lặng lẽ thêm hàng thứ hai
    if (!initial && giayTrungLoai) {
      setHoiTrung(doc);
      return;
    }
    onSave(doc);
  }

  /** "Cập nhật": ghi thông tin vừa gõ lên giấy cũ (ô bỏ trống thì giữ của giấy cũ, ảnh giữ). */
  function capNhatGiayCu(moi: StoredDocument) {
    const cu = giayTrungLoai;
    if (!cu) return onSave(moi);
    onSave({
      ...cu,
      label: labelTouched ? moi.label : cu.label,
      number: moi.number ?? cu.number,
      issuedOn: moi.issuedOn ?? cu.issuedOn,
      expiresOn: moi.expiresOn ?? cu.expiresOn,
      note: moi.note ?? cu.note,
    });
  }

  return (
    <BottomSheet
      kieu="form"
      title={initial ? "Sửa thông tin giấy tờ" : "Thêm giấy tờ mới"}
      onClose={onCancel}
      /* chân Huỷ|Lưu do ngăn vẽ (TAU-07/TAU-10); Lưu mờ khi chưa có thông tin (TAU-11) qua `dangLuu` */
      chan={{ luu: NHAN.luu, onLuu: () => submit(), dangLuu: !luuDuoc }}
    >
      <form onSubmit={submit} noValidate>
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
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            {/* tên giấy phải ĐỌC ĐƯỢC TRỌN để biết máy chọn đúng chưa — không cắt "…" (TAU-18) */}
            <p className="break-words text-[1rem] text-foreground/80">
              Tên gọi:{" "}
              <span className="font-semibold text-navy">
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
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="truncate text-[1rem] text-foreground/80">
              Số giấy:{" "}
              <span className="font-semibold text-navy">
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
                placeholder="VD: 1769/2025/GL-GPKTTS"
              />
            </Field>

            <Field label="Ngày cấp (ghi trên giấy)">
              <input
                type="date"
                value={issuedOn}
                onChange={(e) => setIssuedOn(e.target.value)}
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
          </>
        )}

        {/* câu nhắc đứng riêng, KHÔNG chen vào hàng nút (TAU-10) — Huỷ|Lưu là chân ngăn */}
        <p className="mt-3 text-[0.875rem] leading-snug text-foreground/70">
          {!luuDuoc
            ? `Tàu này đã có “${kindLabel(kind)}” — ghi hạn hoặc số giấy để thêm giấy mới.`
            : expiresOn
              ? "Thông tin đã đủ để app nhắc hạn."
              : kindUsuallyNoExpiry(kind)
                ? "Giấy này thường không thời hạn — để trống ngày hết hạn."
                : "Chưa có ngày hết hạn — ứng dụng sẽ không thể nhắc nhở giúp bà con."}
        </p>
      </form>

      {/*  TRÙNG LOẠI (TAU-11): nền/Escape/"Quay lại" = về form (không ghi gì); "Cập nhật" = ghi lên
          giấy cũ; "Thêm mới" = thêm hàng thứ hai (ca thật: giấy cũ + giấy mới cùng loại). */}
      {hoiTrung && giayTrungLoai && (
        <ConfirmDialog
          icon={<DocIcon className="h-9 w-9 text-navy" />}
          title={`Tàu này đã có “${kindLabel(kind)}”`}
          message="Cập nhật giấy cũ hay thêm giấy mới?"
          cancelLabel={NHAN.quayLai}
          confirmLabel={NHAN.capNhat}
          danger={false}
          onCancel={() => setHoiTrung(null)}
          onConfirm={() => capNhatGiayCu(hoiTrung)}
        >
          <button
            type="button"
            onClick={() => onSave(hoiTrung)}
            className="mt-3 min-h-[3.5rem] w-full rounded-2xl bg-field text-[1.125rem] font-semibold text-navy"
          >
            {NHAN.them} mới
          </button>
        </ConfirmDialog>
      )}
    </BottomSheet>
  );
}
