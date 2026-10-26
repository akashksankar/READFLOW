import type { FigureBBox } from '../../data/db';
import type { GroupedLine } from '../extract/extractPage';

export interface RawFigureBox {
  xMin: number; // in PDF points (0..pageWidth)
  yMin: number; // in PDF points from bottom (0..pageHeight)
  xMax: number;
  yMax: number;
  kind: 'image' | 'diagram';
  segmentCount?: number;
  imageId?: string;
}

export interface FilteredFigureCandidate {
  bboxPoints: { xMin: number; yMin: number; xMax: number; yMax: number };
  bboxNormalized: FigureBBox; // x, y (from top 0..1), w, h (0..1)
  kind: 'image' | 'diagram';
  caption: string;
  imageSignature: string;
}

type Matrix2D = [number, number, number, number, number, number];

export function multiplyMatrices(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function unitSquareToBBox(ctm: Matrix2D): {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
} {
  const corners = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ];
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;

  for (const [u, v] of corners) {
    const px = ctm[0] * u + ctm[2] * v + ctm[4];
    const py = ctm[1] * u + ctm[3] * v + ctm[5];
    if (px < xMin) xMin = px;
    if (px > xMax) xMax = px;
    if (py < yMin) yMin = py;
    if (py > yMax) yMax = py;
  }

  return { xMin, yMin, xMax, yMax };
}

/**
 * Merges nearby vector path bounding boxes when gaps are under ~12 points.
 */
export function clusterVectorPathBoxes(
  pathBoxes: { xMin: number; yMin: number; xMax: number; yMax: number; segments: number }[],
  gapThreshold = 12
): RawFigureBox[] {
  const clusters = pathBoxes.map((b) => ({
    xMin: b.xMin,
    yMin: b.yMin,
    xMax: b.xMax,
    yMax: b.yMax,
    segments: b.segments,
  }));

  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i];
        const b = clusters[j];
        const horizGap = Math.max(0, Math.max(a.xMin, b.xMin) - Math.min(a.xMax, b.xMax));
        const vertGap = Math.max(0, Math.max(a.yMin, b.yMin) - Math.min(a.yMax, b.yMax));
        if (horizGap <= gapThreshold && vertGap <= gapThreshold) {
          a.xMin = Math.min(a.xMin, b.xMin);
          a.yMin = Math.min(a.yMin, b.yMin);
          a.xMax = Math.max(a.xMax, b.xMax);
          a.yMax = Math.max(a.yMax, b.yMax);
          a.segments += b.segments;
          clusters.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  return clusters.map((c) => ({
    xMin: c.xMin,
    yMin: c.yMin,
    xMax: c.xMax,
    yMax: c.yMax,
    kind: 'diagram' as const,
    segmentCount: c.segments,
  }));
}

/**
 * Rule 4: Filter noise:
 * - Drop boxes under 48 by 48 points or under 1% of page area
 * - Drop decorative lines and rules (aspect ratio / thinness)
 * - Drop a box covering over 85% of the page when the page also has substantial text (> 180 chars)
 * - For vector diagrams, require area >= 2% of page and >= 12 path segments
 * - Cap 12 figures per page
 */
