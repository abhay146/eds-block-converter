export interface XwalkField {
  component: string;
  name: string;
  label: string;
  valueType?: string;
  value?: string;
  multi?: boolean;
  options?: unknown[];
  raw?: boolean;
}

export interface DetectedBlock {
  title: string;
  id: string;
  fields: XwalkField[];
  html?: string;
  _styles?: string[];
}

export interface XwalkConfig {
  definitions: unknown[];
  models: unknown[];
  filters: unknown[];
}

/**
 * =========================================================
 * CREATE BLOCK ID
 * =========================================================
 *
 * Hero
 * -> hero
 *
 * Hero (hero-v1)
 * -> hero
 *
 * AI Platforms
 * -> ai-platforms
 */
export function createId(
  value: string,
): string {
  return value
    .trim()
    .replace(
      /\([^)]*\)/g,
      '',
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-',
    )
    .replace(
      /^-+|-+$/g,
      '',
    );
}

/**
 * =========================================================
 * CREATE FIELD NAME
 * =========================================================
 *
 * reference
 * -> reference
 *
 * referenceAlt
 * -> referenceAlt
 *
 * Video url
 * -> videoUrl
 */
export function createFieldName(
  value: string,
): string {
  const text =
    value
      .trim()
      .replace(
        /\s+/g,
        ' ',
      );

  if (!text) {
    return '';
  }

  /**
   * Already camelCase.
   */
  if (
    /^[a-z][a-zA-Z0-9]*$/.test(
      text,
    )
  ) {
    return text;
  }

  /**
   * Convert:
   *
   * Reference Alt
   * -> referenceAlt
   *
   * video-url
   * -> videoUrl
   */
  return text
    .replace(
      /[-_\s]+(.)?/g,
      (
        _,
        char: string | undefined,
      ) =>
        char
          ? char.toUpperCase()
          : '',
    )
    .replace(
      /^[A-Z]/,
      (char) =>
        char.toLowerCase(),
    );
}

/**
 * =========================================================
 * CREATE FIELD LABEL
 * =========================================================
 *
 * referenceAlt
 * -> Reference Alt
 */
export function createFieldLabel(
  value: string,
): string {
  const name =
    createFieldName(
      value,
    );

  if (!name) {
    return '';
  }

  return name
    .replace(
      /([a-z0-9])([A-Z])/g,
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
 * =========================================================
 * STYLE DISPLAY NAME
 * =========================================================
 *
 * hero-v1
 * -> Hero V1
 */
function styleDisplayName(
  value: string,
): string {
  return value
    .trim()
    .replace(
      /[-_]+/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase(),
    );
}

/**
 * =========================================================
 * GET BLOCK STYLES
 * =========================================================
 */
function getBlockStyles(
  block: DetectedBlock,
): string[] {
  if (
    !Array.isArray(
      block._styles,
    )
  ) {
    return [];
  }

  return block._styles
    .filter(
      (
        style,
      ): style is string =>
        typeof style === 'string' &&
        style.trim().length > 0,
    )
    .map(
      (style) =>
        style.trim(),
    );
}

/**
 * =========================================================
 * EXTRACT STYLES FROM TITLE
 * =========================================================
 *
 * Hero (hero-v1)
 * -> ["hero-v1"]
 *
 * Cards (cards, dark)
 * -> ["cards", "dark"]
 */
function extractStylesFromTitle(
  title: string,
): string[] {
  const match =
    title.match(
      /\(([^()]+)\)\s*$/,
    );

  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map(
      (style) =>
        style.trim(),
    )
    .filter(Boolean);
}

/**
 * =========================================================
 * CLEAN BLOCK TITLE
 * =========================================================
 *
 * Hero (hero-v1)
 * -> Hero
 */
function cleanBlockTitle(
  title: string,
): string {
  return title
    .trim()
    .replace(
      /\s*\([^)]*\)\s*$/,
      '',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

/**
 * =========================================================
 * CREATE CLASSES FIELD
 * =========================================================
 */
function createStyleField(
  block: DetectedBlock,
  blockTitle: string,
): XwalkField {
  let styles =
    getBlockStyles(
      block,
    );

  if (!styles.length) {
    styles =
      extractStylesFromTitle(
        block.title,
      );
  }

  return {
    component:
      'multiselect',

    name:
      'classes',

    label:
      'Classes',

    options:
      styles.length > 0
        ? [
            {
              name:
                `${blockTitle} Style`,

              children:
                styles.map(
                  (style) => ({
                    name:
                      styleDisplayName(
                        style,
                      ),

                    value:
                      style,
                  }),
                ),
            },
          ]
        : [],
  };
}

/**
 * =========================================================
 * REMOVE EXISTING CLASSES FIELD
 * =========================================================
 */
function removeClassesField(
  fields: XwalkField[],
): XwalkField[] {
  return fields.filter(
    (field) =>
      field.name !== 'classes',
  );
}

/**
 * =========================================================
 * REMOVE DUPLICATE FIELDS
 * =========================================================
 *
 * reference
 * referenceAlt
 *
 * are different fields.
 */
function removeDuplicateFields(
  fields: XwalkField[],
): XwalkField[] {
  const seen =
    new Set<string>();

  return fields.filter(
    (field) => {
      const key =
        `${field.component}:${field.name}`;

      if (
        seen.has(
          key,
        )
      ) {
        return false;
      }

      seen.add(
        key,
      );

      return true;
    },
  );
}

/**
 * =========================================================
 * GENERATE XWALK CONFIG
 * =========================================================
 */
export function generateXwalkConfig(
  blocks: DetectedBlock[],
): XwalkConfig {
  const definitions:
    unknown[] = [];

  const models:
    unknown[] = [];

  const filters:
    unknown[] = [];

  /**
   * Prevent duplicate IDs.
   */
  const processedIds =
    new Set<string>();

  for (
    const block of blocks
  ) {
    /**
     * Clean block title.
     *
     * Hero (hero-v1)
     * -> Hero
     */
    const blockTitle =
      cleanBlockTitle(
        block.title,
      );

    /**
     * Block ID.
     *
     * Hero
     * -> hero
     */
    const blockId =
      createId(
        blockTitle,
      );

    if (!blockId) {
      continue;
    }

    if (
      processedIds.has(
        blockId,
      )
    ) {
      continue;
    }

    processedIds.add(
      blockId,
    );

    /**
     * =====================================================
     * DEFINITION
     * =====================================================
     */
    definitions.push({
      title:
        blockTitle,

      id:
        blockId,

      plugins: {
        xwalk: {
          page: {
            resourceType:
              'core/franklin/components/block/v1/block',

            template: {
              name:
                blockTitle,

              model:
                blockId,

              filter:
                blockId,
            },
          },
        },
      },
    });

    /**
     * Existing fields.
     */
    let fields =
      removeClassesField(
        block.fields || [],
      );

    /**
     * Remove duplicates.
     */
    fields =
      removeDuplicateFields(
        fields,
      );

    /**
     * Classes field.
     */
    const styleField =
      createStyleField(
        block,
        blockTitle,
      );

    /**
     * =====================================================
     * MODEL
     * =====================================================
     */
    models.push({
      id:
        blockId,

      fields: [
        styleField,
        ...fields,
      ],
    });
  }

  return {
    definitions,
    models,
    filters,
  };
}