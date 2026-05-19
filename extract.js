const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\cd05d349-c209-4a72-87cb-3a940bd9e50f\\.system_generated\\logs\\overview.txt', 'utf8');
const lines = content.split('\n');
for (let line of lines) {
  if (line.includes('CSS principal AtlasConcours')) {
    console.log(line);
  }
}
