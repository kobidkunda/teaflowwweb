"use client";

import React, { createContext, useContext, useMemo } from "react";
import { makeTr, type TextDict } from "@/lib/business/sourceKey";

const Ctx = createContext<TextDict | null>(null);

/** Server components pass the published `starter` texts for the current locale. */
export function BusinessI18nProvider({ dict, children }: { dict: TextDict | null; children: React.ReactNode }) {
  return <Ctx.Provider value={dict}>{children}</Ctx.Provider>;
}

/** Client components: `const t = useTr(); t("English source")`. */
export function useTr() {
  const dict = useContext(Ctx);
  return useMemo(() => makeTr(dict), [dict]);
}
