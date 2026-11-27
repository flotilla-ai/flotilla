/** Click toggles one id; shift-click selects every id between the anchor and the target in list order. */
export function selectRange(order: string[], selected: Set<string>, anchor: string | null, target: string, shift: boolean): Set<string> {
  const next = new Set(selected);
  const a = anchor ? order.indexOf(anchor) : -1; const b = order.indexOf(target);
  if (!shift || a < 0 || b < 0) { if (next.has(target)) next.delete(target); else next.add(target); return next; }
  for (const id of order.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(id);
  return next;
}
