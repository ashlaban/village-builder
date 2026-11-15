// Source of src/ read as JavaScript text (VB-373). Tools and tests that scan or parse src/ read it through readSource, so that once a
// file is .ts its types are blanked first: stripTypeScriptTypes (node:module, Node 22.23) keeps every line and column.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../..');

function stripTypes(text) {
  const { stripTypeScriptTypes } = require('node:module');
  // The function is experimental and says so once on stderr; the warning is dropped here, as it is no news to the tools.
  const emit = process.emitWarning;
  process.emitWarning = (w, ...a) => (/stripTypeScriptTypes/.test(String(w)) ? undefined : emit.call(process, w, ...a));
  try {
    return stripTypeScriptTypes(text, { mode: 'strip' });
  } finally {
    process.emitWarning = emit;
  }
}

// file: absolute, or relative to the repository root.
function readSource(file) {
  const text = fs.readFileSync(path.resolve(ROOT, file), 'utf8');
  return /\.[cm]?ts$/.test(file) ? stripTypes(text) : text;
}

module.exports = { readSource, stripTypes };
