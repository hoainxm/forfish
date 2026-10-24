"use client";

/*
  TRANG NGƯỜI DÙNG `/kairos/u/[id]` — KIỂU FACEBOOK (14 §3.8, §10; AC12 · AC13 · AC15; bản
  2026-10-24 sau câu hỏi của anh Long "trang này đã đủ tương tự fb chưa").
  `[id]` = kairos_profiles.id (uuid công khai, KHÔNG SĐT); `toi` = trang của mình (hỏi /me rồi
  chuyển sang id thật).
   · Đầu trang: ẢNH BÌA (~2.6:1) + ảnh đại diện tròn đè mép dưới bìa. Chưa có ảnh ⇒ nền token +
     chữ cái đầu. Trang mình: chạm bìa/ảnh đại diện ⇒ chọn ảnh (nén image-resize ⇒ /upload ⇒
     PATCH /me), có ảnh rồi thì hỏi Đổi ảnh / Bỏ ảnh.
   · Tên + Chính thức + chấm "AI" (hồ sơ agent — isAgent, chưa bật) · dòng phụ (cảng nhà · số
     hiệu tàu khi chủ bật) · "Cùng cảng" khi cùng cảng nhà với người xem · số bài · N người theo
     dõi · M đang theo dõi (chạm ⇒ sheet danh sách) · dòng tự giới thiệu.
   · Tên còn mặc định ("Bà con 5689") + chưa đổi lần nào ⇒ mời "Bà con muốn được gọi là gì?"
     ngay trên trang (một ô + Lưu, có Để sau — nhớ trong máy `forfish.kairos.moiten.v1`).
   · Của mình: Sửa (sheet Sửa trang: tên, ảnh, số hiệu tàu, Giới thiệu) + ô "Bà con muốn chia sẻ gì?".
     Người khác: Theo dõi (một chiều, bấm lại để bỏ) + ⋯ (Chặn). KHÔNG có nút Nhắn — chưa có
     tính năng nhắn tin, không hứa thứ không có. Đã chặn ⇒ "Bạn đã chặn người này" + Bỏ chặn.
   · Thẻ Bài viết · Ảnh (lưới ảnh từ bài của chính họ) · Giới thiệu · (trang mình) Đã lưu — bài lưu MANG
     THEO trong máy, cả ảnh (14 §18, saved-posts.tsx). Mất sóng / chưa đăng nhập mà mở /kairos/u/toi ⇒ vẫn
     hiện "Đã lưu" ngay dưới câu báo (đọc trong máy, không request).
   · Mất sóng: bài của người này trong bản lưu dòng tin (chỉ chữ — lưới ảnh báo cần sóng); số
     theo dõi không hiện (bản lưu không có); nút ghi "Cần sóng".
*/

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { Tabs } from "@/components/ui/tabs";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { loadFeedCache, savedAtLabel } from "@/lib/kairos/feed-client";
import { addMoiTen, gridPhotos, MOI_TEN_KEY, ngheName, parseMoiTen, tinhName } from "@/lib/kairos/ho-so";
import { validateHandle } from "@/lib/kairos/ten-goi";
import type { KairosPost } from "@/lib/kairos/types";
import { LIMITS } from "@/lib/kairos/types";
import {
  discardUploads, EMPTY_ABOUT, errorText, kairosSend, kairosUpload, type KairosMe, type KairosUser,
} from "@/lib/kairos/write-client";
import { NHAN } from "@/lib/labels";
import { resizeForMarket } from "@/lib/market/image-resize";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";
import { FollowListSheet } from "./follow-list-sheet";
import { KairosAvatar } from "./kairos-avatar";
import { PostCard } from "./post-card";
import { PostSkeleton } from "./post-skeleton";
import { ProfileSheet } from "./profile-sheet";
import { SavedPosts } from "./saved-posts";
import { usePostActions } from "./use-post-actions";

type Load = "loading" | "ready" | "missing" | "error" | "offline" | "login";
type Page = { user: KairosUser; posts: KairosPost[]; next: string | null };
type Photo = "avatar" | "cover";

