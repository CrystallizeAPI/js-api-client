const { catalogueFetcherGraphqlBuilder } = require('../dist/core/catalogue.js');
const { jsonToGraphQLQuery } = require('json-to-graphql-query');

test('Catalogue Query Builder Test', () => {
    const builder = catalogueFetcherGraphqlBuilder;
    const dataset = [
        {
            query: {
                catalogue: {
                    children: {
                        __on: [
                            builder.onItem({
                                ...builder.onComponent('test', 'RichText', {
                                    json: true,
                                }),
                            }),
                            builder.onProduct({
                                defaultVariant: {
                                    firstImage: {
                                        url: true,
                                    },
                                },
                            }),
                            builder.onDocument(),
                            builder.onFolder(),
                        ],
                    },
                },
            },
            result: `query { catalogue { children { ... on Item { __typename name path test: component (id: \"test\") { content { __typename ... on RichTextContent { json } } } topics { name path } } ... on Product { __typename defaultVariant { firstImage { url } } vatType { name percent } } ... on Document { __typename } ... on Folder { __typename } } } }`,
        },
        {
            query: {
                grid: {
                    __args: {
                        id: 'test',
                    },
                    name: true,
                },
                catalogue: {
                    id: true,
                    tenant: {
                        name: true,
                    },
                    children: {
                        __on: [
                            builder.onItem({
                                ...builder.onComponent('test', 'RichText', {
                                    json: true,
                                }),
                            }),
                            builder.onProduct({
                                defaultVariant: {
                                    firstImage: {
                                        url: true,
                                    },
                                },
                            }),
                            builder.onDocument(),
                            builder.onFolder(),
                        ],
                    },
                },
            },
            result: `query { grid (id: \"test\") { name } catalogue { id tenant { name } children { ... on Item { __typename name path test: component (id: \"test\") { content { __typename ... on RichTextContent { json } } } topics { name path } } ... on Product { __typename defaultVariant { firstImage { url } } vatType { name percent } } ... on Document { __typename } ... on Folder { __typename } } } }`,
        },
        {
            query: {
                catalogue: {
                    ...builder.onComponent('grid', 'GridRelations', {
                        grids: {
                            rows: {
                                columns: {
                                    layout: {
                                        rowspan: true,
                                        colspan: true,
                                    },
                                    item: {
                                        __on: [
                                            builder.onProduct(
                                                {
                                                    name: true,
                                                },
                                                {
                                                    onVariant: {
                                                        images: {
                                                            url: true,
                                                        },
                                                        price: true,
                                                    },
                                                },
                                            ),
                                        ],
                                    },
                                },
                            },
                        },
                    }),
                },
            },
            result: `query { catalogue { grid: component (id: "grid") { content { __typename ... on GridRelationsContent { grids { rows { columns { layout { rowspan colspan } item { ... on Product { __typename name vatType { name percent } variants { name sku price images { url } } } } } } } } } } } }`,
        },
    ];
    dataset.forEach(({ query, result }) => {
        expect(jsonToGraphQLQuery({ query })).toBe(result);
    });
});
