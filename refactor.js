const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const styleRegex = /<style>([\s\S]*?)<\/style>/;
const scriptRegex = /<script>\s*\n\/\/\s*════════════([\s\S]*?)<\/script>/;

const styleMatch = content.match(styleRegex);
const scriptMatch = content.match(scriptRegex);

if (!fs.existsSync('css')) fs.mkdirSync('css');
if (!fs.existsSync('js')) fs.mkdirSync('js');

if (styleMatch) fs.writeFileSync('css/style.css', styleMatch[1].trim() + '\n');
// Include the matched comments part back
if (scriptMatch) fs.writeFileSync('js/app.js', '// ════════════' + scriptMatch[1].trim() + '\n');

let newContent = content.replace(styleRegex, '<link rel="stylesheet" href="css/style.css">');
newContent = newContent.replace(scriptRegex, '<script src="js/app.js"></script>');

fs.writeFileSync('index.html', newContent);
