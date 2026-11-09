"use client";

import React, { useState } from "react";
import Image from "next/image";
import styles from "./TeaMoments.module.css";

export function TeaMomentsImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <figure className={styles.image}>
    <Image src={url} alt={alt} width={1200} height={1500} sizes="(max-width: 767px) 100vw, 45vw"
      unoptimized={url.startsWith("/uploads/")} onError={() => setFailed(true)} />
    <figcaption>{alt}</figcaption>
  </figure>;
}
