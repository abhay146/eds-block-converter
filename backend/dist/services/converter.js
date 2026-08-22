import * as cheerio from 'cheerio';
/**
 * Convert Mammoth HTML into EDS-style block HTML.
 *
 * Tables are converted into:
 *
 * <div class="cards">
 *   <div>
 *     <div>...</div>
 *     <div>...</div>
 *   </div>
 * </div>
 *
 * The temporary "cards" class is replaced later
 * by the detected block name.
 */
export function convertToEdsHtml(html) {
    const $ = cheerio.load(html);
    $('table').each((_, table) => {
        const converted = convertTableToBlock($, table);
        $(table).replaceWith(converted);
    });
    return $('body').html() || '';
}
/**
 * Convert a table into an EDS block.
 */
function convertTableToBlock($, table) {
    const rows = $(table)
        .find('tr')
        .toArray();
    if (!rows.length) {
        return $(table).toString();
    }
    /**
     * Metadata table should not become a block.
     */
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
            const content = cleanCell($, $(cell).html() || '');
            return `<div>${content}</div>`;
        })
            .join('\n    ');
        return `<div>\n    ${cellHtml}\n  </div>`;
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
function isMetadataTable($, rows) {
    const text = rows
        .slice(0, 2)
        .map((row) => $(row).text())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    return (text.includes('section metadata') ||
        text === 'metadata' ||
        text.startsWith('metadata '));
}
/**
 * Convert metadata table.
 */
function convertMetadataTable($, rows) {
    const values = [];
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
        if (key &&
            value &&
            key.toLowerCase() !== 'section metadata' &&
            key.toLowerCase() !== 'metadata') {
            values.push(`<div>${escapeHtml(key)}</div>`, `<div>${escapeHtml(value)}</div>`);
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
 * Clean a table cell.
 *
 * IMPORTANT:
 * We intentionally DO NOT keep base64 image data.
 *
 * DOCX image:
 *
 * <img src="data:image/jpeg;base64,...">
 *
 * becomes:
 *
 * [IMAGE]
 */
function cleanCell($, cell) {
    const $cell = cheerio.load(cell);
    /**
     * Remove base64 image.
     *
     * We keep an EDS-friendly marker instead.
     */
    $cell('img').each((_, img) => {
        const alt = $cell(img)
            .attr('alt')
            ?.trim() || '';
        if (alt) {
            $cell(img).replaceWith(`[IMAGE:${escapeText(alt)}]`);
        }
        else {
            $cell(img).replaceWith('[IMAGE]');
        }
    });
    /**
     * Remove empty paragraphs.
     */
    $cell('p').each((_, p) => {
        const hasText = $cell(p)
            .text()
            .trim()
            .length > 0;
        const hasImage = $cell(p).text().includes('[IMAGE]');
        if (!hasText && !hasImage) {
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
        if (!text && !$cell(div).find('img').length) {
            $cell(div).remove();
        }
    });
    return ($cell.root().html()?.trim() || '');
}
/**
 * Escape HTML.
 */
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
/**
 * Escape simple text used inside image markers.
 */
function escapeText(value) {
    return value
        .replace(/[\[\]]/g, '')
        .trim();
}
