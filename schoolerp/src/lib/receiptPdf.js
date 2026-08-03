// lib/receiptPdf.js
//
// Builds a downloadable PDF for a single fee receipt using jsPDF.
// Install: npm install jspdf
//
// Usage:
//   import { downloadReceiptPdf } from '../lib/receiptPdf';
//   downloadReceiptPdf({
//     receipt_number: 'RCPT-2026-000123',
//     student_name: 'Aarav Sharma',
//     class_section: '1st Standard - A',
//     academic_year: '2026-27',
//     amount: 12000,
//     mode: 'Cash',
//     reference_no: '',
//     notes: '',
//     created_at: new Date().toISOString(),
//     school_name: 'Greenwood Public School', // optional, defaults below
//   });

import { jsPDF } from 'jspdf';

const INR_PLAIN = (n) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n) || 0);

const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export function downloadReceiptPdf(receipt) {
  const {
    receipt_number,
    student_name,
    class_section,
    academic_year,
    amount,
    mode,
    reference_no,
    notes,
    created_at,
    school_name = 'School Fee Receipt',
  } = receipt;

  const doc = new jsPDF({ unit: 'pt', format: 'a5' }); // compact receipt size
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 36;
  let y = 48;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(school_name, pageWidth / 2, y, { align: 'center' });

  y += 20;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90);
  doc.text('Fee Payment Receipt', pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0);

  y += 14;
  doc.setDrawColor(200);
  doc.line(marginX, y, pageWidth - marginX, y);

  // Receipt meta
  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(receipt_number || '—', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(fmtDateTime(created_at), pageWidth - marginX, y, { align: 'right' });

  y += 28;
  const rows = [
    ['Student Name', student_name || '—'],
    ['Class / Section', class_section || '—'],
    ['Academic Year', academic_year || '—'],
    ['Payment Mode', mode || '—'],
  ];
  if (reference_no) rows.push(['Reference No.', reference_no]);

  doc.setFontSize(10.5);
  rows.forEach(([label, value]) => {
    doc.setTextColor(110);
    doc.text(label, marginX, y);
    doc.setTextColor(0);
    doc.text(String(value), pageWidth - marginX, y, { align: 'right' });
    y += 20;
  });

  if (notes) {
    doc.setTextColor(110);
    doc.text('Notes', marginX, y);
    doc.setTextColor(0);
    const wrapped = doc.splitTextToSize(notes, pageWidth - marginX * 2 - 80);
    doc.text(wrapped, pageWidth - marginX, y, { align: 'right' });
    y += 16 * wrapped.length + 4;
  }

  y += 8;
  doc.setDrawColor(200);
  doc.line(marginX, y, pageWidth - marginX, y);

  // Amount box
  y += 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Amount Paid', marginX, y);
  doc.setFontSize(16);
  doc.text(`Rs. ${INR_PLAIN(amount)}`, pageWidth - marginX, y, { align: 'right' });

  // Footer
  y += 50;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(140);
  doc.text(
    'This is a system-generated receipt and does not require a signature.',
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  const filename = `${receipt_number || 'receipt'}.pdf`;
  doc.save(filename);
}