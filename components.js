const NAV_MAP = {
  0: { label: 'Home', path: '/' },
  1: { label: 'About', path: '/about/' },
  2: { label: 'Projects', path: '/projects/' },
  3: { label: 'Art', path: '/art/' },
  4: { label: 'Writeups', path: '/writeups/' },
  5: { label: 'Log', path: '/log/' },
  6: { label: 'Contact', path: '/contact/' }
}
}

class SiteNav extends HTMLElement {
  connectedCallback() {
    const segs = window.location.pathname.split('/').filter(Boolean)
    const firstKey = Object.keys(NAV_MAP).find(k => NAV_MAP[k].path === '/' + (segs[0] || '') + '/')
    const parent = segs.length <= 1 ? '/' : '/' + segs.slice(0, -1).join('/') + '/'
    const parentKey = Object.keys(NAV_MAP).find(k => NAV_MAP[k].path === parent)
    const pageName = segs.length === 1 && firstKey ? NAV_MAP[firstKey].label : (segs[segs.length - 1] || '')
    const pageCls = firstKey === '1' ? ' cred' : ''
    const trail = [`<a class="nav-item home" href="/"><span class="label">Jonty</span></a>`]
    let acc = ''
    segs.forEach((seg, i) => {
      acc += '/' + seg
      const cls = i === 0 && firstKey === '1' ? 'nav-item cred' : 'nav-item'
      const label = i === 0 && firstKey ? NAV_MAP[firstKey].label : seg
      trail.push(`<a class="${cls}" href="${acc}/"><span class="label">${label}</span></a>`)
    })
    const keys = Object.keys(NAV_MAP).map(k => {
      const c = (k === '0' ? ' home' : k === '1' ? ' cred' : '') + (k === firstKey ? ' selected' : '')
      return `<a class="nav-key${c}" href="${NAV_MAP[k].path}">${k}</a>`
    }).join('')
    this.innerHTML = `
      <nav class="crumb">
        <div class="crumb-inner">
          <div class="crumb-bar">
            <div class="crumb-trail">${trail.join('<span class="crumb-sep">/</span>')}</div>
            <div class="crumb-keys">${keys}</div>
          </div>
          <div class="crumb-hints">
            <a class="nav-hint show" href="/"><span class="key">[0]</span> home</a>
            <a class="nav-hint show" href="${parent}"><span class="key">[esc]</span> back</a>
          </div>
          <div class="crumb-mobile">
            <a class="crumb-back" href="${parent}">&larr;</a>
            <span class="crumb-page${pageCls}">${pageName}</span>
          </div>
        </div>
      </nav>
    `
    const preview = key => {
      if (!key) return
      let html = `<a class="nav-item home" href="/"><span class="label">Jonty</span></a>`
      if (key !== '0') {
        const cls = key === '1' ? 'nav-item cred' : 'nav-item'
        html += `<span class="crumb-sep">/</span><a class="${cls}" href="${NAV_MAP[key].path}"><span class="label">${NAV_MAP[key].label}</span></a>`
      }
      this.querySelector('.crumb-trail').innerHTML = html
      this.querySelectorAll('.nav-key').forEach(el => el.classList.toggle('selected', el.textContent === key))
    }

    const go = (key, path) => {
      preview(key)
      document.querySelectorAll('main, site-footer').forEach(el => el.style.visibility = 'hidden')
      requestAnimationFrame(() => requestAnimationFrame(() => { location.href = path }))
    }

    this.querySelectorAll('.nav-key').forEach(el => el.addEventListener('click', e => { e.preventDefault(); go(el.textContent, el.href) }))
    const hints = this.querySelectorAll('.crumb-hints a')
    hints[0].addEventListener('click', e => { e.preventDefault(); go('0', hints[0].href) })
    hints[1].addEventListener('click', e => { e.preventDefault(); go(parentKey, hints[1].href) })
    const back = this.querySelector('.crumb-back')
    back.addEventListener('click', e => { e.preventDefault(); go(parentKey, back.href) })

    window.addEventListener('keydown', e => {
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const k = e.key
      if (k === 'Escape') { e.preventDefault(); go(parentKey, parent) }
      else if (k === '0') { e.preventDefault(); go('0', NAV_MAP[0].path) }
      else if (k >= '1' && k <= '6') { e.preventDefault(); go(k, NAV_MAP[k].path) }
    })
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer>
        <span>Jonty Ali · Durham · 2026</span>
        <span>© 2026 Jonty Ali. All rights reserved.</span>
      </footer>
    `
  }
}

class ProjectGallery extends HTMLElement {
  async connectedCallback() {
    const probe = src => new Promise(res => {
      const i = new Image()
      i.onload = () => res(true)
      i.onerror = () => res(false)
      i.src = src
    })

    const images = []
    let n = 1
    while (true) {
      const png = 'gallery/' + n + '.png'
      const gif = 'gallery/' + n + '.gif'
      if (await probe(png)) images.push(png)
      else if (await probe(gif)) images.push(gif)
      else break
      n++
    }

    if (!images.length) {
      this.innerHTML = `<div class="gallery-empty">no images yet</div>`
      return
    }

    this.innerHTML = `
      <div class="carousel ready" id="carousel">
        <div class="carousel-track" id="carousel-track"></div>
        <button class="carousel-btn carousel-prev" id="prev" aria-label="previous">&#8249;</button>
        <button class="carousel-btn carousel-next" id="next" aria-label="next">&#8250;</button>
        <div class="carousel-dots" id="dots"></div>
      </div>
      <div class="lightbox" id="lightbox" role="dialog" aria-modal="true">
        <button class="lightbox-close" id="lb-close" aria-label="close">✕</button>
        <img id="lb-img" src="" alt="">
      </div>
    `

    const track = this.querySelector('#carousel-track')
    const dotsEl = this.querySelector('#dots')
    const prevBtn = this.querySelector('#prev')
    const nextBtn = this.querySelector('#next')
    const lb = this.querySelector('#lightbox')
    const lbImg = this.querySelector('#lb-img')
    const lbClose = this.querySelector('#lb-close')

    images.forEach((src, i) => {
      const img = document.createElement('img')
      img.src = src
      img.alt = 'screenshot ' + (i + 1)
      if (i === 0) img.classList.add('visible')
      track.appendChild(img)
    })

    images.forEach((_, i) => {
      const dot = document.createElement('div')
      dot.className = 'dot' + (i === 0 ? ' active' : '')
      dot.addEventListener('click', () => goTo(i))
      dotsEl.appendChild(dot)
    })

    const imgs = track.querySelectorAll('img')
    const dots = dotsEl.querySelectorAll('.dot')
    let current = 0

    function goTo(idx) {
      imgs[current].classList.remove('visible')
      dots[current].classList.remove('active')
      current = (idx + images.length) % images.length
      imgs[current].classList.add('visible')
      dots[current].classList.add('active')
    }

    prevBtn.addEventListener('click', () => goTo(current - 1))
    nextBtn.addEventListener('click', () => goTo(current + 1))

    document.addEventListener('keydown', e => {
      if (lb.classList.contains('open')) return
      if (e.key === 'ArrowLeft')  goTo(current - 1)
      if (e.key === 'ArrowRight') goTo(current + 1)
    })

    track.addEventListener('click', () => {
      lbImg.src = images[current]
      lb.classList.add('open')
    })

    const closeLb = () => lb.classList.remove('open')
    lbClose.addEventListener('click', closeLb)
    lb.addEventListener('click', e => { if (e.target === lb) closeLb() })
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLb() })
  }
}

class ProjectIcon extends HTMLElement {
  connectedCallback() {
    const name = window.location.pathname.split('/').filter(Boolean).pop()
    const img = new Image()
    img.onload = () => {
      img.className = 'card-icon'
      img.alt = ''
      this.appendChild(img)
    }
    img.src = name + '.png'
  }
}

// looks for <slug>.png next to writeup and silently does nothing if missing
class WriteupIcon extends HTMLElement {
  connectedCallback() {
    const name = window.location.pathname.split('/').filter(Boolean).pop()
    const img = new Image()
    img.onload = () => {
      img.className = 'card-icon'
      img.alt = ''
      this.appendChild(img)
    }
    img.src = name + '.png'
  }
}

class AIUsage extends HTMLElement {
  connectedCallback() {
    const words = { none: 'NONE', low: 'LOW', high: 'HEAVY' }
    const key = (this.getAttribute('level') || 'none').toLowerCase()
    const level = words[key] ? key : 'none'
    const desc = (this.getAttribute('desc') || '').replace(/\s+/g, ' ').trim()
    const label = level === 'none' ? 'No AI Usage' : 'AI Usage'
    this.innerHTML = `
      <span class="ai-usage-cell" data-level="${level}">
        <button type="button" class="ai-usage-trigger">${label}</button>
        <span class="ai-usage-pop" role="tooltip">
          <span class="ai-usage-pop-head">${words[level]}</span>
          <span class="ai-usage-pop-desc"></span>
        </span>
      </span>
    `
    this.querySelector('.ai-usage-pop-desc').textContent = desc

    const cell = this.querySelector('.ai-usage-cell')
    const trigger = this.querySelector('.ai-usage-trigger')
    const pop = this.querySelector('.ai-usage-pop')
    const m = 8
    const place = () => {
      const t = trigger.getBoundingClientRect()
      const pw = pop.offsetWidth
      const ph = pop.offsetHeight
      const left = Math.max(m, Math.min(t.left, window.innerWidth - m - pw))
      let top = t.bottom + m
      if (top + ph > window.innerHeight - m) top = t.top - ph - m
      top = Math.max(m, Math.min(top, window.innerHeight - m - ph))
      pop.style.left = left + 'px'
      pop.style.top = top + 'px'
    }
    const reposition = () => { if (cell.matches(':hover, :focus-within')) place() }
    cell.addEventListener('mouseenter', place)
    cell.addEventListener('focusin', place)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
  }
}

customElements.define('site-nav', SiteNav)
customElements.define('site-footer', SiteFooter)
customElements.define('project-gallery', ProjectGallery)
customElements.define('project-icon', ProjectIcon)
customElements.define('writeup-icon', WriteupIcon)
customElements.define('ai-usage', AIUsage)

document.querySelectorAll('.project-status').forEach(el => {
  if (el.textContent.trim().toLowerCase() === 'idea') el.classList.add('idea')
})