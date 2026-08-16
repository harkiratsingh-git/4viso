// Shared multi-stop route path helpers for the SVG network map views.
// Projects lat/lng onto a 1000x500 canvas and draws a chained quadratic-bezier
// path through an arbitrary number of waypoints (origin -> stops -> destination).

export function projectMercator(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * 920 + 40;
  const y = ((80 - lat) / 140) * 420 + 40;
  return [Math.max(20, Math.min(980, x)), Math.max(20, Math.min(480, y))];
}

/** Builds an SVG path `d` string through a chain of already-projected points. */
export function buildMultiStopPathD(points: [number, number][]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    const midX = (x1 + x2) / 2;
    const midY = Math.min(y1, y2) - Math.abs(x1 - x2) * 0.18;
    d += ` Q ${midX} ${midY} ${x2} ${y2}`;
  }
  return d;
}

/** Interpolates a point along the chained path at overall progress 0..1 (100 == fully at destination). */
export function pointOnMultiStopPath(points: [number, number][], progressPercent: number): [number, number] {
  if (points.length === 0) return [0, 0];
  if (points.length === 1) return points[0];

  const progress = Math.max(0, Math.min(1, progressPercent / 100));
  const segments = points.length - 1;
  const segLen = 1 / segments;
  const segIndex = Math.min(segments - 1, Math.floor(progress / segLen));
  const localT = (progress - segIndex * segLen) / segLen;

  const [x1, y1] = points[segIndex];
  const [x2, y2] = points[segIndex + 1];
  const midX = (x1 + x2) / 2;
  const midY = Math.min(y1, y2) - Math.abs(x1 - x2) * 0.18;

  const t = localT;
  const curX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
  const curY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;
  return [curX, curY];
}
