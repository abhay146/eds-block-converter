import * as cheerio from 'cheerio';
import mammoth from 'mammoth';
import { convertToEdsHtml, } from '../services/converter.js';
import { generateXwalkConfig, createId, } from '../services/xwalk.js';
/**
 * =========================================================
 * BASIC HELPERS
 * =========================================================
 */
function cleanFieldText(value) {
    return value
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
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
/**
 * =========================================================
 * CONVERTER RESULT -> HTML STRING
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
 * COLUMN PREFIX PARSER
 * =========================================================
 *
 * Allowed:
 *
 * col1_text
 * col2_richtext
 * col3_reference
 *
 * Not allowed:
 *
 * col4_text
 * col5_reference
 *
 */
function parseColumnField(value) {
    const match = value
        .trim()
        .match(/^col(\d+)_(.+)$/i);
    if (!match) {
        return null;
    }
    const column = Number(match[1]);
    const fieldName = match[2]
        .trim();
    if (!fieldName) {
        return null;
    }
    return {
        column,
        fieldName,
    };
}
/**
 * =========================================================
 * VALIDATE COLUMN PREFIX
 * =========================================================
 *
 * ONLY:
 *
 * col1_
 * col2_
 * col3_
 *
 */
function validateColumnField(value, blockTitle) {
    const parsed = parseColumnField(value);
    if (!parsed) {
        return null;
    }
    if (parsed.column < 1 ||
        parsed.column > 3) {
        return {
            block: blockTitle,
            field: value,
            message: `Column "${value}" is not allowed. ` +
                `Only col1_, col2_, and col3_ are allowed.`,
        };
    }
    return null;
}
/**
 * =========================================================
 * KNOWN FIELD DETECTION
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
        'linktext',
        'linktitle',
        'url',
    ].includes(normalized);
}
/**
 * =========================================================
 * CREATE NORMAL FIELD
 * =========================================================
 */
function createNormalField(rawName, rawLabel) {
    const original = cleanFieldText(rawName);
    if (!original) {
        return null;
    }
    const normalized = normalizeFieldName(original);
    const label = rawLabel &&
        cleanFieldText(rawLabel)
        ? cleanFieldText(rawLabel)
        : createLabel(original);
    /**
     * REFERENCE
     */
    if (normalized === 'reference') {
        return {
            component: 'reference',
            name: 'reference',
            label,
            valueType: 'string',
            multi: false,
        };
    }
    /**
     * REFERENCE ALT
     */
    if (normalized === 'referencealt') {
        return {
            component: 'text',
            name: 'referenceAlt',
            label,
            valueType: 'string',
            value: '',
        };
    }
    /**
     * IMAGE
     */
    if (normalized === 'image') {
        return {
            component: 'reference',
            name: 'image',
            label,
            valueType: 'string',
            multi: false,
        };
    }
    /**
     * IMAGE ALT
     */
    if (normalized === 'imagealt') {
        return {
            component: 'text',
            name: 'imageAlt',
            label,
            valueType: 'string',
            value: '',
        };
    }
    /**
     * THUMBNAIL IMAGE ALT
     */
    if (normalized === 'thumbnailimagealt') {
        return {
            component: 'text',
            name: 'thumbnailImageAlt',
            label,
            valueType: 'string',
            value: '',
        };
    }
    /**
     * VIDEO URL
     */
    if (normalized === 'videourl') {
        return {
            component: 'text',
            name: 'videoUrl',
            label,
            valueType: 'string',
            value: '',
        };
    }
    /**
     * VIDEO
     */
    if (normalized === 'video') {
        return {
            component: 'text',
            name: 'video',
            label,
            valueType: 'string',
            value: '',
        };
    }
    /**
     * TEXT
     */
    if (normalized === 'text') {
        return {
            component: 'text',
            name: 'text',
            label,
            valueType: 'string',
            value: '',
        };
    }
    /**
     * RICHTEXT
     */
    if (normalized === 'richtext') {
        return {
            component: 'richtext',
            name: 'richtext',
            label,
            valueType: 'string',
            raw: true,
        };
    }
    /**
     * DESCRIPTION
     */
    if (normalized === 'description') {
        return {
            component: 'richtext',
            name: 'description',
            label,
            valueType: 'string',
            raw: true,
        };
    }
    /**
     * TITLE
     */
    if (normalized === 'title') {
        return {
            component: 'text',
            name: 'title',
            label,
            valueType: 'string',
            value: '',
        };
    }
    /**
     * AEM CONTENT
     */
    if (normalized === 'aemcontent') {
        return {
            component: 'aem-content',
            name: 'link',
            label: 'Link',
        };
    }
    /**
     * LINK
     */
    if (normalized === 'link') {
        return {
            component: 'aem-content',
            name: 'link',
            label: 'Link',
        };
    }
    /**
     * LINK TEXT
     */
    if (normalized === 'linktext') {
        return {
            component: 'text',
            name: 'linkText',
            label: 'Text',
            valueType: 'string',
            value: '',
        };
    }
    /**
     * LINK TITLE
     */
    if (normalized === 'linktitle') {
        return {
            component: 'text',
            name: 'linkTitle',
            label: 'Title',
            valueType: 'string',
            value: '',
        };
    }
    /**
     * URL
     */
    if (normalized === 'url') {
        return {
            component: 'text',
            name: 'url',
            label,
            valueType: 'string',
            value: '',
        };
    }
    /**
     * UNKNOWN
     */
    return {
        component: 'text',
        name: createId(original),
        label,
        valueType: 'string',
        value: '',
    };
}
/**
 * =========================================================
 * CREATE COLUMN FIELD
 * =========================================================
 *
 * Examples:
 *
 * col1_reference
 * col1_referenceAlt
 * col1_richtext
 * col1_text
 *
 * col2_link
 * col2_linkText
 * col2_linkTitle
 *
 */
function createColumnField(column, rawFieldName) {
    const fieldName = cleanFieldText(rawFieldName);
    if (!fieldName) {
        return null;
    }
    const normalized = normalizeFieldName(fieldName);
    const prefix = `col${column}_`;
    /**
     * REFERENCE
     *
     * col1_reference
     */
    if (normalized === 'reference') {
        return {
            component: 'reference',
            name: `${prefix}reference`,
            label: 'Reference',
            valueType: 'string',
            multi: false,
        };
    }
    /**
     * REFERENCE ALT
     *
     * col1_referenceAlt
     */
    if (normalized === 'referencealt') {
        return {
            component: 'text',
            name: `${prefix}referenceAlt`,
            label: 'Reference Alt',
            valueType: 'string',
            value: '',
        };
    }
    /**
     * IMAGE
     */
    if (normalized === 'image') {
        return {
            component: 'reference',
            name: `${prefix}image`,
            label: 'Image',
            valueType: 'string',
            multi: false,
        };
    }
    /**
     * IMAGE ALT
     */
    if (normalized === 'imagealt') {
        return {
            component: 'text',
            name: `${prefix}imageAlt`,
            label: 'Image Alt',
            valueType: 'string',
            value: '',
        };
    }
    /**
     * RICHTEXT
     *
     * col1_richtext
     */
    if (normalized === 'richtext') {
        return {
            component: 'richtext',
            name: `${prefix}richtext`,
            label: 'Title and Description',
            valueType: 'string',
            raw: true,
        };
    }
    /**
     * TEXT
     *
     * IMPORTANT:
     *
     * Your requested mapping:
     *
     * col1_text
     *
     * ->
     *
     * {
     *   component: "richtext",
     *   name: "col1_text",
     *   label: "Title and Description"
     * }
     */
    if (normalized === 'text') {
        return {
            component: 'richtext',
            name: `${prefix}text`,
            label: 'Title and Description',
            valueType: 'string',
            raw: true,
        };
    }
    /**
     * DESCRIPTION
     */
    if (normalized === 'description') {
        return {
            component: 'richtext',
            name: `${prefix}description`,
            label: 'Title and Description',
            valueType: 'string',
            raw: true,
        };
    }
    /**
     * TITLE
     */
    if (normalized === 'title') {
        return {
            component: 'text',
            name: `${prefix}title`,
            label: 'Title',
            valueType: 'string',
            value: '',
        };
    }
    /**
     * AEM CONTENT
     *
     * col2_aem-content
     *
     * ->
     *
     * col2_link
     */
    if (normalized === 'aemcontent') {
        return {
            component: 'aem-content',
            name: `${prefix}link`,
            label: 'Link',
        };
    }
    /**
     * LINK
     *
     * col2_link
     */
    if (normalized === 'link') {
        return {
            component: 'aem-content',
            name: `${prefix}link`,
            label: 'Link',
        };
    }
    /**
     * LINK TEXT
     *
     * col2_linkText
     */
    if (normalized === 'linktext') {
        return {
            component: 'text',
            name: `${prefix}linkText`,
            label: 'Text',
            valueType: 'string',
            value: '',
        };
    }
    /**
     * LINK TITLE
     *
     * col2_linkTitle
     */
    if (normalized === 'linktitle') {
        return {
            component: 'text',
            name: `${prefix}linkTitle`,
            label: 'Title',
            valueType: 'string',
            value: '',
        };
    }
    /**
     * VIDEO
     */
    if (normalized === 'video') {
        return {
            component: 'text',
            name: `${prefix}video`,
            label: 'Video',
            valueType: 'string',
            value: '',
        };
    }
    /**
     * VIDEO URL
     */
    if (normalized === 'videourl') {
        return {
            component: 'text',
            name: `${prefix}videoUrl`,
            label: 'Video Url',
            valueType: 'string',
            value: '',
        };
    }
    /**
     * UNKNOWN COLUMN FIELD
     */
    return {
        component: 'text',
        name: `${prefix}${createId(fieldName)}`,
        label: createLabel(fieldName),
        valueType: 'string',
        value: '',
    };
}
/**
 * =========================================================
 * CREATE FIELD FROM NAME
 * =========================================================
 */
function createFieldFromName(rawName) {
    const original = cleanFieldText(rawName);
    if (!original) {
        return null;
    }
    /**
     * CHECK COLUMN PREFIX
     */
    const columnField = parseColumnField(original);
    if (columnField) {
        return createColumnField(columnField.column, columnField.fieldName);
    }
    /**
     * NORMAL FIELD
     */
    return createNormalField(original);
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
 * GET ALL FIELD VALUES FROM TABLE
 * =========================================================
 */
function getTableFieldValues(tableHtml) {
    const $ = cheerio.load(tableHtml);
    const values = [];
    $('th, td').each((_index, cell) => {
        $(cell)
            .find('p, h1, h2, h3, h4, h5, h6')
            .each((_childIndex, element) => {
            const value = cleanFieldText($(element).text());
            if (value) {
                values.push(value);
            }
        });
    });
    return values;
}
/**
 * =========================================================
 * VALIDATE BLOCK COLUMNS
 * =========================================================
 */
function validateBlockColumns(blockHtml, blockTitle) {
    const errors = [];
    const values = getTableFieldValues(blockHtml);
    for (const value of values) {
        const error = validateColumnField(value, blockTitle);
        if (error) {
            errors.push(error);
        }
    }
    return errors;
}
/**
 * =========================================================
 * DETECT FIELDS FROM TABLE
 * =========================================================
 */
function detectTableFields(blockHtml) {
    const $ = cheerio.load(blockHtml);
    const fields = [];
    $('tr').each((_rowIndex, row) => {
        const cells = $(row)
            .find('th, td')
            .toArray();
        for (const cell of cells) {
            const values = [];
            $(cell)
                .find('p, h1, h2, h3, h4, h5, h6')
                .each((_index, element) => {
                const text = cleanFieldText($(element).text());
                if (text) {
                    values.push(text);
                }
            });
            /**
             * If there are no child
             * paragraph/headings.
             */
            if (values.length === 0) {
                const text = cleanFieldText($(cell).text());
                if (text) {
                    values.push(text);
                }
            }
            /**
             * Process values.
             */
            for (const value of values) {
                const columnField = parseColumnField(value);
                /**
                 * Column field.
                 */
                if (columnField) {
                    const field = createColumnField(columnField.column, columnField.fieldName);
                    if (field) {
                        fields.push(field);
                    }
                    continue;
                }
                /**
                 * Normal known field.
                 */
                if (isExactKnownField(value)) {
                    const field = createNormalField(value);
                    if (field) {
                        fields.push(field);
                    }
                }
            }
        }
    });
    return uniqueFields(fields);
}
/**
 * =========================================================
 * GET BLOCK TITLE
 * =========================================================
 *
 * First row of table:
 *
 * Hero (hero-v1)
 *
 */
function getBlockTitle(tableHtml) {
    const $ = cheerio.load(tableHtml);
    const firstRow = $('tr')
        .first();
    if (!firstRow.length) {
        return '';
    }
    const firstText = cleanFieldText(firstRow.text());
    return firstText;
}
/**
 * =========================================================
 * PARSE BLOCK TITLE + STYLES
 * =========================================================
 *
 * Hero (hero-v1)
 *
 * ->
 *
 * title = Hero
 * styles = ["hero-v1"]
 *
 */
function parseBlockTitle(value) {
    const text = value
        .replace(/\s+/g, ' ')
        .trim();
    const match = text.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (!match) {
        return {
            title: text,
            styles: [],
        };
    }
    const title = match[1]
        .trim();
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
 * CREATE BLOCK HTML
 * =========================================================
 */
function createEdsBlockHtml(tableHtml, id) {
    const $ = cheerio.load(tableHtml);
    const table = $('table')
        .first();
    if (!table.length) {
        return tableHtml;
    }
    table.addClass(`${id} block`);
    return [
        `<div class="${id}-wrapper">`,
        $.html(table),
        '</div>',
    ].join('\n');
}
/**
 * =========================================================
 * DETECT BLOCKS
 * =========================================================
 *
 * Every table is treated as one block.
 *
 */
function detectBlocks(html) {
    const blocks = [];
    const errors = [];
    if (!html ||
        !html.trim()) {
        return {
            blocks,
            errors,
        };
    }
    const $ = cheerio.load(html);
    $('table').each((index, element) => {
        const tableHtml = $.html(element);
        const rawTitle = getBlockTitle(tableHtml);
        if (!rawTitle) {
            return;
        }
        /**
         * Parse title and styles.
         */
        const { title, styles, } = parseBlockTitle(rawTitle);
        if (!title) {
            return;
        }
        /**
         * Validate columns first.
         */
        const blockErrors = validateBlockColumns(tableHtml, title);
        if (blockErrors.length > 0) {
            errors.push(...blockErrors);
            return;
        }
        /**
         * Generate block ID.
         */
        const id = createId(title) ||
            `block-${index + 1}`;
        /**
         * Detect fields.
         */
        const fields = detectTableFields(tableHtml);
        /**
         * Block HTML.
         */
        const finalHtml = createEdsBlockHtml(tableHtml, id);
        blocks.push({
            title,
            id,
            fields,
            html: finalHtml,
            _styles: styles,
        });
    });
    return {
        blocks,
        errors,
    };
}
/**
 * =========================================================
 * FIND XWALK DEFINITION
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
 * FIND XWALK MODEL
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
 * ROUTE
 * =========================================================
 */
export async function converterRoutes(app) {
    app.post('/convert', async (request, reply) => {
        try {
            /**
             * Get file.
             */
            const file = await request.file();
            if (!file) {
                return reply
                    .code(400)
                    .send({
                    success: false,
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
                    success: false,
                    error: 'Only DOCX files are supported',
                });
            }
            /**
             * Read DOCX.
             */
            const buffer = await file.toBuffer();
            /**
             * DOCX -> HTML.
             */
            const mammothResult = await mammoth.convertToHtml({
                buffer,
            });
            /**
             * HTML -> EDS HTML.
             */
            const conversionResult = convertToEdsHtml(mammothResult.value);
            /**
             * Extract actual HTML.
             */
            const edsHtml = getEdsHtml(conversionResult);
            if (!edsHtml) {
                return reply
                    .code(500)
                    .send({
                    success: false,
                    error: 'EDS HTML conversion returned empty content',
                });
            }
            /**
             * Detect blocks.
             */
            const detection = detectBlocks(edsHtml);
            const blocks = detection.blocks;
            /**
             * IMPORTANT:
             *
             * If col4_, col5_, etc. exists,
             * return validation error.
             */
            if (detection.errors.length > 0) {
                return reply
                    .code(400)
                    .send({
                    success: false,
                    error: 'Invalid column configuration',
                    validationErrors: detection.errors,
                });
            }
            /**
             * Generate XWalk.
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
                    html: block.html ||
                        '',
                };
            });
            /**
             * Final response.
             */
            return {
                success: true,
                filename: file.filename,
                html: edsHtml,
                detectedBlocks: blocks,
                blockFiles,
                xwalk,
                messages: mammothResult.messages,
            };
        }
        catch (error) {
            app.log.error(error);
            return reply
                .code(500)
                .send({
                success: false,
                error: 'Failed to convert DOCX file',
            });
        }
    });
}
