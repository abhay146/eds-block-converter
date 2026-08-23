export interface XwalkField {
  component: string;
  name: string;
  label: string;
  valueType?: string;
  value?: string;
  multi?: boolean;
  options?: unknown[];
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
 * Create block ID.
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
export function createId(value: string): string {
  return value
    .trim()
    .replace(/\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Create field name.
 *
 * IMPORTANT:
 * Do NOT lowercase camelCase field names.
 *
 * reference
 * -> reference
 *
 * referenceAlt
 * -> referenceAlt
 *
 * Video url
 * -> videoUrl
 *
 * Image Alt
 * -> imageAlt
 */
export function createFieldName(value: string): string {
  const text = value
    .trim()
    .replace(/\s+/g, ' ');

  if (!text) {
    return '';
  }

  /**
   * Already camelCase.
   *
   * referenceAlt
   * -> referenceAlt
   */
  if (
    /^[a-z][a-zA-Z0-9]*$/.test(text)
  ) {
    return text;
  }

  /**
   * Convert spaces / hyphens / underscores
   * to camelCase.
   *
   * Video url
   * -> videoUrl
   *
   * Reference Alt
   * -> referenceAlt
   *
   * Image Alt
   * -> imageAlt
   */
  return text
    .replace(
      /[-_\s]+(.)?/g,
      (_, char: string | undefined) =>
        char ? char.toUpperCase() : '',
    )
    .replace(
      /^[A-Z]/,
      (char) => char.toLowerCase(),
    );
}

/**
 * Convert field name to display label.
 *
 * reference
 * -> Reference
 *
 * referenceAlt
 * -> Reference Alt
 *
 * videoUrl
 * -> Video Url
 *
 * imageAlt
 * -> Image Alt
 */
export function createFieldLabel(
  value: string,
): string {
  const name = createFieldName(value);

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
      (char) => char.toUpperCase(),
    );
}

/**
 * Style display name.
 *
 * hero-v1
 * -> Hero V1
 *
 * cards
 * -> Cards
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
      (char) => char.toUpperCase(),
    );
}

/**
 * Get styles stored on block.
 */
function getBlockStyles(
  block: DetectedBlock,
): string[] {
  if (!Array.isArray(block._styles)) {
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
      (style) => style.trim(),
    );
}

/**
 * Extract styles from title.
 *
 * Hero (hero-v1)
 * -> ["hero-v1"]
 *
 * AI Platforms (cards, swiper)
 * -> ["cards", "swiper"]
 */
function extractStylesFromTitle(
  title: string,
): string[] {
  const match = title.match(
    /\(([^()]*)\)\s*$/,
  );

  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map(
      (style) => style.trim(),
    )
    .filter(Boolean);
}

/**
 * Clean block title.
 *
 * Hero (hero-v1)
 * -> Hero
 *
 * AI Platforms (cards, swiper)
 * -> AI Platforms
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
 * Create Classes field.
 */
function createStyleField(
  block: DetectedBlock,
  blockTitle: string,
): XwalkField {
  let styles = getBlockStyles(block);

  if (!styles.length) {
    styles =
      extractStylesFromTitle(
        block.title,
      );
  }

  return {
    component: 'multiselect',
    name: 'classes',
    label: 'Classes',

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

                    value: style,
                  }),
                ),
            },
          ]
        : [],
  };
}

/**
 * Remove automatically detected classes field.
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
 * Remove duplicate fields.
 *
 * reference + referenceAlt must
 * remain two separate fields.
 */
function removeDuplicateFields(
  fields: XwalkField[],
): XwalkField[] {
  const seen = new Set<string>();

  return fields.filter(
    (field) => {
      const key =
        `${field.component}:${field.name}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    },
  );
}

/**
 * Generate XWalk configuration.
 */
export function generateXwalkConfig(
  blocks: DetectedBlock[],
): XwalkConfig {
  const definitions: unknown[] = [];
  const models: unknown[] = [];
  const filters: unknown[] = [];

  /**
   * Prevent duplicate block definitions/models.
   */
  const processedIds =
    new Set<string>();

  for (const block of blocks) {
    /**
     * Clean title.
     */
    const blockTitle =
      cleanBlockTitle(
        block.title,
      );

    /**
     * Create block ID only
     * from title.
     */
    const blockId =
      createId(blockTitle);

    if (!blockId) {
      continue;
    }

    /**
     * Prevent duplicate blocks.
     */
    if (processedIds.has(blockId)) {
      continue;
    }

    processedIds.add(blockId);

    /**
     * Definition.
     */
    definitions.push({
      title: blockTitle,
      id: blockId,

      plugins: {
        xwalk: {
          page: {
            resourceType:
              'core/franklin/components/block/v1/block',

            template: {
              name: blockTitle,
              model: blockId,
              filter: blockId,
            },
          },
        },
      },
    });

    /**
     * Existing detected fields.
     */
    let fields =
      removeClassesField(
        block.fields || [],
      );

    /**
     * Remove duplicates but DO NOT
     * merge reference and referenceAlt.
     */
    fields =
      removeDuplicateFields(
        fields,
      );

    /**
     * Classes field always first.
     */
    const styleField =
      createStyleField(
        block,
        blockTitle,
      );

    /**
     * Model.
     */
    models.push({
      id: blockId,

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