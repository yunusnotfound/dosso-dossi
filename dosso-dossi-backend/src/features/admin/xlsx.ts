import ExcelJS from 'exceljs';

/// Panel dışa aktarımlarının ortak Excel biçimi.
/// Marka kimliği tablolara taşınır: altın başlık şeridi, koyu kahve sütun
/// başlıkları, krem zebra satırlar. Renkler mobil app_colors.dart ile aynı.
const BRAND = {
  gold: 'FFEAC980',
  onGold: 'FF6B4E12',
  coffee: 'FF2E211A',
  onDark: 'FFF7F2EA',
  canvas: 'FFF3EDE2',
  zebra: 'FFFBF8F3',
  line: 'FFEFE9DF',
  ok: 'FF3E7C4F',
  bad: 'FFC24A30',
} as const;

export type CellFormat = 'text' | 'money' | 'int' | 'date' | 'signedMoney';

export interface SheetColumn<T> {
  header: string;
  width: number;
  format?: CellFormat;
  value: (row: T) => string | number | Date | null;
}

export interface SheetSpec<T> {
  name: string;
  columns: SheetColumn<T>[];
  rows: T[];
  /// Tablonun üstünde gösterilen özet satırları ("Toplam ciro: …").
  summary?: { label: string; value: string | number; format?: CellFormat }[];
}

const NUM_FORMATS: Record<CellFormat, string> = {
  text: '@',
  money: '#,##0.00 ₺',
  signedMoney: '[Green]#,##0.00 ₺;[Red]-#,##0.00 ₺',
  int: '#,##0',
  date: 'dd.mm.yyyy hh:mm',
};

/// Marka başlığı + rapor adı + tarih; ardından (varsa) özet ve tablo.
function buildSheet<T>(wb: ExcelJS.Workbook, spec: SheetSpec<T>, subtitle: string) {
  const ws = wb.addWorksheet(spec.name, {
    views: [{ state: 'frozen', ySplit: 0 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });
  const lastCol = spec.columns.length;

  // ── Marka şeridi ──
  ws.mergeCells(1, 1, 1, lastCol);
  const brandCell = ws.getCell(1, 1);
  brandCell.value = 'DOSSO DOSSI COFFEE';
  brandCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: BRAND.onGold } };
  brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.gold } };
  brandCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 34;

  // ── Rapor adı / tarih ──
  ws.mergeCells(2, 1, 2, lastCol);
  const subCell = ws.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { size: 10, color: { argb: BRAND.onGold } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.canvas } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;

  let cursor = 3;

  // ── Özet blok ──
  if (spec.summary?.length) {
    cursor += 1;
    for (const item of spec.summary) {
      const labelCell = ws.getCell(cursor, 1);
      labelCell.value = item.label;
      labelCell.font = { bold: true, color: { argb: BRAND.coffee } };
      const valueCell = ws.getCell(cursor, 2);
      valueCell.value = item.value;
      valueCell.numFmt = NUM_FORMATS[item.format ?? 'text'];
      cursor += 1;
    }
    cursor += 1;
  }

  // ── Sütun başlıkları ──
  const headerRow = ws.getRow(cursor);
  spec.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: BRAND.onDark }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.coffee } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getColumn(i + 1).width = c.width;
  });
  headerRow.height = 24;
  const headerRowNumber = cursor;

  // ── Veri ──
  spec.rows.forEach((row, index) => {
    const r = ws.getRow(headerRowNumber + 1 + index);
    spec.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      cell.value = c.value(row);
      cell.numFmt = NUM_FORMATS[c.format ?? 'text'];
      cell.alignment = {
        vertical: 'middle',
        horizontal: c.format === 'text' || !c.format ? 'left' : 'right',
        indent: 1,
      };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.zebra } };
      }
      cell.border = { bottom: { style: 'thin', color: { argb: BRAND.line } } };
    });
  });

  // Başlık satırı sabitlensin ve süzgeç açık gelsin
  ws.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  if (spec.rows.length > 0) {
    ws.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber + spec.rows.length, column: lastCol },
    };
  }
  return ws;
}

/// Birden çok sayfalı, markalı çalışma kitabı üretir.
export async function buildWorkbook(
  title: string,
  sheets: SheetSpec<never>[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dosso Dossi Yönetim Paneli';
  wb.created = new Date();

  const stamp = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());
  const subtitle = `${title} · ${stamp} tarihinde oluşturuldu`;

  for (const sheet of sheets) buildSheet(wb, sheet, subtitle);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/// Dosya adı: rapor-2026-08-19.xlsx
export function fileStamp(prefix: string, ext: 'xlsx' | 'csv'): string {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return `${prefix}-${iso}.${ext}`;
}