const PORT_NAME = new Map(FISHING_PORTS.map((p) => [p.id, p.name]));
/** Trường trang cá nhân khi máy chủ cũ chưa trả / dựng từ bản lưu mất sóng — mặc định an toàn. */
const USER_DEFAULTS = { about: EMPTY_ABOUT, followers: 0, followingCount: 0, samePort: false, isAgent: false, askName: false };

function readMoiTen(): string[] {
  try {
    return parseMoiTen(window.localStorage.getItem(MOI_TEN_KEY));
  } catch {
    return [];
  }
}

export function UserProfile({ id }: { id: string }) {
  const router = useRouter();
  const { phone, signedIn, ready: authReady } = useAuthUser();
  const online = useOnline();
  const [user, setUser] = useState<KairosUser | null>(null);
  const a = usePostActions({
    onPosted: () => setUser((u) => (u ? { ...u, postCount: u.postCount + 1 } : u)),
    onDeleted: () => setUser((u) => (u ? { ...u, postCount: Math.max(0, u.postCount - 1) } : u)),
  });
  const [posts, setPosts] = useState<KairosPost[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  /** user dựng từ bản lưu dòng tin (mất sóng) — không có số theo dõi / Giới thiệu */
  const [cached, setCached] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [busy, setBusy] = useState<"" | "follow" | "block" | "me">("");
  const [askBlock, setAskBlock] = useState(false);
  const [me, setMe] = useState<KairosMe | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState("bai");
  const [follows, setFollows] = useState<"followers" | "following" | null>(null);
  const [photoMenu, setPhotoMenu] = useState<Photo | null>(null);
  const [photoBusy, setPhotoBusy] = useState<Photo | null>(null);
  const [moreSheet, setMoreSheet] = useState(false);
  const [nameLater, setNameLater] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<Photo | null>(null);
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  });

  const fetchUser = useCallback(async () => {
    setLoad("loading");
    if (id === "toi") {
      if (!signedIn) {
        setLoad("login");
        return;
      }
      const r = await kairosSend<{ me: KairosMe }>("GET", "/api/kairos/me");
      if (r.ok) router.replace(`/kairos/u/${r.data.me.profileId}`);
      else setLoad(r.offline ? "offline" : "error");
      return;
    }
    const r = await kairosSend<Page>("GET", `/api/kairos/users/${encodeURIComponent(id)}`);
    setNow(Date.now());
    if (r.ok) {
      // máy chủ cũ (chưa có trường mới) ⇒ mặc định an toàn, không vỡ trang
      setUser({ ...USER_DEFAULTS, ...r.data.user });
      setPosts(r.data.posts);
      setNext(r.data.next);
      setSavedAt(null);
      setCached(false);
      setLoad("ready");
      return;
    }
    if (r.status === 404) {
      setLoad("missing");
      return;
    }
    if (r.offline) {
      const cache = loadFeedCache(phone);
      const mine = cache?.posts.filter((p) => p.author?.profileId === id) ?? [];
      const au = mine[0]?.author;
      if (au) {
        setUser(
          (u) =>
            // `mine` của bài trong bản lưu ⇒ biết đây là trang mình (hiện thẻ Đã lưu khi mất sóng)
            u ?? { ...au, ...USER_DEFAULTS, postCount: mine.length, following: false, blockedByMe: false, me: !!mine[0]?.mine },
        );
        setPosts((cur) => (cur.length ? cur : mine));
        setSavedAt(cache?.savedAt ?? null);
        if (!userRef.current) setCached(true);
      }
      setLoad("offline");
      return;
    }
    setLoad("error");
  }, [id, phone, signedIn, router]);

  useEffect(() => {
    if (authReady) void fetchUser();
  }, [authReady, fetchUser]);

  useEffect(() => {
    const on = () => {
      if (load === "offline" || load === "error") void fetchUser();
    };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [load, fetchUser]);

  // lời mời đặt tên: đã bấm "Để sau" trên máy này thì thôi
  useEffect(() => {
    if (user?.askName) setNameLater(readMoiTen().includes(user.profileId));
  }, [user?.askName, user?.profileId]);

  const loadMore = async () => {
    if (!next) return;
    setMore("loading");
    const r = await kairosSend<Page>("GET", `/api/kairos/users/${encodeURIComponent(id)}?cursor=${encodeURIComponent(next)}`);
    if (!r.ok) {
      setMore("error");
      return;
    }
    setPosts((cur) => [...cur, ...r.data.posts.filter((p) => !cur.some((x) => x.id === p.id))]);
    setNext(r.data.next);
    setMore("idle");
  };

  const applyMe = (m: KairosMe) =>
    setUser((u) =>
      u ? { ...u, handle: m.handle, avatarUrl: m.avatarUrl, subline: m.subline, boatReg: m.boatReg, about: m.about ?? u.about, askName: !!m.askName } : u,
    );

  const toggleFollow = async () => {
    if (!user) return;
    if (!signedIn) {
      a.notify("Đăng nhập để theo dõi.", true);
      return;
    }
    setBusy("follow");
    const on = !user.following;
    const r = await kairosSend(on ? "PUT" : "DELETE", `/api/kairos/follows/${user.profileId}`);
    setBusy("");
    if (!r.ok) {
      a.notify(errorText(r, "theo-doi"), true);
      return;
    }
    setUser({ ...user, following: on, followers: Math.max(0, user.followers + (on ? 1 : -1)) });
    a.notify(on ? `Đã theo dõi ${user.handle}. Bài của họ có ở chip Theo dõi.` : `Đã bỏ theo dõi ${user.handle}.`);
  };

  const setBlock = async (on: boolean) => {
    if (!user) return;
    setBusy("block");
    const r = await kairosSend(on ? "PUT" : "DELETE", `/api/kairos/blocks/${user.profileId}`);
    setBusy("");
    if (!r.ok) {
      a.notify(errorText(r, "chan"), true);
      return;
    }
    if (on) {
      setUser({ ...user, blockedByMe: true, following: false, followers: user.following ? Math.max(0, user.followers - 1) : user.followers });
      setPosts([]);
      setNext(null);
      a.notify(`Đã chặn ${user.handle}.`);
    } else {
      a.notify(`Đã bỏ chặn ${user.handle}.`);
      void fetchUser();
    }
  };

  const openEdit = async () => {
    setBusy("me");
    const r = await kairosSend<{ me: KairosMe }>("GET", "/api/kairos/me");
    setBusy("");
    if (r.ok) setMe({ ...r.data.me, about: r.data.me.about ?? EMPTY_ABOUT });
    else a.notify(errorText(r, "ten"), true);
  };

  // ── Ảnh bìa / ảnh đại diện (trang mình) ──
  const pickPhoto = (kind: Photo) => {
    if (!online) {
      a.notify("Cần sóng để đổi ảnh.", true);
      return;
    }
    pending.current = kind;
    fileRef.current?.click();
  };
  const tapPhoto = (kind: Photo) => {
    if (!user?.me || photoBusy) return;
    const has = kind === "avatar" ? user.avatarUrl : user.about.coverUrl;
    if (has) setPhotoMenu(kind);
    else pickPhoto(kind);
  };
  const savePhoto = async (kind: Photo, path: string | null) => {
    const r = await kairosSend<{ me: KairosMe }>("PATCH", "/api/kairos/me", kind === "avatar" ? { avatarPath: path } : { coverPath: path });
    if (!r.ok) {
      a.notify(errorText(r, "ho-so"), true);
      return false;
    }
    applyMe(r.data.me);
    a.notify(path ? "Đã đổi ảnh." : "Đã bỏ ảnh.");
    return true;
  };
  const onFile = async (f: File | undefined) => {
    const kind = pending.current;
    if (fileRef.current) fileRef.current.value = "";
    if (!f || !kind) return;
    setPhotoBusy(kind);
    try {
      const up = await kairosUpload(await resizeForMarket(f));
      if (!up.ok) a.notify(errorText(up, "anh"), true);
      // lưu hồ sơ hỏng ⇒ xoá ảnh vừa tải (không để mồ côi); hỏng tiếp thì agent dọn sau 24 giờ
      else if (!(await savePhoto(kind, up.data.path))) void discardUploads([up.data.path]);
    } catch (e) {
      a.notify((e as Error)?.message || "Không nén được ảnh", true);
    }
    setPhotoBusy(null);
  };
  const removePhoto = async (kind: Photo) => {
    setPhotoBusy(kind);
    await savePhoto(kind, null);
    setPhotoBusy(null);
  };

  const shown = a.view([...a.added.filter((p) => user?.me && !posts.some((x) => x.id === p.id)), ...posts]);
  const btn = "flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 font-semibold disabled:opacity-40";
  const showName = !!user?.me && user.askName && !nameLater && !cached;

  return (
    <div className="pb-6">
      <div className="space-y-3 px-4">
        {load === "offline" && user && (
          <StatusBanner level="warn">{savedAt ? `Mất sóng — bài lưu lúc ${savedAtLabel(savedAt)}` : "Mất sóng — đang xem bài đã tải"}</StatusBanner>
        )}
        {!user && load === "loading" && (
          <>
            <div aria-busy className="surface overflow-hidden">
              <div className="aspect-[2.6/1] w-full animate-pulse bg-field" />
              <div className="px-4 pb-4">
                <div className="-mt-12 h-24 w-24 rounded-full bg-field ring-4 ring-card" />
                <div className="mt-3 h-5 w-40 animate-pulse rounded bg-field" />
              </div>
            </div>
            <PostSkeleton count={2} />
          </>
        )}
        {load === "missing" && <EmptyState>Không tìm thấy người này.</EmptyState>}
        {load === "login" && (
          <EmptyState>
            <Link href="/login" className="font-semibold text-sea">
              {NHAN.dangNhap}
            </Link>{" "}
            để có trang của bạn trên Kairos.
          </EmptyState>
        )}
        {!user && load === "offline" && <EmptyState>Mất sóng. Có sóng sẽ tải.</EmptyState>}
      </div>
      {/* trang MÌNH mà chưa dựng được (mất sóng / chưa đăng nhập): bài đã lưu vẫn đọc được — nằm trong máy */}
      {!user && id === "toi" && (load === "offline" || load === "login") && (
        <section aria-label={NHAN.daLuu} className="mt-3">
          <h2 className="px-4 pb-2 text-[1.125rem] font-bold text-navy">{NHAN.daLuu}</h2>
          <SavedPosts phone={phone} now={now} actions={a.actions} view={a.view} />
        </section>
      )}
      <div className="space-y-3 px-4">
        {load === "error" && (
          <div className="surface p-4 text-center">
            <p className="mb-3">Chưa tải được trang này.</p>
            <button type="button" onClick={() => void fetchUser()} className="h-11 rounded-xl border border-line px-4 font-semibold text-sea">
              {NHAN.thuLai}
            </button>
          </div>
        )}
      </div>

      {user && (
        <>
          <section className="surface mx-4 mt-3 overflow-hidden">
            {/* ẢNH BÌA */}
            <div className="relative aspect-[2.6/1] w-full bg-sea/15">
              {user.about.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh kho kairos-media đã nén
                <img src={user.about.coverUrl} alt="" className="h-full w-full object-cover" />
              )}
              {user.me && (
                <button
                  type="button"
                  onClick={() => tapPhoto("cover")}
                  disabled={!!photoBusy}
                  aria-label={user.about.coverUrl ? "Đổi ảnh bìa" : "Thêm ảnh bìa"}
                  className="absolute inset-0 flex items-end justify-end p-2"
                >
                  <span className="flex h-9 items-center rounded-full bg-card/90 px-3 text-[0.875rem] font-semibold text-navy">
                    {photoBusy === "cover" ? NHAN.dangGui : user.about.coverUrl ? NHAN.doiAnh : NHAN.anh}
                  </span>
                </button>
              )}
            </div>

            <div className="px-4 pb-4">
              {/* ẢNH ĐẠI DIỆN đè mép dưới bìa */}
              <div className="-mt-12 mb-2 flex items-end">
                {user.me ? (
                  <button
                    type="button"
                    onClick={() => tapPhoto("avatar")}
                    disabled={!!photoBusy}
                    aria-label="Đổi ảnh đại diện"
                    className="relative rounded-full"
                  >
                    <KairosAvatar id={user.profileId} name={user.handle} url={user.avatarUrl} xl className="ring-4 ring-card" />
                    {photoBusy === "avatar" && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-navy/50 text-[0.8125rem] font-semibold text-white">
                        {NHAN.dangGui}
                      </span>
                    )}
                  </button>
                ) : (
                  <KairosAvatar id={user.profileId} name={user.handle} url={user.avatarUrl} xl className="ring-4 ring-card" />
                )}
              </div>

              <h2 className="flex items-center gap-1.5 text-[1.25rem] font-bold text-navy">
                <span className="min-w-0 truncate">{user.handle}</span>
                {user.isAgent && (
                  <span title="Trợ lý AI" className="shrink-0 rounded-full bg-navy/10 px-1.5 text-[0.6875rem] font-bold text-navy">
                    AI
                  </span>
                )}
                {user.official && <span className="shrink-0 rounded-full bg-sea/12 px-2 py-0.5 text-[0.75rem] font-bold text-sea">{NHAN.chinhThuc}</span>}
              </h2>
              {(user.subline || user.boatReg || user.samePort) && (
                <p className="flex min-w-0 items-center gap-1.5 text-[0.875rem] text-foreground/65">
                  <span className="min-w-0 truncate">{[user.subline, user.boatReg].filter(Boolean).join(" · ")}</span>
                  {user.samePort && <span className="shrink-0 rounded-full bg-ok-bg px-2 py-0.5 text-[0.75rem] font-semibold text-ok">{NHAN.cungCang}</span>}
                </p>
              )}
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.875rem] text-foreground/65">
                <span>
                  <b className="text-navy">{user.postCount}</b> bài
                </span>
                {!cached && (
                  <>
                    <button type="button" onClick={() => setFollows("followers")} className="inline-flex min-h-11 items-center">
                      <b className="mr-1 text-navy">{user.followers}</b> người theo dõi
                    </button>
                    <button type="button" onClick={() => setFollows("following")} className="inline-flex min-h-11 items-center">
                      <b className="mr-1 text-navy">{user.followingCount}</b> đang theo dõi
                    </button>
                  </>
                )}
              </p>
              {user.about.gioiThieu && <p className="mt-1 break-words text-[1rem] text-foreground">{user.about.gioiThieu}</p>}

              <div className="mt-3 flex gap-2">
                {user.me ? (
                  <button type="button" onClick={() => void openEdit()} disabled={!online || busy === "me"} className={`${btn} flex-1 border border-line text-sea`}>
                    {!online ? NHAN.canSong : busy === "me" ? NHAN.dangMo : NHAN.sua}
                  </button>
                ) : user.blockedByMe ? (
                  <button type="button" onClick={() => void setBlock(false)} disabled={!online || !!busy} className={`${btn} flex-1 border border-line text-navy`}>
                    {!online ? NHAN.canSong : busy === "block" ? NHAN.dangGui : NHAN.boChan}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void toggleFollow()}
                      disabled={!online || !!busy}
                      aria-pressed={user.following}
                      className={`${btn} flex-1 ${user.following ? "border border-sea text-sea" : "bg-sea text-white"}`}
                    >
                      {user.following && <CheckIcon className="h-5 w-5" />}
                      {!online ? NHAN.canSong : busy === "follow" ? NHAN.dangGui : NHAN.theoDoi}
                    </button>
                    {!user.official && (
                      <button
                        type="button"
                        aria-label="Thêm việc"
                        onClick={() => setMoreSheet(true)}
                        disabled={!!busy}
                        className={`${btn} w-11 border border-line px-0 text-[1.25rem] text-foreground/75`}
                      >
                        ⋯
                      </button>
                    )}
                  </>
                )}
              </div>
              {user.blockedByMe && <p className="mt-2 text-[0.875rem] text-foreground/65">Bạn đã chặn người này. Bài và bình luận của họ không hiện với bạn.</p>}
            </div>
          </section>

          {showName && (
            <NameInvite
              online={online}
              onSaved={(m) => {
                applyMe(m);
                a.notify(`Đã lưu. Bà con sẽ gọi bạn là ${m.handle}.`);
              }}
              onLater={() => {
                setNameLater(true);
                try {
                  window.localStorage.setItem(MOI_TEN_KEY, JSON.stringify(addMoiTen(readMoiTen(), user.profileId)));
                } catch {
                  // máy không ghi được ⇒ lần sau mời lại, không hỏng gì
                }
              }}
            />
          )}

          {!user.blockedByMe && (
            <Tabs
              ariaLabel="Trang người dùng"
              value={tab}
              onChange={setTab}
              tabs={[
                {
                  id: "bai",
                  label: NHAN.baiViet,
                  content: (
                    <div className="space-y-3 px-4">
                      {user.me && (
                        <button
                          type="button"
                          onClick={() => a.compose({ kind: "new" })}
                          className="surface flex h-14 w-full items-center gap-3 px-4 text-left text-[1rem] text-foreground/65 transition active:scale-[0.99]"
                        >
                          <KairosAvatar id={user.profileId} name={user.handle} url={user.avatarUrl} small />
                          Bà con muốn chia sẻ gì?
                        </button>
                      )}
                      {shown.length === 0
                        ? load === "ready" &&
                          (user.me ? (
                            <div className="surface p-4 text-center">
                              <p className="mb-3">Chưa có bài nào. Kể bà con nghe chuyến biển vừa rồi?</p>
                              <button type="button" onClick={() => a.compose({ kind: "new" })} className="h-11 rounded-xl bg-sea px-5 font-semibold text-white">
                                {NHAN.dang}
                              </button>
                            </div>
                          ) : (
                            <EmptyState>Chưa có bài.</EmptyState>
                          ))
                        : shown.map((p) => <PostCard key={p.id} post={p} now={now} actions={a.actions} />)}
                      <MoreButton next={next} more={more} onMore={() => void loadMore()} />
                    </div>
                  ),
                },
                {
                  id: "anh",
                  label: NHAN.anh,
                  content: <PhotoGrid posts={shown} profileId={user.profileId} offline={load === "offline"} next={next} more={more} onMore={() => void loadMore()} />,
                },
                {
                  id: "gioi-thieu",
                  label: NHAN.gioiThieu,
                  content: <About user={user} cached={cached} onEdit={() => void openEdit()} canEdit={online && busy !== "me"} />,
                },
                ...(user.me
                  ? [{ id: "da-luu", label: NHAN.daLuu, content: <SavedPosts phone={phone} now={now} actions={a.actions} view={a.view} /> }]
                  : []),
              ]}
            />
          )}
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

      {photoMenu && user && (
        <BottomSheet title={photoMenu === "cover" ? "Ảnh bìa" : "Ảnh đại diện"} onClose={() => setPhotoMenu(null)}>
          <div className="divide-y divide-line">
            <button
              type="button"
              className="flex min-h-14 w-full items-center rounded-xl px-3 text-left text-[1rem] font-semibold text-navy active:bg-field"
              onClick={() => {
                const k = photoMenu;
                setPhotoMenu(null);
                pickPhoto(k);
              }}
            >
              {NHAN.doiAnh}
            </button>
            <button
              type="button"
              disabled={!online}
              className="flex min-h-14 w-full items-center rounded-xl px-3 text-left text-[1rem] font-semibold text-danger active:bg-field disabled:opacity-40"
              onClick={() => {
                const k = photoMenu;
                setPhotoMenu(null);
                void removePhoto(k);
              }}
            >
              {online ? NHAN.boAnh : NHAN.canSong}
            </button>
          </div>
        </BottomSheet>
      )}
      {moreSheet && user && (
        <BottomSheet title="Thêm việc" onClose={() => setMoreSheet(false)}>
          <button
            type="button"
            disabled={!online}
            className="flex min-h-14 w-full items-center rounded-xl px-3 text-left text-[1rem] font-semibold text-danger active:bg-field disabled:opacity-40"
            onClick={() => {
              setMoreSheet(false);
              if (signedIn) setAskBlock(true);
              else a.notify("Đăng nhập để chặn.", true);
            }}
          >
            {online ? `${NHAN.chan} ${user.handle}` : NHAN.canSong}
          </button>
        </BottomSheet>
      )}
      {follows && user && <FollowListSheet profileId={user.profileId} dir={follows} onClose={() => setFollows(null)} />}
      {askBlock && user && (
        <ConfirmDialog
          title={`Chặn ${user.handle}?`}
          message="Bạn sẽ không thấy bài và bình luận của họ nữa. Hai bên tự bỏ theo dõi nhau."
          confirmLabel={NHAN.chan}
          onCancel={() => setAskBlock(false)}
          onConfirm={() => {
            setAskBlock(false);
            void setBlock(true);
          }}
        />
      )}
      {me && (
        <ProfileSheet
          me={me}
          onClose={() => setMe(null)}
          onSaved={(m) => {
            setMe(null);
            applyMe(m);
            a.notify("Đã lưu.");
          }}
        />
      )}
      {a.ui}
    </div>
  );
}

