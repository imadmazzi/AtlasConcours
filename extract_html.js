const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\cd05d349-c209-4a72-87cb-3a940bd9e50f\\.system_generated\\logs\\overview.txt', 'utf8');
const lines = content.split('\n');
for (let line of lines) {
  if (line.includes('write_to_file') && line.includes('index.html')) {
    const data = JSON.parse(line);
    for (let call of data.tool_calls || []) {
      if (call.name === 'write_to_file' && call.args.TargetFile.includes('index.html')) {
         console.log("--- FOUND index.html ---");
         console.log(call.args.CodeContent.substring(0, 1000));
         console.log("...length:", call.args.CodeContent.length);
      }
    }
  }
}
