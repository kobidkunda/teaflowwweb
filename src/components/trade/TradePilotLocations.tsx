"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import type { TradeSharedPilotRecord } from "@/lib/trade/catalogue";
import { publicTradePilots } from "@/lib/trade/publicPilots";
import { tradeText } from "@/lib/trade/copy";
import styles from "./trade.module.css";
import ui from "./ritual.module.css";

export function TradePilotLocations({ pilots, dict, onEnquire }: {
  pilots: TradeSharedPilotRecord[];
  dict: Record<string, string>;
  onEnquire: () => void;
}) {
  const locations = publicTradePilots(pilots);
  if (!locations.length) return null;
  return <section className={ui.pilotSection} aria-labelledby="pilotLocationsHeading">
    <div className={`${styles.wrap} ${ui.pilotLayout}`}>
      <div className={ui.pilotIntro}>
        <h2 id="pilotLocationsHeading">{tradeText(dict, "ui.pilotTitle")}</h2>
        <p>{tradeText(dict, "ui.pilotBody")}</p>
        <button type="button" className={ui.pilotAction} onClick={onEnquire}>
          {tradeText(dict, "ui.pilotEnquire")} <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      <ul className={ui.pilotList}>
        {locations.map((pilot) => <li key={pilot.id}>
          <h3>{pilot.town_name}</h3>
          <p className={ui.pilotPoint}>{pilot.collection_point}</p>
          <p>{pilot.collection_address}</p>
        </li>)}
      </ul>
    </div>
  </section>;
}
