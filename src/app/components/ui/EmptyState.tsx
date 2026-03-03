import React from 'react';
import { motion } from 'motion/react';

type EmptyGridCell = {
  c: number;
  r: number;
  cs?: number;
  rs?: number;
  filled: boolean;
};

const EMPTY_GRID: EmptyGridCell[] = [
  // "E" letter (cols 1-3)
  { c: 1, r: 1, cs: 3, filled: true },
  { c: 1, r: 2, filled: true },
  { c: 2, r: 2, filled: false },
  { c: 3, r: 2, filled: false },
  { c: 1, r: 3, cs: 3, filled: true },
  { c: 1, r: 4, filled: true },
  { c: 2, r: 4, filled: false },
  { c: 3, r: 4, filled: false },
  { c: 1, r: 5, cs: 3, filled: true },
  // Gap column (col 4)
  { c: 4, r: 1, filled: false },
  { c: 4, r: 2, filled: false },
  { c: 4, r: 3, filled: false },
  { c: 4, r: 4, filled: false },
  { c: 4, r: 5, filled: false },
  // "M" letter (cols 5-7)
  { c: 5, r: 1, rs: 5, filled: true },
  { c: 6, r: 1, rs: 2, filled: true },
  { c: 6, r: 3, filled: false },
  { c: 6, r: 4, filled: false },
  { c: 6, r: 5, filled: false },
  { c: 7, r: 1, rs: 5, filled: true },
];

export const EmptyState: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4 }}
    className="flex flex-col items-center justify-center py-16 gap-4"
  >
    <div
      className="grid gap-[8px]"
      style={{
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(5, minmax(0, 1fr))',
        width: 200,
        height: 182,
      }}
    >
      {EMPTY_GRID.map((cell, i) => (
        <div
          key={i}
          className="rounded-[20px]"
          style={{
            gridColumn: cell.cs ? `${cell.c} / span ${cell.cs}` : cell.c,
            gridRow: cell.rs ? `${cell.r} / span ${cell.rs}` : cell.r,
            backgroundColor: cell.filled ? '#000000' : '#ffffff',
          }}
        />
      ))}
    </div>
  </motion.div>
);
