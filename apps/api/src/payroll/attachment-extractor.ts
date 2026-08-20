import { extractRawText } from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import * as XLSX from 'xlsx';

import {
  PayrollImportRowSchema,
  type PayrollImportRow,
  type PayrollValidationIssue,
} from '@finora/shared';

const MAX_TEXT = 120_000;
const MAX_ROWS = 500;
const SUPPORTED_TEXT = new Set(['txt', 'csv', 'tsv', 'md', 'json', 'xml', 'rtf']);
const extension = (name: string) => name.toLowerCase().split('.').pop() ?? '';

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value == null ? '' : String(value).trim();
}

function parseAmount(value: unknown) {
  const raw = clean(value).replace(/[^0-9.\-]/g, '');
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 && amount <= 10_000_000 ? amount : null;
}

function canonicalHeader(value: unknown) {
  const header = clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/^(employee|staff|employeename|name|fullname)$/.test(header)) return 'employeeName';
  if (/^(salary|netpay|amount|amountdue|grosspay|pay)$/.test(header)) return 'amount';
  if (/^(currency|ccy)$/.test(header)) return 'currency';
  if (/^(phone|phonenumber|momonumber|account|accountnumber|destination)$/.test(header)) return 'destination';
  if (/^(network|provider|rail|method)$/.test(header)) return 'rail';
  if (/^(period|month|payperiod)$/.test(header)) return 'period';
  if (/^(paydate|date|paymentdate)$/.test(header)) return 'payDate';
  return null;
}

