/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-check

/** @type {import('@babel/core').ConfigFunction} */
module.exports = (api) => {
    api.assertVersion(7);
    api.cache.forever();

    /** @type {import('@babel/core').TransformOptions} */
    const config = {
        sourceType: 'unambiguous',
        presets: [
            [
                '@babel/preset-env',
                {
                    useBuiltIns: 'entry',
                    corejs: '3',
                },
            ],
            [
                '@babel/preset-react',
                {
                    development: process.env.NODE_ENV === 'development',
                    runtime: 'automatic',
                },
            ],
            [
                // https://babeljs.io/docs/en/next/babel-preset-typescript
                '@babel/preset-typescript',
                {
                    isTSX: true,
                    allExtensions: true,
                    allowNamespaces: true,
                    allowDeclareFields: true,
                    onlyRemoveTypeImports: true,
                    // jsxPragma: 'React',
                },
            ],
        ],
        // https://babeljs.io/docs/en/assumptions
        // @ts-ignore
        assumptions: {
            constantReexports: true,
            constantSuper: true,
            enumerableModuleMeta: true,
            ignoreFunctionLength: true,
            ignoreToPrimitiveHint: true,
            mutableTemplateObject: true,
            noClassCalls: true,
            noDocumentAll: true,
            noNewArrows: true,
            objectRestNoSymbols: true,
            privateFieldsAsProperties: true,
            setClassMethods: true,
            setComputedProperties: true,
            setPublicClassFields: true,
            setSpreadProperties: true,
            skipForOfIteratorClosing: true,
            superIsCallableConstructor: true,
        },
        plugins: [
            '@babel/plugin-syntax-dynamic-import',
            [
                'named-asset-import',
                {
                    loaderMap: {
                        // svg: { ReactComponent: '@svgr/webpack?-svgo,+titleProp,+ref![path]' },
                    },
                },
            ],
            // ['import', { libraryName: 'antd', libraryDirectory: 'es', style: true }], // babel-plugin-import
        ],
        compact: false,
    };

    return config;
};
