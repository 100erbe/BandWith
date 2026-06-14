import fs from 'fs';

const filepath = 'src/lib/services/bands.ts';
let content = fs.readFileSync(filepath, 'utf8');

// The error is: column bands_1.slug does not exist
// Let's remove slug, created_at, and updated_at from the bands selection in band_members query

content = content.replace(
  /bands \(\s*id,\s*name,\s*slug,\s*logo_url,\s*description,\s*created_at,\s*updated_at\s*\)/g,
  'bands (\n          id,\n          name,\n          logo_url,\n          description\n        )'
);

fs.writeFileSync(filepath, content);
console.log("Fixed bands.ts");
