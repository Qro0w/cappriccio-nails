// Draws the private "Top clients" list (1080 wide; height shrinks to fit a short list).
const W = 1080
const CREAM = '#f3e6d0', ROSE = '#f2a1b5', DARK = '#3a0817'

function spaced(ctx, text, x, y, sp) {
  const chars = [...text], w = chars.map((c) => ctx.measureText(c).width)
  let cx = x - (w.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)) / 2
  ctx.textAlign = 'left'
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += w[i] + sp })
  ctx.textAlign = 'center'
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

// rows: [{ ig, phone, visits, last: 'Nov 28' }]
export function drawClients(canvas, { rows, subtitle }, assets) {
  const N = rows.length
  const RH = 72
  const H = Math.min(1920, Math.max(1080, 700 + N * RH + 230))
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'

  // background (same as the slots story)
  ctx.fillStyle = '#0d0809'; ctx.fillRect(0, 0, W, H)
  ctx.save(); ctx.translate(W / 2, H * 0.4); ctx.scale(1, 0.75)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 1.05)
  g.addColorStop(0, '#4a0a1f'); g.addColorStop(0.45, '#2c0712'); g.addColorStop(0.78, '#120507'); g.addColorStop(1, '#0d0809')
  ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 2, H * 2); ctx.restore()
  if (assets.streaks) { ctx.globalAlpha = 0.55; ctx.drawImage(assets.streaks, 0, 0, W, H); ctx.globalAlpha = 1 }

  let y = 80
  if (assets.logo) { const lw = 260, lh = lw * (assets.logo.height / assets.logo.width); ctx.drawImage(assets.logo, (W - lw) / 2, y, lw, lh); y += lh }
  ctx.fillStyle = CREAM; ctx.font = 'italic 400 112px "Playfair Display"'
  y += 80; ctx.fillText('Top Clients', W / 2, y)
  y += 78; ctx.fillStyle = ROSE; ctx.font = '600 22px Inter'; spaced(ctx, subtitle, W / 2, y, 6)

  const L = 70, R = W - 70
  y += 62
  ctx.font = '600 19px Inter'; ctx.fillStyle = 'rgba(243,230,208,0.5)'
  ctx.textAlign = 'left'; ctx.fillText('CLIENT', L + 92, y)
  ctx.textAlign = 'right'; ctx.fillText('VISITS', R - 20, y); ctx.fillText('LAST VISIT', R - 160, y)
  ctx.textAlign = 'center'
  y += 26; ctx.strokeStyle = 'rgba(243,230,208,0.18)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke()
  const rh = Math.min(RH, (H - 230 - y) / Math.max(N, 1))

  rows.forEach((r, i) => {
    const top = y + 10 + i * rh, cy = top + rh / 2
    if (i < 3) { rr(ctx, L - 10, top + 4, R - L + 20, rh - 8, 22); ctx.fillStyle = 'rgba(242,161,181,0.09)'; ctx.fill() }
    ctx.font = `italic 400 ${i < 3 ? 42 : 36}px "Playfair Display"`; ctx.fillStyle = i < 3 ? ROSE : 'rgba(242,161,181,0.7)'
    ctx.fillText(String(i + 1), L + 34, cy)
    ctx.textAlign = 'left'
    ctx.font = `400 ${Math.round(rh * 0.42)}px "Playfair Display"`; ctx.fillStyle = CREAM
    ctx.fillText(fit(ctx, r.ig, 470), L + 92, cy - rh * 0.13)
    ctx.font = `400 ${Math.round(rh * 0.25)}px Inter`; ctx.fillStyle = 'rgba(243,230,208,0.5)'
    ctx.fillText(r.phone, L + 92, cy + rh * 0.24)
    ctx.textAlign = 'right'; ctx.font = '400 22px Inter'; ctx.fillStyle = 'rgba(243,230,208,0.65)'
    ctx.fillText(r.last, R - 160, cy)
    ctx.textAlign = 'center'
    const pw = 64, ph = 38
    rr(ctx, R - 20 - pw, cy - ph / 2, pw, ph, ph / 2); ctx.fillStyle = i < 3 ? CREAM : 'rgba(243,230,208,0.14)'; ctx.fill()
    ctx.font = '600 21px Inter'; ctx.fillStyle = i < 3 ? DARK : CREAM; ctx.fillText(String(r.visits), R - 20 - pw / 2, cy + 1)
    if (i >= 2 && i < N - 1) {
      ctx.strokeStyle = 'rgba(243,230,208,0.07)'; ctx.beginPath(); ctx.moveTo(L + 92, top + rh); ctx.lineTo(R, top + rh); ctx.stroke()
    }
  })

  ctx.fillStyle = ROSE; ctx.font = '400 32px "Playfair Display"'; ctx.fillText('Thank you for coming back ♡', W / 2, H - 130)
  ctx.fillStyle = 'rgba(243,230,208,0.45)'; ctx.font = '400 20px Inter'; ctx.fillText('@cappriccio.nails · private list', W / 2, H - 80)
}
