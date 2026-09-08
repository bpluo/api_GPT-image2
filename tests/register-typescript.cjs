const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
    return resolve.call(
        this,
        request.startsWith('@/') ? path.join(__dirname, '../src', request.slice(2)) : request,
        parent,
        ...rest
    );
};
require.extensions['.ts'] = function (module, filename) {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
    });
    module._compile(outputText, filename);
};