function normalizeDate(value: unknown) {
  const raw = clean(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function rowsFromMatrix(matrix: unknown[][], sourceName: string, locationPrefix: string): PayrollImportRow[] {
  const headers = matrix[0]?.map(canonicalHeader) ?? [];
  const hasHeader = headers.some(Boolean);
  const data = hasHeader ? matrix.slice(1) : matrix;
  const issues: PayrollValidationIssue[] = [];
  return data.slice(0, MAX_ROWS).map((values, index) => {
    const rowId = `row-${index + 1}`;
    const get = (key: 'employeeName' | 'amount' | 'currency' | 'destination' | 'rail' | 'period' | 'payDate') => {
      const column = headers.indexOf(key);
      return column >= 0 ? values[column] : '';
    };
    const employeeName = clean(hasHeader ? get('employeeName') : values[0]) || null;
    const amount = parseAmount(hasHeader ? get('amount') : values[1]);
    const currency = clean(hasHeader ? get('currency') : '') || null;
    const destination = clean(hasHeader ? get('destination') : values[2]) || null;
    const rail = clean(hasHeader ? get('rail') : '') || null;
    const period = clean(hasHeader ? get('period') : '') || null;
    const payDate = normalizeDate(hasHeader ? get('payDate') : '');
    const rowIssues: PayrollValidationIssue[] = [];
    if (!employeeName) rowIssues.push({ code: 'employee_missing', message: 'Employee name is missing.', rowId, blocking: true });
    if (amount == null) rowIssues.push({ code: 'amount_missing_or_invalid', message: 'A positive payment amount is required.', rowId, blocking: true });
    if (!currency) rowIssues.push({ code: 'currency_missing', message: 'Currency is missing.', rowId, blocking: true });
    if (!destination) rowIssues.push({ code: 'destination_missing', message: 'A payout destination is missing.', rowId, blocking: true });
    issues.push(...rowIssues);
    return PayrollImportRowSchema.parse({
      rowId, employeeName, employeeId: null, amount, currency, destination, rail, period, payDate,
      confidence: rowIssues.length ? 0.35 : 0.9,
      citations: [{ sourceName, location: `${locationPrefix}, row ${index + (hasHeader ? 2 : 1)}` }],
      issues: rowIssues,
    });
  });
}

async function textToRows(text: string, sourceName: string) {
  const lines = text.slice(0, MAX_TEXT).split(/\r?\n/).filter((line) => line.trim());
  const delimiter = lines[0]?.includes('\t') ? '\t' : lines[0]?.includes(',') ? ',' : null;
  if (!delimiter) {
    const naturalRows = lines.map((line) => {
      const amountMatch = line.match(/(?:GHS|USD|EUR|GBP|NGN|KES|ZAR|\$|€|£)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
      const currencyMatch = line.match(/\b(GHS|USD|EUR|GBP|NGN|KES|ZAR)\b/i);
      const destinationMatch = line.match(/\b(?:\+?\d[\d\s-]{7,}|\d{8,})\b/);
      if (!amountMatch) return [line];
      const name = line.slice(0, amountMatch.index).replace(/[-:|]+$/g, '').trim();
      return [name, amountMatch[1], destinationMatch?.[0] ?? '', currencyMatch?.[1]?.toUpperCase() ?? ''];
    });
    return rowsFromMatrix(
      [['name', 'amount', 'destination', 'currency'], ...naturalRows],
      sourceName,
      'Text',
    );
  }
  return rowsFromMatrix(lines.map((line) => line.split(delimiter)), sourceName, 'Text');
}

export async function extractPayrollRows(input: {
  bytes: ArrayBuffer;
  fileName: string;
  contentType: string;
  extractImage?: (input: { bytes: Uint8Array; contentType: string; fileName: string }) => Promise<unknown[][]>;
}) {
  const ext = extension(input.fileName);
  if (SUPPORTED_TEXT.has(ext) || input.contentType.startsWith('text/')) {
    return textToRows(new TextDecoder().decode(input.bytes), input.fileName);
  }
  if (ext === 'xlsx' || ext === 'xls' || input.contentType.includes('spreadsheet')) {
    const workbook = XLSX.read(input.bytes, { type: 'array', cellDates: true, dense: true });
    return workbook.SheetNames.flatMap((sheetName) => {
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, { header: 1, raw: false, defval: '' });
      return rowsFromMatrix(matrix, input.fileName, `Sheet "${sheetName}"`);
    }).slice(0, MAX_ROWS);
  }
  if (ext === 'docx' || input.contentType.includes('wordprocessingml')) {
    const result = await extractRawText({ arrayBuffer: input.bytes });
    return textToRows(result.value, input.fileName);
  }
  if (ext === 'pdf' || input.contentType === 'application/pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(input.bytes));
    const result = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(result.text) ? result.text : [result.text];
    return pages.flatMap((page, index) => rowsFromMatrix(String(page).split(/\r?\n/).map((line) => [line]), input.fileName, `PDF page ${index + 1}`)).slice(0, MAX_ROWS);
  }
  if (input.contentType.startsWith('image/') && input.extractImage) {
    const matrix = await input.extractImage({ bytes: new Uint8Array(input.bytes), contentType: input.contentType, fileName: input.fileName });
    return rowsFromMatrix(matrix, input.fileName, 'Image');
  }
  if (input.contentType.startsWith('image/')) throw new Error('payroll_image_extraction_unavailable');
  throw new Error('payroll_file_format_not_supported');
}

export function summarizePayrollRows(rows: PayrollImportRow[]) {
  const currency = rows.find((row) => row.currency)?.currency ?? 'USD';
  const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const blockingIssues = rows.flatMap((row) => row.issues).filter((issue) => issue.blocking);
  return { total, currency, blockingIssues, warnings: [] as PayrollValidationIssue[] };
}

export function validatePayrollRow(row: PayrollImportRow): PayrollImportRow {
  const issues: PayrollValidationIssue[] = [];
  if (!row.employeeName?.trim()) {
    issues.push({ code: 'employee_missing', message: 'Employee name is missing.', rowId: row.rowId, blocking: true });
  }
  if (row.amount == null || !Number.isFinite(row.amount) || row.amount <= 0 || row.amount > 10_000_000) {
    issues.push({ code: 'amount_missing_or_invalid', message: 'A positive payment amount is required.', rowId: row.rowId, blocking: true });
  }
  if (!row.currency?.trim()) {
    issues.push({ code: 'currency_missing', message: 'Currency is missing.', rowId: row.rowId, blocking: true });
  }
  if (!row.destination?.trim()) {
    issues.push({ code: 'destination_missing', message: 'A payout destination is missing.', rowId: row.rowId, blocking: true });
  }
  return PayrollImportRowSchema.parse({
    ...row,
    employeeName: row.employeeName?.trim() || null,
    currency: row.currency?.trim().toUpperCase() || null,
    destination: row.destination?.trim() || null,
    rail: row.rail?.trim() || null,
    period: row.period?.trim() || null,
    issues,
    confidence: issues.length ? Math.min(row.confidence, 0.35) : Math.max(row.confidence, 0.9),
  });
}
