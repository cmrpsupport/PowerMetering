import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export type BadgeColor = 'slate' | 'green' | 'yellow' | 'red' | 'indigo'

export function Badge({
  color = 'slate',
  children,
}: {
  color?: BadgeColor
  children: ReactNode
}) {
  const styles =
    color === 'green'
      ? 'bg-[color-mix(in_srgb,var(--accent-green)_12%,var(--card))] text-[var(--accent-green)] ring-[var(--border)]'
      : color === 'yellow'
        ? 'bg-[var(--card)] text-[var(--text)] ring-[var(--border)]'
        : color === 'red'
          ? 'bg-[color-mix(in_srgb,var(--accent-red)_12%,var(--card))] text-[var(--accent-red)] ring-[var(--border)]'
          : color === 'indigo'
            ? 'bg-[var(--card)] text-[var(--text)] ring-[var(--border)]'
            : 'bg-[var(--card)] text-[var(--text)] ring-[var(--border)]'

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-[10px] px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        styles,
      )}
    >
      {children}
    </span>
  )
}

