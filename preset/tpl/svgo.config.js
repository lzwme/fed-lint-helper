module.exports = {
    plugins: [
        {
            name: 'preset-default',
            params: {
                overrides: {
                    convertPathData: false,
                    convertTransform: false,
                    removeViewBox: false,
                },
            },
        },
        {
            name: 'prefixIds',
        },
    ],
};
