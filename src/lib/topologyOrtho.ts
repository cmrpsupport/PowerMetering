/**
 * Orthogonal (Manhattan) path from parent bottom anchor to child top-center.
 * Coordinates are container-local pixels (same space as SVG overlay).
 *
 * When `siblingIndex` / `siblingCount` are set (same parent, multiple children),
 * the vertical stub is slightly staggered so horizontal segments do not sit on
 * identical Y coordinates.
 */
export function orthogonalConnectorPath(
  parentBottomCenterX: number,
  parentBottomY: number,
  childTopCenterX: number,
  childTopY: number,
  options?: {
    stubMin?: number
    stubMax?: number
    /** 0-based index among siblings sharing this parent (for fan-out). */
    siblingIndex?: number
    siblingCount?: number
  },
): string {
  const stubMin = options?.stubMin ?? 10
  const stubMax = options?.stubMax ?? 28
  const sIdx = options?.siblingIndex ?? 0
  const sCount = options?.siblingCount ?? 1

  const dx = Math.abs(childTopCenterX - parentBottomCenterX)
  const dy = childTopY - parentBottomY
  if (!Number.isFinite(dy) || dy <= 1) {
    return `M ${parentBottomCenterX} ${parentBottomY} L ${childTopCenterX} ${childTopY}`
  }

  const baseStub = Math.min(stubMax, Math.max(stubMin, dy * 0.18))
  /** Separate horizontal arms by a few px when multiple children share a parent. */
  const lane = sCount > 1 ? Math.min(6, 2 + sIdx * 2.5) : 0
  const stub = Math.min(stubMax, baseStub + lane)

  if (dx < 0.75) {
    return `M ${parentBottomCenterX} ${parentBottomY} L ${childTopCenterX} ${childTopY}`
  }

  const yMid = parentBottomY + stub
  return `M ${parentBottomCenterX} ${parentBottomY} L ${parentBottomCenterX} ${yMid} L ${childTopCenterX} ${yMid} L ${childTopCenterX} ${childTopY}`
}
