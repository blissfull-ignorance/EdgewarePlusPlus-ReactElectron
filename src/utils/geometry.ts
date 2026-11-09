/**
 * Popup geometry calculation — ported from legacy features/popup.py.
 *
 * Grid-based weighted placement: divides available area into 50x50 grid
 * squares, weights each square by non-overlap ratio + Euclidean distance
 * from existing popups. When > 1 popup exists, uses Infinity weight
 * (prevents overlap).
 */

export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExistingPopup {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PopupGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

const GRID_SIZE = 50;

/**
 * Calculate popup dimensions based on source media dimensions and mode.
 * Fullscreen mode: 30-70% of smallest monitor dimension.
 * Lowkey mode: 20-50% of smallest monitor dimension.
 */
function calculatePopupDimensions(
  mediaWidth: number,
  mediaHeight: number,
  monitorBounds: MonitorBounds,
  isLowkey: boolean,
  lowkeyScaling: number
): { width: number; height: number } {
  const smallestDim = Math.min(monitorBounds.width, monitorBounds.height);
  const minPct = isLowkey ? 0.2 : 0.3;
  const maxPct = isLowkey ? 0.5 : 0.7;

  const aspectRatio = mediaWidth / mediaHeight;
  if (!isFinite(aspectRatio) || aspectRatio === 0) {
    return { width: 400, height: 300 };
  }

  const scaleFactor = minPct + Math.random() * (maxPct - minPct);

  let width: number;
  let height: number;

  if (aspectRatio >= 1) {
    width = Math.floor(smallestDim * scaleFactor * Math.min(aspectRatio, 2));
    height = Math.floor(width / aspectRatio);
  } else {
    height = Math.floor(smallestDim * scaleFactor * Math.min(1 / aspectRatio, 2));
    width = Math.floor(height * aspectRatio);
  }

  if (isLowkey) {
    const scalingFactor = lowkeyScaling / 100;
    width = Math.floor(width * scalingFactor);
    height = Math.floor(height * scalingFactor);
  }

  width = Math.max(100, Math.min(width, monitorBounds.width - 50));
  height = Math.max(100, Math.min(height, monitorBounds.height - 50));

  return { width, height };
}

/**
 * Compute the weighted placement for a single grid cell.
 * Returns Infinity when more than one popup already exists (legacy behavior).
 * Otherwise returns a weight combining non-overlap ratio and distance.
 */
function computeCellWeight(
  cellX: number,
  cellY: number,
  popupWidth: number,
  popupHeight: number,
  existingPopups: ExistingPopup[]
): number {
  if (existingPopups.length > 1) {
    return Number.POSITIVE_INFINITY;
  }

  let totalWeight = 0;

  for (const existing of existingPopups) {
    const overlapX = Math.max(
      0,
      Math.min(cellX + popupWidth, existing.x + existing.width) -
        Math.max(cellX, existing.x)
    );
    const overlapY = Math.max(
      0,
      Math.min(cellY + popupHeight, existing.y + existing.height) -
        Math.max(cellY, existing.y)
    );

    const overlapArea = overlapX * overlapY;
    const popupArea = popupWidth * popupHeight;
    const nonOverlapRatio = popupArea > 0 ? 1 - overlapArea / popupArea : 1;

    const dx = Math.max(
      0,
      Math.max(cellX - (existing.x + existing.width), (existing.x) - (cellX + popupWidth))
    );
    const dy = Math.max(
      0,
      Math.max(cellY - (existing.y + existing.height), (existing.y) - (cellY + popupHeight))
    );
    const distance = Math.sqrt(dx * dx + dy * dy);

    totalWeight += nonOverlapRatio + distance / 1000;
  }

  return existingPopups.length > 0 ? totalWeight : 1;
}

/**
 * Select a random grid cell weighted by the computed weights.
 */
function selectWeightedCell(weights: number[], count: number): number {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0 || !isFinite(totalWeight)) {
    return Math.floor(Math.random() * count);
  }

  let r = Math.random() * totalWeight;
  for (let i = 0; i < count; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return count - 1;
}

/**
 * Compute popup position using the grid-based weighted algorithm.
 * When no existing popups, positions randomly within monitor bounds.
 * When one existing popup, uses weighted placement to avoid overlap.
 * When multiple existing popups, uses Infinity weights (uniform random on grid).
 */
function computeWeightedPosition(
  monitorBounds: MonitorBounds,
  popupWidth: number,
  popupHeight: number,
  existingPopups: ExistingPopup[]
): { x: number; y: number } {
  const availableWidth = monitorBounds.width - popupWidth;
  const availableHeight = monitorBounds.height - popupHeight;

  if (availableWidth <= 0 || availableHeight <= 0) {
    return { x: monitorBounds.x, y: monitorBounds.y };
  }

  if (existingPopups.length === 0) {
    return {
      x: monitorBounds.x + Math.floor(Math.random() * availableWidth),
      y: monitorBounds.y + Math.floor(Math.random() * availableHeight),
    };
  }

  const cols = Math.floor(availableWidth / GRID_SIZE);
  const rows = Math.floor(availableHeight / GRID_SIZE);

  if (cols <= 0 || rows <= 0) {
    return { x: monitorBounds.x, y: monitorBounds.y };
  }

  const cellCount = cols * rows;
  const weights = new Array(cellCount);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = monitorBounds.x + col * GRID_SIZE;
      const cellY = monitorBounds.y + row * GRID_SIZE;
      weights[row * cols + col] = computeCellWeight(
        cellX,
        cellY,
        popupWidth,
        popupHeight,
        existingPopups
      );
    }
  }

  const selectedIndex = selectWeightedCell(weights, cellCount);
  const col = selectedIndex % cols;
  const row = Math.floor(selectedIndex / cols);

  return {
    x: monitorBounds.x + col * GRID_SIZE,
    y: monitorBounds.y + row * GRID_SIZE,
  };
}

