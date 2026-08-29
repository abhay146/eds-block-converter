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
 * TYPES
 * =========================================================
 */

interface ConverterResultLike {
  html?: string;
  edsHtml?: string;
  value?: string;
}


/**
 * =========================================================
 * BASIC HELPERS
 * =========================================================
 */

function cleanFieldText(
  value: string,
): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


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
      /[_-]+/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim()
    .replace(
      /\b\w/g,
      (char) => char.toUpperCase(),
    );
}


function normalizeFieldName(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '');
}


/**
 * =========================================================
 * GET EDS HTML
 * =========================================================
 */

function getEdsHtml(
  conversionResult: unknown,
): string {
  if (
    typeof conversionResult === 'string'
  ) {
    return conversionResult;
  }

  if (
    conversionResult &&
    typeof conversionResult === 'object'
  ) {
    const result =
      conversionResult as ConverterResultLike;

    if (
      typeof result.html === 'string'
    ) {
      return result.html;
    }

    if (
      typeof result.edsHtml === 'string'
    ) {
      return result.edsHtml;
    }

    if (
      typeof result.value === 'string'
    ) {
      return result.value;
    }
  }

  return '';
}


/**
 * =========================================================
 * COLUMN PREFIX
 * =========================================================
 *
 * Supported:
 *
 * col1_
 * col2_
 * col3_
 *
 * NOT supported:
 *
 * col4_
 * col5_
 */

interface ParsedFieldName {
  original: string;

  prefix: string;

  fieldName: string;

  columnNumber?: number;
}


function parseColumnFieldName(
  value: string,
): ParsedFieldName {
  const original =
    cleanFieldText(value);

  /**
   * Match:
   *
   * col1_reference
   * col2_richtext
   * col3_linkText
   * col1_referenceAlt
   */

  const match =
    original.match(
      /^col(\d+)_([\s\S]+)$/i,
    );

  if (
    !match
  ) {
    return {
      original,
      prefix: '',
      fieldName: original,
    };
  }

  const columnNumber =
    Number(match[1]);

  /**
   * Maximum only col1-col3.
   */

  if (
    columnNumber > 3
  ) {
    throw new Error(
      `Invalid column "${original}". Only col1_, col2_, and col3_ are allowed. col${columnNumber}_ is not supported.`,
    );
  }

  if (
    columnNumber < 1
  ) {
    throw new Error(
      `Invalid column "${original}". Column number must start from col1_.`,
    );
  }

  return {
    original,

    prefix:
      `col${columnNumber}_`,

    fieldName:
      cleanFieldText(
        match[2],
      ),

    columnNumber,
  };
}


/**
 * =========================================================
 * KNOWN FIELD TYPES
 * =========================================================
 */

function isKnownField(
  value: string,
): boolean {
  const parsed =
    parseColumnFieldName(value);

  const normalized =
    normalizeFieldName(
      parsed.fieldName,
    );

  return [
    'reference',
    'referencealt',

    'image',
    'imagealt',
    'thumbnailimagealt',

    'text',
    'richtext',
    'description',
    'title',

    'link',
    'linktext',
    'linktitle',

    'aemcontent',

    'url',

    'video',
    'videourl',
  ].includes(
    normalized,
  );
}


/**
 * =========================================================
 * CREATE FIELD
 * =========================================================
 */

