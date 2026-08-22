import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { convertToEdsHtml } from '../services/converter.js';
import { generateXwalkConfig, createId, } from '../services/xwalk.js';
/**
 * Detect fields from block HTML.
 *
 * Block name is NOT hardcoded.
 * Fields are detected from actual block content.
 */
function detectFields(blockHtml) {
    const fields = [];
    const $ = cheerio.load(blockHtml);
    const hasHeading = $('h1, h2, h3, h4, h5, h6').length > 0;
    const hasParagraph = $('p').length > 0;
    const hasImage = blockHtml.includes('[IMAGE]');
    const hasLink = $('a').length > 0;
    const hasList = $('ul, ol').length > 0;
    if (hasHeading) {
        fields.push({
            component: 'text',
            name: 'title',
            label: 'Title',
        });
    }
    if (hasParagraph || hasList) {
        fields.push({
            component: 'richtext',
            name: 'description',
            label: 'Description',
        });
    }
    if (hasImage) {
        fields.push({
            component: 'reference',
            name: 'image',
            label: 'Image',
        });
    }
    if (hasLink) {
        fields.push({
            component: 'text',
            name: 'link',
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
 *
 * No Hero / Columns / Cards name is hardcoded.
 */
function getBlockTitle(block) {
    const firstRow = block.children().first();
    if (!firstRow.length) {
        return '';
    }
    /**
     * Get text from the first row.
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
 * Every .cards container is treated as a block.
 *
 * The first row text becomes the block name.
 *
 * Example:
 *
 * Hero       -> hero
 * Columns    -> columns
 * Cards      -> cards
 * Abhay      -> abhay
 * My Banner  -> my-banner
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
            block.find('.metadata').length) {
            return;
        }
        /**
         * Get dynamic block name.
         */
        const title = getBlockTitle(block);
        if (!title) {
            return;
        }
        /**
         * Create block ID.
         *
         * Abhay
         * -> abhay
         *
         * My Custom Block
         * -> my-custom-block
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
     * If there are no .cards blocks,
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
             */
            const result = await mammoth.convertToHtml({
                buffer,
            });
            /**
             * HTML -> EDS HTML.
             */
            const edsHtml = convertToEdsHtml(result.value);
            /**
             * Detect blocks from
             * converted EDS HTML.
             */
            const blocks = detectBlocks(edsHtml);
            /**
             * Generate XWalk configuration.
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
