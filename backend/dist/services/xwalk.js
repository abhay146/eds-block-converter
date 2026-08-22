function createId(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function detectFieldTypes(html) {
    const fields = [];
    const hasImage = /\[IMAGE\]/i.test(html);
    const hasLink = /<a\b[^>]*>/i.test(html);
    const hasList = /<(ul|ol)\b/i.test(html);
    const paragraphs = [
        ...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi),
    ].map((match) => match[1]
        .replace(/<[^>]+>/g, '')
        .trim());
    const hasTitle = paragraphs.some((text) => text.length > 0);
    if (hasTitle) {
        fields.push({
            component: 'text',
            name: 'title',
            label: 'Title',
        });
    }
    if (paragraphs.length > 1 || hasList) {
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
export function generateXwalkConfig(blocks) {
    const definitions = [];
    const models = [];
    const filters = [];
    for (const block of blocks) {
        const blockId = createId(block.id || block.title);
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
        models.push({
            id: blockId,
            fields: [
                {
                    component: 'multiselect',
                    name: 'classes',
                    label: 'Classes',
                    options: [
                        {
                            name: `${block.title} Style`,
                            children: [
                                {
                                    name: block.title,
                                    value: blockId,
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
export { createId, detectFieldTypes, };
