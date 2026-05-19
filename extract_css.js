const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\cd05d349-c209-4a72-87cb-3a940bd9e50f\\.system_generated\\logs\\overview.txt', 'utf8');
const lines = content.split('\n');
for (let line of lines) {
  if (line.includes('write_to_file')) {
    try {
      const data = JSON.parse(line);
      for (let call of data.tool_calls || []) {
        if (call.name === 'write_to_file' && call.args.TargetFile.includes('main.css')) {
          console.log("=== main.css content ===");
          // Unescape the escaped string
          let code = call.args.CodeContent;
          if (code.startsWith('"')) code = code.slice(1, -1);
          code = code.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          fs.writeFileSync('extracted_main.css', code);
          console.log("Written to extracted_main.css, length:", code.length);
        }
      }
    } catch(e){ console.log('parse error', e.message); }
  }
}
