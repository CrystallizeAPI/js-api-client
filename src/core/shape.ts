import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from './client.js';

type ComponentParentType = 'Root' | 'ComponentChoice' | 'ComponentMultipleChoice' | 'ContentChunk' | 'Piece';

const basicComponentConfig = () => ['BasicComponentConfig'];

const structuralComponentConfig = (parentType: ComponentParentType, level: number): any[] => {
    const nestableComponentType: ComponentParentType[] = ['Root', 'Piece'];
    if (level <= 0) {
        return [];
    }

    const piece = {
        __typeName: 'PieceComponentConfig',
        multilingual: true,
        identifier: true,
        components: components('Piece', level - 1),
    };

    // we can always have piece
    if (!nestableComponentType.includes(parentType)) {
        return [piece];
    }

    return [
        {
            __typeName: 'ComponentChoiceComponentConfig',
            multilingual: true,
            choices: {
                id: true,
                name: true,
                description: true,
                type: true,
                config: {
                    __all_on: basicComponentConfig(),
                    __on: structuralComponentConfig('ComponentChoice', level - 1),
                },
            },
        },
        {
            __typeName: 'ComponentMultipleChoiceComponentConfig',
            multilingual: true,
            allowDuplicates: true,
            choices: {
                id: true,
                name: true,
                description: true,
                type: true,
                config: {
                    __all_on: basicComponentConfig(),
                    __on: structuralComponentConfig('ComponentMultipleChoice', level - 1),
                },
            },
        },
        {
            __typeName: 'ContentChunkComponentConfig',
            multilingual: true,
            repeatable: true,
            components: components('ContentChunk', level - 1),
        },
        piece,
    ];
};

const components = (parentType: ComponentParentType, level: number) => ({
    id: true,
    name: true,
    description: true,
    type: true,
    config: {
        __all_on: basicComponentConfig(),
        __on: structuralComponentConfig(parentType, level),
    },
});

export const createShapeBrowser = (client: ClientInterface) => {
    const query = (identifier: string, level: number) => {
        const componentList = components('Root', level);
        return {
            shape: {
                __args: {
                    identifier,
                },
                __on: {
                    __typeName: 'Shape',
                    identifier: true,
                    type: true,
                    name: true,
                    meta: {
                        key: true,
                        value: true,
                    },
                    createdAt: true,
                    updatedAt: true,
                    components: componentList,
                    variantComponents: componentList,
                },
            },
        };
    };

    const buildQuery = (identifier: string, level = 5) =>
        jsonToGraphQLQuery({ query: query(identifier, level) }) + '\n' + fragments;
    return {
        query: buildQuery,
        fetch: async (identifier: string, level = 5) => {
            const response = await client.nextPimApi(buildQuery(identifier, level));
        },
    };
};

const fragments = `#graphql

fragment BooleanComponentConfig on BooleanComponentConfig {
    multilingual
}

fragment DatetimeComponentConfig on DatetimeComponentConfig {
    multilingual
}

fragment FilesComponentConfig on FilesComponentConfig {
    multilingual
    min
    max
    acceptedContentTypes {
        extensionLabel
        contentType
    }
    maxFileSize {
        size
        unit
    }
}

fragment GridRelationsComponentConfig on GridRelationsComponentConfig {
    multilingual
    min
    max
}

fragment ImagesComponentConfig on ImagesComponentConfig {
    multilingual
    min
    max
}

fragment ItemRelationsComponentConfig on ItemRelationsComponentConfig {
    multilingual
    minItems
    maxItems
    minSkus
    maxSkus
    acceptedShapeIdentifiers
    quickSelect {
        folders {
            folderId
        }
    }
}

fragment LocationComponentConfig on LocationComponentConfig {
    multilingual
}

fragment NumericComponentConfig on NumericComponentConfig {
    multilingual
    decimalPlaces
    units
}

fragment ParagraphCollectionComponentConfig on ParagraphCollectionComponentConfig {
    multilingualParagraphs: multilingual
}

fragment PropertiesTableComponentConfig on PropertiesTableComponentConfig {
    multilingual
    sections {
        keys
        title
    }
}

fragment RichTextComponentConfig on RichTextComponentConfig {
    multilingual
    min
    max
}

fragment SelectionComponentConfig on SelectionComponentConfig {
    multilingual
    min
    max
    options {
        key
        value
        isPreselected
    }
}

fragment VideosComponentConfig on VideosComponentConfig {
    multilingual
    min
    max
}

fragment BasicComponentConfig on ComponentConfig {
    ...BooleanComponentConfig
    ...DatetimeComponentConfig
    ...FilesComponentConfig
    ...GridRelationsComponentConfig
    ...ImagesComponentConfig
    ...ItemRelationsComponentConfig
    ...LocationComponentConfig
    ...NumericComponentConfig
    ...ParagraphCollectionComponentConfig
    ...PropertiesTableComponentConfig
    ...RichTextComponentConfig
    ...SelectionComponentConfig
    ...VideosComponentConfig
}

`;
