const PDFDocument = require('pdfkit');
const { getAllSettings } = require('./settings');

const BRAND_GREEN = '#0b5d3b';
const BRAND_GOLD = '#c9a227';

/**
 * Creates a new PDF document and draws a letterhead using the configured
 * institution name/address (Settings page) at the top. Returns the document;
 * caller is responsible for piping it to a response and calling doc.end()
 * when finished adding content.
 */
function newDocument({ title }) {
  const settings = getAllSettings();
  const institutionName = settings.institution_name || 'Fountain of Peace University College';
  const institutionAddress = settings.institution_address || '';

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  doc.rect(0, 0, doc.page.width, 90).fill(BRAND_GREEN);
  doc
    .fillColor('#ffffff')
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(institutionName.toUpperCase(), 50, 25, { width: doc.page.width - 200 });
  doc
    .fontSize(9)
    .font('Helvetica')
    .text(institutionAddress, 50, 46)
    .text('Tukuza Student Information Management System', 50, 60);

  if (title) {
    doc
      .fillColor(BRAND_GOLD)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(title.toUpperCase(), 50, 25, { align: 'right', width: doc.page.width - 100 });
  }

  doc.fillColor('#000000').font('Helvetica');
  doc.y = 110;
  return doc;
}

function currencySymbol() {
  const settings = getAllSettings();
  return settings.currency_symbol || 'K';
}

function footer(doc, note) {
  const bottom = doc.page.height - 60;
  doc
    .fontSize(8)
    .fillColor('#666666')
    .text(note || `Generated ${new Date().toLocaleString()} · Tukuza SIS`, 50, bottom, {
      width: doc.page.width - 100,
      align: 'center',
    });
}

module.exports = { newDocument, footer, currencySymbol, BRAND_GREEN, BRAND_GOLD };
