"use client";

/*
  TRANG NGƯỜI DÙNG `/kairos/u/[id]` (14 §3.8, §10; AC12 · AC13 · AC15).
  `[id]` = kairos_profiles.id (uuid công khai, KHÔNG SĐT); `toi` = trang của mình (hỏi /me rồi
  chuyển sang id thật).
   · Ảnh, tên gọi, dấu Chính thức, dòng phụ (cảng nhà · số hiệu tàu khi chủ bật), số bài.
   · Người khác: Theo dõi (một chiều, không cần duyệt — bấm lại để bỏ) · Chặn (xác nhận).
     Đã chặn ⇒ "Bạn đã chặn người này" + Bỏ chặn, không hiện bài.
   · Của mình: Sửa ⇒ sheet "Tên trên Kairos".
   · Mất sóng: bài của người này trong bản lưu dòng tin; nút ghi "Cần sóng".
*/

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { loadFeedCache, savedAtLabel } from "@/lib/kairos/feed-client";
import type { KairosPost } from "@/lib/kairos/types";
import { errorText, kairosSend, type KairosMe, type KairosUser } from "@/lib/kairos/write-client";
import { NHAN } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";
import { KairosAvatar } from "./kairos-avatar";
import { PostCard } from "./post-card";
import { PostSkeleton } from "./post-skeleton";
import { ProfileSheet } from "./profile-sheet";
import { usePostActions } from "./use-post-actions";

type Load = "loading" | "ready" | "missing" | "error" | "offline" | "login";
type Page = { user: KairosUser; posts: KairosPost[]; next: string | null };

export function UserProfile({ id }: { id: string }) {
  const router = useRouter();
  const { phone, signedIn, ready: authReady } = useAuthUser();
  const online = useOnline();
  const a = usePostActions();
  const [user, setUser] = useState<KairosUser | null>(null);
  const [posts, setPosts] = useState<KairosPost[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [busy, setBusy] = useState<"" | "follow" | "block" | "me">("");
  const [askBlock, setAskBlock] = useState(false);
  const [me, setMe] = useState<KairosMe | null>(null);
  const [now, setNow] = useState(() => Date.now());

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
      setUser(r.data.user);
      setPosts(r.data.posts);
      setNext(r.data.next);
      setSavedAt(null);
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
        setUser((u) => u ?? { ...au, postCount: mine.length, following: false, blockedByMe: false, me: false });
        setPosts((cur) => (cur.length ? cur : mine));
        setSavedAt(cache?.savedAt ?? null);
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
    setUser({ ...user, following: on });
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
      setUser({ ...user, blockedByMe: true, following: false });
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
    if (r.ok) setMe(r.data.me);
    else a.notify(errorText(r, "ten"), true);
  };

  const shown = a.view([...a.added.filter((p) => user?.me && !posts.some((x) => x.id === p.id)), ...posts]);
  const btn = "flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 font-semibold disabled:opacity-40";

  return (
    <div className="space-y-3 px-4 pb-6">
      {load === "offline" && user && (
        <StatusBanner level="warn">{savedAt ? `Mất sóng — bài lưu lúc ${savedAtLabel(savedAt)}` : "Mất sóng — đang xem bài đã tải"}</StatusBanner>
      )}
      {!user && load === "loading" && <PostSkeleton count={2} />}
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
      {load === "error" && (
        <div className="surface p-4 text-center">
          <p className="mb-3">Chưa tải được trang này.</p>
          <button type="button" onClick={() => void fetchUser()} className="h-11 rounded-xl border border-line px-4 font-semibold text-sea">
            {NHAN.thuLai}
          </button>
        </div>
      )}

      {user && (
        <>
          <section className="surface p-4">
            <div className="flex items-center gap-4">
              <KairosAvatar id={user.profileId} name={user.handle} url={user.avatarUrl} large />
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-1.5 text-[1.25rem] font-bold text-navy">
                  <span className="min-w-0 truncate">{user.handle}</span>
                  {user.official && <span className="shrink-0 rounded-full bg-sea/12 px-2 py-0.5 text-[0.75rem] font-bold text-sea">{NHAN.chinhThuc}</span>}
                </h2>
                {(user.subline || user.boatReg) && (
                  <p className="truncate text-[0.875rem] text-foreground/65">{[user.subline, user.boatReg].filter(Boolean).join(" · ")}</p>
                )}
                <p className="text-[0.875rem] text-foreground/65">{user.postCount} bài</p>
              </div>
            </div>
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
                        onClick={() => (signedIn ? setAskBlock(true) : a.notify("Đăng nhập để chặn.", true))}
                        disabled={!online || !!busy}
                        className={`${btn} border border-line text-foreground/75`}
                      >
                        {NHAN.chan}
                      </button>
                    )}
                  </>
              )}
            </div>
            {user.blockedByMe && <p className="mt-2 text-[0.875rem] text-foreground/65">Bạn đã chặn người này. Bài và bình luận của họ không hiện với bạn.</p>}
          </section>

          {!user.blockedByMe &&
            (shown.length === 0 ? (
              load === "ready" && <EmptyState>Chưa có bài.</EmptyState>
            ) : (
              shown.map((p) => <PostCard key={p.id} post={p} now={now} actions={a.actions} />)
            ))}
          {next && !user.blockedByMe && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={more === "loading"}
              className="h-11 w-full rounded-xl border border-line font-semibold text-sea disabled:opacity-40"
            >
              {more === "loading" ? NHAN.dangTai : more === "error" ? NHAN.thuLai : NHAN.xemThem}
            </button>
          )}
        </>
      )}

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
            setUser((u) => (u ? { ...u, handle: m.handle, avatarUrl: m.avatarUrl, subline: m.subline, boatReg: m.boatReg } : u));
            a.notify("Đã lưu.");
          }}
        />
      )}
      {a.ui}
    </div>
  );
}
