import Fastify from 'fastify';
import type {
  FastifyInstance,
} from 'fastify';
import * as cheerio from 'cheerio';
import mammoth from 'mammoth';

import {
  convertToEdsHtml,
} from '../services/converter.js';

import {
  generateXwalkConfig,
  createId,
} from '../services/xwalk.js';

import type {
  DetectedBlock,
  XwalkField,
} from '../services/xwalk.js';

/**
 * =========================================================
 * BASIC HELPERS
 * =========================================================
 */

/**
 * Convert camelCase / kebab-case field names
 * into a readable label.
 *
 * referenceAlt
 * -> Reference Alt
 *
 * videoUrl
 * -> Video Url
 */
function createLabel(
  value: string,
): string {
  return value
    .trim()
    .replace(
      /([a-z])([A-Z])/g,
      '$1 $2',
    )
    .replace(
      /[-_]+/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim()
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase(),
    );
}

/**
 * Normalize field name only for
 * comparison.
 *
 * referenceAlt
 * reference alt
 * reference-alt
 *
 * all become:
 *
 * referencealt
 */
function normalizeFieldName(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      '',
    )
    .replace(
      /[-_]/g,
      '',
    );
}

/**
 * Clean field text.
 */
function cleanFieldText(
  value: string,
): string {
  return value
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

/**
 * =========================================================
 * KNOWN FIELD DETECTION
 * =========================================================
 */

/**
 * Check if a value is a known field.
 *
 * IMPORTANT:
 *
 * We intentionally keep this list strict.
 *
 * Normal content like:
 *
 * "This is some text"
 *
 * must NOT become a field called "text".
 */
function isExactKnownField(
  value: string,
): boolean {
  const normalized =
    normalizeFieldName(
      value,
    );

  return [
    'reference',
    'referencealt',
    'image',
    'imagealt',
    'thumbnailimagealt',
    'videourl',
    'video',
    'text',
    'description',
    'title',
    'link',
    'url',
  ].includes(
    normalized,
  );
}

/**
 * =========================================================
 * CREATE XWALK FIELD
 * =========================================================
 *
 * This is the most important function.
 *
 * DOCX field:
 *
 * reference
 * -> reference component
 *
 * referenceAlt
 * -> text component
 * -> imageAlt name
 *
 * text
 * -> richtext component
 *
 * Video url
 * -> text component
 * -> videoUrl name
 */
function createFieldFromName(
  rawName: string,
  rawLabel?: string,
): XwalkField | null {
  const original =
    cleanFieldText(
      rawName,
    );

  if (!original) {
    return null;
  }

  const normalized =
    normalizeFieldName(
      original,
    );

  /**
   * Use the actual DOCX label
   * whenever it exists.
   *
   * NEVER hardcode:
   *
   * Image Alt / Thumbnail Image Alt
   */
  const label =
    rawLabel &&
    cleanFieldText(
      rawLabel,
    )
      ? cleanFieldText(
          rawLabel,
        )
      : createLabel(
          original,
        );

  /**
   * -------------------------------------------------------
   * REFERENCE
   * -------------------------------------------------------
   */
  if (
    normalized ===
    'reference'
  ) {
    return {
      component:
        'reference',

      name:
        'reference',

      label,

      valueType:
        'string',

      multi:
        false,
    };
  }

  /**
   * -------------------------------------------------------
   * REFERENCE ALT
   * -------------------------------------------------------
   *
   * DOCX:
   *
   * referenceAlt
   *
   * XWalk:
   *
   * component: text
   * name: imageAlt
   */
  if (
    normalized ===
    'referencealt'
  ) {
    return {
      component:
        'text',

      valueType:
        'string',

      name:
        'imageAlt',

      label,
    };
  }

  /**
   * -------------------------------------------------------
   * IMAGE
   * -------------------------------------------------------
   */
  if (
    normalized ===
    'image'
  ) {
    return {
      component:
        'reference',

      name:
        'image',

      label,

      valueType:
        'string',

      multi:
        false,
    };
  }

  /**
   * -------------------------------------------------------
   * IMAGE ALT
   * -------------------------------------------------------
   */
  if (
    normalized ===
      'imagealt' ||
    normalized ===
      'thumbnailimagealt'
  ) {
    return {
      component:
        'text',

      valueType:
        'string',

      name:
        'imageAlt',

      label,
    };
  }

  /**
   * -------------------------------------------------------
   * VIDEO URL
   * -------------------------------------------------------
   */
  if (
    normalized ===
    'videourl'
  ) {
    return {
      component:
        'text',

      name:
        'videoUrl',

      label,

      valueType:
        'string',
    };
  }

  /**
   * -------------------------------------------------------
   * VIDEO
   * -------------------------------------------------------
   */
  if (
    normalized ===
    'video'
  ) {
    return {
      component:
        'text',

      name:
        'video',

      label,

      valueType:
        'string',
    };
  }

  /**
   * -------------------------------------------------------
   * TEXT
   * -------------------------------------------------------
   */
  if (
    normalized ===
    'text'
  ) {
    return {
      component:
        'richtext',

      name:
        'text',

      value:
        '',

      label,

      valueType:
        'string',
    };
  }

  /**
   * -------------------------------------------------------
   * DESCRIPTION
   * -------------------------------------------------------
   */
  if (
    normalized ===
    'description'
  ) {
    return {
      component:
        'richtext',

      name:
        'description',

      value:
        '',

      label,

      valueType:
        'string',
    };
  }

  /**
   * -------------------------------------------------------
   * TITLE
   * -------------------------------------------------------
   */
  if (
    normalized ===
    'title'
  ) {
    return {
      component:
        'text',

      name:
        'title',

      label,

      valueType:
        'string',
    };
  }

  /**
   * -------------------------------------------------------
   * LINK
   * -------------------------------------------------------
   */
  if (
    normalized ===
    'link'
  ) {
    return {
      component:
        'aem-content',

      name:
        'link',

      label,
    };
  }

  /**
   * -------------------------------------------------------
   * URL
   * -------------------------------------------------------
   */
  if (
    normalized ===
    'url'
  ) {
    return {
      component:
        'text',

      name:
        'url',

      label,

      valueType:
        'string',
    };
  }

  /**
   * Unknown field.
   *
   * Preserve it as text.
   */
  return {
    component:
      'text',

    name:
      createId(
        original,
      ),

    label,

    valueType:
      'string',
  };
}

/**
 * =========================================================
 * UNIQUE FIELDS
 * =========================================================
 */

function uniqueFields(
  fields: XwalkField[],
): XwalkField[] {
  const seen =
    new Set<string>();

  const result:
    XwalkField[] = [];

  for (
    const field of fields
  ) {
    const key =
      `${field.component}:${field.name}`;

    if (
      seen.has(
        key,
      )
    ) {
      continue;
    }

    seen.add(
      key,
    );

    result.push(
      field,
    );
  }

  return result;
}

/**
 * =========================================================
 * COLUMN HELPERS
 * =========================================================
 */

function detectColumnPrefix(
  blockHtml: string,
): string {
  const match =
    blockHtml.match(
      /column[-_]?(\d+)/i,
    );

  if (!match) {
    return '';
  }

  return `column${match[1]}`;
}

function withColumnPrefix(
  name: string,
  prefix: string,
): string {
  if (!prefix) {
    return name;
  }

  return `${prefix}-${name}`;
}

/**
 * =========================================================
 * TABLE FIELD DETECTION
 * =========================================================
 *
 * Supports tables like:
 *
 * | reference    | Reference |
 * | referenceAlt | Reference Alt |
 * | text         | Text |
 *
 * First cell = field name
 * Second cell = label
 */
function detectTableFields(
  blockHtml: string,
): XwalkField[] {
  const $ =
    cheerio.load(
      blockHtml,
    );

  const fields:
    XwalkField[] = [];

  $('table').each(
    (_, table) => {
      $(table)
        .find('tr')
        .each(
          (_, row) => {
            const cells =
              $(row)
                .find('th, td')
                .toArray();

            if (
              cells.length === 0
            ) {
              return;
            }

            const name =
              cleanFieldText(
                $(cells[0])
                  .text(),
              );

            if (!name) {
              return;
            }

            /**
             * If second cell exists,
             * treat it as label.
             */
            const label =
              cells.length >= 2
                ? cleanFieldText(
                    $(cells[1])
                      .text(),
                  )
                : '';

            const field =
              createFieldFromName(
                name,
                label,
              );

            if (!field) {
              return;
            }

            fields.push(
              field,
            );
          },
        );
    },
  );

  return uniqueFields(
    fields,
  );
}

/**
 * =========================================================
 * FIELD EXTRACTION FROM PARAGRAPHS
 * =========================================================
 *
 * This handles:
 *
 * <p>reference</p>
 * <p>referenceAlt</p>
 * <p>Video url</p>
 * <p>text</p>
 *
 * It also handles cases where DOCX
 * has generated nested DIVs.
 */
function detectFieldsFromParagraphs(
  blockHtml: string,
): XwalkField[] {
  const $ =
    cheerio.load(
      blockHtml,
    );

  const fields:
    XwalkField[] = [];

  $(
    'p, h1, h2, h3, h4, h5, h6',
  ).each(
    (_, element) => {
      const text =
        cleanFieldText(
          $(element)
            .text(),
        );

      if (!text) {
        return;
      }

      /**
       * Exact field only.
       *
       * This prevents normal sentence:
       *
       * "This is some text"
       *
       * from becoming a "text" field.
       */
      if (
        !isExactKnownField(
          text,
        )
      ) {
        return;
      }

      const field =
        createFieldFromName(
          text,
        );

      if (!field) {
        return;
      }

      fields.push(
        field,
      );
    },
  );

  return uniqueFields(
    fields,
  );
}

/**
 * =========================================================
 * FIELD EXTRACTION FROM RAW HTML
 * =========================================================
 *
 * Extra fallback for cases where
 * Mammoth puts multiple field names
 * inside one text node.
 *
 * Example:
 *
 * reference
 * referenceAlt
 * Video url
 * text
 *
 * even if they are inside one DIV.
 */
function detectFieldsFromRawText(
  blockHtml: string,
): XwalkField[] {
  const $ =
    cheerio.load(
      blockHtml,
    );

  const fields:
    XwalkField[] = [];

  /**
   * Get all text nodes through
   * body text.
   */
  const bodyText =
    $('body')
      .text()
      .replace(
        /\u00a0/g,
        ' ',
      )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();

  if (!bodyText) {
    return [];
  }

  /**
   * Split possible field names.
   *
   * We intentionally check longer
   * names before shorter names.
   */
  const candidates = [
    'referenceAlt',
    'thumbnailImageAlt',
    'imageAlt',
    'Video url',
    'video url',
    'reference',
    'image',
    'video',
    'text',
    'description',
    'title',
    'link',
    'url',
  ];

  for (
    const candidate of candidates
  ) {
    const regex =
      new RegExp(
        `(?:^|[\\s|,/;:]+)${candidate.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          '\\$&',
        )}(?=$|[\\s|,/;:]+)`,
        'i',
      );

    if (
      !regex.test(
        bodyText,
      )
    ) {
      continue;
    }

    const field =
      createFieldFromName(
        candidate,
      );

    if (!field) {
      continue;
    }

    fields.push(
      field,
    );
  }

  return uniqueFields(
    fields,
  );
}

/**
 * =========================================================
 * GENERIC FALLBACK
 * =========================================================
 */

function detectFallbackFields(
  blockHtml: string,
): XwalkField[] {
  const $ =
    cheerio.load(
      blockHtml,
    );

  const fields:
    XwalkField[] = [];

  const hasHeading =
    $(
      'h1, h2, h3, h4, h5, h6',
    ).length > 0;

  const hasParagraph =
    $('p').length > 0;

  const hasImage =
    blockHtml.includes(
      '[IMAGE',
    );

  const hasLink =
    $('a').length > 0;

  const hasList =
    $('ul, ol').length > 0;

  const columnPrefix =
    detectColumnPrefix(
      blockHtml,
    );

  if (
    hasHeading
  ) {
    fields.push({
      component:
        'text',

      name:
        withColumnPrefix(
          'title',
          columnPrefix,
        ),

      label:
        'Title',

      valueType:
        'string',
    });
  }

  if (
    hasParagraph ||
    hasList
  ) {
    fields.push({
      component:
        'richtext',

      name:
        withColumnPrefix(
          'description',
          columnPrefix,
        ),

      label:
        'Description',

      value:
        '',

      valueType:
        'string',
    });
  }

  if (
    hasImage
  ) {
    fields.push({
      component:
        'reference',

      name:
        withColumnPrefix(
          'image',
          columnPrefix,
        ),

      label:
        'Image',

      valueType:
        'string',

      multi:
        false,
    });
  }

  if (
    hasLink
  ) {
    fields.push({
      component:
        'aem-content',

      name:
        withColumnPrefix(
          'link',
          columnPrefix,
        ),

      label:
        'Link',
    });
  }

  return uniqueFields(
    fields,
  );
}

/**
 * =========================================================
 * MAIN FIELD DETECTION
 * =========================================================
 */
function detectFields(
  blockHtml: string,
): XwalkField[] {
  /**
   * 1. Real table.
   */
  const tableFields =
    detectTableFields(
      blockHtml,
    );

  /**
   * 2. Paragraph / heading
   *    based detection.
   */
  const paragraphFields =
    detectFieldsFromParagraphs(
      blockHtml,
    );

  /**
   * 3. Raw text fallback.
   */
  const rawTextFields =
    detectFieldsFromRawText(
      blockHtml,
    );

  /**
   * Merge everything.
   *
   * uniqueFields prevents:
   *
   * reference
   * reference
   *
   * from appearing twice.
   */
  const detected =
    uniqueFields([
      ...tableFields,
      ...paragraphFields,
      ...rawTextFields,
    ]);

  if (
    detected.length
  ) {
    return detected;
  }

  /**
   * 4. Generic content fallback.
   */
  return detectFallbackFields(
    blockHtml,
  );
}

/**
 * =========================================================
 * BLOCK TITLE
 * =========================================================
 */

function getBlockTitle(
  block: cheerio.Cheerio<any>,
): string {
  const firstRow =
    block
      .children()
      .first();

  if (
    !firstRow.length
  ) {
    return '';
  }

  const firstText =
    firstRow
      .find(
        'p, h1, h2, h3, h4, h5, h6',
      )
      .first()
      .text()
      .replace(
        /\[IMAGE(?::[^\]]+)?\]/gi,
        '',
      )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();

  /**
   * IMPORTANT:
   *
   * Field names should NOT become
   * block title.
   *
   * If first row contains only
   * reference/referenceAlt/text etc.,
   * don't use it as title.
   */
  if (
    firstText &&
    !isExactKnownField(
      firstText,
    )
  ) {
    return firstText;
  }

  const fallbackText =
    firstRow
      .text()
      .replace(
        /\[IMAGE(?::[^\]]+)?\]/gi,
        '',
      )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();

  if (
    fallbackText &&
    !isExactKnownField(
      fallbackText,
    )
  ) {
    return fallbackText;
  }

  return '';
}

