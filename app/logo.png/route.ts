const logo = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 88" role="img" aria-labelledby="title">
  <title id="title">Intel Computer Center</title>
  <rect width="88" height="88" rx="20" fill="#0f172a"/>
  <path d="M25 23h12v42H25zm20 0h24v10H55v22h14v10H45z" fill="#38bdf8"/>
  <text x="106" y="43" fill="#0f172a" font-family="Arial, sans-serif" font-size="29" font-weight="800">ICE</text>
  <text x="106" y="65" fill="#475569" font-family="Arial, sans-serif" font-size="14" font-weight="600">COMPUTERS &amp; ELECTRONICS</text>
</svg>`;

export function GET() {
  return new Response(logo, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
