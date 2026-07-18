const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requiredFiles = ['README.md', 'LICENSE', 'docs/PRD.md', 'docs/ARCHITECTURE.md', 'docs/PLAN.md', 'docs/ACCEPTANCE.md', 'docs/BUDGET.md', 'docs/BUILD_LOG.md', 'docs/DEMO_SCRIPT.md', 'docs/PROJECT_DESCRIPTION.md', 'docs/PITCH.txt'];
for (const file of requiredFiles) if (!fs.existsSync(path.join(root, file))) throw new Error(`required_document_missing:${file}`);
const readme = read('README.md');
for (const heading of ['Judge path and demo', 'Pitch', 'Media', 'Deployed showcase URL', 'ChatGPT prerequisites and connect', 'Architecture', 'Environment and setup', 'Commands', 'Registry and examples', 'Limits and security', 'Judges', 'Built with Codex and GPT-5.6', 'License']) if (!new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(readme)) throw new Error(`readme_heading_missing:${heading}`);
if (!read('LICENSE').startsWith('MIT License\n')) throw new Error('license_not_mit');
if ([...read('docs/PITCH.txt')].length > 200) throw new Error('pitch_over_200_unicode_characters');
for (const phrase of ['Codex', 'GPT-5.6', 'Sol', 'Luna', '$100', 'human']) if (!read('docs/DEMO_SCRIPT.md').includes(phrase)) throw new Error(`demo_script_missing:${phrase}`);
console.log('document-check passed');