/**
 * Lowkey corner placement options.
 * Index 0 = Top-Right, 1 = Top-Left, 2 = Bottom-Left, 3 = Bottom-Right, 4 = Random.
 */
const LOWKEY_CORNERS = [
  { name: "Top-Right", anchorX: "right", anchorY: "top" },
  { name: "Top-Left", anchorX: "left", anchorY: "top" },
  { name: "Bottom-Left", anchorX: "left", anchorY: "bottom" },
  { name: "Bottom-Right", anchorX: "right", anchorY: "bottom" },
  { name: "Random", anchorX: "random", anchorY: "random" },
] as const;

type CornerAnchor = typeof LOWKEY_CORNERS[number]["anchorX"];

/**
 * Compute popup position in a specific corner of the monitor.
 */
function computeCornerPosition(
  monitorBounds: MonitorBounds,
  popupWidth: number,
  popupHeight: number,
  cornerIndex: number
): { x: number; y: number } {
  const corner = LOWKEY_CORNERS[Math.min(cornerIndex, LOWKEY_CORNERS.length - 1)];
  const padding = 20;

  let x: number;
  let y: number;

  const anchorX = corner.anchorX as CornerAnchor;
  if (anchorX === "right") {
    x = monitorBounds.x + monitorBounds.width - popupWidth - padding;
  } else if (anchorX === "left") {
    x = monitorBounds.x + padding;
  } else {
    x = monitorBounds.x + Math.floor(Math.random() * (monitorBounds.width - popupWidth));
  }

  if (corner.anchorY === "bottom") {
    y = monitorBounds.y + monitorBounds.height - popupHeight - padding;
  } else if (corner.anchorY === "top") {
    y = monitorBounds.y + padding;
  } else {
    y = monitorBounds.y + Math.floor(Math.random() * (monitorBounds.height - popupHeight));
  }

  return { x, y };
}

/**
 * Parse the disabled monitors string from settings into an array of monitor indices.
 */
function parseDisabledMonitors(disabledMonitors: string): number[] {
  try {
    const parsed = JSON.parse(disabledMonitors);
    if (Array.isArray(parsed)) {
      return parsed.filter((m) => typeof m === "number");
    }
  } catch {
    // Invalid JSON, return empty
  }
  return [];
}

/**
 * Select an available monitor from the list, excluding disabled ones.
 */
function selectMonitor(
  monitors: MonitorBounds[],
  disabledMonitors: string
): MonitorBounds {
  const disabled = parseDisabledMonitors(disabledMonitors);
  const available = monitors.filter((_, i) => !disabled.includes(i));

  if (available.length === 0) {
    return monitors[0] || { x: 0, y: 0, width: 1920, height: 1080 };
  }

  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Main geometry computation function.
 *
 * @param mediaWidth - Source media width in pixels
 * @param mediaHeight - Source media height in pixels
 * @param monitors - Available monitor bounds (from Electron screen API)
 * @param existingPopups - Currently open popup geometries
 * @param isLowkey - Whether lowkey mode is enabled
 * @param cornerIndex - Lowkey corner selection (0-4, only used when isLowkey)
 * @param lowkeyScaling - Lowkey scaling percentage (0-100)
 * @param disabledMonitors - JSON string of disabled monitor indices
 */
export function computePopupGeometry({
  mediaWidth = 640,
  mediaHeight = 480,
  monitors = [{ x: 0, y: 0, width: 1920, height: 1080 }],
  existingPopups = [],
  isLowkey = false,
  cornerIndex = 0,
  lowkeyScaling = 50,
  disabledMonitors = "[]",
}: {
  mediaWidth?: number;
  mediaHeight?: number;
  monitors?: MonitorBounds[];
  existingPopups?: ExistingPopup[];
  isLowkey?: boolean;
  cornerIndex?: number;
  lowkeyScaling?: number;
  disabledMonitors?: string;
}): PopupGeometry {
  const monitor = selectMonitor(monitors, disabledMonitors);
  const { width, height } = calculatePopupDimensions(
    mediaWidth,
    mediaHeight,
    monitor,
    isLowkey,
    lowkeyScaling
  );

  let x: number;
  let y: number;

  if (isLowkey) {
    const pos = computeCornerPosition(monitor, width, height, cornerIndex);
    x = pos.x;
    y = pos.y;
  } else {
    const pos = computeWeightedPosition(monitor, width, height, existingPopups);
    x = pos.x;
    y = pos.y;
  }

  return { x, y, width, height };
}

export { LOWKEY_CORNERS, calculatePopupDimensions, computeWeightedPosition, computeCornerPosition, parseDisabledMonitors, selectMonitor, computeCellWeight, selectWeightedCell };
