const NAV_MAP = {
  0: { label: 'Home', path: '/' },
  1: { label: 'About', path: '/about/' },
  2: { label: 'Projects', path: '/projects/' },
  3: { label: 'Puzzles', path: '/puzzles/' },
  4: { label: 'Art', path: '/art/' },
  5: { label: 'Writeups', path: '/writeups/' },
  6: { label: 'Log', path: '/log/' },
  7: { label: 'Contact', path: '/contact/' }
}

class SiteNav extends HTMLElement {
  connectedCallback() {
    const segs = window.location.pathname.split('/').filter(Boolean)
    const firstKey = Object.keys(NAV_MAP).find(k => NAV_MAP[k].path === '/' + (segs[0] || '') + '/')
    const parent = segs.length <= 1 ? '/' : '/' + segs.slice(0, -1).join('/') + '/'
    const parentKey = Object.keys(NAV_MAP).find(k => NAV_MAP[k].path === parent)
    const pageName = segs.length === 1 && firstKey ? NAV_MAP[firstKey].label : (segs[segs.length - 1] || '')
    const trail = [`<a class="nav-item home" href="/"><span class="label">Jonty</span></a>`]
    let acc = ''
    segs.forEach((seg, i) => {
      acc += '/' + seg
      const label = i === 0 && firstKey ? NAV_MAP[firstKey].label : seg
      trail.push(`<a class="nav-item" href="${acc}/"><span class="label">${label}</span></a>`)
    })
    const keys = Object.keys(NAV_MAP).map(k => {
      const c = (k === '0' ? ' home' : '') + (k === firstKey ? ' selected' : '')
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
            <span class="crumb-page">${pageName}</span>
          </div>
        </div>
      </nav>
    `
    const preview = key => {
      if (!key) return
      let html = `<a class="nav-item home" href="/"><span class="label">Jonty</span></a>`
      if (key !== '0') {
        html += `<span class="crumb-sep">/</span><a class="nav-item" href="${NAV_MAP[key].path}"><span class="label">${NAV_MAP[key].label}</span></a>`
      }
      this.querySelector('.crumb-trail').innerHTML = html
      this.querySelectorAll('.nav-key').forEach(el => el.classList.toggle('selected', el.textContent === key))
    }

    const go = (key, path) => {
      preview(key)
      location.href = path
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
      else if (k >= '1' && k <= String(Object.keys(NAV_MAP).length - 1)) { e.preventDefault(); go(k, NAV_MAP[k].path) }
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

customElements.define('site-nav', SiteNav)
customElements.define('site-footer', SiteFooter)
customElements.define('writeup-icon', WriteupIcon)
