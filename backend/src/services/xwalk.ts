/**
 * =========================================================
 * XWALK TYPES
 * =========================================================
 */

export interface XwalkOption {
  name: string;
  value: string;
}

export interface XwalkField {
  component: string;
  name: string;
  label: string;

  valueType?: string;

  value?: string;

  raw?: boolean;

  multi?: boolean;

  options?: XwalkOption[];
}

export interface DetectedBlock {
  title: string;

  id: string;

  fields: XwalkField[];

  html?: string;

  /**
   * Internal styles extracted from:
   *
   * Hero (hero-v1)
   *
   * _styles = ["hero-v1"]
   */
  _styles?: string[];
}

export interface XwalkDefinition {
  title: string;

  id: string;

  plugins: {
    xwalk: {
      page: {
        resourceType: string;

        template: {
          name: string;
          model: string;
          filter: string;
        };
      };
    };
  };
}

export interface XwalkModel {
  id: string;

  fields: XwalkField[];
}

export interface XwalkConfig {
  definitions: XwalkDefinition[];

  models: XwalkModel[];

  filters: unknown[];
}

/**
 * =========================================================
 * CREATE BLOCK ID
 * =========================================================
 *
 * Examples:
 *
 * Hero
 * -> hero
 *
 * AI Platforms
 * -> ai-platforms
 *
 * Award Block
 * -> award-block
 */

export function createId(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-',
    )
    .replace(
      /^-+/g,
      '',
    )
    .replace(
      /-+$/g,
      '',
    )
    .replace(
      /-+/g,
      '-',
    );
}

/**
 * =========================================================
 * NORMALIZE TO CAMEL CASE
 * =========================================================
 *
 * Reference Alt
 * -> referenceAlt
 *
 * link-text
 * -> linkText
 *
 * link_text
 * -> linkText
 */

function toCamelCase(
  value: string,
): string {
  const cleaned =
    value
      .trim()
      .replace(
        /([a-z])([A-Z])/g,
        '$1 $2',
      )
      .replace(
        /[^a-zA-Z0-9]+/g,
        ' ',
      )
      .trim();

  if (!cleaned) {
    return '';
  }

  const parts =
    cleaned
      .split(/\s+/)
      .filter(Boolean);

  return parts
    .map(
      (
        part,
        index,
      ) => {
        const lower =
          part.toLowerCase();

        if (index === 0) {
          return lower;
        }

        return (
          lower.charAt(0).toUpperCase() +
          lower.slice(1)
        );
      },
    )
    .join('');
}

/**
 * =========================================================
 * VALIDATE COLUMN PREFIX
 * =========================================================
 *
 * Allowed:
 *
 * col1_
 * col2_
 * col3_
 *
 * Not allowed:
 *
 * col4_
 * col5_
 * col10_
 */

export function validateColumnField(
  fieldName: string,
): void {
  const match =
    fieldName.match(
      /^col(\d+)_/i,
    );

  if (!match) {
    return;
  }

  const columnNumber =
    Number(match[1]);

  if (
    columnNumber > 3
  ) {
    throw new Error(
      `Invalid field "${fieldName}". ` +
        `Maximum allowed column is col3_. ` +
        `Only col1_, col2_, and col3_ are allowed.`,
    );
  }
}

/**
 * =========================================================
 * CREATE FIELD NAME
 * =========================================================
 *
 * Normal:
 *
 * Reference Alt
 * -> referenceAlt
 *
 * Link Text
 * -> linkText
 *
 *
 * Column:
 *
 * col1_text
 * -> col1_text
 *
 * col1_richtext
 * -> col1_richtext
 *
 * col2_linkText
 * -> col2_linkText
 *
 * col3_referenceAlt
 * -> col3_referenceAlt
 */

export function createFieldName(
  value: string,
): string {
  const original =
    value.trim();

  if (!original) {
    return '';
  }

  /**
   * Detect any column prefix first.
   *
   * This also detects col4_, col5_, etc.
   * so validation can throw an error.
   */
  const anyColumnMatch =
    original.match(
      /^col(\d+)[_\s-]+(.+)$/i,
    );

  if (anyColumnMatch) {
    const columnNumber =
      Number(
        anyColumnMatch[1],
      );

    /**
     * Throw error for col4+.
     */
    if (
      columnNumber > 3
    ) {
      throw new Error(
        `Invalid field "${original}". ` +
          `Maximum allowed column is col3_. ` +
          `Only col1_, col2_, and col3_ are allowed.`,
      );
    }

    const column =
      `col${columnNumber}`;

    const fieldPart =
      toCamelCase(
        anyColumnMatch[2],
      );

    if (!fieldPart) {
      return '';
    }

    /**
     * IMPORTANT:
     *
     * Keep underscore between
     * column and field name.
     *
     * col1_text
     */
    return `${column}_${fieldPart}`;
  }

  return toCamelCase(
    original,
  );
}

/**
 * =========================================================
 * CREATE FIELD LABEL
 * =========================================================
 *
 * referenceAlt
 * -> Reference Alt
 *
 * linkText
 * -> Link Text
 *
 * col1_text
 * -> Text
 *
 * col1_richtext
 * -> Richtext
 *
 * col2_linkText
 * -> Link Text
 */

