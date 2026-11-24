/* =====================================================================
   Arcade-Intro
   Ablauf: Halle einblenden → auf den Automaten zulaufen → zum Münzschlitz
   → Münze einwerfen → hoch zum Bildschirm → Röhre schaltet ein → Zoom,
   bis der Automaten-Bildschirm (mit der echten Karte) den Browser füllt.
   Für Screenshots: ?introT=<ms> friert das Intro bei dieser Zeit ein.
   Ohne Intro: ?nointro
   ===================================================================== */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const DEBUG_T = params.has('introT') ? parseFloat(params.get('introT')) : null;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------
  // Sound (Web Audio, alles synthetisch – keine Dateien)
  // ---------------------------------------------------------------
  let ctx = null, soundOn = true;
  try { soundOn = localStorage.getItem('geoarcade_sound') !== '0'; } catch (e) {}
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx || !soundOn || ctx.state !== 'running') return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || .1, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur + .03);
  }
  function noise(dur, vol, when, f1, f2) {
    if (!ctx || !soundOn || ctx.state !== 'running') return;
    const t = ctx.currentTime + (when || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f1 || 800, t); bp.frequency.exponentialRampToValueAtTime(f2 || f1 || 800, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol || .1, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(bp).connect(g).connect(ctx.destination); src.start(t);
  }
  const SFX = {
    step()   { noise(.08, .10, 0, 160, 90); },
    clink()  { tone(2093, .22, 'triangle', .16); tone(2794, .3, 'sine', .1, .02); noise(.05, .12, 0, 3500, 7000);
               tone(1760, .15, 'triangle', .08, .16); noise(.04, .08, .17, 3000, 6000);
               noise(.3, .07, .25, 900, 400); },
    credit() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .11, 'square', .06, .35 + i * .075)); },
    power()  { tone(50, .7, 'sawtooth', .07, 0, 160); noise(.4, .09, 0, 300, 3000); tone(15600, .6, 'sine', .015, .05); },
    ready()  { [784, 988, 1175, 1568].forEach((f, i) => tone(f, .1, 'square', .06, i * .09)); tone(2093, .35, 'square', .05, .36); },
    whoosh() { noise(1.5, .14, 0, 250, 6000); tone(90, 1.5, 'triangle', .05, 0, 700); },
  };

  // ---------------------------------------------------------------
  // Hilfsfunktionen
  // ---------------------------------------------------------------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;       // easeInOutCubic
  const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeInQuart = t => t * t * t * t;
  function lerpCam(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: Math.exp(lerp(Math.log(a.s), Math.log(b.s), t)) }; }

  // Phasen und Dauer in ms (wait endet früher, wenn man klickt)
  const PHASES = ['fade', 'walk', 'toCoin', 'wait', 'insert', 'toScreen', 'boot', 'zoom'];
  const DUR_DEFAULT = { fade: 1100, walk: 3600, toCoin: 1400, wait: 4500, insert: 1150, toScreen: 1600, boot: 1700, zoom: 1900 };

  let S = null; // aktueller Zustand des Intros

  // ---------------------------------------------------------------
  // Szene aufbauen
  // ---------------------------------------------------------------
  function el(cls, parent, x, y, w, h, html) {
    const d = document.createElement('div');
    d.className = 'iw ' + cls;
    d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.width = w + 'px'; d.style.height = h + 'px';
    if (html) d.innerHTML = html;
    (parent || S.world).appendChild(d);
    return d;
  }

  function buildCabinet(parent, ox, W, H, u, main) {
    const r = {};
    el('i-body', parent, ox - 1.7 * u, -3.9 * u, W + 3.4 * u, H + 12.2 * u);
    el('i-cap', parent, ox - 2.0 * u, -4.45 * u, W + 4.0 * u, 0.75 * u);
    r.marquee = el('i-marquee' + (main ? ' off' : ''), parent, ox - 1.35 * u, -3.55 * u, W + 2.7 * u, 2.5 * u,
      main ? `<div class="t" style="font-size:${0.95 * u}px">GEO ARCADE</div><div class="s" style="font-size:${0.26 * u}px">WELTKARTEN · LERNAUTOMAT</div>`
           : `<div class="t" style="font-size:${0.8 * u}px">${parent.dataset.title}</div>`);
    el('i-speaker', parent, ox + W * 0.5 - 2.2 * u, -0.98 * u + 0.0 * u, 4.4 * u, 0.18 * u);
    const bez = el('i-bezel', parent, ox - 0.75 * u, -0.75 * u, W + 1.5 * u, H + 1.5 * u);
    if (main) {
      el('i-bezelLine', bez, 0.35 * u, 0.35 * u, W + 0.8 * u, H + 0.8 * u);
      const l1 = document.createElement('div'); l1.className = 'lbl'; l1.textContent = '1 PLAYER';
      l1.style.cssText = `left:${0.9 * u}px; bottom:${0.12 * u}px; font-size:${0.2 * u}px`; bez.appendChild(l1);
      const l2 = document.createElement('div'); l2.className = 'lbl'; l2.textContent = 'HI-SCORE 999990';
      l2.style.cssText = `right:${0.9 * u}px; bottom:${0.12 * u}px; font-size:${0.2 * u}px; color:#00e5ff; text-shadow:0 0 .5em rgba(0,229,255,.8)`; bez.appendChild(l2);
      r.screen = el('i-screen', parent, ox, 0, W, H);
    } else {
      el('i-sideScreen' + (parent.dataset.b ? ' b' : ''), parent, ox, 0, W, H);
    }
    // Bedienpult
    el('i-deck', parent, ox - 1.95 * u, H + 1.0 * u, W + 3.9 * u, 2.2 * u);
    el('i-deckEdge', parent, ox - 1.95 * u, H + 3.2 * u, W + 3.9 * u, 0.4 * u);
    const jx = ox + W * 0.3, jy = H + 2.05 * u;
    el('i-stickBase', parent, jx - 0.55 * u, jy - 0.25 * u, 1.1 * u, 0.55 * u);
    el('i-stickShaft', parent, jx - 0.06 * u, jy - 1.0 * u, 0.12 * u, 0.95 * u);
    el('i-stickBall', parent, jx - 0.34 * u, jy - 1.45 * u, 0.68 * u, 0.68 * u);
    const cols = [['#ff2e88', '#ff7ab8'], ['#ffd400', '#fff09a'], ['#00e5ff', '#a8f6ff'], ['#39ff14', '#b4ff9e']];
    cols.forEach((c, i) => {
      const bx = ox + W * 0.58 + i * 0.85 * u, by = H + 1.75 * u + (i % 2 ? -0.25 * u : 0.15 * u);
      const b = el('i-btn', parent, bx, by, 0.6 * u, 0.6 * u);
      b.style.background = `radial-gradient(circle at 38% 32%, ${c[1]} 0, ${c[0]} 45%, rgba(0,0,0,.5) 100%)`;
      if (main) {
        const l = el('i-deckLbl', parent, bx, by + 0.72 * u, 0.6 * u, 0.3 * u, 'ABCD'[i]);
        l.style.fontSize = 0.18 * u + 'px'; l.style.textAlign = 'center';
      }
    });
    if (main) {
      const s = el('i-deckLbl', parent, jx - 1.2 * u, H + 2.75 * u, 2.4 * u, 0.3 * u, 'PLAYER 1');
      s.style.fontSize = 0.18 * u + 'px'; s.style.textAlign = 'center';
    }
    // Münztür
    const cx = ox + W / 2;
    if (main) {
      r.led = el('i-led', parent, cx - 1.7 * u, H + 3.95 * u, 3.4 * u, 0.62 * u, 'CREDIT 00');
      r.led.style.fontSize = 0.5 * u + 'px';
    }
    el('i-door', parent, cx - 2.2 * u, H + 4.8 * u, 4.4 * u, 2.85 * u);
    r.plate = el('i-plate', parent, cx - 0.75 * u, H + 5.05 * u, 1.5 * u, 1.85 * u,
      `<div class="i-plateTxt" style="font-size:${0.17 * u}px; margin-top:${0.16 * u}px">1 COIN</div>`);
    r.slot = el('i-slot', parent, cx - 0.08 * u, H + 5.55 * u, 0.16 * u, 0.95 * u);
    el('i-return', parent, cx - 0.3 * u, H + 7.05 * u, 0.6 * u, 0.32 * u);
    // zweite Münzeinheit (Deko)
    el('i-plate', parent, cx + 0.95 * u, H + 5.05 * u, 0.9 * u, 1.85 * u).style.filter = 'brightness(.45)';
    el('i-plate', parent, cx - 1.85 * u, H + 5.05 * u, 0.9 * u, 1.85 * u).style.filter = 'brightness(.45)';
    el('i-kick', parent, ox - 1.7 * u, H + 7.8 * u, W + 3.4 * u, 0.5 * u);
    return r;
  }

  function build() {
    const vw = innerWidth, vh = innerHeight;
    const W = vw, H = vh, u = (W + H) / 20;
    const stage = document.createElement('div');
    stage.id = 'introStage';
    stage.innerHTML = `
      <div id="introCam"><div id="introWorld"></div></div>
      <div id="introFade"></div>
      <div id="introCoin"><div class="c"><span>G</span></div></div>
      <div id="introPrompt">▶ MÜNZE EINWERFEN ◀<small>KLICKEN · ENTER · LEERTASTE</small></div>
      <div id="introUi"><button class="mute" id="introMute"></button><button id="introSkip">ÜBERSPRINGEN ▶▶</button></div>`;
    document.body.appendChild(stage);
    S = { stage, vw, vh, W, H, u, world: stage.querySelector('#introWorld'), cam: stage.querySelector('#introCam'),
          fade: stage.querySelector('#introFade'), coin: stage.querySelector('#introCoin'), prompt: stage.querySelector('#introPrompt'),
          dur: Object.assign({}, DUR_DEFAULT), phase: -1, t0: 0, done: false, events: {} };
    S.world.style.setProperty('--u', u + 'px');
    S.world.style.setProperty('--r', 0.5 * u + 'px');
    S.world.style.setProperty('--panelW', 2.2 * u + 'px');

    const floorY = H + 8.3 * u;
    // Wand + Neon
    el('i-wall', null, -10 * W, -8 * H, 21 * W, 8 * H + floorY);
    el('i-neon pink', null, -10 * W, -3.0 * H, 21 * W, 0.06 * u);
    el('i-neon cyan', null, -10 * W, -2.75 * H, 21 * W, 0.04 * u);
    el('i-neon cyan', null, -10 * W, floorY - 0.25 * u, 21 * W, 0.05 * u);
    const sign = (txt, cls, x, y, size) => { const d = el('i-sign ' + cls, null, x, y, 1, 1, txt); d.style.fontSize = size + 'px'; d.style.width = 'auto'; d.style.height = 'auto'; d.style.transform = 'translateX(-50%)'; return d; };
    sign('HIGH SCORE', 'pink', -W * 0.95 - 3 * u, -2.3 * H, 1.3 * u);
    sign('PLAY!', 'cyan', W * 1.95 + 3 * u, -2.25 * H, 1.6 * u);
    sign('★ INSERT COIN ★', 'yellow', W / 2, -1.8 * H - 2 * u, 1.1 * u);
    // Boden mit Perspektiv-Gitter
    S.floorWrap = el('i-floorWrap', null, -10 * W, floorY, 21 * W, 6 * H);
    S.floor = document.createElement('div'); S.floor.className = 'i-floor'; S.floorWrap.appendChild(S.floor);
    S.floor.style.backgroundSize = `${1.6 * u}px ${1.6 * u}px`;
    S.floor.style.transform = `perspective(${1.6 * H}px) rotateX(74deg)`;
    el('i-floorGlow', null, W / 2 - (W + 6 * u) / 2, floorY - 0.8 * u, W + 6 * u, 3.2 * u);

    // Nachbar-Automaten
    const gap = W + 3.4 * u + 2.8 * u;
    [[-gap, 'GALAXY', ''], [gap, 'RACER', 'b'], [-2 * gap, 'PUZZLE', 'b'], [2 * gap, 'BLAST', '']].forEach(([dx, title, b]) => {
      const g = document.createElement('div'); g.className = 'iw i-side'; g.style.left = '0'; g.style.top = '0';
      g.dataset.title = title; if (b) g.dataset.b = '1';
      S.world.appendChild(g);
      buildCabinet(g, dx, W, H, u, false);
    });
    // Haupt-Automat
    const host = document.createElement('div'); host.className = 'iw'; host.style.left = '0'; host.style.top = '0';
    S.world.appendChild(host);
    Object.assign(S, buildCabinet(host, 0, W, H, u, true));

    // Bildschirm-Inhalt: die echte App + Effekte
    S.app = document.getElementById('app');
    S.appIntro = document.getElementById('intro');
    S.appInsert = document.getElementById('insert');
    S.appIntroDisplay = S.appIntro ? S.appIntro.style.display : '';
    if (S.appIntro) S.appIntro.style.display = 'none';
    S.screen.appendChild(S.app);
    S.attract = document.createElement('div'); S.attract.className = 'i-attract';
    S.attract.innerHTML = '<div class="small">GEO ARCADE</div><div class="big">INSERT COIN</div><div class="small">© 2026 · 1 PLAYER</div>';
    S.black = document.createElement('div'); S.black.className = 'i-black';
    S.noise = document.createElement('canvas'); S.noise.className = 'i-noise'; S.noise.width = 160; S.noise.height = 100;
    S.power = document.createElement('div'); S.power.className = 'i-power';
    S.crt = document.createElement('div'); S.crt.className = 'i-crt';
    [S.attract, S.black, S.noise, S.power, S.crt].forEach(n => S.screen.appendChild(n));
    S.noiseCtx = S.noise.getContext('2d');
    S.noiseImg = S.noiseCtx.createImageData(160, 100);

    // Münze
    const cs = Math.round(Math.min(vw, vh) * 0.14);
    S.coinSize = cs;
    S.coin.style.width = cs + 'px'; S.coin.style.height = cs + 'px';
    S.coin.querySelector('.c').style.fontSize = Math.round(cs * 0.36) + 'px';
    S.coinTxt = S.coin.querySelector('.c span');

    // Kameras (Weltkoordinaten: Bildschirm liegt bei 0..W, 0..H)
    const cabTop = -4.45 * u, cabBot = floorY, cabH = cabBot - cabTop, cabW = W + 4.0 * u;
    const midY = (cabTop + cabBot) / 2;
    S.cams = {
      far:    { x: W / 2, y: midY, s: Math.min(0.42 * vh / cabH, 0.38 * vw / cabW) },
      near:   { x: W / 2, y: midY + 0.6 * u, s: Math.min(0.96 * vh / cabH, 0.92 * vw / cabW) },
      coin:   { x: W / 2, y: H + 5.95 * u, s: Math.min(0.8 * vw / (4.6 * u), 0.8 * vh / (4.2 * u)) },
      screen: { x: W / 2, y: H / 2 - 0.9 * u, s: Math.min(0.7, 0.8 * vh / (H + 5.2 * u)) },
      final:  { x: W / 2, y: H / 2, s: 1 },
    };
    S.cams.screenClose = { x: W / 2, y: H / 2 - 0.4 * u, s: S.cams.screen.s * 1.07 };
    S.slotWorld = { x: W / 2, y: H + 5.55 * u, h: 0.95 * u };

    updateMuteBtn();
    stage.querySelector('#introMute').addEventListener('click', e => {
      e.stopPropagation(); soundOn = !soundOn;
      try { localStorage.setItem('geoarcade_sound', soundOn ? '1' : '0'); } catch (err) {}
      if (soundOn) audio(); updateMuteBtn();
    });
    stage.querySelector('#introSkip').addEventListener('click', e => { e.stopPropagation(); finish(); });
    stage.addEventListener('pointerdown', onAction);
  }
  function updateMuteBtn() { const b = document.getElementById('introMute'); if (b) b.textContent = soundOn ? '🔊 TON AN' : '🔇 TON AUS'; }

  // ---------------------------------------------------------------
  // Zeitachse
  // ---------------------------------------------------------------
  function phaseAt(t) {
    let acc = 0;
    for (let i = 0; i < PHASES.length; i++) {
      const d = S.dur[PHASES[i]];
      if (t < acc + d) return { i, name: PHASES[i], lt: t - acc, d, p: (t - acc) / d };
      acc += d;
    }
    return { i: PHASES.length, name: 'end', lt: 0, d: 1, p: 1 };
  }
  function phaseStart(name) { let acc = 0; for (const n of PHASES) { if (n === name) return acc; acc += S.dur[n]; } return acc; }

  function setCam(c, bob, roll) {
    S.world.style.transform = `translate(${S.vw / 2 - c.x * c.s}px, ${S.vh / 2 - c.y * c.s}px) scale(${c.s})`;
    S.cam.style.transform = `translateY(${bob || 0}px) rotate(${roll || 0}deg)`;
    S.curCam = c;
  }
  function worldToView(x, y) { const c = S.curCam; return { x: S.vw / 2 + (x - c.x) * c.s, y: S.vh / 2 + (y - c.y) * c.s }; }

  function drawNoise(level) {
    const d = S.noiseImg.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    S.noiseCtx.putImageData(S.noiseImg, 0, 0);
    S.noise.style.opacity = level;
  }

  function render(t) {
    const P = phaseAt(t), C = S.cams;
    let cam = C.far, bob = 0, roll = 0;
    // Kamera
    switch (P.name) {
      case 'fade':     cam = C.far; break;
      case 'walk': {
        const e = easeSine(P.p);
        cam = lerpCam(C.far, C.near, e);
        const steps = 3.2 * P.lt / 1000 * 1.75;          // ~1,75 Schritte pro Sekunde
        const amp = S.vh * 0.014 * Math.sin(Math.PI * P.p); // am Anfang/Ende sanft
        bob = Math.abs(Math.sin(steps * Math.PI / 3.2 * 2)) * -amp + amp * 0.5;
        roll = Math.sin(steps * Math.PI / 3.2) * 0.7 * Math.sin(Math.PI * P.p);
        S.floor.style.backgroundPosition = `0 ${P.lt * 0.09 * S.u / 10}px`;
        break; }
      case 'toCoin':   cam = lerpCam(C.near, C.coin, ease(P.p)); break;
      case 'wait':     cam = { x: C.coin.x, y: C.coin.y + Math.sin(P.lt / 600) * 0.03 * S.u, s: C.coin.s }; break;
      case 'insert':   cam = C.coin; if (P.p > .75) { const k = (P.p - .75) / .25; bob = Math.sin(k * Math.PI * 6) * 3 * (1 - k); } break;
      case 'toScreen': cam = lerpCam(C.coin, C.screen, ease(P.p)); break;
      case 'boot':     cam = lerpCam(C.screen, C.screenClose, easeSine(P.p)); break;
      case 'zoom':     cam = lerpCam(C.screenClose, C.final, ease(P.p)); break;
      default:         cam = C.final;
    }
    setCam(cam, bob, roll);

    // Einblenden
    S.fade.style.opacity = P.name === 'fade' ? String(1 - easeSine(P.p)) : '0';

    // Marquee geht beim Einblenden flackernd an
    if (P.name === 'fade' && P.p > .45 && !S.events.marq) { S.events.marq = 1; S.marquee.classList.remove('off'); S.marquee.classList.add('flick'); }
    if (P.i > 0 && !S.events.marq) { S.events.marq = 1; S.marquee.classList.remove('off'); }

    // Münze + Hinweis
    const coinVisible = P.name === 'wait' || P.name === 'insert' || (P.name === 'toCoin' && P.p > .7);
    S.prompt.classList.toggle('show', P.name === 'wait');
    S.plate.classList.toggle('pulse', P.name === 'wait' || P.name === 'toCoin');
    if (coinVisible) {
      const slot = worldToView(S.slotWorld.x, S.slotWorld.y);
      const cs = S.coinSize;
      const doorRight = worldToView(S.slotWorld.x + 2.2 * S.u, 0).x;
      const hover = { x: Math.min(S.vw - cs - 12, doorRight + cs * 0.45), y: slot.y - cs * 0.15 };
      let x = hover.x, y = hover.y, rot = 0, op = 1, clip = 0, sc = 1;
      if (P.name === 'toCoin') { op = (P.p - .7) / .3; y = hover.y - 40 * (1 - op); rot = (P.lt / 4) % 360; }
      else if (P.name === 'wait') { y = hover.y + Math.sin(P.lt / 300) * cs * 0.08; rot = (P.lt / 3.5) % 360; }
      else { // insert
        const a = clamp(P.p / .55, 0, 1), b = clamp((P.p - .55) / .25, 0, 1);
        const target = { x: slot.x - cs / 2, y: slot.y - cs * 0.62 };
        x = lerp(hover.x, target.x, ease(a)); y = lerp(hover.y, target.y, ease(a));
        rot = lerp(S.coinRotAtInsert || 0, 90, ease(a));
        sc = lerp(1, 0.92, a);
        if (b > 0) { y = target.y + b * cs * 0.75; clip = b; }
        if (P.p > .8) op = 0;
      }
      S.coin.style.opacity = op;
      S.coin.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
      S.coin.querySelector('.c').style.transform = `rotateY(${rot}deg)`;
      const back = ((rot % 360) + 360) % 360; S.coinTxt.style.transform = back > 90 && back < 270 ? 'scaleX(-1)' : '';
      S.coin.style.clipPath = clip ? `inset(0 0 ${clip * 75}% 0)` : '';
      if (P.name === 'wait') S.coinRotAtInsert = rot % 180 > 90 ? (rot % 180) - 180 : rot % 180;
    } else {
      S.coin.style.opacity = 0;
    }

    // Credit-Anzeige
    const credited = P.i > PHASES.indexOf('insert') || (P.name === 'insert' && P.p > .8);
    if (credited && !S.events.credit) { S.events.credit = 1; S.led.textContent = 'CREDIT 01'; S.led.classList.add('on'); S.plate.classList.remove('pulse'); S.plate.classList.add('flash'); }

    // Bildschirm: Attract-Modus → Rauschen → Einschalten → App
    const scr = P.name;
    let attract = 1, noiseLvl = 0, black = 0, power = 0, appIntro = false;
    if (scr === 'toScreen') { attract = P.p < .55 ? 1 : 0; noiseLvl = P.p < .55 ? 0 : clamp((P.p - .55) / .2, 0, 1) * .85; }
    if (scr === 'boot') {
      attract = 0;
      if (P.p < .22) { noiseLvl = .85; }
      else if (P.p < .32) { black = 1; noiseLvl = 0; }
      else if (P.p < .52) { black = 1; power = (P.p - .32) / .2; }
      else { black = 1 - clamp((P.p - .52) / .12, 0, 1); appIntro = true; }
    }
    if (scr === 'zoom' || scr === 'end') { attract = 0; appIntro = true; }
    S.attract.style.opacity = attract;
    S.black.style.opacity = black;
    if (noiseLvl > 0) drawNoise(noiseLvl); else S.noise.style.opacity = 0;
    if (power > 0 && power < 1) {
      S.power.style.opacity = 1;
      const sy = power < .5 ? lerp(.002, 1, power * 2) : 1;       // Linie öffnet sich zum Bild
      S.power.style.transform = power < .5 ? `scaleX(${lerp(.05, 1, power * 2)})` : `scaleY(${lerp(1, S.H / 2, (power - .5) * 2)})`;
      S.power.style.opacity = power < .5 ? 1 : 1 - (power - .5) * 1.6;
      void sy;
    } else S.power.style.opacity = 0;
    if (S.appIntro) S.appIntro.style.display = appIntro ? S.appIntroDisplay : 'none';
    if (S.appInsert) S.appInsert.style.visibility = appIntro ? 'hidden' : '';

    // Röhren-Effekt blendet beim Reinzoomen aus
    S.crt.style.opacity = scr === 'zoom' ? String(1 - easeInQuart(P.p)) : (scr === 'end' ? '0' : '1');
    // Für scharfes Bild nur beim großen Zoom auf die Grafikkarte auslagern
    S.world.style.willChange = scr === 'zoom' ? 'transform' : 'auto';

    // UI
    const ui = document.getElementById('introUi');
    if (ui) ui.style.opacity = scr === 'zoom' ? String(1 - P.p) : '1';

    return P;
  }

  // Sounds bei Phasenwechseln (nur live)
  function onPhase(name) {
    if (name === 'insert') { SFX.clink(); SFX.credit(); }
    if (name === 'toScreen') { /* leise */ }
    if (name === 'boot') { setTimeout(() => S && SFX.power(), S.dur.boot * .3); setTimeout(() => S && SFX.ready(), S.dur.boot * .55); }
    if (name === 'zoom') SFX.whoosh();
  }

  // ---------------------------------------------------------------
  // Steuerung
  // ---------------------------------------------------------------
  function onAction(e) {
    if (!S || S.done) return;
    audio();                                  // Klick schaltet Ton frei
    const P = phaseAt(performance.now() - S.t0);
    if (P.name === 'wait') {
      S.dur.wait = P.lt;                      // Wartezeit endet jetzt
    } else if (P.name === 'walk' || P.name === 'fade' || P.name === 'toCoin') {
      // schneller zum Münzschlitz
    }
    if (e && e.preventDefault) e.preventDefault();
  }
  function onKey(e) {
    if (!S || S.done) return;
    if (e.key === 'Escape') { finish(); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAction(); }
  }

  let lastStep = 0;
  function tick(now) {
    if (!S || S.done) return;
    const t = now - S.t0;
    const P = render(t);
    if (P.i !== S.phase) { S.phase = P.i; onPhase(P.name); }
    if (P.name === 'walk' && now - lastStep > 520 && P.p > .05 && P.p < .95) { lastStep = now; SFX.step(); }
    if (P.name === 'end') { finish(); return; }
    requestAnimationFrame(tick);
  }

  function finish() {
    if (!S || S.done) return;
    S.done = true;
    // App zurück an ihren normalen Platz
    S.app.style.pointerEvents = '';
    document.body.insertBefore(S.app, S.stage);
    if (S.appIntro) S.appIntro.style.display = S.appIntroDisplay;
    if (S.appInsert) S.appInsert.style.visibility = '';
    S.stage.remove();
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    S = null;
    window.dispatchEvent(new Event('resize'));  // Karte neu ausrichten
  }
  function onResize() { finish(); }

  function startIntro() {
    if (S) return;
    build();
    document.addEventListener('keydown', onKey, true);
    if (DEBUG_T !== null) {                      // Standbild für Tests
      S.done = false;
      const t = DEBUG_T;
      // Ereignisse, die bis dahin passiert wären
      render(Math.max(0, t - 16)); render(t);
      window.__introDebug = { phaseAt: x => phaseAt(x).name, phaseStart };
      return;
    }
    window.addEventListener('resize', onResize);
    S.t0 = performance.now();
    requestAnimationFrame(tick);
  }

  window.GeoArcadeIntro = { start: startIntro, skip: finish };

  if (!params.has('nointro') && !reduced) startIntro();
})();
