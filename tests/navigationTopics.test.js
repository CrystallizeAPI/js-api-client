const { createNavigationFetcher, createClient } = require('../dist/index.js');
const { walkTree } = require('./util');

test('Test Nav fetching Topic: /', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture',
    });

    const fetch = createNavigationFetcher(CrystallizeClient).byTopics;
    const response = await fetch('/', 'en', 3);

    // fetch topics returns a list of topics with no parents
    expect(response.tree[0].name).toBe('Specials');
    expect(response.tree[0].path).toBe('/specials');
    expect(response.tree[1].children[0].path).toBe('/room/livingroom');

    // Verify all tree nodes have id properties
    walkTree(response.tree, (node) => {
        expect(node).toHaveProperty('id');
    });
});

test('Test Nav fetching Topic: /specials', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture',
    });

    const fetch = createNavigationFetcher(CrystallizeClient).byTopics;
    const response = await fetch('/specials', 'en', 3);

    expect(response.tree.name).toBe('Specials');
    expect(response.tree.path).toBe('/specials');
    expect(response.tree.children[1].path).toBe('/specials/new-arrival');

    // Verify all tree nodes have id properties
    walkTree([response.tree], (node) => {
        expect(node).toHaveProperty('id');
    });
});

test('Test Nav fetching Topic: /specials + extra data + specific level', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture',
    });

    const fetch = createNavigationFetcher(CrystallizeClient).byTopics;
    const response = await fetch(
        '/specials',
        'en',
        3,
        {
            tenant: {
                __args: {
                    language: 'en',
                },
                name: true,
            },
        },
        (level) => {
            switch (level) {
                case 0:
                    return {
                        parentId: true,
                    };
                case 1:
                    return {
                        parent: {
                            path: true,
                        },
                        items: {
                            edges: {
                                node: {
                                    path: true,
                                },
                            },
                        },
                    };
                case 2:
                    return {
                        createdAt: true,
                    };
                default:
                    return {};
            }
        },
    );
    expect(response.tree.path).toBe('/specials');
    expect(response.tree.children[0].name).toBe('Organic');
    expect(response.tree.children[0].parent.path).toBe('/specials');

    expect(response.tree.children[0].items.edges[0].node.path).toBe('/shop/plants/monstera-deliciosa');

    // Verify all tree nodes have id properties
    walkTree([response.tree], (node) => {
        expect(node).toHaveProperty('id');
    });
});
