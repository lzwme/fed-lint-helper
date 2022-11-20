#!/usr/bin/env node

try {
    require('../cjs/cli.js');
} catch (_e) {
    console.log(_e.message);
    import('../esm/cli.js');
}