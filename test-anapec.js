const fs = require('fs');

async function test() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
  const res = await fetch('https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/detail_offre/1124757');
  const t = await res.text();
  fs.writeFileSync('anapec_test.html', t);
  console.log('Saved to anapec_test.html');
}

test();
