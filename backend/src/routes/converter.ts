import { FastifyInstance } from 'fastify';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

import { convertToEdsHtml } from '../services/converter.js';

import {
  generateXwalkConfig,
  DetectedBlock,
  XwalkField,
  createId,
} from '../services/xwalk.js';

/**
 * Detect fields from block HTML.
 *
 * Nothing is hardcoded for Hero, Columns,
 * Cards or any other block name.
 */
function detectFields(
  blockHtml: string,
): XwalkField[] {
  const fields: XwalkField[] = [];

  const $ = cheerio.load(blockHtml);

  const hasHeading =
    $('h1, h2, h3, h4, h5, h6').length > 0;

  const hasParagraph =
    $('p').length > 0;

  const hasImage =
    blockHtml.includes('[IMAGE]');

  const hasLink =
    $('a').length > 0;

  const hasList =
    $('ul, ol').length > 0;

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
 * Get dynamic block name.
 *
 * First row of the block is treated
 * as the block name.
 */
function getBlockTitle(
  block: cheerio.Cheerio<any>,
): string {
  const firstRow =
    block.children().first();

  if (!firstRow.length) {
    return '';
  }

  const title =
    firstRow
      .text()
      .replace(/\[IMAGE\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  return title;
}

/**
 * Detect blocks automatically.
 *
 * No Hero / Columns / Cards names
 * are hardcoded here.
 */
function detectBlocks(
  html: string,
): DetectedBlock[] {
  const blocks: DetectedBlock[] = [];

  const $ = cheerio.load(html);

  /**
   * Every .cards container is treated
   * as a block candidate.
   */
  $('.cards').each(
    (index, element) => {
      const block =
        $(element);

      /**
       * Ignore metadata.
       */
      if (
        block.hasClass('metadata') ||
        block.find('.metadata').length
      ) {
        return;
      }

      /**
       * Detect block name.
       */
      const title =
        getBlockTitle(block);

      if (!title) {
        return;
      }

      /**
       * Generate ID automatically.
       *
       * Hero
       *   -> hero
       *
       * My Custom Block
       *   -> my-custom-block
       */
      const id =
        createId(title) ||
        `block-${index + 1}`;

      /**
       * Get complete block HTML.
       */
      const blockHtml =
        $.html(block);

      /**
       * Detect fields automatically.
       */
      const fields =
        detectFields(blockHtml);

      blocks.push({
        title,
        id,
        fields,
      });
    },
  );

  /**
   * Fallback when no .cards blocks
   * are found.
   */
  if (
    !blocks.length &&
    html.trim()
  ) {
    const title =
      $('h1, h2, h3, h4, h5, h6')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim() ||
      'Content';

    const id =
      createId(title) ||
      'content';

    blocks.push({
      title,
      id,
      fields:
        detectFields(html),
    });
  }

  return blocks;
}

/**
 * Converter route.
 */
export async function converterRoutes(
  app: FastifyInstance,
) {
  app.post(
    '/convert',
    async (
      request,
      reply,
    ) => {
      try {
        /**
         * Get uploaded DOCX.
         */
        const file =
          await request.file();

        if (!file) {
          return reply
            .code(400)
            .send({
              error:
                'No DOCX file uploaded',
            });
        }

        /**
         * Validate extension.
         */
        const filename =
          file.filename
            .toLowerCase();

        if (
          !filename.endsWith(
            '.docx',
          )
        ) {
          return reply
            .code(400)
            .send({
              error:
                'Only DOCX files are supported',
            });
        }

        /**
         * Read DOCX.
         */
        const buffer =
          await file.toBuffer();

        /**
         * DOCX → HTML.
         */
        const result =
          await mammoth.convertToHtml({
            buffer,
          });

        /**
         * HTML → EDS HTML.
         */
        const edsHtml =
          convertToEdsHtml(
            result.value,
          );

        /**
         * Detect blocks.
         */
        const blocks =
          detectBlocks(
            edsHtml,
          );

        /**
         * Generate XWalk config.
         */
        const xwalk =
          generateXwalkConfig(
            blocks,
          );

        return {
          success: true,

          filename:
            file.filename,

          html:
            edsHtml,

          detectedBlocks:
            blocks,

          xwalk,

          messages:
            result.messages,
        };
      } catch (error) {
        app.log.error(error);

        return reply
          .code(500)
          .send({
            error:
              'Failed to convert DOCX file',
          });
      }
    },
  );
}