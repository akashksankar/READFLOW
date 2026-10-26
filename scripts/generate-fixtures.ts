/**
 * Generates deterministic Phase 1 + Phase 2 test fixtures under tests/fixtures/ using pdf-lib.
 * Fixtures live only under tests/fixtures/ and are never shown in the app.
 */

import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures');

async function generateFixtures() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // 1. 3-page simple text PDF
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    for (let p = 1; p <= 3; p++) {
      const page = doc.addPage([600, 800]);
      page.drawText(`Chapter ${p}: The Quiet Art of Reading`, {
        x: 60,
        y: 720,
        size: 18,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText(
        `This is page ${p} of the three-page simple text fixture. Long-form reading requires calm typography, steady margins, and zero visual distraction.`,
        { x: 60, y: 670, size: 12, font, maxWidth: 460, lineHeight: 18 }
      );
      page.drawText(
        `A second paragraph begins here after a clear vertical gap. Readers can select any phrase in this paragraph to apply a Saffron, Clay, Sage, or Slate wash.`,
        { x: 60, y: 590, size: 12, font, maxWidth: 460, lineHeight: 18 }
      );
    }
    const bytes = await doc.save();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'simple-3page.pdf'), bytes);
  }

  // 2. 300-page text PDF
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    for (let p = 1; p <= 300; p++) {
      const page = doc.addPage([600, 800]);
      page.drawText(`Section ${p}`, { x: 60, y: 720, size: 16, font });
      page.drawText(
        `Page ${p} of 300. This long-document fixture verifies virtualized scrolling in Comfort mode and flat canvas memory in Original mode.`,
        { x: 60, y: 680, size: 12, font, maxWidth: 460, lineHeight: 18 }
      );
    }
    const bytes = await doc.save();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'book-300page.pdf'), bytes);
  }

  // 3. Two-column PDF
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    const page = doc.addPage([600, 800]);
    for (let i = 0; i < 6; i++) {
      page.drawText(`Left column line ${i + 1} with steady scholarly prose.`, {
        x: 50,
        y: 700 - i * 22,
        size: 11,
        font,
      });
      page.drawText(`Right column line ${i + 1} continuing the second column.`, {
        x: 320,
        y: 700 - i * 22,
        size: 11,
        font,
      });
    }
    const bytes = await doc.save();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'two-column.pdf'), bytes);
  }

  // 4. PDF with repeating headers and footers and hyphenated line endings
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    for (let p = 1; p <= 4; p++) {
      const page = doc.addPage([600, 800]);
      page.drawText('COLLECTED ESSAYS ON TYPOGRAPHY', { x: 60, y: 760, size: 10, font });
      page.drawText('The quick brown fox jumps over the extraor-', {
        x: 60,
        y: 650,
        size: 12,
        font,
      });
      page.drawText('dinary lazy dog in the quiet afternoon.', {
        x: 60,
        y: 632,
        size: 12,
        font,
      });
      page.drawText(`Page ${p}`, { x: 280, y: 40, size: 10, font });
    }
    const bytes = await doc.save();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'headers-footers-hyphens.pdf'), bytes);
  }

  // 5. Image-only / no extractable text PDF
  {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    page.drawRectangle({
      x: 80,
      y: 200,
      width: 440,
      height: 500,
      color: rgb(0.85, 0.82, 0.76),
    });
    const bytes = await doc.save();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'image-only.pdf'), bytes);
  }

  // 6. Password-protected / encrypted PDF header structure
  {
    const encryptedStub = `%PDF-1.7
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj
3 0 obj << /Filter /Standard /V 2 /R 3 /Length 128 /P -4 /O (00000000000000000000000000000000) /U (00000000000000000000000000000000) >> endobj
trailer << /Root 1 0 R /Encrypt 3 0 R >>
%%EOF`;
    fs.writeFileSync(path.join(FIXTURES_DIR, 'password-protected.pdf'), encryptedStub, 'utf-8');
  }

  // 7. Truncated / corrupted PDF
  {
    const truncated = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages ';
    fs.writeFileSync(path.join(FIXTURES_DIR, 'truncated.pdf'), truncated, 'utf-8');
  }

  // 8. Non-PDF file renamed .pdf
  {
    const nonPdf = 'Hello world! This is a plain text file renamed with a .pdf extension.';
    fs.writeFileSync(path.join(FIXTURES_DIR, 'not-a-pdf.pdf'), nonPdf, 'utf-8');
  }

  // 9. Phase 2: PDF with figures, vector diagrams, and captions
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    const page = doc.addPage([600, 800]);
    page.drawText('Chapter 1: Visual Diagrams and Figures', {
      x: 60,
      y: 740,
      size: 18,
      font,
    });
    // Draw a multi-element vector diagram
    for (let i = 0; i < 6; i++) {
      page.drawRectangle({
        x: 80 + i * 35,
        y: 500,
        width: 28,
        height: 40 + i * 15,
        color: rgb(0.7, 0.3, 0.2),
      });
    }
    page.drawText('Figure 1.1: Comparative reading velocity across six typography presets.', {
      x: 80,
      y: 470,
      size: 11,
      font,
    });
    const bytes = await doc.save();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'figures-and-diagrams.pdf'), bytes);
  }

  // 10. Phase 2: Watermarked PDF (repeated small graphic on every page)
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    for (let p = 1; p <= 6; p++) {
      const page = doc.addPage([600, 800]);
      page.drawRectangle({
        x: 500,
        y: 720,
        width: 55,
        height: 55,
        color: rgb(0.8, 0.8, 0.8),
      });
      page.drawText(`Page ${p} prose with a repeating corner watermark.`, {
        x: 60,
        y: 640,
        size: 12,
        font,
      });
    }
    const bytes = await doc.save();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'watermarked.pdf'), bytes);
  }

  // 11. Phase 2: Study chapter PDF with definitions, bold terms, dates/percentages, and lists
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
    const page = doc.addPage([600, 800]);
    page.drawText('Chapter 4: Memory Consolidation', {
      x: 60,
      y: 730,
      size: 18,
      font: boldFont,
    });
    page.drawText(
      'Spaced repetition: A learning technique that incorporates increasing intervals of time between subsequent reviews of previously learned material.',
      { x: 60, y: 680, size: 12, font, maxWidth: 460, lineHeight: 16 }
    );
    page.drawText(
      'In 1885 Hermann Ebbinghaus demonstrated that memory retention drops by 60% within 24 hours without active recall.',
      { x: 60, y: 620, size: 12, font, maxWidth: 460, lineHeight: 16 }
    );
    const bytes = await doc.save();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'study-chapter.pdf'), bytes);
  }

  console.log('Generated all 11 test fixtures in tests/fixtures/.');
}

generateFixtures().catch((err) => {
  console.error(err);
  process.exit(1);
});
