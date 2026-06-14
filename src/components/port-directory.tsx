"use client";

import { useMemo, useState } from "react";
import { ACTIVE_PORTS, PORT_CLASS_LABEL } from "@/data/fishing-ports";
import { Card, RefNote } from "@/components/ui/primitives";
import { useHome, HomeBar, applyHome } from "@/components/ui/region-filter";
import { AnchorIcon, PinIcon, SearchIcon } from "@/components/icons";

/*
  Danh bạ cảng cá chỉ định — 172 cảng (nguồn chính thức). Lọc theo tỉnh nhà
  để chỉ hiện cảng GẦN tàu của bà con; tìm theo tên; bấm xem địa chỉ.
*/
export function PortDirectory() {
  const { home } = useHome();
  const [near, setNear] = useState(true);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const byHome = applyHome(ACTIVE_PORTS, (p) => p.province, home.province, near);
    const query = q.trim().toLowerCase();
    if (!query) return byHome;
    return byHome.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.province ?? "").toLowerCase().includes(query),
    );
  }, [home.province, near, q]);

  return (
    <div className="px-4">
      <HomeBar home={home} near={near} setNear={setNear} />

      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/65" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm cảng theo tên…"
          className="min-h-[3.25rem] w-full rounded-2xl border-0 bg-field pl-11 pr-4 text-[1.125rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
      </div>

      <RefNote tone="var(--t3)" bg="var(--t3-bg)">
        Cảng cá chỉ định để bốc dỡ, bán cá, làm thủ tục. Nguồn chính thức,
        cập nhật theo công bố của tỉnh.
      </RefNote>

      <p className="mb-2 mt-2 px-1 text-[0.875rem] font-semibold text-foreground/70">
        {list.length} cảng{home.province && near ? ` gần ${home.province}` : ""}
      </p>

      <ul className="space-y-2.5">
        {list.map((p) => (
          <li key={p.id}>
            <Card className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="display flex min-w-0 items-center gap-2 text-[1.125rem] font-bold leading-snug text-navy">
                  <AnchorIcon className="h-5 w-5 shrink-0 text-t3" />
                  {p.name}
                </p>
                {p.klass && (
                  <span className="shrink-0 rounded-full bg-t3-bg px-2 py-0.5 text-[0.75rem] font-bold text-t3">
                    {PORT_CLASS_LABEL[p.klass]}
                  </span>
                )}
              </div>
              {p.province && (
                <p className="text-[0.9375rem] font-semibold text-foreground/70">
                  {p.province}
                </p>
              )}
              {p.address && (
                <p className="mt-0.5 flex gap-1.5 text-[0.9375rem] text-foreground/65">
                  <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground/65" />
                  <span>{p.address}</span>
                </p>
              )}
            </Card>
          </li>
        ))}
        {list.length === 0 && (
          <p className="rounded-[1.25rem] bg-field/70 py-10 text-center text-[1rem] text-foreground/70">
            Không có cảng phù hợp. Thử bỏ “Chỉ gần tôi” hoặc đổi tỉnh.
          </p>
        )}
      </ul>
    </div>
  );
}
