"use client";

import { createContext, useContext } from "react";
import type { ActorContext } from "@/domain/types";

const ViewerContext = createContext<ActorContext | null>(null);

export function ViewerProvider({ children, viewer }: { children: React.ReactNode; viewer: ActorContext | null }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): ActorContext | null {
  return useContext(ViewerContext);
}
