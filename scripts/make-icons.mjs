// 앱 아이콘 PNG 생성: node scripts/make-icons.mjs
// iOS 홈 화면은 SVG 아이콘을 쓰지 않으므로 PNG가 필요하다.
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('./icon.svg', import.meta.url))
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1')

const targets = [
  ['apple-touch-icon.png', 180],
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['favicon-32.png', 32],
]
for (const [name, size] of targets) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out(name))
}
// 안드로이드 maskable: 가장자리가 잘려도 되도록 여백을 둔다.
const inner = await sharp(svg, { density: 300 }).resize(410, 410).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#d8e46a' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(out('pwa-maskable-512.png'))
console.log('icons written')
