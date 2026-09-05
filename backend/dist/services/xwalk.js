// ============================================================
// XWalk Configuration Generator
// ============================================================
// ============================================================
// Create Block ID
// ============================================================
export function createId(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\([^)]*\)/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
// ============================================================
// Parse Block Title
//
// Hero (hero-v1)
//     ↓
// title  = Hero
// styles = ["hero-v1"]
// ============================================================
export function parseBlockTitle(value) {
    const original = value.trim();
    const match = original.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (!match) {
        return {
            title: original,
            styles: []
        };
    }
    const title = match[1].trim();
    const styles = match[2]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return {
        title,
        styles
    };
}
// ============================================================
// Create Field Label
// ============================================================
export function createFieldLabel(value) {
    const cleaned = value
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim();
    return cleaned
        .split(" ")
        .map((word) => {
        if (!word) {
            return "";
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
    })
        .join(" ");
}
// ============================================================
// Create Field Name
//
// IMPORTANT:
//
// referenceAlt
//     stays referenceAlt
//
// NOT:
// reference_Alt
//
// col1_referenceAlt
//     stays col1_referenceAlt
// ============================================================
export function createFieldName(value) {
    const original = value.trim();
    if (!original) {
        return "";
    }
    // ----------------------------------------------------------
    // Column field
    // ----------------------------------------------------------
    const columnMatch = original.match(/^col(\d+)[_\s-]+(.+)$/i);
    if (columnMatch) {
        const column = Number(columnMatch[1]);
        if (column < 1 || column > 3) {
            throw new Error(`Invalid column number: col${column}`);
        }
        let field = columnMatch[2].trim();
        // Convert spaces and hyphens to camelCase.
        field = field.replace(/[\s-]+(.)/g, (_match, char) => String(char).toUpperCase());
        // Remove unsupported characters.
        field = field.replace(/[^a-zA-Z0-9]/g, "");
        if (!field) {
            return `col${column}`;
        }
        // Keep camelCase.
        field =
            field.charAt(0).toLowerCase() +
                field.slice(1);
        return `col${column}_${field}`;
    }
    // ----------------------------------------------------------
    // Normal field
    // ----------------------------------------------------------
    let field = original;
    field = field.replace(/[\s-]+(.)/g, (_match, char) => String(char).toUpperCase());
    field = field.replace(/[^a-zA-Z0-9]/g, "");
    if (!field) {
        return "";
    }
    return (field.charAt(0).toLowerCase() +
        field.slice(1));
}
// ============================================================
// Normalize Field
// ============================================================
export function normalizeField(field) {
    const normalizedName = createFieldName(field.name);
    let normalizedLabel = field.label;
    // ----------------------------------------------------------
    // Reference Alt
    // ----------------------------------------------------------
    if (/referenceAlt$/i.test(normalizedName)) {
        normalizedLabel = "Reference Alt";
    }
    // ----------------------------------------------------------
    // Image Alt
    // ----------------------------------------------------------
    else if (/imageAlt$/i.test(normalizedName)) {
        normalizedLabel = "Image Alt";
    }
    // ----------------------------------------------------------
    // Reference
    // ----------------------------------------------------------
    else if (/reference$/i.test(normalizedName)) {
        const columnMatch = normalizedName.match(/^col(\d+)_reference$/i);
        if (columnMatch) {
            normalizedLabel =
                `Col${columnMatch[1]} Reference`;
        }
        else {
            normalizedLabel = "Reference";
        }
    }
    // ----------------------------------------------------------
    // Image
    // ----------------------------------------------------------
    else if (/image$/i.test(normalizedName)) {
        const columnMatch = normalizedName.match(/^col(\d+)_image$/i);
        if (columnMatch) {
            normalizedLabel =
                `Col${columnMatch[1]} Image`;
        }
        else {
            normalizedLabel = "Image";
        }
    }
    // ----------------------------------------------------------
    // Empty label
    // ----------------------------------------------------------
    else if (!normalizedLabel ||
        normalizedLabel === field.name) {
        normalizedLabel =
            createFieldLabel(normalizedName);
    }
    return {
        ...field,
        name: normalizedName,
        label: normalizedLabel
    };
}
// ============================================================
// Create Field
// ============================================================
export function createField(component, name, label, extra = {}) {
    const normalizedName = createFieldName(name);
    let normalizedLabel = label || createFieldLabel(normalizedName);
    // ----------------------------------------------------------
    // Reference Alt
    // ----------------------------------------------------------
    if (/referenceAlt$/i.test(normalizedName)) {
        normalizedLabel = "Reference Alt";
    }
    // ----------------------------------------------------------
    // Image Alt
    // ----------------------------------------------------------
    else if (/imageAlt$/i.test(normalizedName)) {
        normalizedLabel = "Image Alt";
    }
    // ----------------------------------------------------------
    // Reference
    // ----------------------------------------------------------
    else if (/reference$/i.test(normalizedName)) {
        const columnMatch = normalizedName.match(/^col(\d+)_reference$/i);
        if (columnMatch) {
            normalizedLabel =
                `Col${columnMatch[1]} Reference`;
        }
        else {
            normalizedLabel = "Reference";
        }
    }
    // ----------------------------------------------------------
    // Image
    // ----------------------------------------------------------
    else if (/image$/i.test(normalizedName)) {
        const columnMatch = normalizedName.match(/^col(\d+)_image$/i);
        if (columnMatch) {
            normalizedLabel =
                `Col${columnMatch[1]} Image`;
        }
        else {
            normalizedLabel = "Image";
        }
    }
    return {
        component,
        name: normalizedName,
        label: normalizedLabel,
        ...extra
    };
}
// ============================================================
// Create Style Field
// ============================================================
export function createStyleField(styles) {
    if (!styles || styles.length === 0) {
        return null;
    }
    return {
        component: "multiselect",
        name: "classes",
        label: "Style",
        options: styles.map((style) => ({
            name: createFieldLabel(style),
            value: style
        }))
    };
}
// ============================================================
// Generate Definitions
//
// IMPORTANT:
//
// fields are NOT inside definitions.
//
// filter is NOT inside template.
//
// Correct:
//
// {
//   title: "Hero",
//   id: "hero",
//   plugins: {
//     xwalk: {
//       page: {
//         resourceType: "...",
//         template: {
//           name: "Hero",
//           model: "hero"
//         }
//       }
//     }
//   }
// }
// ============================================================
export function generateDefinitions(blocks) {
    return blocks.map((block) => ({
        title: block.title,
        id: block.id,
        plugins: {
            xwalk: {
                page: {
                    resourceType: "core/franklin/components/block/v1/block",
                    template: {
                        name: block.title,
                        model: block.id
                    }
                }
            }
        }
    }));
}
// ============================================================
// Generate Models
//
// fields ONLY exist inside models.
// ============================================================
export function generateModels(blocks) {
    return blocks.map((block) => {
        const fields = [];
        // --------------------------------------------------------
        // Style
        // --------------------------------------------------------
        const styleField = createStyleField(block.styles || []);
        if (styleField) {
            fields.push(styleField);
        }
        // --------------------------------------------------------
        // Detected fields
        // --------------------------------------------------------
        for (const field of block.fields || []) {
            fields.push(normalizeField(field));
        }
        return {
            id: block.id,
            fields
        };
    });
}
// ============================================================
// Generate Filters
//
// Example:
//
// {
//   "id": "hero",
//   "components": ["hero"]
// }
// ============================================================
export function generateFilters(blocks) {
    return blocks.map((block) => ({
        id: block.id,
        components: [block.id]
    }));
}
// ============================================================
// Remove Duplicate Blocks
//
// If DOCX produces:
//
// columns
// columns
//
// only the first one will remain.
//
// This prevents duplicate model IDs and duplicate filters.
// ============================================================
export function uniqueBlocks(blocks) {
    const result = [];
    const seenIds = new Set();
    for (const block of blocks) {
        if (!block.id) {
            continue;
        }
        if (seenIds.has(block.id)) {
            continue;
        }
        seenIds.add(block.id);
        result.push(block);
    }
    return result;
}
// ============================================================
// Generate Complete XWalk Configuration
// ============================================================
export function generateXwalkConfig(blocks) {
    // ----------------------------------------------------------
    // Remove duplicate block IDs
    // ----------------------------------------------------------
    const normalizedBlocks = uniqueBlocks(blocks);
    // ----------------------------------------------------------
    // Definitions
    // ----------------------------------------------------------
    const definitions = generateDefinitions(normalizedBlocks);
    // ----------------------------------------------------------
    // Models
    // ----------------------------------------------------------
    const models = generateModels(normalizedBlocks);
    // ----------------------------------------------------------
    // Filters
    // ----------------------------------------------------------
    const filters = generateFilters(normalizedBlocks);
    // ----------------------------------------------------------
    // Final XWalk JSON
    // ----------------------------------------------------------
    return {
        definitions,
        models,
        filters
    };
}
