const siteUrl = process.env.SITE_URL;

if (!siteUrl) throw new Error('SITE_URL is required');

let response;
for (let attempt = 1; attempt <= 12; attempt += 1) {
  response = await fetch(siteUrl, { redirect: 'follow' });
  if (response.ok) break;
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}

if (!response?.ok) throw new Error(`Deployment returned ${response?.status ?? 'no response'}`);

const html = await response.text();
for (const marker of ['Poster Forge', 'data-poster', 'data-controls']) {
  if (!html.includes(marker)) throw new Error(`Deployment is missing ${marker}`);
}

const iconResponse = await fetch(new URL('icon.svg', siteUrl));
if (!iconResponse.ok) throw new Error(`Icon returned ${iconResponse.status}`);

console.log(`Verified ${siteUrl}`);
