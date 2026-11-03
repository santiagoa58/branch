/** Keys for rows without ids: the text and its occurrence, so a repeated text stays distinct. */
export function keyedByText<T>(items: readonly T[], text: (item: T) => string) {
  const seen = new Map<string, number>();
  return items.map((item, index) => {
    const value = text(item);
    const count = (seen.get(value) ?? 0) + 1;
    seen.set(value, count);
    return { key: `${count}:${value}`, item, index };
  });
}
