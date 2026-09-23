const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requiredFiles = ['README.md', 'LICENSE', 'docs/PRD.md', 'docs/ARCHITECTURE.md', 'docs/PLAN.md', 'docs/ACCEPTANCE.md', 'docs/BUDGET.md', 'docs/BUILD_LOG.md', 'docs/DEMO_SCRIPT.md', 'docs/PROJECT_DESCRIPTION.md', 'docs/PITCH.txt'];
for (const file of requiredFiles) if (!fs.existsSync(path.join(root, file))) throw new Error(`required_document_missing:${file}`);
const readme = read('README.md');
for (const heading of ['Try it', 'How it works', 'Built with Codex and GPT-5.6', 'Architecture and security', 'Local development', 'Source documents', 'License']) if (!new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(readme)) throw new Error(`readme_heading_missing:${heading}`);
// The deployed app's Connect link points at this anchor (src/core/presentation.js CONNECT_URL).
if (!readme.includes('<a id="chatgpt-prerequisites-and-connect"></a>')) throw new Error('readme_connect_anchor_missing');
if (!read('LICENSE').startsWith('MIT License\n')) throw new Error('license_not_mit');
if ([...read('docs/PITCH.txt')].length > 200) throw new Error('pitch_over_200_unicode_characters');
for (const phrase of ['Codex', 'GPT-5.6', 'Sol', 'Luna', 'human']) if (!read('docs/DEMO_SCRIPT.md').includes(phrase)) throw new Error(`demo_script_missing:${phrase}`);
// The script is the narrated video's transcript, which says the budget aloud ("one-hundred-dollar").
if (!/\$100|one-hundred-dollar/.test(read('docs/DEMO_SCRIPT.md'))) throw new Error('demo_script_missing:$100');
console.log('document-check passed');
