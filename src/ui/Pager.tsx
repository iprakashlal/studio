import { useEffect } from "react";

/** The page of a list that is shown (kept inside the list's size as it shrinks), and the slice of it. */
export function usePage<T>(list: T[], per: number, page: number, setPage: (n: number) => void) {
  const pages = Math.max(1, Math.ceil(list.length / per)), at = Math.min(page, pages - 1);
  useEffect(() => { if (page !== at) setPage(at); }, [page, at]); // eslint-disable-line react-hooks/exhaustive-deps
  return { pages, at, slice: list.slice(at * per, at * per + per) };
}

/** Previous / Next with the numbers; shown only when there is more than one page. */
export function Pager({ page, pages, total, per, onPage, noun = "items" }: { page: number; pages: number; total: number; per: number; onPage: (n: number) => void; noun?: string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={`${noun} pages`} className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[13px]">
      <button type="button" className="btn btn-sm" disabled={page === 0} onClick={() => onPage(page - 1)}>← Previous</button>
      <span className="text-ink-400" aria-live="polite">Page {page + 1} of {pages} · {noun} {page * per + 1}–{Math.min(total, (page + 1) * per)} of {total}</span>
      <button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next →</button>
    </nav>
  );
}
