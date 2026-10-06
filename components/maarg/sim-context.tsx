"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type TrafficMode = "normal" | "emergency" | "vip";
export type Overlay = null | "trace" | "architecture" | "live" | "edge-explainer" | "packet";

type SimState = {
  mode: TrafficMode;
  setMode: (m: TrafficMode) => void;
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  specId: string | null;
  openSpec: (id: string | null) => void;
  presenting: boolean;
  setPresenting: (p: boolean) => void;
};

const Ctx = createContext<SimState | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TrafficMode>("normal");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [specId, setSpecId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const openSpec = useCallback((id: string | null) => setSpecId(id), []);
  const value = useMemo(
    () => ({ mode, setMode, overlay, setOverlay, specId, openSpec, presenting, setPresenting }),
    [mode, overlay, specId, openSpec, presenting],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSim() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSim must be used inside SimProvider");
  return v;
}