function createFieldFromName(
  rawName: string,
  rawLabel?: string,
): XwalkField | null {
  const parsed =
    parseColumnFieldName(
      rawName,
    );

  const baseName =
    cleanFieldText(
      parsed.fieldName,
    );

  if (
    !baseName
  ) {
    return null;
  }

  const normalized =
    normalizeFieldName(
      baseName,
    );

  const prefix =
    parsed.prefix;

  /**
   * Final field name.
   *
   * Example:
   *
   * col1_reference
   *
   * -> col1_reference
   */

  const fieldName = (
    name: string,
  ) => `${prefix}${name}`;


  /**
   * =======================================================
   * REFERENCE
   * =======================================================
   */

  if (
    normalized === 'reference'
  ) {
    return {
      component: 'reference',

      name:
        fieldName('reference'),

      label:
        rawLabel ||
        createLabel(
          prefix
            ? `${prefix}reference`
            : 'Reference',
        ),

      valueType: 'string',

      multi: false,
    };
  }


  /**
   * =======================================================
   * REFERENCE ALT
   * =======================================================
   */

  if (
    normalized === 'referencealt'
  ) {
    return {
      component: 'text',

      valueType: 'string',

      name:
        fieldName('referenceAlt'),

      label:
        rawLabel ||
        'Reference Alt',

      value: '',
    };
  }


  /**
   * =======================================================
   * IMAGE
   * =======================================================
   */

  if (
    normalized === 'image'
  ) {
    return {
      component: 'reference',

      name:
        fieldName('image'),

      label:
        rawLabel ||
        'Image',

      valueType: 'string',

      multi: false,
    };
  }


  /**
   * =======================================================
   * IMAGE ALT
   * =======================================================
   */

  if (
    normalized === 'imagealt'
  ) {
    return {
      component: 'text',

      valueType: 'string',

      name:
        fieldName('imageAlt'),

      label:
        rawLabel ||
        'Image Alt',

      value: '',
    };
  }


  /**
   * =======================================================
   * THUMBNAIL IMAGE ALT
   * =======================================================
   */

  if (
    normalized === 'thumbnailimagealt'
  ) {
    return {
      component: 'text',

      valueType: 'string',

      name:
        fieldName('thumbnailImageAlt'),

      label:
        rawLabel ||
        'Thumbnail Image Alt',

      value: '',
    };
  }


  /**
   * =======================================================
   * TEXT
   * =======================================================
   *
   * Example:
   *
   * col1_text
   *
   * -> col1_text
   */

  if (
    normalized === 'text'
  ) {
    return {
      component: 'text',

      valueType: 'string',

      name:
        fieldName('text'),

      label:
        rawLabel ||
        'Text',

      value: '',
    };
  }


  /**
   * =======================================================
   * RICHTEXT
   * =======================================================
   *
   * Example:
   *
   * col1_richtext
   *
   * -> col1_richtext
   */

  if (
    normalized === 'richtext'
  ) {
    return {
      component: 'richtext',

      valueType: 'string',

      name:
        fieldName('richtext'),

      label:
        rawLabel ||
        'Title and Description',

      raw: true,
    };
  }


  /**
   * =======================================================
   * DESCRIPTION
   * =======================================================
   */

  if (
    normalized === 'description'
  ) {
    return {
      component: 'richtext',

      valueType: 'string',

      name:
        fieldName('description'),

      label:
        rawLabel ||
        'Description',

      raw: true,
    };
  }


  /**
   * =======================================================
   * TITLE
   * =======================================================
   */

  if (
    normalized === 'title'
  ) {
    return {
      component: 'text',

      valueType: 'string',

      name:
        fieldName('title'),

      label:
        rawLabel ||
        'Title',

      value: '',
    };
  }


  /**
   * =======================================================
   * LINK
   * =======================================================
   *
   * col2_link
   *
   * -> aem-content
   * -> col2_link
   */

  if (
    normalized === 'link'
  ) {
    return {
      component: 'aem-content',

      name:
        fieldName('link'),

      label:
        rawLabel ||
        'Link',
    };
  }


  /**
   * =======================================================
   * LINK TEXT
   * =======================================================
   *
   * col2_linkText
   *
   * -> text
   * -> col2_linkText
   */

  if (
    normalized === 'linktext'
  ) {
    return {
      component: 'text',

      valueType: 'string',

      name:
        fieldName('linkText'),

      label:
        rawLabel ||
        'Text',

      value: '',
    };
  }


  /**
   * =======================================================
   * LINK TITLE
   * =======================================================
   */

  if (
    normalized === 'linktitle'
  ) {
    return {
      component: 'text',

      valueType: 'string',

      name:
        fieldName('linkTitle'),

      label:
        rawLabel ||
        'Title',

      value: '',
    };
  }


  /**
   * =======================================================
   * AEM CONTENT
   * =======================================================
   */

  if (
    normalized === 'aemcontent'
  ) {
    return {
      component: 'aem-content',

      name:
        fieldName('link'),

      label:
        rawLabel ||
        'Link',
    };
  }


  /**
   * =======================================================
   * URL
   * =======================================================
   */

  if (
    normalized === 'url'
  ) {
    return {
      component: 'text',

      valueType: 'string',

      name:
        fieldName('url'),

      label:
        rawLabel ||
        'URL',

      value: '',
    };
  }


  /**
   * =======================================================
   * VIDEO
   * =======================================================
   */

  if (
    normalized === 'video'
  ) {
    return {
      component: 'text',

      valueType: 'string',

      name:
        fieldName('video'),

      label:
        rawLabel ||
        'Video',

      value: '',
    };
  }


  /**
   * =======================================================
   * VIDEO URL
   * =======================================================
   */

  if (
    normalized === 'videourl'
  ) {
    return {
      component: 'text',

      valueType: 'string',

      name:
        fieldName('videoUrl'),

      label:
        rawLabel ||
        'Video URL',

      value: '',
    };
  }


  /**
   * =======================================================
   * UNKNOWN FIELD
   * =======================================================
   */

  return {
    component: 'text',

    valueType: 'string',

    name:
      fieldName(
        createId(
          baseName,
        ),
      ),

    label:
      rawLabel ||
      createLabel(
        baseName,
      ),

    value: '',
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
    if (
      seen.has(field.name)
    ) {
      continue;
    }

    seen.add(field.name);

    result.push(field);
  }

  return result;
}