export function createFieldLabel(
  value: string,
): string {
  let result =
    value
      .trim()

      /**
       * Remove column prefix from label.
       */
      .replace(
        /^col[1-3]_+/i,
        '',
      )

      /**
       * Convert camelCase.
       */
      .replace(
        /([a-z])([A-Z])/g,
        '$1 $2',
      )

      /**
       * Replace snake/kebab.
       */
      .replace(
        /[-_]+/g,
        ' ',
      )

      .replace(
        /\s+/g,
        ' ',
      )

      .trim();

  if (!result) {
    return '';
  }

  return result.replace(
    /\b\w/g,
    (char) =>
      char.toUpperCase(),
  );
}

/**
 * =========================================================
 * CREATE STYLE DISPLAY NAME
 * =========================================================
 *
 * hero-v1
 * -> Hero V1
 *
 * background-semantic-green
 * -> Background Semantic Green
 *
 * form-step
 * -> Form Step
 */

function createStyleName(
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
    .trim()
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase(),
    );
}

/**
 * =========================================================
 * NORMALIZE FIELD
 * =========================================================
 */

function normalizeField(
  field: XwalkField,
): XwalkField {
  const originalName =
    field.name
      ? field.name.trim()
      : '';

  if (!originalName) {
    throw new Error(
      'Field name cannot be empty.',
    );
  }

  /**
   * Validate col1/col2/col3.
   */
  validateColumnField(
    originalName,
  );

  /**
   * Generate final field name.
   */
  const name =
    createFieldName(
      originalName,
    );

  /**
   * Validate final name.
   */
  validateColumnField(
    name,
  );

  /**
   * Preserve existing label.
   * Otherwise generate one.
   */
  const label =
    field.label &&
    field.label.trim()
      ? field.label.trim()
      : createFieldLabel(
          name,
        );

  return {
    ...field,

    name,

    label,
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
    const normalized =
      normalizeField(
        field,
      );

    const key =
      normalized.name.toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push(
      normalized,
    );
  }

  return result;
}

/**
 * =========================================================
 * CREATE CLASSES / STYLE FIELD
 * =========================================================
 *
 * Input:
 *
 * ["hero-v1"]
 *
 * Output:
 *
 * {
 *   component: "multiselect",
 *   name: "classes",
 *   label: "Style",
 *   options: [
 *     {
 *       name: "Hero V1",
 *       value: "hero-v1"
 *     }
 *   ]
 * }
 */

function createClassesField(
  styles: string[],
): XwalkField {
  /**
   * Remove empty and duplicate styles.
   */
  const uniqueStyles =
    [
      ...new Set(
        styles
          .map(
            (style) =>
              style.trim(),
          )
          .filter(Boolean),
      ),
    ];

  return {
    component:
      'multiselect',

    name:
      'classes',

    label:
      'Style',

    options:
      uniqueStyles.map(
        (style) => ({
          name:
            createStyleName(
              style,
            ),

          value:
            style,
        }),
      ),
  };
}

/**
 * =========================================================
 * CREATE XWALK DEFINITION
 * =========================================================
 */

function createDefinition(
  block: DetectedBlock,
): XwalkDefinition {
  return {
    title:
      block.title,

    id:
      block.id,

    plugins: {
      xwalk: {
        page: {
          resourceType:
            'core/franklin/components/block/v1/block',

          template: {
            name:
              block.title,

            model:
              block.id,

            filter:
              block.id,
          },
        },
      },
    },
  };
}

/**
 * =========================================================
 * CREATE XWALK MODEL
 * =========================================================
 */

function createModel(
  block: DetectedBlock,
): XwalkModel {
  const styles =
    Array.isArray(
      block._styles,
    )
      ? block._styles
          .map(
            (style) =>
              style.trim(),
          )
          .filter(Boolean)
      : [];

  /**
   * Normalize detected fields.
   */
  const normalizedFields =
    uniqueFields(
      block.fields || [],
    );

  /**
   * Style field always first.
   */
  const fields:
    XwalkField[] = [
      createClassesField(
        styles,
      ),

      ...normalizedFields,
    ];

  return {
    id:
      block.id,

    fields,
  };
}

/**
 * =========================================================
 * GENERATE FULL XWALK CONFIG
 * =========================================================
 *
 * Final structure:
 *
 * {
 *   definitions: [],
 *   models: [],
 *   filters: []
 * }
 */

export function generateXwalkConfig(
  blocks: DetectedBlock[],
): XwalkConfig {
  const definitions:
    XwalkDefinition[] =
      [];

  const models:
    XwalkModel[] =
      [];

  /**
   * Prevent duplicate IDs.
   */
  const usedIds =
    new Set<string>();

  for (
    const block of blocks
  ) {
    if (
      !block.id
    ) {
      continue;
    }

    if (
      usedIds.has(
        block.id,
      )
    ) {
      continue;
    }

    usedIds.add(
      block.id,
    );

    /**
     * Definition.
     */
    definitions.push(
      createDefinition(
        block,
      ),
    );

    /**
     * Model.
     */
    models.push(
      createModel(
        block,
      ),
    );
  }

  return {
    definitions,

    models,

    /**
     * Full XWalk config.
     */
    filters: [],
  };
}