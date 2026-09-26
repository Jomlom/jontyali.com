(function () {

  const canvas = document.getElementById('bg-stars-canvas')
  if (!canvas) return

  const ctx = canvas.getContext('2d')

  const PAUSE_KEY = 'sim-paused'
  let paused = localStorage.getItem(PAUSE_KEY) === 'true'

  const NSTARS = 1600
  const REF_PIXELS = 3840 * 2160
  let active = NSTARS

  // scale star density and blur to screen size
  function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const dpr = window.devicePixelRatio || 1
    const area = canvas.width * canvas.height * dpr * dpr
    const scale = Math.min(1, Math.max(0.3, Math.sqrt(area / REF_PIXELS)))
    active = Math.round(NSTARS * scale)
    document.documentElement.style.setProperty('--bg-blur', (2 * scale).toFixed(2) + 'px')
  }
  resize()
  window.addEventListener('resize', resize)
  const dirs = new Float32Array(NSTARS * 3)
  const props = new Float32Array(NSTARS * 4) // size, opacity, twinkleSpd, twinklePhase
  const cols = new Float32Array(NSTARS * 3)  // r g b 0..1

  function genStars() {
    for (let s = 0; s < NSTARS; s++) {
      let x, y, z, l
      do {
        x = Math.random()*2-1; y = Math.random()*2-1; z = Math.random()*2-1
        l = Math.sqrt(x*x + y*y + z*z)
      } while (l > 1 || l < 0.001)
      dirs[s*3] = x/l; dirs[s*3+1] = y/l; dirs[s*3+2] = z/l
      props[s*4] = 1.5 + Math.random() * 1.1 // size
      props[s*4+1] = 0.22 + Math.random() * 0.35 // base opacity
      props[s*4+2] = 0.011 + Math.random() * 0.01 // twinkle speed
      props[s*4+3] = Math.random() * Math.PI * 2 // twinkle phase
      const t = Math.random()
      if (t < 0.15) { cols[s*3]=0.85; cols[s*3+1]=0.90; cols[s*3+2]=1.00 }
      else if (t < 0.28) { cols[s*3]=1.00; cols[s*3+1]=0.90; cols[s*3+2]=0.75 }
      else { cols[s*3]=0.95; cols[s*3+1]=0.95; cols[s*3+2]=0.95 }
    }
  }
  genStars()

  // re-randomise on reset button
  window.addEventListener('heroReset', genStars)

  // rotation on pages without hero-sim
  const AUTO_ROT_X = 0.25
  let autoRotY = -0.75
  const AUTO_ROT_SPEED = 0.00006

  let frame = 0

  function tick() {
    frame++

    const w = canvas.width, h = canvas.height
    const px = Math.max(Math.min(w, h) / 1080, 0.9)

    // hero-sim sizes canvas to hero section width x height
    const heroCanvas = document.getElementById('hero-canvas')
    const heroAsp = heroCanvas ? (heroCanvas.width / heroCanvas.height) : Math.max(w / h, 1.3)

    // read camera from hero-sim
    let rotX, rotY
    if (window._heroSim) {
      rotX = window._heroSim.rotX
      rotY = window._heroSim.rotY
    } else {
      // when no hero sim, rotate slowly on own
      autoRotY += AUTO_ROT_SPEED
      rotX = AUTO_ROT_X
      rotY = autoRotY
    }

    // fade stars out/in together with the hero galaxy while it resets
    const sfAlpha = (window._heroSim && typeof window._heroSim.fadeAlpha === 'number') ? window._heroSim.fadeAlpha : 1

    // projection with same fov as hero-sim
    const fov = Math.PI / 3.2
    const asp = heroAsp
    const f = 1 / Math.tan(fov / 2)

    // rotation matrix components
    const cx = Math.cos(rotX), sx = Math.sin(rotX)
    const cy = Math.cos(rotY), sy = Math.sin(rotY)

    ctx.clearRect(0, 0, w, h)

    for (let s = 0; s < active; s++) {
      const dx = dirs[s*3], dy = dirs[s*3+1], dz = dirs[s*3+2]

      // apply rotY then rotX
      const rx1 = dx*cy + dz*sy
      const ry1 = dy
      const rz1 = -dx*sy + dz*cy
      const vx = rx1
      const vy = ry1*cx - rz1*sx
      const vz = ry1*sx + rz1*cx

      if (vz >= -0.1) continue // behind camera

      const ndcX = (vx / -vz) * (f / asp)
      const ndcY = (vy / -vz) * f
      if (ndcX < -1.1 || ndcX > 1.1 || ndcY < -1.1 || ndcY > 1.1) continue

      // twinkle
      const tw = 1 + 0.28 * Math.sin(frame * props[s*4+2] + props[s*4+3])
      const op = props[s*4+1] * tw * sfAlpha
      const sz = props[s*4] * px

      // convert ndc to canvas pixels
      const screenX = (ndcX + 1) * 0.5 * w
      const screenY = (1 - (ndcY + 1) * 0.5) * h

      const r = Math.round(cols[s*3] * 255)
      const g = Math.round(cols[s*3+1] * 255)
      const b = Math.round(cols[s*3+2] * 255)

      ctx.globalAlpha = op
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.beginPath()
      ctx.arc(screenX, screenY, sz * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1

    if (!paused) requestAnimationFrame(tick)
  }

  tick()

  const controls = document.createElement('div')
  controls.className = 'sim-controls'
  document.body.appendChild(controls)

  if (document.getElementById('hero-canvas')) {
    const resetBtn = document.createElement('button')
    resetBtn.id = 'sim-reset'
    resetBtn.className = 'sim-pause'
    resetBtn.setAttribute('aria-label', 'reset galaxy simulation')
    resetBtn.textContent = 'reset'
    resetBtn.addEventListener('click', () => {
      window.dispatchEvent(new Event('heroResetRequest'))
    })
    controls.appendChild(resetBtn)
  }

  const pauseBtn = document.createElement('button')
  pauseBtn.id = 'sim-pause'
  pauseBtn.className = 'sim-pause'
  pauseBtn.setAttribute('aria-label', 'pause background animation')
  pauseBtn.textContent = paused ? 'play' : 'pause'
  controls.appendChild(pauseBtn)

  pauseBtn.addEventListener('click', () => {
    paused = !paused
    localStorage.setItem(PAUSE_KEY, paused)
    pauseBtn.textContent = paused ? 'play' : 'pause'
    if (!paused) tick()
    window.dispatchEvent(new CustomEvent('simPauseToggle', { detail: { paused } }))
  })

  if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    const rules = document.createElement('script')
    rules.type = 'speculationrules'
    rules.textContent = JSON.stringify({
      prerender: [{
        where: { and: [{ href_matches: '/*' }, { not: { href_matches: '/puzzles/*' } }] },
        eagerness: 'moderate'
      }]
    })
    document.head.append(rules)
  }

})()
