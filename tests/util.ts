export const walkTree = (tree: any[], cb: any) => {
    tree.forEach((node) => {
        cb(node);
        if (node?.children?.length) {
            walkTree(node.children, cb);
        }
    });
};
