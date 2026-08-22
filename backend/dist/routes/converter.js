import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { convertToEdsHtml } from '../services/converter.js';
import { generateXwalkConfig, createId, } from '../services/xwalk.js';
/**
 * Detect whether the document/block explicitly contains
 * column prefixes such as:
 *
 * col1_
 * col2_
 * col3_
 *
 * We DO NOT create these prefixes automatically.
 */
function detectColumnPrefix(blockHtml) {
    const match = blockHtml.match(/\b(col\d+_)/i);
    if (!match) {
        return '';
    }
    return match[1].toLowerCase();
}
/**
 * Add a column prefix only when it actually exists
 * in the DOCX content.
 *
 * Example:
 *
 * col1_ + image
 * => col1_image
 *
 * col2_ + description
 * => col2_description
 *
 * No prefix:
 * => image
 * => description
 */
function withColumnPrefix(name, prefix) {
    if (!prefix) {
        return name;
    }
    return `${prefix}${name}`;
}
/**
 * Detect fields from block HTML.
 */
function detectFields(blockHtml) {
    const fields = [];
    const $ = cheerio.load(blockHtml);
    const hasHeading = $('h1, h2, h3, h4, h5, h6').length > 0;
    const hasParagraph = $('p').length > 0;
    const hasImage = blockHtml.includes('[IMAGE]');
    const hasLink = $('a').length > 0;
    const hasList = $('ul, ol').length > 0;
    /**
     * Detect explicit column prefix.
     *
     * Example:
     * col1_
     * col2_
     */
    const columnPrefix = detectColumnPrefix(blockHtml);
    /**
     * Title
     */
    if (hasHeading) {
        fields.push({
            component: 'text',
            name: withColumnPrefix('title', columnPrefix),
            label: 'Title',
        });
    }
    /**
     * Description
     */
    if (hasParagraph || hasList) {
        fields.push({
            component: 'richtext',
            name: withColumnPrefix('description', columnPrefix),
            label: 'Description',
        });
    }
    /**
     * Image
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
     * Link
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
 * Get block name dynamically.
 *
 * Example:
 *
 * <div class="cards">
 *   <div>
 *     <div><p>Hero</p></div>
 *   </div>
 * </div>
 *
 * Returns:
 *
 * Hero
 */
function getBlockTitle(block) {
    const firstRow = block.children().first();
    if (!firstRow.length) {
        return '';
    }
    /**
     * First try text from the first row.
     */
    const title = firstRow
        .text()
        .replace(/\[IMAGE\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (title) {
        return title;
    }
    /**
     * Fallback to heading.
     */
    const heading = firstRow
        .find('h1, h2, h3, h4, h5, h6')
        .first();
    if (heading.length) {
        return heading
            .text()
            .replace(/\s+/g, ' ')
            .trim();
    }
    return '';
}
/**
 * Detect blocks automatically.
 *
 * No block names are hardcoded.
 *
 * Hero
 *   -> hero
 *
 * Columns
 *   -> columns
 *
 * Abhay
 *   -> abhay
 *
 * My Banner
 *   -> my-banner
 */
function detectBlocks(html) {
    const blocks = [];
    const $ = cheerio.load(html);
    /**
     * Every .cards container is
     * treated as a block candidate.
     */
    $('.cards').each((index, element) => {
        const block = $(element);
        /**
         * Ignore metadata.
         */
        if (block.hasClass('metadata') ||
            block.find('.metadata').length) {
            return;
        }
        /**
         * Get block title.
         */
        const title = getBlockTitle(block);
        if (!title) {
            return;
        }
        /**
         * Generate ID.
         *
         * Display title:
         * Abhay
         *
         * ID:
         * abhay
         */
        const id = createId(title) ||
            `block-${index + 1}`;
        /**
         * Get complete block HTML.
         */
        const blockHtml = $.html(block);
        /**
         * Detect fields.
         */
        const fields = detectFields(blockHtml);
        blocks.push({
            title,
            id,
            fields,
        });
    });
    /**
     * Fallback:
     *
     * If no .cards blocks exist,
     * create one generic block.
     */
    if (!blocks.length &&
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
        });
    }
    return blocks;
}
/**
 * Converter route.
 */
export async function converterRoutes(app) {
    app.post('/convert', async (request, reply) => {
        try {
            /**
             * Get uploaded DOCX.
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
             * Read DOCX.
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
            const edsHtml = convertToEdsHtml(result.value);
            /**
             * Detect blocks.
             */
            const blocks = detectBlocks(edsHtml);
            /**
             * Generate XWalk config.
             */
            const xwalk = generateXwalkConfig(blocks);
            /**
             * Return conversion result.
             */
            return {
                success: true,
                filename: file.filename,
                html: edsHtml,
                detectedBlocks: blocks,
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