/**
 * =========================================================
 * BLOCK TITLE + STYLES
 * =========================================================
 */

function parseBlockTitle(
  value: string,
): {
  title: string;
  styles: string[];
} {
  const text =
    value
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();

  const match =
    text.match(
      /^(.*?)\s*\(([^()]*)\)\s*$/,
    );

  if (!match) {
    return {
      title:
        text,

      styles:
        [],
    };
  }

  const title =
    match[1]
      .trim();

  const styles =
    match[2]
      .split(',')
      .map(
        (style) =>
          style.trim(),
      )
      .filter(Boolean);

  return {
    title,
    styles,
  };
}

/**
 * =========================================================
 * BLOCK HTML
 * =========================================================
 */

function replaceBlockClass(
  html: string,
  id: string,
): string {
  return html.replace(
    /class=["']cards["']/i,
    `class="${id} block"`,
  );
}

function createEdsBlockHtml(
  originalHtml: string,
  id: string,
): string {
  const blockHtml =
    replaceBlockClass(
      originalHtml,
      id,
    );

  return [
    `<div class="${id}-wrapper">`,
    blockHtml,
    '</div>',
  ].join('\n');
}

/**
 * =========================================================
 * BLOCK DETECTION
 * =========================================================
 */

function detectBlocks(
  html: string,
): DetectedBlock[] {
  const blocks:
    DetectedBlock[] = [];

  const $ =
    cheerio.load(
      html,
    );

  $('.cards').each(
    (
      index,
      element,
    ) => {
      const block =
        $(element);

      /**
       * Ignore metadata.
       */
      if (
        block.hasClass(
          'metadata',
        ) ||
        block.find(
          '.metadata',
        ).length > 0
      ) {
        return;
      }

      /**
       * Get block title.
       */
      const rawTitle =
        getBlockTitle(
          block,
        );

      /**
       * If no title is available,
       * use Block + number.
       */
      const safeTitle =
        rawTitle ||
        `Block ${index + 1}`;

      const {
        title,
        styles,
      } =
        parseBlockTitle(
          safeTitle,
        );

      if (!title) {
        return;
      }

      /**
       * Clean ID.
       *
       * Hero (hero-v1)
       * -> hero
       */
      const id =
        createId(
          title,
        ) ||
        `block-${index + 1}`;

      /**
       * Original HTML.
       */
      const originalHtml =
        $.html(
          block,
        );

      /**
       * Detect fields.
       */
      const fields =
        detectFields(
          originalHtml,
        );

      /**
       * Final EDS HTML.
       */
      const finalHtml =
        createEdsBlockHtml(
          originalHtml,
          id,
        );

      const detectedBlock:
        DetectedBlock = {
        title,

        id,

        fields,

        html:
          finalHtml,

        _styles:
          styles,
      };

      blocks.push(
        detectedBlock,
      );
    },
  );

  /**
   * =======================================================
   * GENERIC FALLBACK
   * =======================================================
   */
  if (
    blocks.length === 0 &&
    html.trim()
  ) {
    const rawTitle =
      $(
        'h1, h2, h3, h4, h5, h6',
      )
        .first()
        .text()
        .replace(
          /\s+/g,
          ' ',
        )
        .trim() ||
      'Content';

    const {
      title,
      styles,
    } =
      parseBlockTitle(
        rawTitle,
      );

    const id =
      createId(
        title,
      ) ||
      'content';

    blocks.push({
      title,

      id,

      fields:
        detectFields(
          html,
        ),

      html,

      _styles:
        styles,
    });
  }

  return blocks;
}

/**
 * =========================================================
 * DOCX CONVERSION ROUTE
 * =========================================================
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
         * Upload DOCX.
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
         * DOCX -> HTML.
         */
        const result =
          await mammoth.convertToHtml(
            {
              buffer,
            },
          );

        /**
         * HTML -> EDS HTML.
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
         * Generate XWalk.
         */
        const xwalk =
          generateXwalkConfig(
            blocks,
          );

        /**
         * Generate block files.
         */
        const blockFiles =
          blocks.map(
            (block) => ({
              name:
                block.id,

              jsonFile:
                `${block.id}.json`,

              htmlFile:
                `${block.id}.html`,

              json: {
                title:
                  block.title,

                id:
                  block.id,

                fields:
                  block.fields,
              },

              html:
                block.html ||
                '',
            }),
          );

        /**
         * Final response.
         */
        return {
          success:
            true,

          filename:
            file.filename,

          html:
            edsHtml,

          detectedBlocks:
            blocks,

          blockFiles,

          xwalk,

          messages:
            result.messages,
        };
      } catch (error) {
        app.log.error(
          error,
        );

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