export function AccountIcon({ kind }: { kind: "orders" | "bag" | "address" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "orders" ? (
        <><path d="m3 7 9-4 9 4v11l-9 4-9-4V7Z" /><path d="m3 7 9 4 9-4M12 11v11M7.5 5 17 9" /></>
      ) : kind === "bag" ? (
        <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></>
      ) : (
        <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>
      )}
    </svg>
  );
}
