import { db, SessionRecord } from '../../data/db';

export function formatLocalDateKey(timestamp: number = Date.now()): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function estimateWordsFromChars(charCount: number): number {
  return Math.max(0, Math.round(charCount / 5));
}

export interface SessionTrackerState {
  sessionId: string;
  docId: string;
  startedAt: number;
  activeSeconds: number;
  pagesRead: number;
  wordsEstimated: number;
  lastInteractionAt: number;
  isVisible: boolean;
  isFocused: boolean;
}

export function isTickEligible(params: {
  isVisible: boolean;
  isFocused: boolean;
  lastInteractionAt: number;
  now: number;
}): boolean {
  if (!params.isVisible || !params.isFocused) return false;
  return params.now - params.lastInteractionAt <= 60_000;
}

export class ReadingSessionTracker {
  private sessionId: string;
  private docId: string;
  private mode: 'comfort' | 'paged' | 'original';
  private startedAt: number;
  private dateKey: string;
  private activeSeconds = 0;
  private visitedPages = new Set<number>();
  private pageCharsByNumber = new Map<number, number>();
  private lastInteractionAt: number;
  private isVisible = true;
  private isFocused = true;
  private currentPageNumber: number;
  private currentPageEnteredAt: number;
  private tickIntervalId: number | null = null;
  private flushIntervalId: number | null = null;
  private stopped = false;

  constructor(docId: string, initialPage: number, mode: 'comfort' | 'paged' | 'original') {
    const now = Date.now();
    this.sessionId = `sess_${docId}_${now}_${Math.random().toString(36).slice(2, 7)}`;
    this.docId = docId;
    this.mode = mode;
    this.startedAt = now;
    this.dateKey = formatLocalDateKey(now);
    this.lastInteractionAt = now;
    this.currentPageNumber = initialPage;
    this.currentPageEnteredAt = now;
    if (typeof document !== 'undefined') {
      this.isVisible = document.visibilityState === 'visible';
      this.isFocused = document.hasFocus();
    }
  }

  public start(): void {
    if (typeof window === 'undefined') return;
    this.tickIntervalId = window.setInterval(() => {
      this.tick(Date.now());
    }, 1000);
    this.flushIntervalId = window.setInterval(() => {
      void this.flush();
    }, 10_000);
  }

  public recordInteraction(now: number = Date.now()): void {
    this.lastInteractionAt = now;
  }

  public setVisibility(visible: boolean, focused: boolean, now: number = Date.now()): void {
    this.isVisible = visible;
    this.isFocused = focused;
    if (visible && focused) {
      this.lastInteractionAt = now;
    } else {
      void this.flush();
    }
  }

  public setMode(mode: 'comfort' | 'paged' | 'original'): void {
    this.mode = mode;
    this.recordInteraction();
  }

  public onPageChange(pageNumber: number, charCountOnPage: number = 1200, now: number = Date.now()): void {
    this.recordInteraction(now);
    if (charCountOnPage > 0) {
      this.pageCharsByNumber.set(pageNumber, charCountOnPage);
    }
    if (pageNumber !== this.currentPageNumber) {
      // Check if previous page had >= 3s dwell before switching
      if (now - this.currentPageEnteredAt >= 3000) {
        this.visitedPages.add(this.currentPageNumber);
      }
      this.currentPageNumber = pageNumber;
      this.currentPageEnteredAt = now;
    }
  }

  public registerPageCharCount(pageNumber: number, charCount: number): void {
    if (charCount > 0) {
      this.pageCharsByNumber.set(pageNumber, charCount);
    }
  }

  public tick(now: number = Date.now()): void {
    if (this.stopped) return;
    if (
      isTickEligible({
        isVisible: this.isVisible,
        isFocused: this.isFocused,
        lastInteractionAt: this.lastInteractionAt,
        now,
      })
    ) {
      this.activeSeconds += 1;
      if (now - this.currentPageEnteredAt >= 3000) {
        this.visitedPages.add(this.currentPageNumber);
      }
    }
  }

  public getWordsEstimated(): number {
    let totalChars = 0;
    for (const pageNum of this.visitedPages) {
      totalChars += this.pageCharsByNumber.get(pageNum) ?? 1100;
    }
    return estimateWordsFromChars(totalChars);
  }

  public async flush(): Promise<void> {
    if (this.activeSeconds < 2 && this.visitedPages.size === 0) return;
    const now = Date.now();
    const record: SessionRecord = {
      id: this.sessionId,
      docId: this.docId,
      startedAt: this.startedAt,
      endedAt: now,
      activeSeconds: this.activeSeconds,
      pagesRead: this.visitedPages.size,
      wordsEstimated: this.getWordsEstimated(),
      mode: this.mode,
      dateKey: this.dateKey,
    };
    try {
      await db.sessions.put(record);
    } catch {
      // Ignore transient IndexedDB errors on unload
    }
  }

  public async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    const now = Date.now();
    if (now - this.currentPageEnteredAt >= 3000) {
      this.visitedPages.add(this.currentPageNumber);
    }
    if (this.tickIntervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
    if (this.flushIntervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
    await this.flush();
  }
}