export function filterFigureBoxes(
  boxes: RawFigureBox[],
  pageWidth: number,
  pageHeight: number,
  pageCharCount: number
): RawFigureBox[] {
  const pageArea = Math.max(1, pageWidth * pageHeight);
  const valid: RawFigureBox[] = [];

  for (const raw of boxes) {
    const xMin = Math.max(0, Math.min(pageWidth, raw.xMin));
    const xMax = Math.max(0, Math.min(pageWidth, raw.xMax));
    const yMin = Math.max(0, Math.min(pageHeight, raw.yMin));
    const yMax = Math.max(0, Math.min(pageHeight, raw.yMax));

    const w = xMax - xMin;
    const h = yMax - yMin;

    // Minimum size 48x48 pt
    if (w < 48 || h < 48) continue;

    // Decorative rule / thin border check
    if (w / h > 14 || h / w > 14) continue;

    const areaRatio = (w * h) / pageArea;
    if (areaRatio < 0.01) continue;

    // Scanned background / watermark covering >85% of page when page has substantial text
    if (areaRatio > 0.85 && pageCharCount > 180) continue;

    if (raw.kind === 'diagram') {
      if (areaRatio < 0.02 || (raw.segmentCount ?? 0) < 12) continue;
    }

    valid.push({
      ...raw,
      xMin,
      yMin,
      xMax,
      yMax,
    });
  }

  // Deduplicate heavily overlapping boxes (keep larger or image over diagram)
  const deduped: RawFigureBox[] = [];
  for (const cand of valid) {
    const overlapsExisting = deduped.some((ex) => {
      const ixMin = Math.max(cand.xMin, ex.xMin);
      const iyMin = Math.max(cand.yMin, ex.yMin);
      const ixMax = Math.min(cand.xMax, ex.xMax);
      const iyMax = Math.min(cand.yMax, ex.yMax);
      if (ixMax <= ixMin || iyMax <= iyMin) return false;
      const interArea = (ixMax - ixMin) * (iyMax - iyMin);
      const candArea = (cand.xMax - cand.xMin) * (cand.yMax - cand.yMin);
      return interArea / Math.max(1, candArea) > 0.7;
    });
    if (!overlapsExisting) {
      deduped.push(cand);
    }
  }

  // Sort top-to-bottom (descending yMax in PDF coords) and cap at 12 per page
  deduped.sort((a, b) => b.yMax - a.yMax);
  return deduped.slice(0, 12);
}

/**
 * Rule 5: Captions:
 * Look for the nearest text line below (or above) the box whose normalized start matches
 * Fig, Figure, Chart, Diagram, Table or Exhibit followed by a number.
 * If none is found, leave it empty. Never generate captions.
 */
const CAPTION_REGEX =
  /^(?:fig\.?|figure|chart|diagram|table|exhibit)\s*\d+(?:[.\-:]\d+)?\b/i;

export function matchFigureCaption(
  box: { xMin: number; yMin: number; xMax: number; yMax: number },
  lines: GroupedLine[]
): string {
  let bestLine: GroupedLine | null = null;
  let bestDistance = Infinity;

  for (const line of lines) {
    const text = line.text.trim();
    if (!CAPTION_REGEX.test(text)) continue;

    // Check vertical distance below box (line.y < box.yMin) or just above box (line.y > box.yMax)
    let dist = Infinity;
    if (line.y <= box.yMin + 18 && box.yMin - line.y <= 90) {
      dist = box.yMin - line.y; // Prefer below
    } else if (line.y >= box.yMax - 18 && line.y - box.yMax <= 70) {
      dist = (line.y - box.yMax) + 15; // Slightly penalize above vs below
    }

    if (dist < bestDistance) {
      bestDistance = dist;
      bestLine = line;
    }
  }

  return bestLine ? bestLine.text.trim() : '';
}

/**
 * Walks PDFPageProxy.getOperatorList() to extract raw raster image and vector diagram bounding boxes.
 */
