"use client";
import { useSyncExternalStore } from "react";
import { getSenState, subscribeSen, type SenState } from "@/lib/sen-bien-state";

const SSR: SenState = { mode: "ranh", canh: false, level: null };

/** Trạng thái Sen Biển hiện ra — một nguồn cho mọi icon (lib/sen-bien-state.ts). */
export function useSenBienState(): SenState {
  return useSyncExternalStore(subscribeSen, getSenState, () => SSR);
}
