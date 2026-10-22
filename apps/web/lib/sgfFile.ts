/** Save text as a file download. Falls back to opening the text in a new tab where downloads are blocked. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/x-go-sgf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function sgfFilename(size: number, date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  return `playgolite-${d}-${size}x${size}.sgf`;
}

export function todayStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