export async function detectPageFigureCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjsOps: any,
  lines: GroupedLine[],
  pageCharCount: number
): Promise<FilteredFigureCandidate[]> {
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width || 600;
  const pageHeight = viewport.height || 800;

  const opList = await page.getOperatorList();
  const fnArray: number[] = opList.fnArray || [];
  const argsArray: unknown[][] = opList.argsArray || [];

  const ctmStack: Matrix2D[] = [];
  let currentCtm: Matrix2D = [1, 0, 0, 1, 0, 0];

  const rasterBoxes: RawFigureBox[] = [];
  const rawPaths: { xMin: number; yMin: number; xMax: number; yMax: number; segments: number }[] = [];

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] || [];

    if (fn === pdfjsOps.save) {
      ctmStack.push([...currentCtm] as Matrix2D);
    } else if (fn === pdfjsOps.restore) {
      const popped = ctmStack.pop();
      if (popped) currentCtm = popped;
    } else if (fn === pdfjsOps.transform) {
      if (args.length >= 6) {
        const m = args.slice(0, 6).map(Number) as Matrix2D;
        currentCtm = multiplyMatrices(currentCtm, m);
      }
    } else if (
      fn === pdfjsOps.paintImageXObject ||
      fn === pdfjsOps.paintInlineImageXObject ||
      fn === pdfjsOps.paintImageMaskXObject
    ) {
      const bbox = unitSquareToBBox(currentCtm);
      const imgId = typeof args[0] === 'string' ? args[0] : 'inline';
      rasterBoxes.push({
        ...bbox,
        kind: 'image',
        imageId: imgId,
      });
    } else if (fn === pdfjsOps.constructPath) {
      // args[0] is ops array, args[1] is coordinates array, args[2] is minMax [xMin, yMin, xMax, yMax] in some PDF.js versions
      const coords = Array.isArray(args[1]) ? (args[1] as number[]) : [];
      const minMax = Array.isArray(args[2]) ? (args[2] as number[]) : null;

      if (minMax && minMax.length >= 4) {
        const p1 = [
          currentCtm[0] * minMax[0] + currentCtm[2] * minMax[1] + currentCtm[4],
          currentCtm[1] * minMax[0] + currentCtm[3] * minMax[1] + currentCtm[5],
        ];
        const p2 = [
          currentCtm[0] * minMax[2] + currentCtm[2] * minMax[3] + currentCtm[4],
          currentCtm[1] * minMax[2] + currentCtm[3] * minMax[3] + currentCtm[5],
        ];
        rawPaths.push({
          xMin: Math.min(p1[0], p2[0]),
          yMin: Math.min(p1[1], p2[1]),
          xMax: Math.max(p1[0], p2[0]),
          yMax: Math.max(p1[1], p2[1]),
          segments: Math.max(1, Math.floor(coords.length / 2)),
        });
      } else if (coords.length >= 4) {
        let xMin = Infinity;
        let yMin = Infinity;
        let xMax = -Infinity;
        let yMax = -Infinity;
        for (let k = 0; k < coords.length - 1; k += 2) {
          const cx = coords[k];
          const cy = coords[k + 1];
          if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
          const px = currentCtm[0] * cx + currentCtm[2] * cy + currentCtm[4];
          const py = currentCtm[1] * cx + currentCtm[3] * cy + currentCtm[5];
          if (px < xMin) xMin = px;
          if (px > xMax) xMax = px;
          if (py < yMin) yMin = py;
          if (py > yMax) yMax = py;
        }
        if (xMin < xMax && yMin < yMax) {
          rawPaths.push({
            xMin,
            yMin,
            xMax,
            yMax,
            segments: Math.max(1, Math.floor(coords.length / 2)),
          });
        }
      }
    }
  }

  const vectorClusters = clusterVectorPathBoxes(rawPaths, 12);
  const combined = [...rasterBoxes, ...vectorClusters];
  const filtered = filterFigureBoxes(combined, pageWidth, pageHeight, pageCharCount);

  return filtered.map((box) => {
    const caption = matchFigureCaption(box, lines);
    // Convert PDF bottom-left yMin..yMax to top-down normalized 0..1
    const normX = Math.max(0, Math.min(1, box.xMin / pageWidth));
    const normY = Math.max(0, Math.min(1, (pageHeight - box.yMax) / pageHeight));
    const normW = Math.max(0.01, Math.min(1 - normX, (box.xMax - box.xMin) / pageWidth));
    const normH = Math.max(0.01, Math.min(1 - normY, (box.yMax - box.yMin) / pageHeight));

    const sig = `${box.kind}:${Math.round(normX * 20)}:${Math.round(normY * 20)}:${Math.round(normW * 20)}:${Math.round(normH * 20)}`;

    return {
      bboxPoints: {
        xMin: box.xMin,
        yMin: box.yMin,
        xMax: box.xMax,
        yMax: box.yMax,
      },
      bboxNormalized: {
        x: normX,
        y: normY,
        w: normW,
        h: normH,
      },
      kind: box.kind,
      caption,
      imageSignature: sig,
    };
  });
}
