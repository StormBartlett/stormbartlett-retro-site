type LocalCoordinateMetrics = {
  rect: DOMRect;
  width: number;
  height: number;
  clientToLocal: (clientX: number, clientY: number) => { x: number; y: number };
};

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);

  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    if (Math.abs(rows[pivot][col]) < 1e-9) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];

    const divisor = rows[col][col];
    for (let i = col; i <= size; i++) rows[col][i] /= divisor;

    for (let row = 0; row < size; row++) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let i = col; i <= size; i++) rows[row][i] -= factor * rows[col][i];
    }
  }

  return rows.map((row) => row[size]);
}

export function createLocalCoordinateMetrics(element: HTMLElement): LocalCoordinateMetrics {
  const rect = element.getBoundingClientRect();
  const width = element.clientWidth;
  const height = element.clientHeight;

  const measurePoint = (x: number, y: number) => {
    const marker = document.createElement("div");
    marker.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:1px;height:1px;visibility:hidden;pointer-events:none;`;
    element.appendChild(marker);
    const markerRect = marker.getBoundingClientRect();
    marker.remove();
    return { x: markerRect.left, y: markerRect.top };
  };

  const screenPoints = [
    measurePoint(0, 0),
    measurePoint(width, 0),
    measurePoint(0, height),
    measurePoint(width, height),
  ];
  const localPoints = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width, y: height },
  ];

  const matrix: number[][] = [];
  const vector: number[] = [];
  screenPoints.forEach((point, index) => {
    const local = localPoints[index];
    matrix.push([point.x, point.y, 1, 0, 0, 0, -local.x * point.x, -local.x * point.y]);
    vector.push(local.x);
    matrix.push([0, 0, 0, point.x, point.y, 1, -local.y * point.x, -local.y * point.y]);
    vector.push(local.y);
  });

  const solution = solveLinearSystem(matrix, vector);
  if (!solution) {
    const scaleX = rect.width / (width || 1);
    const scaleY = rect.height / (height || 1);
    return {
      rect,
      width,
      height,
      clientToLocal: (clientX, clientY) => ({
        x: (clientX - rect.left) / (scaleX || 1),
        y: (clientY - rect.top) / (scaleY || 1),
      }),
    };
  }

  const [a, b, c, d, e, f, g, h] = solution;
  return {
    rect,
    width,
    height,
    clientToLocal: (clientX, clientY) => {
      const denominator = g * clientX + h * clientY + 1;
      return {
        x: (a * clientX + b * clientY + c) / denominator,
        y: (d * clientX + e * clientY + f) / denominator,
      };
    },
  };
}


/**
 * Keep icons inside the visible desktop and off each other. Icons already in a free, visible
 * spot stay exactly where the visitor put them; only clipped or colliding ones move, each to
 * the nearest free grid cell. Returns the same array when nothing needed to move.
 */
export function settleIcons<T extends { id: string; x: number; y: number }>(
  icons: readonly T[], area: { width: number; height: number }, fixed: readonly { x: number; y: number }[] = [], size = 96, gap = 8,
): T[] {
  const maxX = Math.max(8, area.width - size - 8), maxY = Math.max(8, area.height - size - 8), step = size + gap, near = size * .8;
  const placed = fixed.map(point => ({ ...point }));
  const blocked = (x: number, y: number) => placed.some(point => Math.abs(point.x - x) < near && Math.abs(point.y - y) < near);
  let changed = false;
  const result = icons.map(icon => {
    let x = Math.min(Math.max(8, icon.x), maxX), y = Math.min(Math.max(8, icon.y), maxY);
    if (blocked(x, y)) {
      let best: { x: number; y: number } | null = null, distance = Infinity;
      for (let gx = 16; gx <= maxX; gx += step) for (let gy = 8; gy <= maxY; gy += step) {
        if (blocked(gx, gy)) continue;
        const d = (gx - x) ** 2 + (gy - y) ** 2;
        if (d < distance) { distance = d; best = { x: gx, y: gy }; }
      }
      if (best) ({ x, y } = best);
    }
    placed.push({ x, y });
    if (x === icon.x && y === icon.y) return icon;
    changed = true;
    return { ...icon, x, y };
  });
  return changed ? result : icons as T[];
}
