import Dexie, { type Table } from 'dexie';

export type ThemeId = 'paper' | 'sepia' | 'forest' | 'midnight' | 'oled';

export type ReadingFontId =
  | 'literata'
  | 'source-serif'
  | 'newsreader'
  | 'lora'
  | 'eb-garamond'
  | 'crimson-pro'
  | 'atkinson'
  | 'lexend'
  | 'instrument-sans';

export type HeadingFontId =
  | 'fraunces'
  | 'playfair-display'
  | 'newsreader'
  | 'lora'
  | 'instrument-sans'
  | 'atkinson'
  | 'same-as-body';

export type ReadingStyleId =
  | 'classic'
  | 'manuscript'
  | 'editorial'
  | 'study'
  | 'story'
  | 'clear'
  | 'plain'
  | 'custom';

export type DropCapMode =
  | 'off'
  | 'drop'
  | 'raised'
  | 'bold-first-word'
  | 'small-caps';

export type DropCapColorId =
  | 'accent'
  | 'ink'
  | 'saffron'
  | 'clay'
  | 'sage'
  | 'slate'
  | 'plum'
  | 'teal'
  | 'rose'
  | 'amber'
  | 'forest-ink'
  | 'cobalt';

export type DropCapWeight = 400 | 600 | 700 | 900;
export type OpeningAnimationStyle = 'rise' | 'typewriter' | 'ink-fade' | 'off';
export type ReadingFlowMode = 'scroll' | 'paged';
export type PageTurnStyle = 'slide' | 'fade' | 'flip';
export type TapZonesMode = 'normal' | 'wide-center';
export type FiguresInlineMode = 'on' | 'off' | 'gallery-only';
export type CardSessionSize = 10 | 20 | 'all';

export type MotionPreference = 'system' | 'reduced' | 'full';
export type ReaderMode = 'comfort' | 'paged' | 'original';
export type HighlightColor = 'saffron' | 'clay' | 'sage' | 'slate';
export type SoundscapeId = 'rain' | 'forest' | 'seashore';

export type CardColor =
  | 'ivory'
  | 'ochre'
  | 'terracotta'
  | 'sage'
  | 'slate'
  | 'plum'
  | 'rose'
  | 'charcoal';

export type CardColorId = CardColor;

export type CardType = 'definition' | 'bold-term' | 'fact' | 'key-sentence' | 'list' | 'custom';

export interface DocumentRecord {
  id: string;
  title: string;
  fileName: string;
  size: number;
  hash: string;
  pageCount: number;
  lastPage?: number;
  addedAt: number;
  lastOpenedAt: number;
  extractedPages: number;
  status: 'extracting' | 'ready' | 'scanned';
  coverBlobId?: string | null;
  softDeletedAt?: number | null;
  figuresStatus?: 'pending' | 'scanning' | 'done';
  figuresScannedPages?: number;
  figureCount?: number;
  preferredReadingFlow?: ReadingFlowMode;
  preferredPageTurn?: PageTurnStyle;
}

export interface FileRecord {
  docId: string;
  blob: Blob;
}

export interface CoverRecord {
  docId: string;
  blob: Blob;
}

export interface ExtractedBlock {
  index: number;
  type: 'heading-1' | 'heading-2' | 'paragraph' | 'furniture';
  text: string;
  rawText?: string;
  isFurniture?: boolean;
  yTop?: number;
  yBottom?: number;
  boldPhrases?: string[];
}

export interface PageQualityInfo {
  score: number;
  reliable: boolean;
  reason?: 'multi-column' | 'tables-or-numeric' | 'sparse-or-scanned' | 'uncertain-columns';
  charCount: number;
}

export interface PageRecord {
  id: string; // `${docId}:${pageIndex}`
  docId: string;
  pageIndex: number; // 0-based
  blocks: ExtractedBlock[];
  charCount: number;
  quality: PageQualityInfo;
}

export interface HighlightRecord {
  id: string;
  docId: string;
  pageIndex: number;
  blockIndex: number;
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
  color: HighlightColor;
  note: string;
  createdAt: number;
  unplaced?: boolean;
  kind?: 'highlight' | 'card-ref';
  cardId?: string;
}

export interface BookmarkRecord {
  id: string;
  docId: string;
  pageIndex: number;
  mode: ReaderMode;
  label: string;
  excerpt: string;
  createdAt: number;
  kind?: 'page' | 'bookmark' | 'figure' | 'card';
  figureId?: string;
  cardId?: string;
}

