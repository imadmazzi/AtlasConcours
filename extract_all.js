const fs = require('fs');

// Extract ALL write_to_file calls from cd05d349 (original React build session)
const content = fs.readFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\cd05d349-c209-4a72-87cb-3a940bd9e50f\\.system_generated\\logs\\overview.txt', 'utf8');
const lines = content.split('\n');

const files = {};

for (let line of lines) {
  if (line.includes('write_to_file')) {
    try {
      const data = JSON.parse(line);
      for (let call of data.tool_calls || []) {
        if (call.name === 'write_to_file') {
          const file = call.args.TargetFile;
          let code = call.args.CodeContent || '';
          if (typeof code === 'string' && code.startsWith('"')) {
            code = code.slice(1, -1);
          }
          code = code.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          files[file] = code;
        }
      }
    } catch(e) {}
  }
}

// Print all file names and sizes
for (const [file, content] of Object.entries(files)) {
  console.log(`${file} : ${content.length} bytes`);
}

// Save selected files
const targets = [
  'main.css', 'Hero.jsx', 'Navbar.jsx', 'LatestConcours.jsx', 'LatestEmplois.jsx',
  'LatestBlog.jsx', 'Footer.jsx', 'ConcoursPage.jsx', 'ConcoursDetailPage.jsx', 'index.css'
];

for (const [file, code] of Object.entries(files)) {
  for (const target of targets) {
    if (file.endsWith(target.replace(/\//g, '\\\\'))) {
      const outName = 'extracted_' + target.replace(/\//g, '_');
      fs.writeFileSync(outName, code);
      console.log(`Saved ${outName} (${code.length} bytes)`);
    }
  }
}
