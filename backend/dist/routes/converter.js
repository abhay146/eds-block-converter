import * as cheerio from 'cheerio';
import mammoth from 'mammoth';
import { convertToEdsHtml, } from '../services/converter.js';
import { generateXwalkConfig, createId, } from '../services/xwalk.js';
/**
 * =========================================================
 * BASIC HELPERS
 * =========================================================
 */
function createLabel(value) {
    return value
        .trim()
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
function normalizeFieldName(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[-_]/g, '');
}
function cleanFieldText(value) {
    return value
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * =========================================================
 * CONVERSION RESULT -> HTML STRING
 * =========================================================
 */
function getEdsHtml(conversionResult) {
    if (typeof conversionResult === 'string') {
        return conversionResult;
    }
    if (conversionResult &&
        typeof conversionResult === 'object') {
        const result = conversionResult;
        if (typeof result.html === 'string') {
            return result.html;
        }
        if (typeof result.edsHtml === 'string') {
            return result.edsHtml;
        }
        if (typeof result.value === 'string') {
            return result.value;
        }
    }
    return '';
}
/**
 * =========================================================
 * KNOWN FIELDS
 * =========================================================
 */
function isExactKnownField(value) {
    const normalized = normalizeFieldName(value);
    return [
        'reference',
        'referencealt',
        'image',
        'imagealt',
        'thumbnailimagealt',
        'videourl',
        'video',
        'text',
        'richtext',
        'aemcontent',
        'description',
        'title',
        'link',
        'url',
    ].includes(normalized);
}
/**
 * =========================================================
 * CREATE FIELD
 * =========================================================
 */
function createFieldFromName(rawName, rawLabel) {
    const original = cleanFieldText(rawName);
    if (!original) {
        return null;
    }
    const normalized = normalizeFieldName(original);
    const defaultLabel = createLabel(original);
    const label = rawLabel &&
        cleanFieldText(rawLabel)
        ? cleanFieldText(rawLabel)
        : defaultLabel;
    if (normalized === 'reference') {
        return {
            component: 'reference',
            name: 'reference',
            label,
            valueType: 'string',
            multi: false,
        };
    }
    if (normalized === 'referencealt') {
        return {
            component: 'text',
            valueType: 'string',
            name: 'referenceAlt',
            label,
            value: '',
        };
    }
    if (normalized === 'image') {
        return {
            component: 'reference',
            name: 'image',
            label,
            valueType: 'string',
            multi: false,
        };
    }
    if (normalized === 'imagealt') {
        return {
            component: 'text',
            valueType: 'string',
            name: 'imageAlt',
            label,
            value: '',
        };
    }
    if (normalized === 'thumbnailimagealt') {
        return {
            component: 'text',
            valueType: 'string',
            name: 'thumbnailImageAlt',
            label,
            value: '',
        };
    }
    if (normalized === 'videourl') {
        return {
            component: 'text',
            valueType: 'string',
            name: 'videoUrl',
            label,
            value: '',
        };
    }
    if (normalized === 'video') {
        return {
            component: 'text',
            valueType: 'string',
            name: 'video',
            label,
            value: '',
        };
    }
    if (normalized === 'text') {
        return {
            component: 'text',
            valueType: 'string',
            name: 'text',
            label,
            value: '',
        };
    }
    if (normalized === 'richtext') {
        return {
            component: 'richtext',
            valueType: 'string',
            name: 'richtext',
            label,
            raw: true,
        };
    }
    if (normalized === 'description') {
        return {
            component: 'richtext',
            valueType: 'string',
            name: 'description',
            label,
            raw: true,
        };
    }
    if (normalized === 'title') {
        return {
            component: 'text',
            valueType: 'string',
            name: 'title',
            label,
            value: '',
        };
    }
    if (normalized === 'aemcontent') {
        return {
            component: 'aem-content',
            name: 'link',
            label: 'Link',
        };
    }
    if (normalized === 'link') {
        return {
            component: 'aem-content',
            name: 'link',
            label,
        };
    }
    if (normalized === 'url') {
        return {
            component: 'text',
            valueType: 'string',
            name: 'url',
            label,
            value: '',
        };
    }
    return {
        component: 'text',
        valueType: 'string',
        name: createId(original),
        label,
        value: '',
    };
}
/**
 * =========================================================
 * UNIQUE FIELDS
 * =========================================================
 */
function uniqueFields(fields) {
    const seen = new Set();
    const result = [];
    for (const field of fields) {
        const key = `${field.component}:${field.name}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(field);
    }
    return result;
}
/**
 * =========================================================
 * DETECT FIELDS FROM TABLE
 * =========================================================
 */
function detectTableFields(table) {
    const fields = [];
    const rows = table
        .find('tr')
        .toArray();
    /**
     * First row is block title.
     * Start from second row.
     */
    rows
        .slice(1)
        .forEach((row) => {
        const cells = table
            .find(row)
            .children('th, td')
            .toArray();
        for (const cell of cells) {
            const elements = table
                .find(cell)
                .find('p, h1, h2, h3, h4, h5, h6')
                .toArray();
            for (const element of elements) {
                const text = cleanFieldText(table
                    .find(element)
                    .text());
                if (!text) {
                    continue;
                }
                if (!isExactKnownField(text)) {
                    continue;
                }
                const field = createFieldFromName(text);
                if (field) {
                    fields.push(field);
                }
            }
        }
    });
    return uniqueFields(fields);
}
/**
 * =========================================================
 * FALLBACK FIELD DETECTION
 * =========================================================
 */
function detectFallbackFields(html) {
    const $ = cheerio.load(html);
    const fields = [];
    const hasHeading = $('h1, h2, h3, h4, h5, h6').length > 0;
    const hasParagraph = $('p').length > 0;
    const hasImage = $('img').length > 0;
    const hasLink = $('a').length > 0;
    if (hasHeading) {
        fields.push({
            component: 'text',
            name: 'title',
            label: 'Title',
            valueType: 'string',
            value: '',
        });
    }
    if (hasParagraph) {
        fields.push({
            component: 'richtext',
            name: 'richtext',
            label: 'Richtext',
            valueType: 'string',
            raw: true,
        });
    }
    if (hasImage) {
        fields.push({
            component: 'reference',
            name: 'image',
            label: 'Image',
            valueType: 'string',
            multi: false,
        });
    }
    if (hasLink) {
        fields.push({
            component: 'aem-content',
            name: 'link',
            label: 'Link',
        });
    }
    return uniqueFields(fields);
}
/**
 * =========================================================
 * PARSE BLOCK TITLE + STYLES
 * =========================================================
 *
 * Hero (hero-v1)
 *
 * title: Hero
 * styles: ["hero-v1"]
 */
function parseBlockTitle(value) {
    const text = cleanFieldText(value);
    const match = text.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (!match) {
        return {
            title: text,
            styles: [],
        };
    }
    const title = match[1].trim();
    const styles = match[2]
        .split(',')
        .map((style) => style.trim())
        .filter(Boolean);
    return {
        title,
        styles,
    };
}
/**
 * =========================================================
 * GET TABLE BLOCK TITLE
 * =========================================================
 */
function getTableBlockTitle(table) {
    const firstRow = table
        .find('tr')
        .first();
    if (!firstRow.length) {
        return '';
    }
    const text = cleanFieldText(firstRow.text());
    if (!text) {
        return '';
    }
    return text;
}
/**
 * =========================================================
 * CREATE EDS BLOCK HTML
 * =========================================================
 */
function createEdsBlockHtml(tableHtml, blockId) {
    const $ = cheerio.load(tableHtml, null, false);
    const table = $('table').first();
    if (table.length) {
        table.attr('class', `${blockId} block`);
    }
    const finalTableHtml = $.html();
    return [
        `<div class="${blockId}-wrapper">`,
        finalTableHtml,
        '</div>',
    ].join('\n');
}
/**
 * =========================================================
 * DETECT BLOCKS FROM TABLES
 * =========================================================
 */
function detectBlocks(html) {
    const blocks = [];
    if (!html ||
        !html.trim()) {
        return blocks;
    }
    const $ = cheerio.load(html, null, false);
    /**
     * IMPORTANT:
     *
     * Each top-level table represents one block.
     */
    const tables = $('table').toArray();
    tables.forEach((tableElement, index) => {
        const table = $(tableElement);
        const rawTitle = getTableBlockTitle(table);
        if (!rawTitle) {
            return;
        }
        const { title, styles, } = parseBlockTitle(rawTitle);
        if (!title) {
            return;
        }
        const id = createId(title) ||
            `block-${index + 1}`;
        const fields = detectTableFields(table);
        const originalHtml = $.html(tableElement);
        const blockHtml = createEdsBlockHtml(originalHtml, id);
        blocks.push({
            title,
            id,
            fields,
            html: blockHtml,
            _styles: styles,
        });
    });
    /**
     * Old .cards support.
     */
    if (blocks.length === 0) {
        $('.cards').each((index, element) => {
            const block = $(element);
            const rawTitle = cleanFieldText(block
                .find('h1, h2, h3, h4, h5, h6, p')
                .first()
                .text());
            if (!rawTitle) {
                return;
            }
            const { title, styles, } = parseBlockTitle(rawTitle);
            const id = createId(title) ||
                `block-${index + 1}`;
            const originalHtml = $.html(element);
            blocks.push({
                title,
                id,
                fields: detectFallbackFields(originalHtml),
                html: originalHtml,
                _styles: styles,
            });
        });
    }
    return blocks;
}
/**
 * =========================================================
 * FIND DEFINITION
 * =========================================================
 */
function findDefinition(definitions, blockId) {
    return definitions.find((item) => {
        return (typeof item === 'object' &&
            item !== null &&
            'id' in item &&
            item.id === blockId);
    });
}
/**
 * =========================================================
 * FIND MODEL
 * =========================================================
 */
function findModel(models, blockId) {
    const model = models.find((item) => {
        return (typeof item === 'object' &&
            item !== null &&
            'id' in item &&
            item.id === blockId);
    });
    if (!model ||
        typeof model !== 'object') {
        return undefined;
    }
    const typedModel = model;
    if (!typedModel.id) {
        return undefined;
    }
    return {
        id: typedModel.id,
        fields: Array.isArray(typedModel.fields)
            ? typedModel.fields
            : [],
    };
}
/**
 * =========================================================
 * DOCX CONVERSION ROUTE
 * =========================================================
 */
export async function converterRoutes(app) {
    app.post('/convert', async (request, reply) => {
        try {
            /**
             * Upload DOCX.
             */
            const file = await request.file();
            if (!file) {
                return reply
                    .code(400)
                    .send({
                    error: 'No DOCX file uploaded',
                });
            }
            /**
             * Validate extension.
             */
            const filename = file.filename
                .toLowerCase();
            if (!filename.endsWith('.docx')) {
                return reply
                    .code(400)
                    .send({
                    error: 'Only DOCX files are supported',
                });
            }
            /**
             * Read file.
             */
            const buffer = await file.toBuffer();
            /**
             * DOCX -> HTML.
             */
            const result = await mammoth.convertToHtml({
                buffer,
            });
            /**
             * HTML -> EDS HTML.
             */
            const conversionResult = await Promise.resolve(convertToEdsHtml(result.value));
            /**
             * Extract HTML string.
             */
            const edsHtml = getEdsHtml(conversionResult);
            if (!edsHtml) {
                return reply
                    .code(500)
                    .send({
                    error: 'EDS HTML conversion returned empty content',
                });
            }
            /**
             * Detect blocks.
             */
            const blocks = detectBlocks(edsHtml);
            /**
             * Generate XWalk config.
             */
            const xwalk = generateXwalkConfig(blocks);
            /**
             * Individual block files.
             */
            const blockFiles = blocks.map((block) => {
                const definition = findDefinition(xwalk.definitions, block.id);
                const model = findModel(xwalk.models, block.id);
                return {
                    name: block.id,
                    jsonFile: `${block.id}.json`,
                    htmlFile: `${block.id}.html`,
                    json: {
                        ...(definition || {
                            title: block.title,
                            id: block.id,
                        }),
                        fields: model?.fields ||
                            block.fields,
                    },
                    html: block.html || '',
                };
            });
            /**
             * Final API response.
             */
            return {
                success: true,
                filename: file.filename,
                html: edsHtml,
                detectedBlocks: blocks,
                blockFiles,
                xwalk,
                messages: result.messages,
            };
        }
        catch (error) {
            app.log.error(error);
            return reply
                .code(500)
                .send({
                error: 'Failed to convert DOCX file',
            });
        }
    });
}