export interface ProgressRecord {
  docId: string;
  pageIndex: number; // 0-based
  blockIndex: number;
  charOffset?: number;
  scrollOffset: number;
  fraction: number; // 0..1
  mode: ReaderMode;
  updatedAt: number;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

/* Phase 2 New Tables */

export interface FigureBBox {
  x: number; // normalized 0..1
  y: number; // normalized 0..1 from top
  w: number; // normalized 0..1
  h: number; // normalized 0..1
}

export interface FigureRecord {
  id: string;
  docId: string;
  pageIndex: number;
  bbox: FigureBBox;
  kind: 'image' | 'diagram';
  caption: string;
  thumbBlob: Blob;
  fullBlob: Blob;
  w: number;
  h: number;
  createdAt?: number;
}

export interface SessionRecord {
  id: string;
  docId: string;
  dateKey: string; // local YYYY-MM-DD
  startedAt: number;
  endedAt: number;
  activeSeconds: number;
  pagesRead: number;
  wordsEstimated: number;
  mode: ReaderMode;
}

export interface GoalRecord {
  id: string; // 'default'
  dailyMinutes: number;
  dailyPages: number | null;
  updatedAt: number;
}

export interface TaskRecord {
  id: string;
  title: string;
  schedule: 'once' | 'daily' | 'weekdays';
  linkedDocId: string | null;
  order: number;
  createdAt: number;
  archivedAt: number | null;
}

export interface TaskLogRecord {
  id: string;
  taskId: string;
  dateKey: string; // YYYY-MM-DD
  completedAt: number | null;
}

export interface ChallengeLogRecord {
  id: string;
  dateKey: string; // YYYY-MM-DD
  challengeKey: string;
  target: number;
  progress: number;
  completedAt: number | null;
}

export interface DeckRecord {
  id: string;
  title: string;
  docId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CardRecord {
  id: string;
  deckId: string;
  docId: string | null;
  pageNumber: number | null;
  sourceHighlightId: string | null;
  sourceFigureId: string | null;
  kind: 'qa' | 'cloze' | 'quote';
  front: string;
  back: string;
  color: CardColor;
  savedAt: number | null;
  box: 1 | 2 | 3 | 4 | 5;
  dueAt: number;
  reviewCount: number;
  lapses: number;
  createdAt: number;
  suspended: boolean;
}

export interface ReviewRecord {
  id: string;
  cardId: string;
  reviewedAt: number;
  result: 'got-it' | 'again';
  prevBox: 1 | 2 | 3 | 4 | 5;
  nextBox: 1 | 2 | 3 | 4 | 5;
}

export interface ReadingSettings {
  theme: ThemeId;
  fontSize: number; // 14..28, default 18
  fontFamily: ReadingFontId;
  lineSpacing: number; // 1.4..2.0, default 1.65
  paragraphSpacing: number; // 0.4..1.5, default 0.9
  margins: number; // 8..40, default 20
  contentWidth: number; // 46..72, default 62
  justify: boolean;
  showFurniture: boolean;
  joinSplitWords: boolean;
  motion: MotionPreference;
  ambienceBed: SoundscapeId;
  ambienceVolume: number;

  /* Phase 2 Additions */
  readingStyle: ReadingStyleId;
  readingFont: ReadingFontId;
  dropCapMode: DropCapMode;
  dropCapLines: 2 | 3 | 4;
  dropCapScope: 'section' | 'every';
  dropCapColor: DropCapColorId;
  dropCapWeight: DropCapWeight;
  dropCapDecoration: 'none' | 'underline' | 'block';
  headingFont: HeadingFontId;
  headingStyle: 'normal' | 'small-caps' | 'italic' | 'sans-medium' | 'bold';
  sectionOrnament: boolean;
  openingAnimation: OpeningAnimationStyle;
  readingFlow: ReadingFlowMode;
  pageTurn: PageTurnStyle;
  tapZones: TapZonesMode;
  figuresInline: FiguresInlineMode;
  cardSessionSize: CardSessionSize;
}

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  theme: 'paper',
  fontSize: 18,
  fontFamily: 'literata',
  lineSpacing: 1.65,
  paragraphSpacing: 0.9,
  margins: 20,
  contentWidth: 62,
  justify: false,
  showFurniture: false,
  joinSplitWords: true,
  motion: 'system',
  ambienceBed: 'rain',
  ambienceVolume: 0.55,

  /* Phase 2 Defaults ("Classic" style) */
  readingStyle: 'classic',
  readingFont: 'literata',
  dropCapMode: 'drop',
  dropCapLines: 3,
  dropCapScope: 'section',
  dropCapColor: 'accent',
  dropCapWeight: 600,
  dropCapDecoration: 'none',
  headingFont: 'fraunces',
  headingStyle: 'normal',
  sectionOrnament: false,
  openingAnimation: 'rise',
  readingFlow: 'scroll',
  pageTurn: 'slide',
  tapZones: 'normal',
  figuresInline: 'on',
  cardSessionSize: 10,
};

export class ReadFlowDatabase extends Dexie {
  documents!: Table<DocumentRecord, string>;
  files!: Table<FileRecord, string>;
  covers!: Table<CoverRecord, string>;
  pages!: Table<PageRecord, string>;
  highlights!: Table<HighlightRecord, string>;
  bookmarks!: Table<BookmarkRecord, string>;
  progress!: Table<ProgressRecord, string>;
  settings!: Table<SettingRecord, string>;

