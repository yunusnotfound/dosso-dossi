import styles from "./citrus-art.module.css";

function OrangeSlice() {
  return (
    <svg viewBox="0 0 180 180" fill="none" aria-hidden="true">
      <circle cx="90" cy="90" r="86" className={styles.rind} />
      <circle cx="90" cy="90" r="76" className={styles.pith} />
      <circle cx="90" cy="90" r="68" className={styles.flesh} />
      {Array.from({ length: 9 }, (_, index) => (
        <g key={index} transform={`rotate(${index * 40} 90 90)`}>
          <path d="M90 28 90 84" className={styles.segment} />
          <path d="m101 38 7 16m-1-18 8 18m-4 5 7 14m-16-12 6 16" className={styles.texture} />
        </g>
      ))}
      <circle cx="90" cy="90" r="7" className={styles.pith} />
      <circle cx="90" cy="90" r="82" stroke="currentColor" strokeDasharray="1 5" opacity=".45" />
    </svg>
  );
}

/** Decorative citrus flies out from a central drink; inherits the scene motion variables. */
export function CitrusArt({ className = "" }: { className?: string }) {
  return (
    <div className={`${styles.citrus} ${className}`} aria-hidden="true">
      <span className={`${styles.slice} ${styles.first}`}><OrangeSlice /></span>
      <span className={`${styles.slice} ${styles.second}`}><OrangeSlice /></span>
      <span className={`${styles.slice} ${styles.third}`}><OrangeSlice /></span>
      <span className={styles.peel}>
        <svg viewBox="0 0 300 360" fill="none">
          <path d="M197 13C102 8 100 60 188 79c100 22 43 75-39 64-80-11-114 34-34 66 104 42 12 57-65 49-64-7-43 67 35 83" className={styles.peelEdge} />
          <path d="M197 13C102 8 100 60 188 79c100 22 43 75-39 64-80-11-114 34-34 66 104 42 12 57-65 49-64-7-43 67 35 83" className={styles.peelInner} />
          <path d="M197 8C110 3 107 55 188 74M149 138c-80-11-114 34-34 66M50 253c-64-7-43 67 35 83" className={styles.peelShine} />
        </svg>
      </span>
      <i className={`${styles.zest} ${styles.zestOne}`} />
      <i className={`${styles.zest} ${styles.zestTwo}`} />
      <i className={`${styles.zest} ${styles.zestThree}`} />
    </div>
  );
}
