"use client";

import { createContext, useContext } from "react";

export type WallContextMenuRequestFn = (
  clientX: number,
  clientY: number,
  objectId?: string,
) => void;

const WallContextMenuRequestContext = createContext<WallContextMenuRequestFn | null>(null);

export function WallContextMenuProvider({
  value,
  children,
}: {
  value: WallContextMenuRequestFn | null;
  children: React.ReactNode;
}) {
  return (
    <WallContextMenuRequestContext.Provider value={value}>
      {children}
    </WallContextMenuRequestContext.Provider>
  );
}

export function useWallContextMenuRequest() {
  return useContext(WallContextMenuRequestContext);
}
