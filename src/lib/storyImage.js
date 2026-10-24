// Draws the "slots overview" story image (1080×1920) on a canvas.
// days: [{ key:'2026-11-05', d:5, col:0-6, row:n, times:[{label:'9:00 AM', booked:bool}] | null }]
// banners: [[firstRow, lastRow]] — weeks covered by ONE "Available soon" label
const W = 1080, H = 1920
const CREAM = '#f3e6d0', ROSE = '#f2a1b5', DARK = '#3a0817', PEACH = '#ffd3a8'

const imgCache = {}
function loadImg(src) {
  if (!imgCache[src]) {
    imgCache[src] = new Promise((res) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => res(null)
      i.src = src
    })
  }
  return imgCache[src]
}

export async function loadStoryAssets() {
  await Promise.all([
    document.fonts?.load('italic 400 150px "Playfair Display"'),
    document.fonts?.load('600 44px "Playfair Display"'),
    document.fonts?.load('400 44px "Playfair Display"'),
    document.fonts?.load('600 20px "Inter"'),
    document.fonts?.load('400 20px "Inter"'),
  ].map((p) => p?.catch?.(() => null)))
  const [logo, streaks] = await Promise.all([loadImg('/logo-note.webp'), loadImg('/streaks.svg')])
  return { logo, streaks }
}

function spaced(ctx, text, x, y, spacing) {
  // centred text with letter spacing
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let cx = x - total / 2
  const prev = ctx.textAlign
  ctx.textAlign = 'left'
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing })
  ctx.textAlign = prev
}

function pill(ctx, cx, cy, w, h, fill) {
  const r = h / 2, x = cx - w / 2, y = cy - h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2)
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill()
}

function outlinePill(ctx, cx, cy, w, h, stroke, fill, lw) {
  const r = h / 2, x = cx - w / 2, y = cy - h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2)
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke()
}

function bookedTime(ctx, label, cx, cy, size) {
  ctx.font = `600 ${size}px Inter`
  ctx.fillStyle = 'rgba(243,230,208,0.38)'
  ctx.fillText(label, cx, cy)
  const w = ctx.measureText(label).width
  ctx.strokeStyle = ROSE; ctx.lineWidth = Math.max(2, size * 0.13)
  ctx.beginPath(); ctx.moveTo(cx - w / 2 - 2, cy); ctx.lineTo(cx + w / 2 + 2, cy); ctx.stroke()
}

