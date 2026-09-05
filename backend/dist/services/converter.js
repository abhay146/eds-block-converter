import * as cheerio from 'cheerio';
import { createId, createFieldLabel, createFieldName, generateXwalkConfig, } from './xwalk.js';
/* =========================================================
   HELPERS
========================================================= */
function normalizeText(value) {
    return value
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function normalizeForCompare(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
}
/* =========================================================
   FIELD TYPE
========================================================= */
function createFieldFromName(rawName) {
    const original = normalizeText(rawName);
    if (!original) {
        return null;
    }
    const match = original.match(/^(col[1-3]_)(.+)$/i);
    const prefix = match
        ? match[1].toLowerCase()
        : '';
    const baseName = match
        ? match[2]
        : original;
    const normalized = normalizeForCompare(baseName);
    /* -------------------------
       REFERENCE
    ------------------------- */
    if (normalized === 'reference') {
        return {
            component: 'reference',
            name: `${prefix}reference`,
            label: createFieldLabel(`${prefix}reference`),
            valueType: 'string',
            multi: false,
        };
    }
    /* -------------------------
       REFERENCE ALT
    ------------------------- */
    if (normalized === 'referencealt') {
        return {
            component: 'text',
            valueType: 'string',
            name: `${prefix}referenceAlt`,
            label: 'Reference Alt',
            value: '',
        };
    }
    /* -------------------------
       IMAGE
    ------------------------- */
    if (normalized === 'image') {
        return {
            component: 'reference',
            name: `${prefix}image`,
            label: 'Image',
            valueType: 'string',
            multi: false,
        };
    }
    /* -------------------------
       IMAGE ALT
    ------------------------- */
    if (normalized === 'imagealt') {
        return {
            component: 'text',
            valueType: 'string',
            name: `${prefix}imageAlt`,
            label: 'Image Alt',
            value: '',
        };
    }
    /* -------------------------
       RICHTEXT
    ------------------------- */
    if (normalized === 'richtext') {
        return {
            component: 'richtext',
            valueType: 'string',
            name: `${prefix}richtext`,
            label: 'Title and Description',
            raw: true,
        };
    }
    /* -------------------------
       DESCRIPTION
    ------------------------- */
    if (normalized === 'description') {
        return {
            component: 'richtext',
            valueType: 'string',
            name: `${prefix}description`,
            label: 'Description',
            raw: true,
        };
    }
    /* -------------------------
       AEM CONTENT / LINK
    ------------------------- */
    if (normalized === 'link' ||
        normalized === 'aemcontent') {
        return {
            component: 'aem-content',
            name: `${prefix}link`,
            label: 'Link',
        };
    }
    /* -------------------------
       URL
    ------------------------- */
    if (normalized === 'url' ||
        normalized === 'href') {
        return {
            component: 'text',
            valueType: 'string',
            name: `${prefix}url`,
            label: 'URL',
            value: '',
        };
    }
    /* -------------------------
       TITLE
    ------------------------- */
    if (normalized === 'title') {
        return {
            component: 'text',
            valueType: 'string',
            name: `${prefix}title`,
            label: 'Title',
            value: '',
        };
    }
    /* -------------------------
       DEFAULT TEXT
    ------------------------- */
    return {
        component: 'text',
        valueType: 'string',
        name: createFieldName(original),
        label: createFieldLabel(original),
        value: '',
    };
}
/* =========================================================
   DUPLICATE FIELDS
========================================================= */
function uniqueFields(fields) {
    const seen = new Set();
    const result = [];
    for (const field of fields) {
        if (!field.name) {
            continue;
        }
        const key = field.name.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(field);
    }
    return result;
}
/* =========================================================
   FIELD NAME EXTRACTION
========================================================= */
function extractFieldNames(text) {
    const normalized = normalizeText(text);
    if (!normalized) {
        return [];
    }
    /*
     * Important:
     *
     * If Word/Mammoth gives:
     *
     * col2_reference
     * col2_referenceAlt
     * col2_richtext
     *
     * together in one cell, split them.
     */
    const matches = normalized.match(/col[1-3]_(?:referenceAlt|reference|imageAlt|image|richtext|description|link|aem-content|aem_content|url|href|title|text)/gi);
    if (matches && matches.length) {
        return matches;
    }
    return [normalized];
}
/* =========================================================
   DETECT FIELDS
========================================================= */
function detectFields(tableHtml) {
    const $ = cheerio.load(tableHtml);
    const fields = [];
    $('tr').each((rowIndex, row) => {
        /*
         * First row = block title.
         */
        if (rowIndex === 0) {
            return;
        }
        const cells = $(row)
            .find('th, td')
            .toArray();
        for (const cell of cells) {
            const elements = $(cell)
                .find('p,h1,h2,h3,h4,h5,h6')
                .toArray();
            if (elements.length) {
                for (const element of elements) {
                    const text = normalizeText($(element).text());
                    for (const fieldName of extractFieldNames(text)) {
                        const field = createFieldFromName(fieldName);
                        if (field) {
                            fields.push(field);
                        }
                    }
                }
            }
            else {
                const text = normalizeText($(cell).text());
                for (const fieldName of extractFieldNames(text)) {
                    const field = createFieldFromName(fieldName);
                    if (field) {
                        fields.push(field);
                    }
                }
            }
        }
    });
    return uniqueFields(fields);
}
/* =========================================================
   BLOCK TITLE
========================================================= */
function parseBlockTitle(rawTitle) {
    const text = normalizeText(rawTitle);
    /*
     * Hero (hero-v1)
     *
     * becomes:
     *
     * title  = Hero
     * styles = hero-v1
     */
    const match = text.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (!match) {
        return {
            title: text,
            styles: [],
        };
    }
    const title = normalizeText(match[1]);
    const styles = match[2]
        .split(',')
        .map((style) => normalizeText(style))
        .filter(Boolean);
    return {
        title,
        styles,
    };
}
/* =========================================================
   GET BLOCK TITLE
========================================================= */
function getBlockTitle(table) {
    const firstRow = table.find('tr').first();
    if (!firstRow.length) {
        return '';
    }
    return normalizeText(firstRow.text());
}
/* =========================================================
   BLOCK HTML
========================================================= */
function createBlockHtml(tableHtml, blockId) {
    const $ = cheerio.load(tableHtml);
    const table = $('table').first();
    if (!table.length) {
        return tableHtml;
    }
    table.attr('class', `${blockId} block`);
    return [
        `<div class="${blockId}-wrapper">`,
        $.html(table),
        '</div>',
    ].join('\n');
}
/* =========================================================
   DETECT BLOCKS
========================================================= */
export function detectBlocks(html) {
    const blocks = [];
    if (!html?.trim()) {
        return blocks;
    }
    const $ = cheerio.load(html);
    $('table').each((index, element) => {
        const table = $(element);
        const rawTitle = getBlockTitle(table);
        if (!rawTitle) {
            return;
        }
        /*
         * Skip metadata.
         */
        if (rawTitle
            .toLowerCase()
            .includes('metadata')) {
            return;
        }
        const { title, styles, } = parseBlockTitle(rawTitle);
        if (!title) {
            return;
        }
        const blockId = createId(title) ||
            `block-${index + 1}`;
        const originalHtml = $.html(table);
        const fields = detectFields(originalHtml);
        const blockHtml = createBlockHtml(originalHtml, blockId);
        blocks.push({
            title,
            id: blockId,
            fields,
            html: blockHtml,
            styles,
        });
    });
    return blocks;
}
/* =========================================================
   BLOCK FILES
========================================================= */
export function createBlockFiles(blocks) {
    return blocks.map((block) => ({
        name: block.id,
        jsonFile: `${block.id}.json`,
        htmlFile: `${block.id}.html`,
        /*
         * Individual block JSON.
         *
         * IMPORTANT:
         * This does NOT contain definition,
         * plugins or filter.
         *
         * Those are in xwalk.
         */
        json: {
            id: block.id,
            fields: block.fields,
        },
        html: block.html || '',
    }));
}
/* =========================================================
   MAIN CONVERSION
========================================================= */
export function convertToEdsHtml(html) {
    const detectedBlocks = detectBlocks(html);
    const blockFiles = createBlockFiles(detectedBlocks);
    /*
     * COMPLETE XWALK JSON
     *
     * {
     *   definitions: [],
     *   models: [],
     *   filters: []
     * }
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
