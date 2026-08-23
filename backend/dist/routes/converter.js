import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { convertToEdsHtml, } from '../services/converter.js';
import { generateXwalkConfig, createId, } from '../services/xwalk.js';
/**
 * Detect explicit column prefix.
 *
 * col1_
 * col2_
 * col3_
 */
function detectColumnPrefix(blockHtml) {
    const match = blockHtml.match(/\b(col\d+_)/i);
    if (!match) {
        return '';
    }
    return match[1].toLowerCase();
}
/**
 * Add prefix only when it exists
 * in the original document.
 */
function withColumnPrefix(name, prefix) {
    if (!prefix) {
        return name;
    }
    return `${prefix}${name}`;
}
/**
 * Parse block title and styles.
 *
 * Examples:
 *
 * Hero
 * -> title: Hero
 * -> styles: []
 *
 * Hero (hero-v1)
 * -> title: Hero
 * -> styles: ["hero-v1"]
 *
 * AI Platforms (cards, swiper)
 * -> title: AI Platforms
 * -> styles: ["cards", "swiper"]
 *
 * Tabs (left-tab, list-layout-two)
 * -> title: Tabs
 * -> styles: ["left-tab", "list-layout-two"]
 */
function parseBlockTitle(value) {
    const text = value
        .replace(/\s+/g, ' ')
        .trim();
    const match = text.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
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
 * Detect XWalk fields.
 */
function detectFields(blockHtml) {
    const fields = [];
    const $ = cheerio.load(blockHtml);
    const hasHeading = $('h1, h2, h3, h4, h5, h6').length > 0;
    const hasParagraph = $('p').length > 0;
    const hasImage = blockHtml.includes('[IMAGE');
    const hasLink = $('a').length > 0;
    const hasList = $('ul, ol').length > 0;
    const columnPrefix = detectColumnPrefix(blockHtml);
    /**
     * Title.
     */
    if (hasHeading) {
        fields.push({
            component: 'text',
            name: withColumnPrefix('title', columnPrefix),
            label: 'Title',
        });
    }
    /**
     * Description.
     */
    if (hasParagraph || hasList) {
        fields.push({
            component: 'richtext',
            name: withColumnPrefix('description', columnPrefix),
            label: 'Description',
        });
    }
    /**
     * Image.
     */
    if (hasImage) {
        fields.push({
            component: 'reference',
            name: withColumnPrefix('image', columnPrefix),
            label: 'Image',
            valueType: 'string',
            multi: false,
        });
    }
    /**
     * Link.
     */
    if (hasLink) {
        fields.push({
            component: 'aem-content',
            name: withColumnPrefix('link', columnPrefix),
            label: 'Link',
        });
    }
    return fields;
}
/**
 * Get raw block title from first row.
 *
 * Example:
 *
 * <div class="cards">
 *   <div>
 *     <div>
 *       <p>Hero (hero-v1)</p>
 *     </div>
 *   </div>
 * </div>
 *
 * returns:
 *
 * Hero (hero-v1)
 */
function getBlockTitle(block) {
    const firstRow = block.children().first();
    if (!firstRow.length) {
        return '';
    }
    const firstText = firstRow
        .find('p, h1, h2, h3, h4, h5, h6')
        .first()
        .text()
        .replace(/\[IMAGE(?::[^\]]+)?\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (firstText) {
        return firstText;
    }
    return firstRow
        .text()
        .replace(/\[IMAGE(?::[^\]]+)?\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Replace temporary cards class.
 */
function replaceBlockClass(html, id) {
    return html.replace(/class=["']cards["']/i, `class="${id} block"`);
}
/**
 * Add EDS-style wrapper.
 *
 * Example:
 *
 * <div class="hero-wrapper">
 *   <div class="hero block">
 *     ...
 *   </div>
 * </div>
 */
function createEdsBlockHtml(originalHtml, id) {
    const blockHtml = replaceBlockClass(originalHtml, id);
    return [
        `<div class="${id}-wrapper">`,
        blockHtml,
        '</div>',
    ].join('\n');
}
/**
 * Detect blocks.
 */
function detectBlocks(html) {
    const blocks = [];
    const $ = cheerio.load(html);
    $('.cards').each((index, element) => {
        const block = $(element);
        /**
         * Ignore metadata.
         */
        if (block.hasClass('metadata') ||
            block.find('.metadata').length > 0) {
            return;
        }
        /**
         * Get raw title.
         */
        const rawTitle = getBlockTitle(block);
        if (!rawTitle) {
            return;
        }
        /**
         * Parse block name and styles.
         *
         * Example:
         *
         * Hero (hero-v1)
         *
         * becomes:
         *
         * title = Hero
         * styles = ["hero-v1"]
         */
        const { title, styles, } = parseBlockTitle(rawTitle);
        if (!title) {
            return;
        }
        /**
         * Generate block ID
         * from block name only.
         *
         * Hero
         * -> hero
         *
         * AI Platforms
         * -> ai-platforms
         */
        const id = createId(title) ||
            `block-${index + 1}`;
        /**
         * Original block HTML.
         */
        const originalHtml = $.html(block);
        /**
         * Fields.
         */
        const fields = detectFields(originalHtml);
        /**
         * Final EDS HTML.
         */
        const finalHtml = createEdsBlockHtml(originalHtml, id);
        /**
         * IMPORTANT:
         *
         * styles are NOT added to
         * DetectedBlock.
         *
         * They are stored temporarily
         * as a non-enumerable property.
         *
         * xwalk.ts can read them,
         * but JSON output will NOT contain:
         *
         * "styles": [...]
         */
        const detectedBlock = {
            title,
            id,
            fields,
            html: finalHtml,
        };
        Object.defineProperty(detectedBlock, '_styles', {
            value: styles,
            enumerable: false,
            writable: true,
        });
        blocks.push(detectedBlock);
    });
    /**
     * Generic fallback.
     */
    if (blocks.length === 0 &&
        html.trim()) {
        const title = $('h1, h2, h3, h4, h5, h6')
            .first()
            .text()
            .replace(/\s+/g, ' ')
            .trim() ||
            'Content';
        const id = createId(title) ||
            'content';
        blocks.push({
            title,
            id,
            fields: detectFields(html),
            html,
        });
    }
    return blocks;
}
/**
 * Convert DOCX to EDS.
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
            const filename = file.filename.toLowerCase();
            if (!filename.endsWith('.docx')) {
                return reply
                    .code(400)
                    .send({
                    error: 'Only DOCX files are supported',
                });
            }
            /**
             * Read DOCX.
             */
            const buffer = await file.toBuffer();
            /**
             * DOCX -> HTML.
             *
             * IMPORTANT:
             * Do NOT use convertImage here.
             *
             * We don't want base64 images.
             */
            const result = await mammoth.convertToHtml({
                buffer,
            });
            /**
             * Convert Mammoth HTML
             * into EDS table/block HTML.
             */
            const edsHtml = convertToEdsHtml(result.value);
            /**
             * Detect blocks.
             */
            const blocks = detectBlocks(edsHtml);
            /**
             * Generate XWalk.
             */
            const xwalk = generateXwalkConfig(blocks);
            /**
             * Individual files.
             */
            const blockFiles = blocks.map((block) => ({
                name: block.id,
                jsonFile: `${block.id}.json`,
                htmlFile: `${block.id}.html`,
                json: {
                    title: block.title,
                    id: block.id,
                    fields: block.fields,
                },
                html: block.html || '',
            }));
            /**
             * Return response.
             */
            return {
                success: true,
                filename: file.filename,
                /**
                 * Complete EDS HTML.
                 */
                html: edsHtml,
                /**
                 * Detected blocks.
                 */
                detectedBlocks: blocks,
                /**
                 * Individual block files.
                 */
                blockFiles,
                /**
                 * XWalk config.
                 */
                xwalk,
                /**
                 * Mammoth messages.
                 */
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
