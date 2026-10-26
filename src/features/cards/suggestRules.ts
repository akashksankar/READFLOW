export type CardRuleKind =
  | 'definition'
  | 'bold-term'
  | 'fact'
  | 'key-sentence'
  | 'list';

export interface CardSuggestion {
  id: string;
  kind: CardRuleKind;
  label: string;
  front: string;
  back: string;
  kindModel: 'qa' | 'cloze' | 'quote';
  pageNumber?: number;
}

/**
 * Pure, non-AI rule-based card candidate extractor from a text selection,
 * paragraph, or chapter blocks.
 */
export function suggestCardsFromText(
  text: string,
  options?: {
    boldPhrases?: string[];
    headingTitle?: string;
    pageNumber?: number;
  }
): CardSuggestion[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const suggestions: CardSuggestion[] = [];
  const seenFronts = new Set<string>();

  const pushSuggestion = (item: Omit<CardSuggestion, 'id'>) => {
    const key = `${item.front.toLowerCase()}__${item.back.toLowerCase()}`;
    if (seenFronts.has(key)) return;
    seenFronts.add(key);
    suggestions.push({
      ...item,
      id: `sug_${suggestions.length + 1}_${Math.abs(hashText(key)).toString(36)}`,
    });
  };

  // Split text into sentences
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);

  // 1. Definition rule:
  // "<Term> is/are/means/refers to <definition>" or "<Term>: <definition>" or "<Term> — <definition>"
  const defColonRegex = /^([A-Z][A-Za-z0-9\s-]{1,42})\s*(?::|—|–)\s+(.{12,240})$/;
  const defVerbRegex =
    /^([A-Z][A-Za-z0-9\s-]{1,42}?)\s+(?:is defined as|refers to|means|denotes|is|are)\s+(.{12,240})$/;

  for (const s of sentences) {
    const colonMatch = s.match(defColonRegex);
    if (colonMatch) {
      const term = colonMatch[1].trim();
      const def = colonMatch[2].trim();
      pushSuggestion({
        kind: 'definition',
        label: 'Definition',
        front: `What is ${term}?`,
        back: def,
        kindModel: 'qa',
        pageNumber: options?.pageNumber,
      });
      continue;
    }

    const verbMatch = s.match(defVerbRegex);
    if (verbMatch) {
      const term = verbMatch[1].trim();
      const wordCount = term.split(/\s+/).length;
      if (wordCount <= 5 && !/^(This|That|It|There|These|Those)\b/i.test(term)) {
        pushSuggestion({
          kind: 'definition',
          label: 'Definition',
          front: `What does "${term}" mean?`,
          back: verbMatch[2].trim(),
          kindModel: 'qa',
          pageNumber: options?.pageNumber,
        });
      }
    }
  }

  // 2. Bold term rule:
  // If bold spans exist in the paragraph, pair the bold phrase with its containing sentence
  if (options?.boldPhrases && options.boldPhrases.length > 0) {
    for (const rawBold of options.boldPhrases) {
      const bold = rawBold.trim().replace(/[:.—-]+$/, '');
      if (bold.length < 3 || bold.length > 48) continue;
      const hostSentence =
        sentences.find((s) => s.toLowerCase().includes(bold.toLowerCase())) ?? cleaned;
      pushSuggestion({
        kind: 'bold-term',
        label: 'Bold term',
        front: bold,
        back: hostSentence,
        kindModel: 'qa',
        pageNumber: options?.pageNumber,
      });
    }
  }

  // 3. Number / date / named-fact cloze rule:
  // Sentence containing a 4-digit year, percentage, or quantity with units
  const factTokenRegex =
    /\b(\d{4}|\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*(?:ms|s|px|pt|km|m|kg|g|Hz|MHz|GHz|MB|GB|years|days|hours|minutes|seconds))\b/;
  for (const s of sentences) {
    const m = s.match(factTokenRegex);
    if (m && m[1]) {
      const answer = m[1];
      const blanked = s.replace(answer, `{{${answer}}}`);
      pushSuggestion({
        kind: 'fact',
        label: 'Fact',
        front: blanked,
        back: answer,
        kindModel: 'cloze',
        pageNumber: options?.pageNumber,
      });
    }
  }

  // 4. List rule:
  // Paragraph or lines containing 3–6 bulleted or numbered items
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bulletLines = lines.filter((l) => /^(?:[-•*]|\d+[.)])\s+/.test(l));
  if (bulletLines.length >= 3 && bulletLines.length <= 6) {
    const promptHeading =
      options?.headingTitle ||
      (lines[0] && !/^(?:[-•*]|\d+[.)])\s+/.test(lines[0])
        ? lines[0]
        : 'Key points from this section');
    pushSuggestion({
      kind: 'list',
      label: 'List',
      front: promptHeading,
      back: bulletLines.map((b) => b.replace(/^(?:[-•*]|\d+[.)])\s+/, '• ')).join('\n'),
      kindModel: 'qa',
      pageNumber: options?.pageNumber,
    });
  }

  // 5. Key sentence rule:
  // First sentence of a section or highlight text
  if (sentences.length > 0) {
    const first = sentences[0];
    const prompt = options?.headingTitle
      ? `Core takeaway: ${options.headingTitle}`
      : `Key idea from "${first.split(/\s+/).slice(0, 5).join(' ')}..."`;
    pushSuggestion({
      kind: 'key-sentence',
      label: 'Key sentence',
      front: prompt,
      back: first,
      kindModel: 'quote',
      pageNumber: options?.pageNumber,
    });
  }

  return suggestions;
}

export function renderClozePrompt(front: string, revealed: boolean): string {
  return front.replace(/\{\{([^}]+)\}\}/g, (_, inner: string) =>
    revealed ? `[${inner}]` : '______'
  );
}

function hashText(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}
