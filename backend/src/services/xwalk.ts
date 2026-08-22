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
}

export interface XwalkConfig {
  definitions: unknown[];
  models: unknown[];
  filters: unknown[];
}

/**
 * Convert block title to XWalk ID.
 *
 * Abhay
 * -> abhay
 *
 * My Banner
 * -> my-banner
 */
function createId(
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
      /^-+|-+$/g,
      '');
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

  for (
    const block of blocks
  ) {
    const blockId =
      createId(
        block.id ||
        block.title,
      );

    /**
     * Block definition.
     */
    definitions.push({
      title: block.title,

      id: blockId,

      plugins: {
        xwalk: {
          page: {
            resourceType:
              'core/franklin/components/block/v1/block',

            template: {
              name: block.title,
              model: blockId,
              filter: blockId,
            },
          },
        },
      },
    });

    /**
     * Block model.
     */
    models.push({
      id: blockId,

      fields: [
        {
          component:
            'multiselect',

          name:
            'classes',

          label:
            'Classes',

          options: [
            {
              name:
                `${block.title} Style`,

              children: [
                {
                  name:
                    block.title,

                  value:
                    blockId,
                },
              ],
            },
          ],
        },

        ...block.fields,
      ],
    });
  }

  return {
    definitions,
    models,
    filters,
  };
}

export {
  createId,
};