  /* Phase 2 Tables */
  figures!: Table<FigureRecord, string>;
  sessions!: Table<SessionRecord, string>;
  goals!: Table<GoalRecord, string>;
  tasks!: Table<TaskRecord, string>;
  taskLog!: Table<TaskLogRecord, string>;
  challengeLog!: Table<ChallengeLogRecord, string>;
  decks!: Table<DeckRecord, string>;
  cards!: Table<CardRecord, string>;
  reviews!: Table<ReviewRecord, string>;

  constructor(dbName = 'ReadFlowDB') {
    super(dbName);

    // Version 1 (Phase 1 schema)
    this.version(1).stores({
      documents: 'id, hash, title, addedAt, lastOpenedAt, status, softDeletedAt',
      files: 'docId',
      covers: 'docId',
      pages: 'id, [docId+pageIndex], docId, pageIndex',
      highlights: 'id, docId, [docId+pageIndex], pageIndex, createdAt',
      bookmarks: 'id, docId, [docId+pageIndex], pageIndex, createdAt',
      progress: 'docId, updatedAt',
      settings: 'key',
    });

    // Version 2 (Phase 2 upgrade preserving all existing Phase 1 data untouched)
    this.version(2)
      .stores({
        documents: 'id, hash, title, addedAt, lastOpenedAt, status, softDeletedAt',
        files: 'docId',
        covers: 'docId',
        pages: 'id, [docId+pageIndex], docId, pageIndex',
        highlights: 'id, docId, [docId+pageIndex], pageIndex, createdAt, kind',
        bookmarks: 'id, docId, [docId+pageIndex], pageIndex, createdAt, kind',
        progress: 'docId, updatedAt',
        settings: 'key',
        figures: 'id, docId, [docId+pageIndex], pageIndex, kind',
        sessions: 'id, docId, dateKey, startedAt, endedAt',
        goals: 'id',
        tasks: 'id, order, schedule, linkedDocId, archivedAt, createdAt',
        taskLog: 'id, taskId, dateKey, [taskId+dateKey], completedAt',
        challengeLog: 'id, dateKey, challengeKey, [dateKey+challengeKey], completedAt',
        decks: 'id, docId, updatedAt, createdAt',
        cards: 'id, deckId, docId, savedAt, dueAt, box, createdAt',
        reviews: 'id, cardId, reviewedAt',
      })
      .upgrade(async (tx) => {
        // Ensure existing settings row seamlessly merges with Phase 2 defaults without losing user overrides
        const existingSettings = await tx.table('settings').get('reading_settings');
        if (existingSettings && existingSettings.value && typeof existingSettings.value === 'object') {
          const val = existingSettings.value as Partial<ReadingSettings>;
          await tx.table('settings').put({
            key: 'reading_settings',
            value: {
              ...DEFAULT_READING_SETTINGS,
              ...val,
              readingFont: val.readingFont ?? val.fontFamily ?? 'literata',
            },
          });
        }
      });
  }
}

export const db = new ReadFlowDatabase();

export function makePageId(docId: string, pageIndex: number): string {
  return `${docId}:${pageIndex}`;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore errors in private browsing or restricted contexts
  }
  return false;
}

export async function getStorageQuotaEstimate(): Promise<{
  usage: number;
  quota: number;
  remaining: number;
} | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const usage = est.usage ?? 0;
      const quota = est.quota ?? 0;
      return {
        usage,
        quota,
        remaining: Math.max(0, quota - usage),
      };
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function deleteFiguresForDocument(docId: string): Promise<void> {
  try {
    await db.transaction('rw', [db.figures, db.bookmarks, db.documents], async () => {
      await db.figures.where('docId').equals(docId).delete();
      await db.bookmarks
        .where('docId')
        .equals(docId)
        .filter((b) => b.kind === 'figure')
        .delete();
      await db.documents.update(docId, {
        figureCount: 0,
        figuresStatus: 'pending',
        figuresScannedPages: 0,
      });
    });
  } catch {
    // Ignore
  }
}

export async function purgeDocumentCompletely(docId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.documents,
      db.files,
      db.covers,
      db.pages,
      db.highlights,
      db.bookmarks,
      db.progress,
      db.figures,
    ],
    async () => {
      await db.documents.delete(docId);
      await db.files.delete(docId);
      await db.covers.delete(docId);
      await db.pages.where('docId').equals(docId).delete();
      await db.highlights.where('docId').equals(docId).delete();
      await db.bookmarks.where('docId').equals(docId).delete();
      await db.progress.delete(docId);
      await db.figures.where('docId').equals(docId).delete();
    }
  );
}
