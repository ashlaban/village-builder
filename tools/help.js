// `--help` for a tool: prints the comment block at the top of its file and exits, before the tool loads or runs anything.
// A tool's first statement, after that block: require('./help.js')(__filename);
// Does nothing when the tool is loaded by another script, so the usage in the header comment is the only copy to keep current.
module.exports = (file) => {
  if (!require.main || require.main.filename !== file || !process.argv.slice(2).some((a) => a === '--help' || a === '-h')) return;
  const lines = require('fs').readFileSync(file, 'utf8').split('\n'), end = lines.findIndex((l) => !l.startsWith('//'));
  console.log(lines.slice(0, end).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
};
