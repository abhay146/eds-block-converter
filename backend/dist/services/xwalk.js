/**
 * Create a valid block ID.
 *
 * Examples:
 *
 * Hero
 * -> hero
 *
 * AI Platforms
 * -> ai-platforms
 *
 * List Layout Two
 * -> list-layout-two
 */
export function createId(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
/**
 * Convert style value into a human-readable name.
 *
 * Examples:
 *
 * hero-v1
 * -> Hero V1
 *
 * left-tab
 * -> Left Tab
 *
 * list-layout-two
 * -> List Layout Two
 *
 * swiper
 * -> Swiper
 */
function styleDisplayName(value) {
    return value
        .trim()
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
/**
 * Get styles detected from the block.
 *
 * The parser stores styles temporarily
 * on the block as a non-enumerable
 * `_styles` property.
 *
 * This keeps `styles` out of the
 * final DetectedBlock JSON.
 */
function getBlockStyles(block) {
    const blockWithStyles = block;
    if (!Array.isArray(blockWithStyles._styles)) {
        return [];
    }
    return blockWithStyles._styles
        .filter((style) => typeof style === 'string' &&
        style.trim().length > 0)
        .map((style) => style.trim());
}
/**
 * Generate XWalk Style field.
 *
 * Example:
 *
 * Hero (hero-v1)
 *
 * becomes:
 *
 * {
 *   component: "multiselect",
 *   name: "classes",
 *   label: "Style",
 *   options: [
 *     {
 *       name: "Common Style",
 *       children: [
 *         {
 *           name: "Hero V1",
 *           value: "hero-v1"
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
function createStyleField(block) {
    const styles = getBlockStyles(block);
    return {
        component: 'multiselect',
        name: 'classes',
        label: 'Style',
        options: [
            {
                name: 'Common Style',
                children: styles.map((style) => ({
                    name: styleDisplayName(style),
                    value: style,
                })),
            },
        ],
    };
}
/**
 * Generate XWalk configuration.
 */
export function generateXwalkConfig(blocks) {
    const definitions = [];
    const models = [];
    for (const block of blocks) {
        /**
         * Block ID.
         *
         * IMPORTANT:
         *
         * block.id is already generated
         * from the block name only.
         *
         * Example:
         *
         * Hero (hero-v1)
         * -> hero
         */
        const blockId = createId(block.id ||
            block.title);
        /**
         * Definition.
         */
        definitions.push({
            title: block.title,
            id: blockId,
            plugins: {
                xwalk: {
                    page: {
                        resourceType: 'core/franklin/components/block/v1/block',
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
         * Model fields.
         *
         * IMPORTANT:
         *
         * `styles` is NOT added here.
         *
         * It is converted into
         * the `classes` multiselect field.
         */
        models.push({
            id: blockId,
            fields: [
                createStyleField(block),
                ...block.fields,
            ],
        });
    }
    return {
        definitions,
        models,
    };
}
