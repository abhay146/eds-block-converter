import * as cheerio from 'cheerio';
export function convertToEdsHtml(html) {
    const $ = cheerio.load(html);
    $('table').each((_, table) => {
        const converted = convertTableToBlock($, table);
        $(table).replaceWith(converted);
    });
    return $('body').html() || '';
}
function convertTableToBlock($, table) {
    const rows = $(table)
        .find('tr')
        .toArray();
    if (!rows.length) {
        return $(table).toString();
    }
    /**
     * Metadata table
     */
    if (isMetadataTable($, rows)) {
        return convertMetadataTable($, rows);
    }
    /**
     * Convert table rows into EDS block rows.
     */
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
            .join('\n  ');
        return `<div>\n  ${cellHtml}\n</div>`;
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
            key.toLowerCase() !==
                'section metadata' &&
            key.toLowerCase() !==
                'metadata') {
            values.push(`<div>${escapeHtml(key)}</div>` +
                `<div>${escapeHtml(value)}</div>`);
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
function cleanCell($, cell) {
    const $cell = cheerio.load(cell);
    /**
     * Convert images to marker.
     */
    $cell('img').each((_, img) => {
        $cell(img).replaceWith('[IMAGE]');
    });
    /**
     * Remove empty paragraphs.
     */
    $cell('p').each((_, p) => {
        const hasText = $cell(p)
            .text()
            .trim()
            .length > 0;
        const hasImage = $cell(p).find('img').length > 0;
        if (!hasText && !hasImage) {
            $cell(p).remove();
        }
    });
    return ($cell.root().html()?.trim() || '');
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
