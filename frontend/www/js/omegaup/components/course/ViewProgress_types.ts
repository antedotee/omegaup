// Shared helpers extracted from ViewProgress.vue so plain `.ts` entry points
// and sibling test files can import them (fork-ts-checker only sees the default
// export of a `.vue` through the ambient shim, so named imports from a `.vue`
// fail with TS2614). ViewProgress.vue re-exports them for existing importers;
// no runtime change.

import { TableCell, Percentage } from '../../csv';

export function escapeXml(cell: TableCell): string {
  if (typeof cell !== 'string') return '';
  return cell
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

export function toOds(courseName: string, table: TableCell[][] | null): string {
  if (table === null) return '';
  let result = `<table:table table:name="${escapeXml(courseName)}">\n`;
  result += `<table:table-column table:number-columns-repeated="${table[0].length}"/>\n`;
  for (const row of table) {
    result += '<table:table-row>\n';
    for (const cell of row) {
      if (cell instanceof Percentage) {
        result += `<table:table-cell office:value-type="percentage" office:value="${cell.value.toFixed(
          4,
        )}"><text:p>${cell.toString()}</text:p></table:table-cell>`;
      } else if (typeof cell === 'number') {
        const num: number = cell;
        result += `<table:table-cell office:value-type="float" office:value="${num}"><text:p>${num.toPrecision(
          2,
        )}</text:p></table:table-cell>`;
      } else {
        result += `<table:table-cell office:value-type="string"><text:p>${escapeXml(
          cell,
        )}</text:p></table:table-cell>`;
      }
    }
    result += '</table:table-row>\n';
  }
  result += '</table:table>';
  return result;
}