/**
 * =========================================================
 * DETECT FIELDS FROM TABLE
 * =========================================================
 */

function detectTableFields(
  tableHtml: string,
): XwalkField[] {
  const $ =
    cheerio.load(
      tableHtml,
    );

  const fields:
    XwalkField[] = [];


  $('tr').each(
    (rowIndex, row) => {
      /**
       * First row is block title.
       */

      if (
        rowIndex === 0
      ) {
        return;
      }


      const cells =
        $(row)
          .find('th, td')
          .toArray();


      for (
        const cell of cells
      ) {
        /**
         * Paragraphs inside table cell.
         */

        const paragraphs =
          $(cell)
            .find(
              'p, h1, h2, h3, h4, h5, h6',
            )
            .toArray();


        for (
          const element of paragraphs
        ) {
          const text =
            cleanFieldText(
              $(element).text(),
            );

          if (
            !text
          ) {
            continue;
          }


          /**
           * This also validates col1-col3.
           *
           * col4_xxx will throw error.
           */

          if (
            !isKnownField(text)
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
            fields.push(field);
          }
        }
      }
    },
  );


  return uniqueFields(
    fields,
  );
}


/**
 * =========================================================
 * DETECT FIELDS
 * =========================================================
 */

function detectFields(
  tableHtml: string,
): XwalkField[] {
  return detectTableFields(
    tableHtml,
  );
}


/**
 * =========================================================
 * BLOCK TITLE
 * =========================================================
 */

function getBlockTitle(
  table: cheerio.Cheerio<any>,
): string {
  const firstRow =
    table
      .find('tr')
      .first();

  if (
    !firstRow.length
  ) {
    return '';
  }

  return cleanFieldText(
    firstRow.text(),
  );
}


/**
 * =========================================================
 * PARSE TITLE + STYLES
 * =========================================================
 *
 * Hero (hero-v1)
 *
 * ->
 *
 * title = Hero
 * styles = ["hero-v1"]
 *
 *
 * AI Platforms (cards , swiper)
 *
 * ->
 *
 * title = AI Platforms
 * styles = ["cards", "swiper"]
 */

