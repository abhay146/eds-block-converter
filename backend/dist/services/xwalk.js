export function createId(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
export function generateXwalkConfig(blocks) {
    const definitions = [];
    const models = [];
    for (const block of blocks) {
        const blockId = createId(block.id ||
            block.title);
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
    };
}
