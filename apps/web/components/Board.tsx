"use client";

import type { Cell, GameState } from "@playgolite/engine";
import { COLUMN_LETTERS, starPoints } from "../lib/geometry";

const CELL = 40;
const MARGIN = 30;

interface BoardProps {
  state: GameState;
  /** A stone the player has tapped but not yet confirmed. */
  pending: { x: number; y: number } | null;
  /** Point index of a ko point that cannot be played right now. */
  koPoint: number | null;
  /** In the scoring phase: owner of each point, 0 = neutral. */
  territory: readonly Cell[] | null;
  showCoordinates: boolean;
  onPoint: (x: number, y: number) => void;
}

export function Board({ state, pending, koPoint, territory, showCoordinates, onPoint }: BoardProps) {
  const size = state.size;
  const span = (size - 1) * CELL;
  const total = span + MARGIN * 2;
  const px = (i: number) => MARGIN + i * CELL;

  const last = state.moves[state.moves.length - 1];
  const lastPlay = last && last.move.kind === "play" ? last.move : null;
  const dead = new Set(state.dead);
  const stoneR = CELL * 0.47;

  const lines: React.ReactElement[] = [];
  for (let i = 0; i < size; i++) {
    lines.push(
      <line key={`h${i}`} x1={px(0)} y1={px(i)} x2={px(size - 1)} y2={px(i)} />,
      <line key={`v${i}`} x1={px(i)} y1={px(0)} x2={px(i)} y2={px(size - 1)} />,
    );
  }

  const stones: React.ReactElement[] = [];
  const territoryMarks: React.ReactElement[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const c = state.board[i];
      if (c === 1 || c === 2) {
        const isDead = dead.has(i);
        stones.push(
          <circle
            key={`s${i}`}
            cx={px(x)}
            cy={px(y)}
            r={stoneR}
            fill={c === 1 ? "var(--stone-black)" : "var(--stone-white)"}
            stroke={c === 2 ? "var(--stone-white-edge)" : "none"}
            strokeWidth={1.5}
            opacity={isDead ? 0.35 : 1}
          />,
        );
      } else if (territory && territory[i]) {
        const o = territory[i];
        territoryMarks.push(
          <rect
            key={`t${i}`}
            x={px(x) - 6}
            y={px(y) - 6}
            width={12}
            height={12}
            rx={2}
            fill={o === 1 ? "var(--stone-black)" : "var(--stone-white)"}
            stroke={o === 2 ? "var(--stone-white-edge)" : "none"}
            opacity={0.85}
          />,
        );
      }
    }
  }
  // Territory also marks removed dead stones' points, drawn over the faded stone.
  if (territory) {
    for (const d of dead) {
      const o = territory[d];
      if (!o) continue;
      const x = d % size;
      const y = Math.floor(d / size);
      territoryMarks.push(
        <rect
          key={`td${d}`}
          x={px(x) - 6}
          y={px(y) - 6}
          width={12}
          height={12}
          rx={2}
          fill={o === 1 ? "var(--stone-black)" : "var(--stone-white)"}
          stroke={o === 2 ? "var(--stone-white-edge)" : "#000"}
          strokeWidth={o === 2 ? 1 : 0}
        />,
      );
    }
  }

  const targets: React.ReactElement[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      targets.push(
        <rect
          key={`p${x}-${y}`}
          x={px(x) - CELL / 2}
          y={px(y) - CELL / 2}
          width={CELL}
          height={CELL}
          fill="transparent"
          onClick={() => onPoint(x, y)}
          style={{ cursor: "pointer" }}
        />,
      );
    }
  }

  return (
    <div className="board-wrap">
      <svg
        viewBox={`0 0 ${total} ${total}`}
        role="img"
        aria-label={`Go board ${size} by ${size}`}
      >
        <g stroke="var(--grid)" strokeWidth={1.2} strokeLinecap="square">
          {lines}
        </g>
        <g fill="var(--grid)">
          {starPoints(size).map(([x, y]) => (
            <circle key={`h${x}-${y}`} cx={px(x)} cy={px(y)} r={3.2} />
          ))}
        </g>
        {showCoordinates && (
          <g fill="var(--grid)" fontSize={11} textAnchor="middle" fontFamily="inherit">
            {Array.from({ length: size }, (_, i) => (
              <g key={`c${i}`}>
                <text x={px(i)} y={MARGIN - 14}>
                  {COLUMN_LETTERS[i]}
                </text>
                <text x={px(i)} y={total - MARGIN + 22}>
                  {COLUMN_LETTERS[i]}
                </text>
                <text x={MARGIN - 16} y={px(i) + 4}>
                  {size - i}
                </text>
                <text x={total - MARGIN + 16} y={px(i) + 4}>
                  {size - i}
                </text>
              </g>
            ))}
          </g>
        )}
        {stones}
        {territoryMarks}
        {lastPlay && !dead.has(lastPlay.y * size + lastPlay.x) && (
          <circle
            cx={px(lastPlay.x)}
            cy={px(lastPlay.y)}
            r={stoneR * 0.45}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={3}
          />
        )}
        {koPoint !== null && (
          <rect
            x={px(koPoint % size) - 7}
            y={px(Math.floor(koPoint / size)) - 7}
            width={14}
            height={14}
            fill="none"
            stroke="var(--danger)"
            strokeWidth={2.5}
          />
        )}
        {pending && (
          <circle
            cx={px(pending.x)}
            cy={px(pending.y)}
            r={stoneR}
            fill={state.toPlay === 1 ? "var(--stone-black)" : "var(--stone-white)"}
            stroke={state.toPlay === 2 ? "var(--stone-white-edge)" : "var(--accent)"}
            strokeWidth={2}
            opacity={0.6}
          />
        )}
        {targets}
      </svg>
    </div>
  );
}