function parseBlockTitle(
  value: string,
): {
  title: string;
  styles: string[];
} {
  const text =
    cleanFieldText(
      value,
    );

  const match =
    text.match(
      /^(.*?)\s*\(([^()]+)\)\s*$/,
    );

  if (
    !match
  ) {
    return {
      title: text,
      styles: [],
    };
  }

  const title =
    match[1].trim();

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
 * CREATE BLOCK HTML
 * =========================================================
 */

function createEdsBlockHtml(
  tableHtml: string,
  blockId: string,
): string {
  const $ =
    cheerio.load(
      tableHtml,
    );

  const table =
    $('table').first();

  if (
    !table.length
  ) {
    return tableHtml;
  }

  /**
   * Change table into EDS block div.
   */

  table.addClass(
    `${blockId} block`,
  );


  return [
    `<div class="${blockId}-wrapper">`,
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
 * Example:
 *
 * <table>
 *   Row 1 -> Block title
 *   Row 2 -> Fields
 * </table>
 */

function detectBlocks(
  html: string,
): DetectedBlock[] {
  const blocks:
    DetectedBlock[] = [];

  if (
    !html ||
    !html.trim()
  ) {
    return blocks;
  }

  const $ =
    cheerio.load(
      html,
    );


  $('table').each(
    (index, element) => {
      const table =
        $(element);

      const rawTitle =
        getBlockTitle(
          table,
        );

      if (
        !rawTitle
      ) {
        return;
      }


      const {
        title,
        styles,
      } =
        parseBlockTitle(
          rawTitle,
        );


      if (
        !title
      ) {
        return;
      }


      const id =
        createId(title) ||
        `block-${index + 1}`;


      const originalHtml =
        $.html(
          table,
        );


      /**
       * Detect fields.
       *
       * col4_ error will be thrown here.
       */

      const fields =
        detectFields(
          originalHtml,
        );


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


  return blocks;
}


/**
 * =========================================================
 * FIND DEFINITION
 * =========================================================
 */

function findDefinition(
  definitions: unknown[],
  blockId: string,
): Record<string, unknown> | undefined {
  return definitions.find(
    (
      item: unknown,
    ): item is Record<string, unknown> => {
      return (
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        item.id === blockId
      );
    },
  );
}


/**
 * =========================================================
 * FIND MODEL
 * =========================================================
 */

function findModel(
  models: unknown[],
  blockId: string,
): {
  id: string;
  fields: XwalkField[];
} | undefined {
  const model =
    models.find(
      (
        item: unknown,
      ) => {
        return (
          typeof item === 'object' &&
          item !== null &&
          'id' in item &&
          (
            item as {
              id?: unknown;
            }
          ).id === blockId
        );
      },
    );


  if (
    !model ||
    typeof model !== 'object'
  ) {
    return undefined;
  }


  const typedModel =
    model as {
      id?: string;
      fields?: XwalkField[];
    };


  if (
    !typedModel.id
  ) {
    return undefined;
  }


  return {
    id:
      typedModel.id,

    fields:
      Array.isArray(
        typedModel.fields,
      )
        ? typedModel.fields
        : [],
  };
}


/**
 * =========================================================
 * ROUTE
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
         * =================================================
         * GET FILE
         * =================================================
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
         * =================================================
         * VALIDATE FILE
         * =================================================
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
         * =================================================
         * READ FILE
         * =================================================
         */

        const buffer =
          await file.toBuffer();


        /**
         * =================================================
         * DOCX -> HTML
         * =================================================
         */

        const result =
          await mammoth.convertToHtml({
            buffer,
          });


        /**
         * =================================================
         * HTML -> EDS HTML
         * =================================================
         */

        const conversionResult =
          convertToEdsHtml(
            result.value,
          );


        const edsHtml =
          getEdsHtml(
            conversionResult,
          );


        if (
          !edsHtml
        ) {
          return reply
            .code(500)
            .send({
              error:
                'EDS HTML conversion returned empty content',
            });
        }


        /**
         * =================================================
         * DETECT BLOCKS
         * =================================================
         */

        let blocks:
          DetectedBlock[];

        try {
          blocks =
            detectBlocks(
              edsHtml,
            );
        } catch (
          error
        ) {
          /**
           * Column validation error.
           */

          const message =
            error instanceof Error
              ? error.message
              : 'Failed to detect block fields';


          return reply
            .code(400)
            .send({
              error:
                message,
            });
        }


        /**
         * =================================================
         * GENERATE XWALK
         * =================================================
         */

        const xwalk =
          generateXwalkConfig(
            blocks,
          );


        /**
         * =================================================
         * INDIVIDUAL BLOCK FILES
         * =================================================
         */

        const blockFiles =
          blocks.map(
            (
              block: DetectedBlock,
            ) => {
              const definition =
                findDefinition(
                  xwalk.definitions,
                  block.id,
                );


              const model =
                findModel(
                  xwalk.models,
                  block.id,
                );


              /**
               * IMPORTANT:
               *
               * Individual JSON now contains:
               *
               * title
               * id
               * plugins
               * fields
               * filters
               */

              return {
                name:
                  block.id,

                jsonFile:
                  `${block.id}.json`,

                htmlFile:
                  `${block.id}.html`,


                json: {
                  ...(
                    definition || {
                      title:
                        block.title,

                      id:
                        block.id,
                    }
                  ),


                  fields:
                    model?.fields ||
                    block.fields,


                  /**
                   * IMPORTANT:
                   *
                   * filters is now present
                   * in EVERY individual JSON file.
                   */

                  filters: [],
                },


                html:
                  block.html ||
                  '',
              };
            },
          );


        /**
         * =================================================
         * FINAL RESPONSE
         * =================================================
         */

        return {
          success: true,

          filename:
            file.filename,


          /**
           * Full HTML.
           */

          html:
            edsHtml,


          /**
           * All detected blocks.
           */

          detectedBlocks:
            blocks,


          /**
           * Separate block JSON + HTML.
           */

          blockFiles,


          /**
           * Complete XWalk config.
           *
           * This contains:
           *
           * definitions
           * models
           * filters
           */

          xwalk,


          /**
           * Mammoth warnings.
           */

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
              error instanceof Error
                ? error.message
                : 'Failed to convert DOCX file',
          });
      }
    },
  );
}