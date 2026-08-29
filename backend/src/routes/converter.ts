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
 * Create readable label.
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
 * Normalize only for comparison.
 *
 * referenceAlt
 * reference alt
 * reference-alt
 *
 * -> referencealt
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
 * Clean text.
 */
function cleanFieldText(
  value: string,
): string {
  return value
    .replace(
      /\u00a0/g,
      ' ',
    )
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
    'richtext',
    'aemcontent',
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
 * CREATE FIELD FROM DOCX VALUE
 * =========================================================
 *
 * IMPORTANT MAPPING:
 *
 * reference
 * -> reference
 *
 * referenceAlt
 * -> referenceAlt
 *
 * richtext
 * -> richtext + raw true
 *
 * text
 * -> text + value ""
 *
 * aem-content
 * -> aem-content + link
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

  const defaultLabel =
    createLabel(
      original,
    );

  const label =
    rawLabel &&
    cleanFieldText(
      rawLabel,
    )
      ? cleanFieldText(
          rawLabel,
        )
      : defaultLabel;

  /**
   * =====================================================
   * REFERENCE
   * =====================================================
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
   * =====================================================
   * REFERENCE ALT
   *
   * IMPORTANT:
   *
   * referenceAlt
   * MUST remain
   * referenceAlt
   *
   * NOT imageAlt
   * =====================================================
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
        'referenceAlt',

      label,

      value:
        '',
    };
  }

  /**
   * =====================================================
   * IMAGE
   * =====================================================
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
   * =====================================================
   * IMAGE ALT
   * =====================================================
   */
  if (
    normalized ===
    'imagealt'
  ) {
    return {
      component:
        'text',

      valueType:
        'string',

      name:
        'imageAlt',

      label,

      value:
        '',
    };
  }

  /**
   * =====================================================
   * THUMBNAIL IMAGE ALT
   * =====================================================
   */
  if (
    normalized ===
    'thumbnailimagealt'
  ) {
    return {
      component:
        'text',

      valueType:
        'string',

      name:
        'thumbnailImageAlt',

      label,

      value:
        '',
    };
  }

  /**
   * =====================================================
   * VIDEO URL
   * =====================================================
   */
  if (
    normalized ===
    'videourl'
  ) {
    return {
      component:
        'text',

      valueType:
        'string',

      name:
        'videoUrl',

      label,

      value:
        '',
    };
  }

  /**
   * =====================================================
   * VIDEO
   * =====================================================
   */
  if (
    normalized ===
    'video'
  ) {
    return {
      component:
        'text',

      valueType:
        'string',

      name:
        'video',

      label,

      value:
        '',
    };
  }

  /**
   * =====================================================
   * TEXT
   *
   * DOCX:
   *
   * text
   *
   * OUTPUT:
   *
   * {
   *   component: "text",
   *   valueType: "string",
   *   name: "text",
   *   label: "Text",
   *   value: ""
   * }
   * =====================================================
   */
  if (
    normalized ===
    'text'
  ) {
    return {
      component:
        'text',

      valueType:
        'string',

      name:
        'text',

      label,

      value:
        '',
    };
  }

  /**
   * =====================================================
   * RICHTEXT
   *
   * DOCX:
   *
   * richtext
   *
   * OUTPUT:
   *
   * {
   *   component: "richtext",
   *   valueType: "string",
   *   name: "richtext",
   *   label: "Richtext",
   *   raw: true
   * }
   * =====================================================
   */
  if (
    normalized ===
    'richtext'
  ) {
    return {
      component:
        'richtext',

      valueType:
        'string',

      name:
        'richtext',

      label,

      raw:
        true,
    };
  }

  /**
   * =====================================================
   * DESCRIPTION
   * =====================================================
   */
  if (
    normalized ===
    'description'
  ) {
    return {
      component:
        'richtext',

      valueType:
        'string',

      name:
        'description',

      label,

      raw:
        true,
    };
  }

  /**
   * =====================================================
   * TITLE
   * =====================================================
   */
  if (
    normalized ===
    'title'
  ) {
    return {
      component:
        'text',

      valueType:
        'string',

      name:
        'title',

      label,

      value:
        '',
    };
  }

  /**
   * =====================================================
   * AEM-CONTENT
   *
   * DOCX:
   *
   * aem-content
   *
   * OUTPUT:
   *
   * {
   *   component: "aem-content",
   *   name: "link",
   *   label: "Link"
   * }
   * =====================================================
   */
  if (
    normalized ===
    'aemcontent'
  ) {
    return {
      component:
        'aem-content',

      name:
        'link',

      label:
        'Link',
    };
  }

  /**
   * =====================================================
   * LINK
   * =====================================================
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
   * =====================================================
   * URL
   * =====================================================
   */
  if (
    normalized ===
    'url'
  ) {
    return {
      component:
        'text',

      valueType:
        'string',

      name:
        'url',

      label,

      value:
        '',
    };
  }

  /**
   * =====================================================
   * UNKNOWN FIELD
   * =====================================================
   */
  return {
    component:
      'text',

    valueType:
      'string',

    name:
      createId(
        original,
      ),

    label,

    value:
      '',
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
 * DETECT FIELDS FROM TABLE
 * =========================================================
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
    (_tableIndex, table) => {
      $(table)
        .find('tr')
        .each(
          (_rowIndex, row) => {
            const cells =
              $(row)
                .find('th, td')
                .toArray();

            for (
              const cell of cells
            ) {
              /**
               * Get every paragraph separately.
               *
               * Example:
               *
               * reference
               * referenceAlt
               */
              const elements =
                $(cell)
                  .find(
                    'p, h1, h2, h3, h4, h5, h6',
                  )
                  .toArray();

              if (
                elements.length
              ) {
                for (
                  const element of elements
                ) {
                  const text =
                    cleanFieldText(
                      $(element)
                        .text(),
                    );

                  if (
                    !text ||
                    !isExactKnownField(
                      text,
                    )
                  ) {
                    continue;
                  }

                  const field =
                    createFieldFromName(
                      text,
                    );

                  if (
                    field
                  ) {
                    fields.push(
                      field,
                    );
                  }
                }

                continue;
              }

              const cellText =
                $(cell)
                  .text();

              const values =
                cellText
                  .split(
                    /\r?\n/,
                  )
                  .map(
                    (value) =>
                      cleanFieldText(
                        value,
                      ),
                  )
                  .filter(
                    Boolean,
                  );

              for (
                const value of values
              ) {
                if (
                  !isExactKnownField(
                    value,
                  )
                ) {
                  continue;
                }

                const field =
                  createFieldFromName(
                    value,
                  );

                if (
                  field
                ) {
                  fields.push(
                    field,
                  );
                }
              }
            }
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
 * DETECT FIELDS FROM PARAGRAPHS
 * =========================================================
 *
 * This is especially important because
 * convertToEdsHtml converts tables into DIVs.
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
    (_index, element) => {
      const text =
        cleanFieldText(
          $(element)
            .text(),
        );

      if (
        !text
      ) {
        return;
      }

      /**
       * Normal paragraph content
       * must not become a field.
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

      if (
        field
      ) {
        fields.push(
          field,
        );
      }
    },
  );

  return uniqueFields(
    fields,
  );
}

/**
 * =========================================================
 * DETECT FIELDS FROM RAW TEXT
 * =========================================================
 *
 * Fallback for DOCX structures where
 * multiple field names appear in one DIV.
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
   * Check all elements individually
   * so text from separate paragraphs
   * does not get merged incorrectly.
   */
  const candidates = [
    'referenceAlt',
    'thumbnailImageAlt',
    'imageAlt',
    'aem-content',
    'aem content',
    'richtext',
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

  const elements =
    $('p, h1, h2, h3, h4, h5, h6, div')
      .toArray();

  for (
    const element of elements
  ) {
    /**
     * Only use direct text when possible.
     */
    const text =
      cleanFieldText(
        $(element)
          .clone()
          .children()
          .remove()
          .end()
          .text(),
      );

    if (
      !text
    ) {
      continue;
    }

    for (
      const candidate of candidates
    ) {
      const candidateNormalized =
        normalizeFieldName(
          candidate,
        );

      const textNormalized =
        normalizeFieldName(
          text,
        );

      if (
        textNormalized !==
        candidateNormalized
      ) {
        continue;
      }

      const field =
        createFieldFromName(
          candidate,
        );

      if (
        field
      ) {
        fields.push(
          field,
        );
      }

      break;
    }
  }

  return uniqueFields(
    fields,
  );
}

/**
 * =========================================================
 * GENERIC CONTENT FALLBACK
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

  if (
    hasHeading
  ) {
    fields.push({
      component:
        'text',

      name:
        'title',

      label:
        'Title',

      valueType:
        'string',

      value:
        '',
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
        'richtext',

      label:
        'Richtext',

      valueType:
        'string',

      raw:
        true,
    });
  }

  if (
    hasImage
  ) {
    fields.push({
      component:
        'reference',

      name:
        'image',

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
        'link',

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
  const tableFields =
    detectTableFields(
      blockHtml,
    );

  const paragraphFields =
    detectFieldsFromParagraphs(
      blockHtml,
    );

  const rawTextFields =
    detectFieldsFromRawText(
      blockHtml,
    );

  const detected =
    uniqueFields([
      ...tableFields,
      ...paragraphFields,
      ...rawTextFields,
    ]);

  if (
    detected.length > 0
  ) {
    return detected;
  }

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
   * Field name should not become title.
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
 * PARSE BLOCK TITLE + STYLES
 * =========================================================
 *
 * Hero (hero-v1)
 *
 * title = Hero
 * styles = ["hero-v1"]
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
      /^(.*?)\s*\(([^()]+)\)\s*$/,
    );

  if (
    !match
  ) {
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
      .filter(
        Boolean,
      );

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
  ].join(
    '\n',
  );
}

/**
 * =========================================================
 * DETECT BLOCKS
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
       * Get title.
       */
      const rawTitle =
        getBlockTitle(
          block,
        );

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

      if (
        !title
      ) {
        return;
      }

      /**
       * Hero
       * -> hero
       */
      const id =
        createId(
          title,
        ) ||
        `block-${index + 1}`;

      /**
       * Original block HTML.
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
       * Final EDS block HTML.
       */
      const finalHtml =
        createEdsBlockHtml(
          originalHtml,
          id,
        );

      blocks.push({
        title,
        id,
        fields,
        html:
          finalHtml,
        _styles:
          styles,
      });
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

        if (
          !file
        ) {
          return reply
            .code(400)
            .send({
              error:
                'No DOCX file uploaded',
            });
        }

        /**
         * Validate file extension.
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
          await mammoth.convertToHtml({
            buffer,
          });

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
         * Generate XWalk config.
         */
        const xwalk =
          generateXwalkConfig(
            blocks,
          );

        /**
         * Generate individual
         * block JSON + HTML.
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
      } catch (
        error
      ) {
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