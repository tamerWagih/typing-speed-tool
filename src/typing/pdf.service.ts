// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import * as path from 'path';
import { TypingSession } from './entities/typing-session.entity';
import { TypingTrial } from './entities/typing-trial.entity';

// Brand colours
const BRAND_BLUE = '#0095DA';
const DARK_BG = '#1a2332';
const HEADER_BG = '#2a3a4e';
const TEXT_WHITE = '#ffffff';
const TEXT_LIGHT = '#b0bec5';
const GREEN = '#4caf50';
const RED = '#ef5350';
const ROW_ALT = '#f5f7fa';

export function generateSessionPdf(session: TypingSession): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
    info: {
      Title: `Typing Test Report - ${session.candidate.fullName}`,
      Author: 'Octopus Outsourcing',
    },
  });

  const pageWidth = 595.28 - 100; // A4 width minus margins
  const trials = session.trials || [];
  const enTrials = trials
    .filter((t) => t.language === 'en' && !t.wasVoided)
    .sort((a, b) => a.trialNumber - b.trialNumber);
  const arTrials = trials
    .filter((t) => t.language === 'ar' && !t.wasVoided)
    .sort((a, b) => a.trialNumber - b.trialNumber);

  // ── Header with Logo ──
  doc.rect(0, 0, 595.28, 90).fill(DARK_BG);

  // Embed Octopus logo
  try {
    const logoPath = path.join(__dirname, 'assets', 'logo.png');
    doc.image(logoPath, 50, 15, { height: 40 });
  } catch (e) {
    // Fallback to text if logo not found
    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor(BRAND_BLUE)
      .text('OCTOPUS OUTSOURCING', 50, 25, { width: pageWidth });
  }
  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor(TEXT_LIGHT)
    .text('Typing Speed Assessment Report', 50, 62, { width: pageWidth });

  // ── Candidate Info Box ──
  const infoY = 110;
  doc.rect(50, infoY, pageWidth, 80).lineWidth(1).strokeColor('#ddd').stroke();
  doc.rect(50, infoY, pageWidth, 28).fill('#e3f2fd');

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#1565c0')
    .text('CANDIDATE INFORMATION', 60, infoY + 8);

  doc.font('Helvetica').fontSize(10).fillColor('#333');

  const col1 = 60;
  const col2 = 280;
  const row1 = infoY + 38;
  const row2 = infoY + 56;

  doc
    .font('Helvetica-Bold')
    .text('Full Name:', col1, row1)
    .font('Helvetica')
    .text(session.candidate.fullName, col1 + 70, row1);

  doc
    .font('Helvetica-Bold')
    .text('Phone:', col2, row1)
    .font('Helvetica')
    .text(session.candidate.phoneNumber, col2 + 50, row1);

  doc
    .font('Helvetica-Bold')
    .text('National ID:', col1, row2)
    .font('Helvetica')
    .text(session.candidate.nationalId || 'N/A', col1 + 70, row2);

  doc
    .font('Helvetica-Bold')
    .text('Date:', col2, row2)
    .font('Helvetica')
    .text(
      session.completedAt
        ? new Date(session.completedAt).toLocaleDateString('en-GB')
        : 'N/A',
      col2 + 50,
      row2,
    );

  // ── Summary Cards ──
  const cardsY = 210;
  const cardWidth = (pageWidth - 30) / 4;

  const avgEnWpm = avg(enTrials, 'netWpm');
  const avgArWpm = avg(arTrials, 'netWpm');
  const avgEnAcc = avg(enTrials, 'accuracy');
  const avgArAcc = avg(arTrials, 'accuracy');

  const cards = [
    { label: 'EN Avg WPM', value: `${avgEnWpm}`, color: BRAND_BLUE },
    { label: 'AR Avg WPM', value: `${avgArWpm}`, color: BRAND_BLUE },
    { label: 'EN Accuracy', value: `${avgEnAcc}%`, color: avgEnAcc >= 80 ? GREEN : avgEnAcc >= 50 ? '#ff9800' : RED },
    { label: 'AR Accuracy', value: `${avgArAcc}%`, color: avgArAcc >= 80 ? GREEN : avgArAcc >= 50 ? '#ff9800' : RED },
  ];

  cards.forEach((card, i) => {
    const x = 50 + i * (cardWidth + 10);
    doc.roundedRect(x, cardsY, cardWidth, 55, 4).fill('#f8f9fa');
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor(card.color)
      .text(card.value, x, cardsY + 8, { width: cardWidth, align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#666')
      .text(card.label, x, cardsY + 35, { width: cardWidth, align: 'center' });
  });

  // ── English Results Table ──
  let tableY = 285;
  tableY = drawTrialTable(doc, 'English Trials', enTrials, 50, tableY, pageWidth);

  // ── Arabic Results Table ──
  tableY += 20;
  tableY = drawTrialTable(doc, 'Arabic Trials', arTrials, 50, tableY, pageWidth);

  // ── Footer ──
  const footerY = 800;
  doc
    .moveTo(50, footerY)
    .lineTo(50 + pageWidth, footerY)
    .lineWidth(0.5)
    .strokeColor('#ccc')
    .stroke();
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#999')
    .text(
      `Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} • Octopus Outsourcing © ${new Date().getFullYear()}`,
      50,
      footerY + 8,
      { width: pageWidth, align: 'center' },
    );

  return doc;
}

function drawTrialTable(
  doc: PDFKit.PDFDocument,
  title: string,
  trials: TypingTrial[],
  x: number,
  y: number,
  width: number,
): number {
  // Title
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(BRAND_BLUE)
    .text(title, x, y);
  y += 20;

  if (trials.length === 0) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#999')
      .text('No valid trials recorded.', x, y);
    return y + 20;
  }

  // Column config
  const cols = [
    { header: 'Trial', width: 50, align: 'center' as const },
    { header: 'Net WPM', width: 70, align: 'center' as const },
    { header: 'Gross WPM', width: 75, align: 'center' as const },
    { header: 'Accuracy', width: 65, align: 'center' as const },
    { header: 'Correct', width: 60, align: 'center' as const },
    { header: 'Total Words', width: 75, align: 'center' as const },
    { header: 'Errors', width: 55, align: 'center' as const },
    { header: 'Tab Sw.', width: 45, align: 'center' as const },
  ];

  const rowHeight = 22;

  // Header row
  doc.rect(x, y, width, rowHeight).fill(HEADER_BG);
  let colX = x;
  cols.forEach((col) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(TEXT_WHITE)
      .text(col.header, colX + 4, y + 6, {
        width: col.width - 8,
        align: col.align,
      });
    colX += col.width;
  });
  y += rowHeight;

  // Data rows
  trials.forEach((trial, i) => {
    if (i % 2 !== 0) doc.rect(x, y, width, rowHeight).fill(ROW_ALT);

    colX = x;
    const values = [
      `${trial.trialNumber}`,
      `${trial.netWpm}`,
      `${trial.grossWpm}`,
      `${trial.accuracy}%`,
      `${trial.correctWords}`,
      `${trial.totalWordsAttempted}`,
      `${trial.errorCount}`,
      `${trial.tabSwitches || 0}`,
    ];

    values.forEach((val, j) => {
      let color = '#333';
      if (j === 3) {
        // Accuracy column
        const acc = trial.accuracy;
        color = acc >= 80 ? GREEN : acc >= 50 ? '#ff9800' : RED;
      }
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(color)
        .text(val, colX + 4, y + 6, {
          width: cols[j].width - 8,
          align: cols[j].align,
        });
      colX += cols[j].width;
    });
    y += rowHeight;
  });

  // Average row
  doc.rect(x, y, width, rowHeight).fill('#e8eaf6');
  colX = x;
  const avgValues = [
    'AVG',
    `${avg(trials, 'netWpm')}`,
    `${avg(trials, 'grossWpm')}`,
    `${avg(trials, 'accuracy')}%`,
    '',
    '',
    '',
    '',
  ];
  avgValues.forEach((val, j) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#1a237e')
      .text(val, colX + 4, y + 6, {
        width: cols[j].width - 8,
        align: cols[j].align,
      });
    colX += cols[j].width;
  });
  y += rowHeight;

  return y;
}

function avg(trials: TypingTrial[], field: keyof TypingTrial): number {
  if (trials.length === 0) return 0;
  const sum = trials.reduce((s, t) => s + (Number(t[field]) || 0), 0);
  return Math.round(sum / trials.length);
}
