/** Star point (hoshi) coordinates for the supported board sizes. */
export function starPoints(size: number): Array<[number, number]> {
  let lines: number[] = [];
  if (size === 9) lines = [2, 6];
  else if (size === 13) lines = [3, 9];
  else if (size === 19) lines = [3, 9, 15];
  const pts: Array<[number, number]> = [];
  for (const x of lines) for (const y of lines) pts.push([x, y]);
  if (size === 9) pts.push([4, 4]);
  if (size === 13) pts.push([6, 6]);
  return pts;
}

export const COLUMN_LETTERS = "ABCDEFGHJKLMNOPQRST"; // Go skips the letter I
