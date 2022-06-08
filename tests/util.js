function walkTree(tree, cb) {
    tree.forEach((node) => {
        cb(node);
        if (node?.children?.length) {
            walkTree(node.children, cb);
        }
    });
}

module.exports = { walkTree };