function MoreButton({ next, more, onMore }: { next: string | null; more: "idle" | "loading" | "error"; onMore: () => void }) {
  if (!next) return null;
  return (
    <button
      type="button"
      onClick={onMore}
      disabled={more === "loading"}
      className="h-11 w-full rounded-xl border border-line font-semibold text-sea disabled:opacity-40"
    >
      {more === "loading" ? NHAN.dangTai : more === "error" ? NHAN.thuLai : NHAN.xemThem}
    </button>
  );
}

/** Thẻ Ảnh — lưới 3 cột từ ảnh trong bài của chính người này; chạm ⇒ mở bài. */
function PhotoGrid({
  posts,
  profileId,
  offline,
  next,
  more,
  onMore,
}: {
  posts: readonly KairosPost[];
  profileId: string;
  offline: boolean;
  next: string | null;
  more: "idle" | "loading" | "error";
  onMore: () => void;
}) {
  const photos = gridPhotos(posts, profileId);
  // bản lưu mất sóng chỉ có chữ (imageCount) — báo cần sóng thay vì "chưa có ảnh"
  const hidden = posts.some((p) => p.author?.profileId === profileId && (p.imageCount ?? 0) > 0);
  return (
    <div className="space-y-3 px-4">
      {photos.length === 0 ? (
        <EmptyState>{offline && hidden ? "Ảnh cần sóng mới xem được." : "Chưa có ảnh."}</EmptyState>
      ) : (
        <ul className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl">
          {photos.map((ph) => (
            <li key={ph.url}>
              <Link href={`/kairos/p/${ph.postId}`} className="block aspect-square bg-field">
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh kho kairos-media đã nén */}
                <img src={ph.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <MoreButton next={next} more={more} onMore={onMore} />
    </div>
  );
}

/** Thẻ Giới thiệu — quê, cảng nhà, nghề, tàu (khi chủ bật), dòng tự giới thiệu. */
function About({ user, cached, onEdit, canEdit }: { user: KairosUser; cached: boolean; onEdit: () => void; canEdit: boolean }) {
  const ab = user.about;
  const port = ab.homePort ? `Cảng ${PORT_NAME.get(ab.homePort) ?? ab.homePort}` : user.subline;
  const rows = [
    { k: "Quê", v: tinhName(ab.queTinh) },
    { k: ab.homePort || /^cảng|^bến/iu.test(user.subline) ? "Cảng nhà" : "Cơ sở", v: port },
    { k: "Nghề", v: ngheName(ab.nghe) },
    { k: "Tàu", v: user.boatReg ?? "" },
  ].filter((r) => r.v);
  return (
    <div className="space-y-3 px-4">
      {cached ? (
        <EmptyState>Mất sóng. Có sóng sẽ xem được phần giới thiệu.</EmptyState>
      ) : rows.length === 0 && !ab.gioiThieu ? (
        user.me ? (
          <div className="surface p-4 text-center">
            <p className="mb-3">Thêm quê, cảng nhà, nghề để bà con biết bạn.</p>
            <button type="button" onClick={onEdit} disabled={!canEdit} className="h-11 rounded-xl border border-line px-5 font-semibold text-sea disabled:opacity-40">
              {NHAN.them}
            </button>
          </div>
        ) : (
          <EmptyState>Chưa có giới thiệu.</EmptyState>
        )
      ) : (
        <div className="surface p-4">
          {ab.gioiThieu && <p className="mb-3 break-words text-[1rem]">{ab.gioiThieu}</p>}
          <dl className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.k} className="flex min-h-11 items-center gap-3 py-2">
                <dt className="w-20 shrink-0 text-[0.875rem] text-foreground/65">{r.k}</dt>
                <dd className="min-w-0 flex-1 font-semibold text-navy">{r.v}</dd>
              </div>
            ))}
          </dl>
          {user.me && (
            <button type="button" onClick={onEdit} disabled={!canEdit} className="mt-3 h-11 w-full rounded-xl border border-line font-semibold text-sea disabled:opacity-40">
              {NHAN.sua}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * LỜI MỜI ĐẶT TÊN — chỉ trang mình, tên còn mặc định chưa đổi lần nào. Không bắt buộc: Để sau.
 * Kiểm ngay khi gõ bằng luật chung (ten-goi.validateHandle); trùng tên chỉ máy chủ biết.
 */
function NameInvite({ online, onSaved, onLater }: { online: boolean; onSaved: (m: KairosMe) => void; onLater: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const typed = name.trim().length > 0;
  const local = typed ? validateHandle(name) : null;
  const localErr = local && !local.ok ? errorText({ code: local.code, status: 400, offline: false }, "ten") : "";

  const save = async () => {
    if (!local?.ok || busy || !online) return;
    setBusy(true);
    setErr("");
    const r = await kairosSend<{ me: KairosMe }>("PATCH", "/api/kairos/me", { handle: name });
    setBusy(false);
    if (r.ok) onSaved({ ...r.data.me, about: r.data.me.about ?? EMPTY_ABOUT });
    else setErr(errorText(r, "ten"));
  };

  return (
    <section className="surface mx-4 mt-3 p-4">
      <label htmlFor="kairos-moi-ten" className="mb-1 block font-bold text-navy">
        Bà con muốn được gọi là gì?
      </label>
      <p className="mb-2 text-[0.875rem] text-foreground/65">Tên hiện trên bài và bình luận, thay cho tên máy đặt.</p>
      <input
        id="kairos-moi-ten"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setErr("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
        }}
        maxLength={LIMITS.handleMax + 10}
        placeholder="Vd: Tư Sa Huỳnh"
        aria-invalid={!!(localErr || err)}
        aria-describedby="kairos-moi-ten-loi"
        className={inputClass}
      />
      <p id="kairos-moi-ten-loi" role={localErr || err ? "alert" : undefined} className="mt-1 min-h-5 text-[0.8125rem] font-semibold text-danger">
        {localErr || err}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <button type="button" onClick={onLater} className="h-11 rounded-xl bg-field font-semibold text-foreground/75">
          {NHAN.deSau}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!online || busy || !local?.ok}
          aria-busy={busy}
          className="h-11 rounded-xl bg-sea font-semibold text-white disabled:opacity-40"
        >
          {!online ? NHAN.canSong : busy ? NHAN.dangGui : NHAN.luu}
        </button>
      </div>
    </section>
  );
}
