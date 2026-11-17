"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { TraderCopy } from "@/lib/business/traderPresentation";
import styles from "./traders.module.css";

export function TraderResources({ copy }: { copy: TraderCopy }) {
  const [done, setDone] = useState<number[]>([]);
  const stages = [[copy.toolsStageOne, copy.toolsStageOneBody], [copy.toolsStageTwo, copy.toolsStageTwoBody], [copy.toolsStageThree, copy.toolsStageThreeBody], [copy.toolsStageFour, copy.toolsStageFourBody]];
  const templates = [
    { label: copy.toolsLeadSheet, name: "customer-visits", columns: [copy.name, copy.toolsState, copy.toolsCustomers, copy.toolsQuoteProduct, copy.toolsTimeline, copy.note] },
    { label: copy.toolsTastingSheet, name: "sample-evaluation", columns: [copy.toolsProduct, copy.toolsVariant, copy.toolsIngredients, copy.toolsNotes, copy.note] },
    { label: copy.toolsStockSheet, name: "stock-reorder", columns: [copy.toolsProduct, copy.toolsVariant, copy.toolsInventory, copy.toolsSales, copy.toolsTimeline, copy.note] },
  ];
  function download(name: string, content: string, type = "text/csv;charset=utf-8") {
    const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `teafloww-${name}`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <section id="trader-resources" className={`${styles.section} ${styles.resources}`}><div className={styles.resourceLayout}><div><h2>{copy.toolsResourcesTitle}</h2><p className={styles.sectionIntro}>{copy.toolsResourcesBody}</p><div className={styles.downloads}>{templates.map(template => <button className={styles.textLink} type="button" key={template.name} onClick={() => download(`${template.name}.csv`, `${template.columns.map(column => `"${column.replaceAll('"', '""')}"`).join(",")}\r\n`)}><Download size={18} aria-hidden="true" />{template.label}</button>)}</div></div><div><h3>{copy.toolsRoadmapTitle}</h3><p className={styles.fine}>{copy.toolsRoadmapIntro}</p><ol className={styles.roadmap}>{stages.map(([title, body], index) => <li key={title}><label><input type="checkbox" checked={done.includes(index)} onChange={event => setDone(previous => event.target.checked ? [...previous, index] : previous.filter(item => item !== index))} /><span><strong>{title}</strong><span>{body}</span></span></label></li>)}</ol><p role="status">{done.length} / 4</p><button type="button" className={styles.outline} onClick={() => download("preparation-checklist.txt", `${copy.toolsRoadmapTitle}\n\n${stages.map(([title, body], index) => `${done.includes(index) ? "[x]" : "[ ]"} ${title}\n${body}`).join("\n\n")}\n\n${copy.toolsRoadmapIntro}`, "text/plain;charset=utf-8")}><Download size={16} aria-hidden="true" />{copy.toolsDownload}</button></div></div></section>;
}

export function TraderHelp({ copy }: { copy: TraderCopy }) {
  const [query, setQuery] = useState("");
  const questions = [[copy.faqOneQ, copy.faqOneA], [copy.faqTwoQ, copy.faqTwoA], [copy.faqThreeQ, copy.faqThreeA], [copy.toolsFaqMarginQ, copy.toolsFaqMarginA], [copy.toolsFaqFreightQ, copy.toolsFaqFreightA], [copy.toolsFaqPaymentQ, copy.toolsFaqPaymentA], [copy.toolsFaqSamplesQ, copy.toolsFaqSamplesA]];
  const results = questions.filter(question => question.join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section id="faq" className={`${styles.section} ${styles.faq}`}><h2>{copy.faqTitle}</h2><label className={styles.faqSearch}>{copy.toolsFaqSearch}<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>{!results.length && <p role="status">{copy.toolsFaqEmpty}</p>}{results.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>;
}
