import * as cheerio from 'cheerio';
import { createId, createFieldLabel, createFieldName, generateXwalkConfig, } from './xwalk.js';
/**
 * =========================================================
 * HELPER
 * =========================================================
 */
function normalizeText(value) {
    return value
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * =========================================================
 * GET BLOCK TITLE
 * =========================================================
 */
function getBlockTitle($, block) {
    const firstRow = block.find('> div').first();
    const firstCell = firstRow.find('> div').first();
    if (!firstCell.length) {
        return '';
    }
    return normalizeText(firstCell.text());
}
/**
 * =========================================================
 * CREATE BLOCK HTML
 * =========================================================
 */
function createBlockHtml(blockId, blockHtml) {
    return [
        `<div class="${blockId}-wrapper">`,
        blockHtml,
        '</div>',
    ].join('\n');
}
/**
 * =========================================================
 * CREATE FIELD
 * =========================================================
 */
function createField(component, name) {
    const fieldName = createFieldName(name);
    const label = createFieldLabel(name);
    if (component === 'reference') {
        return {
            component: 'reference',
            name: fieldName,
            label,
            valueType: 'string',
            multi: false,
        };
    }
    if (component === 'aem-content') {
        return {
            component: 'aem-content',
            name: fieldName,
            label,
        };
    }
    if (component === 'richtext') {
        return {
            component: 'richtext',
            valueType: 'string',
            name: fieldName,
            label,
            raw: true,
        };
    }
    return {
        component: 'text',
        valueType: 'string',
        name: fieldName,
        label,
        value: '',
    };
}
/**
 * =========================================================
 * DETECT FIELD TYPE
 * =========================================================
 */
function detectFieldType(text) {
    const normalized = text
        .toLowerCase()
        .trim();
    /**
     * Reference
     */
    if (normalized === 'reference' ||
        normalized.includes('reference')) {
        if (normalized.includes('alt')) {
            return 'text';
        }
        return 'reference';
    }
    /**
     * AEM Content
     */
    if (normalized === 'aem-content' ||
        normalized === 'aem content' ||
        normalized === 'link') {
        return 'aem-content';
    }
    /**
     * Richtext
     */
    if (normalized === 'richtext' ||
        normalized === 'rich text' ||
        normalized === 'content' ||
        normalized === 'description') {
        return 'richtext';
    }
    /**
     * Default
     */
    return 'text';
}
/**
 * =========================================================
 * GET FIELD NAME FROM CELL
 * =========================================================
 */
function getFieldName(text) {
    const normalized = normalizeText(text);
    if (!normalized) {
        return '';
    }
    /**
     * Keep known names.
     */
    if (normalized.toLowerCase() ===
        'referencealt') {
        return 'referenceAlt';
    }
    if (normalized.toLowerCase() ===
        'reference') {
        return 'reference';
    }
    if (normalized.toLowerCase() ===
        'aem-content') {
        return 'link';
    }
    if (normalized.toLowerCase() ===
        'richtext') {
        return 'richtext';
    }
    return createFieldName(normalized);
}
/**
 * =========================================================
 * REMOVE DUPLICATE FIELDS
 * =========================================================
 */
function removeDuplicateFields(fields) {
    const seen = new Set();
    return fields.filter((field) => {
        if (seen.has(field.name)) {
            return false;
        }
        seen.add(field.name);
        return true;
    });
}
/**
 * =========================================================
 * DETECT FIELDS FROM BLOCK
 * =========================================================
 */
function detectFields($, block) {
    const fields = [];
    const rows = block.find('> div');
    /**
     * First row = Block title.
     * Remaining rows = fields.
     */
    rows.each((rowIndex, rowElement) => {
        if (rowIndex === 0) {
            return;
        }
        const row = $(rowElement);
        const cells = row.find('> div');
        cells.each((_, cellElement) => {
            const cell = $(cellElement);
            /**
             * Each paragraph can represent
             * a field definition.
             */
            const paragraphs = cell.find('p');
            if (paragraphs.length > 0) {
                paragraphs.each((__, paragraphElement) => {
                    const text = normalizeText($(paragraphElement)
                        .text());
                    if (!text) {
                        return;
                    }
                    const fieldName = getFieldName(text);
                    if (!fieldName) {
                        return;
                    }
                    const component = detectFieldType(text);
                    /**
                     * Special handling
                     * for referenceAlt.
                     */
                    if (fieldName ===
                        'referenceAlt') {
                        fields.push({
                            component: 'text',
                            valueType: 'string',
                            name: 'referenceAlt',
                            label: 'Reference Alt',
                            value: '',
                        });
                        return;
                    }
                    fields.push(createField(component, fieldName));
                });
                return;
            }
            /**
             * If no paragraphs,
             * use cell text.
             */
            const text = normalizeText(cell.text());
            if (!text) {
                return;
            }
            const fieldName = getFieldName(text);
            if (!fieldName) {
                return;
            }
            const component = detectFieldType(text);
            fields.push(createField(component, fieldName));
        });
    });
    return removeDuplicateFields(fields);
}
/**
 * =========================================================
 * DETECT BLOCKS
 * =========================================================
 */
export function detectBlocks(html) {
    const $ = cheerio.load(html);
    const detectedBlocks = [];
    /**
     * Franklin block tables
     */
    $('table').each((_, tableElement) => {
        const table = $(tableElement);
        const rawTitle = getBlockTitle($, table);
        if (!rawTitle) {
            return;
        }
        /**
         * Ignore metadata table.
         */
        if (rawTitle
            .toLowerCase()
            .includes('metadata')) {
            return;
        }
        const blockId = createId(rawTitle);
        if (!blockId) {
            return;
        }
        const fields = detectFields($, table);
        /**
         * Get generated HTML.
         */
        const tableHtml = $.html(table);
        const htmlOutput = createBlockHtml(blockId, tableHtml);
        detectedBlocks.push({
            title: rawTitle,
            id: blockId,
            fields,
            html: htmlOutput,
        });
    });
    return detectedBlocks;
}
/**
 * =========================================================
 * CREATE INDIVIDUAL BLOCK FILES
 * =========================================================
 *
 * IMPORTANT:
 *
 * blockFiles contains ONLY
 * individual block JSON.
 *
 * Complete XWalk config:
 *
 * definitions
 * models
 * filters
 *
 * stays inside result.xwalk
 *
 */
export function createBlockFiles(blocks) {
    return blocks.map((block) => {
        const blockId = createId(block.title);
        return {
            name: blockId,
            jsonFile: `${blockId}.json`,
            htmlFile: `${blockId}.html`,
            json: {
                title: block.title
                    .replace(/\s*\([^)]*\)\s*$/, '')
                    .trim(),
                id: blockId,
                fields: block.fields,
            },
            html: block.html || '',
        };
    });
}
/**
 * =========================================================
 * MAIN CONVERTER
 * =========================================================
 */
export function convertToEdsHtml(html) {
    /**
     * Detect blocks.
     */
    const detectedBlocks = detectBlocks(html);
    /**
     * Create separate block files.
     */
    const blockFiles = createBlockFiles(detectedBlocks);
    /**
     * Generate complete XWalk config.
     *
     * This contains:
     *
     * definitions
     * models
     * filters
     */
    const xwalk = generateXwalkConfig(detectedBlocks);
    return {
        html,
        detectedBlocks,
        blockFiles,
        xwalk,
        messages: [],
    };
}
