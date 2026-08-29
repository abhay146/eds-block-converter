import * as cheerio from 'cheerio';

import type { Element } from 'domhandler';

/**
 * Convert Mammoth HTML into EDS-style HTML.
 */
export function convertToEdsHtml(
  html: string,
): string {
  const $ = cheerio.load(html);

  $('table').each((_, table) => {
    const converted = convertTableToBlock(
      $,
      table,
    );

    $(table).replaceWith(converted);
  });

  return $('body').html() || '';
}

/**
 * Convert DOCX table into EDS block.
 */
function convertTableToBlock(
  $: cheerio.CheerioAPI,
  table: Element,
): string {
  const rows = $(table)
    .find('tr')
    .toArray();

  if (!rows.length) {
    return $(table).toString();
  }

  if (isMetadataTable($, rows)) {
    return convertMetadataTable($, rows);
  }

  const blockRows = rows
    .map((row) => {
      const cells = $(row)
        .find('th, td')
        .toArray();

      if (!cells.length) {
        return '';
      }

      const cellHtml = cells
        .map((cell) => {
          const content = cleanCell(
            $,
            $(cell).html() || '',
          );

          return `<div>${content}</div>`;
        })
        .join('\n    ');

      return [
        '<div>',
        `    ${cellHtml}`,
        '</div>',
      ].join('\n');
    })
    .filter(Boolean);

  if (!blockRows.length) {
    return '';
  }

  return [
    '<div class="cards">',
    ...blockRows,
    '</div>',
  ].join('\n');
}

/**
 * Detect metadata tables.
 */
function isMetadataTable(
  $: cheerio.CheerioAPI,
  rows: Element[],
): boolean {
  const text = rows
    .slice(0, 2)
    .map((row) => $(row).text())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return (
    text.includes('section metadata') ||
    text === 'metadata' ||
    text.startsWith('metadata ')
  );
}

/**
 * Convert metadata table.
 */
function convertMetadataTable(
  $: cheerio.CheerioAPI,
  rows: Element[],
): string {
  const values: string[] = [];

  for (const row of rows) {
    const cells = $(row)
      .find('th, td')
      .toArray();

    if (cells.length < 2) {
      continue;
    }

    const key = $(cells[0])
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const value = $(cells[1])
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    if (
      key &&
      value &&
      key.toLowerCase() !== 'section metadata' &&
      key.toLowerCase() !== 'metadata'
    ) {
      values.push(
        `<div>${escapeHtml(key)}</div>`,
        `<div>${escapeHtml(value)}</div>`,
      );
    }
  }

  if (!values.length) {
    return '';
  }

  return [
    '<div class="metadata">',
    ...values,
    '</div>',
  ].join('\n');
}

/**
 * Clean table cell.
 */
function cleanCell(
  $: cheerio.CheerioAPI,
  cell: string,
): string {
  const $cell = cheerio.load(cell);

  /**
   * Replace images.
   */
  $cell('img').each((_, img) => {
    const alt =
      $cell(img)
        .attr('alt')
        ?.trim() || '';

    if (alt) {
      $cell(img).replaceWith(
        `[IMAGE:${escapeText(alt)}]`,
      );
    } else {
      $cell(img).replaceWith('[IMAGE]');
    }
  });

  /**
   * Remove empty paragraphs.
   */
  $cell('p').each((_, p) => {
    const text = $cell(p)
      .text()
      .trim();

    const hasImage =
      text.includes('[IMAGE');

    if (!text && !hasImage) {
      $cell(p).remove();
    }
  });

  /**
   * Remove empty divs.
   */
  $cell('div').each((_, div) => {
    const text = $cell(div)
      .text()
      .trim();

    if (
      !text &&
      !$cell(div).find('img').length
    ) {
      $cell(div).remove();
    }
  });

  return (
    $cell
      .root()
      .html()
      ?.trim() || ''
  );
}

/**
 * Escape HTML.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape image marker text.
 */
function escapeText(value: string): string {
  return value
    .replace(/[\[\]]/g, '')
    .trim();
}