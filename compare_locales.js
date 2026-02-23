const fs = require('fs');
const path = require('path');

const enDir = path.join(__dirname, 'worklenz-frontend/public/locales/en');
const esDir = path.join(__dirname, 'worklenz-frontend/public/locales/es');

function getFiles(dir, filesList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getFiles(fullPath, filesList);
        } else if (fullPath.endsWith('.json')) {
            filesList.push(fullPath);
        }
    }
    return filesList;
}

const enFiles = getFiles(enDir);
const esFiles = getFiles(esDir);

const relEnFiles = enFiles.map(f => path.relative(enDir, f));
const relEsFiles = esFiles.map(f => path.relative(esDir, f));

const missingFiles = relEnFiles.filter(f => !relEsFiles.includes(f));
console.log('Missing files in ES:', missingFiles);

let totalMissingKeys = 0;

relEnFiles.forEach(file => {
    if (!relEsFiles.includes(file)) return;

    const enData = JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8'));
    const esData = JSON.parse(fs.readFileSync(path.join(esDir, file), 'utf8'));

    const missingKeys = Object.keys(enData).filter(key => !(key in esData) || esData[key] === enData[key]);

    if (missingKeys.length > 0) {
        console.log(`\\n--- File: ${file} ---`);
        missingKeys.forEach(k => {
            console.log(`Key: "${k}" | EN: "${enData[k]}" | ES: "${esData[k] || 'MISSING'}"`);
        });
        totalMissingKeys += missingKeys.length;
    }
});

console.log(`\\nTotal missing or untranslated keys: ${totalMissingKeys}`);
