export function textMatches(haystack: string, query: string): boolean {
  const variants = (value: string) => {
    const lower = value.toLocaleLowerCase("de-DE").trim();
    return [
      lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss"),
      lower.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss"),
    ];
  };
  return variants(query).some((q) => variants(haystack).some((h) => h.includes(q)));
}

export function addSearchToHistory(history: string[], query: string): string[] {
  const term = query.trim();
  if (!term) return history;
  return [term, ...history.filter((item) => item.toLocaleLowerCase("de-DE") !== term.toLocaleLowerCase("de-DE"))];
}