export function drawStory(canvas, { title, subtitle, days, rows, banners = [], footer }, assets) {
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'

  // background: burgundy radial glow + cream streaks
  ctx.fillStyle = '#0d0809'; ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.translate(W / 2, H * 0.4); ctx.scale(1, 0.75)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 1.05)
  g.addColorStop(0, '#4a0a1f'); g.addColorStop(0.45, '#2c0712'); g.addColorStop(0.78, '#120507'); g.addColorStop(1, '#0d0809')
  ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 2, H * 2)
  ctx.restore()
  if (assets.streaks) { ctx.globalAlpha = 0.55; ctx.drawImage(assets.streaks, 0, 0, W, H); ctx.globalAlpha = 1 }

  // logo + title
  let y = 90
  if (assets.logo) { const lw = 330, lh = lw * (assets.logo.height / assets.logo.width); ctx.drawImage(assets.logo, (W - lw) / 2, y, lw, lh); y += lh }
  ctx.fillStyle = CREAM
  let ts = 150
  ctx.font = `italic 400 ${ts}px "Playfair Display"`
  while (ctx.measureText(title).width > W - 120 && ts > 80) { ts -= 6; ctx.font = `italic 400 ${ts}px "Playfair Display"` }
  y += 28 + ts * 0.5
  ctx.fillText(title, W / 2, y)
  y += ts * 0.5 + 24
  ctx.fillStyle = ROSE; ctx.font = '600 22px Inter'
  spaced(ctx, subtitle, W / 2, y, 7)

  // weekday header
  const left = 60, colW = (W - 120) / 7
  y += 75
  ctx.fillStyle = 'rgba(243,230,208,0.75)'; ctx.font = '600 30px "Playfair Display"'
  ;['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach((d, i) => ctx.fillText(d, left + colW * (i + 0.5), y))
  y += 42

  // grid: row heights follow the busiest day in each row, scaled down if it would not fit
  const footerTop = H - 210
  const base = { num: 44, numH: 56, pillH: 32, gap: 5, font: 19, rowGap: 28 }
  const soonRow = (r) => banners.some(([a, b]) => r >= a && r <= b)
  const maxTimes = Array.from({ length: rows }, (_, r) => (soonRow(r) ? 1 : Math.max(1, ...days.filter((d) => d.row === r).map((d) => (d.times ? d.times.length : 1)))))
  const need = (s) => maxTimes.reduce((a, n) => a + base.numH * s + n * (base.pillH + base.gap) * s + base.rowGap * s, 0)
  const s = Math.min(1, (footerTop - y) / need(1))
  const pw = Math.min(colW - 8, 132)

  let ry = y
  const rowTop = []
  for (let r = 0; r < rows; r++) {
    rowTop.push(ry)
    const soon = soonRow(r)
    days.filter((d) => d.row === r).forEach((d) => {
      const cx = left + colW * (d.col + 0.5)
      ctx.fillStyle = soon ? 'rgba(243,230,208,0.12)' : CREAM; ctx.font = `400 ${base.num * s}px "Playfair Display"`
      if (soon) { ctx.fillText(String(d.d), cx, ry + (base.numH * s) / 2); return }
      ctx.fillText(String(d.d), cx, ry + (base.numH * s) / 2)
      let ty = ry + base.numH * s + (base.pillH * s) / 2
      if (!d.times) {
        ctx.fillStyle = 'rgba(243,230,208,0.35)'; ctx.font = `600 ${18 * s}px Inter`
        spaced(ctx, 'CLOSED', cx, ty - 4 * s, 3.5 * s)
        return
      }
      d.times.forEach((t) => {
        if (t.booked) bookedTime(ctx, t.label, cx, ty, base.font * s)
        else {
          pill(ctx, cx, ty, pw, base.pillH * s, CREAM)
          ctx.fillStyle = DARK; ctx.font = `600 ${base.font * s}px Inter`; ctx.fillText(t.label, cx, ty + 1)
        }
        ty += (base.pillH + base.gap) * s
      })
    })
    ry += (base.numH + maxTimes[r] * (base.pillH + base.gap) + base.rowGap) * s
  }
  rowTop.push(ry)

  // one "Available soon" label centred over each run of hidden weeks
  banners.forEach(([a, b]) => {
    const cy = (rowTop[a] + rowTop[b + 1] - base.rowGap * s) / 2
    ctx.font = 'italic 400 46px "Playfair Display"'
    const tw = ctx.measureText('Available soon').width
    outlinePill(ctx, W / 2, cy, tw + 80, 82, 'rgba(255,211,168,0.75)', 'rgba(30,4,12,0.6)', 3)
    ctx.fillStyle = PEACH; ctx.fillText('Available soon', W / 2, cy + 2)
  })

  // footer: legend + link
  const fy = H - 150
  ctx.font = '600 22px Inter'
  const lw1 = 112
  pill(ctx, W / 2 - 150, fy, lw1, 38, CREAM)
  ctx.fillStyle = DARK; ctx.fillText('9:00 AM', W / 2 - 150, fy + 1)
  ctx.fillStyle = 'rgba(243,230,208,0.8)'; ctx.font = '400 22px Inter'; ctx.textAlign = 'left'
  ctx.fillText('open', W / 2 - 150 + lw1 / 2 + 12, fy)
  ctx.textAlign = 'center'
  bookedTime(ctx, '9:00 AM', W / 2 + 70, fy, 22)
  ctx.fillStyle = 'rgba(243,230,208,0.8)'; ctx.font = '400 22px Inter'; ctx.textAlign = 'left'
  ctx.fillText('booked', W / 2 + 70 + 60, fy)
  ctx.textAlign = 'center'
  ctx.fillStyle = ROSE; let fs = 34
  ctx.font = `400 ${fs}px "Playfair Display"`
  while (ctx.measureText(footer).width > W - 80 && fs > 22) { fs -= 2; ctx.font = `400 ${fs}px "Playfair Display"` }
  ctx.fillText(footer, W / 2, H - 82)
}
