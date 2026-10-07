import {
  blendGeometry,
  clamp,
  type Geometry,
  heroGeometry,
  heroSteps,
  mix,
  smooth,
} from './motion';

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};
const island = $('#island');
const content = $('#island-content');
const hero = $('.hero');
const experience = $('#experience');
const demo = $('#demo-anchor');
const splitSection = $('.split-section');
const splitAnchor = $('#split-anchor');
const footerAnchor = $('#footer-anchor');
const footerWrap = $('.footer-wordmark-wrap');
const footerWordmark = $('.footer-wordmark');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionPreference.matches;
let context = '';
let frame = 0;
let scenario: Scenario = 'media';
let playing = true;
let playback = 83;
let volume = 64;
let brightness = 78;
let dnd = false;
let microphone = false;
let wifi = true;
let bluetooth = true;
let connectedNetwork = 'Studio';
let connectedDevice = 'Headphones';
let query = '';
let selectedTrack = 0;
let notificationIds = [1, 2];
let timerDuration = 25 * 60;
let timerRemaining = timerDuration;
let timerDeadline: number | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let splitFocus = 'media';

type Scenario =
  'media' | 'timer' | 'notifications' | 'controls' | 'launcher' | 'privacy' | 'wifi' | 'bluetooth';
const iconPaths: Record<string, string> = {
  play: '<path d="m7 4 10 6-10 6Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5v10M13 5v10" stroke-width="2.5"/>',
  previous: '<path d="M5 5v10m11-10-8 5 8 5Z"/>',
  next: '<path d="M15 5v10M4 5l8 5-8 5Z"/>',
  timer: '<circle cx="10" cy="11" r="7"/><path d="M10 7v4l3 2M7 1h6m-3 0v3"/>',
  bell: '<path d="M4 13h12l-2-3V7a4 4 0 0 0-8 0v3Zm4 3a2 2 0 0 0 4 0"/>',
  close: '<path d="m6 6 8 8m0-8-8 8"/>',
  wifi: '<path d="M2 6a13 13 0 0 1 16 0M5 9a8 8 0 0 1 10 0m-7 3a3 3 0 0 1 4 0"/><circle cx="10" cy="16" r=".7" fill="currentColor"/>',
  bluetooth: '<path d="m6 5 9 9-5 4V2l5 4-9 9"/>',
  microphone:
    '<rect x="7" y="2" width="6" height="10" rx="3"/><path d="M4 9a6 6 0 0 0 12 0m-6 6v3m-3 0h6"/>',
  check: '<path d="m4 10 4 4 8-8"/>',
  copy: '<rect x="7" y="7" width="9" height="10" rx="2"/><path d="M11 7V3H3v10h4"/>',
};
const icon = (name: string) =>
  `<svg aria-hidden="true" viewBox="0 0 20 20">${iconPaths[name] ?? ''}</svg>`;
const wave = '<span class="compact-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const tracks = ['Weightless', 'Still here', 'A little space'];
const descriptions: Record<Scenario, string> = {
  media: 'Artwork, playback, and a timeline. Your music, a little closer.',
  timer: 'Start a timer. Keep your attention on what you came to do.',
  notifications: 'A place for notifications. And a way to make them wait.',
  controls: 'The everyday adjustments, without another window.',
  launcher: 'Type to find an app. The keyboard does the rest.',
  privacy: 'Capture stays visible in a separate cluster, even outside the Island.',
  wifi: 'A connection flow, right where you need it. Simulated networks here.',
  bluetooth: 'Your devices, in reach. Simulated pairing in this demo.',
};
const sizes: Record<Scenario, Geometry> = {
  media: { width: 440, height: 310, radius: 30 },
  timer: { width: 360, height: 303, radius: 30 },
  notifications: { width: 430, height: 304, radius: 30 },
  controls: { width: 420, height: 330, radius: 30 },
  launcher: { width: 420, height: 314, radius: 30 },
  privacy: { width: 390, height: 268, radius: 30 },
  wifi: { width: 410, height: 310, radius: 30 },
  bluetooth: { width: 410, height: 280, radius: 30 },
};
const label = (title: string, right: string) =>
  `<div class="surface-label">${title}<span>${right}</span></div>`;
const footer = (text: string) =>
  `<div class="surface-footer"><span class="status-dot"></span>${text}<span>SIMULATED</span></div>`;
function toggle(name: string, text: string, checked: boolean, detail = '') {
  return `<div class="toggle-row"><div>${text}${detail ? `<small>${detail}</small>` : ''}</div><button class="toggle" role="switch" aria-checked="${checked}" aria-label="${text}" data-action="${name}"></button></div>`;
}
function mediaMarkup() {
  return `${label('MEDIA', 'MPRIS')}<div class="media-body"><img class="album-art" src="/artwork.svg" alt="Abstract dune album artwork"/><div><h3>${tracks[selectedTrack]}</h3><p>The quiet hours</p><small>A little room to think.</small></div></div>
  <label class="sr-only" for="media-progress">Playback position</label><input id="media-progress" type="range" min="0" max="222" value="${playback}" data-range="progress"/>
  <div class="time-labels"><span id="elapsed">${time(playback)}</span><span>3:42</span></div>
  <div class="media-controls"><button data-action="previous" aria-label="Previous track">${icon('previous')}</button><button class="play-button" data-action="play" aria-label="${playing ? 'Pause' : 'Play'} playback">${icon(playing ? 'pause' : 'play')}</button><button data-action="next" aria-label="Next track">${icon('next')}</button></div>${footer('Desktop speakers')}`;
}
function timerMarkup() {
  return `${label('TIMER', 'STAY IN THE MOMENT')}<div class="timer-display" id="timer-value">${time(timerRemaining)}</div><p class="timer-subtitle" id="timer-subtitle">${timerDeadline ? 'A little time, just for this.' : timerRemaining === 0 ? 'Time’s up.' : 'A little focus goes a long way.'}</p><div class="timer-actions"><button class="surface-button primary" data-action="timer">${timerDeadline ? 'Pause timer' : timerRemaining < timerDuration && timerRemaining > 0 ? 'Resume timer' : 'Start timer'}</button><button class="surface-button" data-action="reset-timer">Reset</button></div><div class="timer-presets" role="group" aria-label="Timer duration">${[5, 15, 25].map((m) => `<button data-minutes="${m}" aria-pressed="${timerDuration === m * 60}">${m} min</button>`).join('')}</div>`;
}
function notificationsMarkup() {
  const notifications = [
    { id: 1, title: 'A moment to step back', text: 'Your focus session is ready when you are.' },
    { id: 2, title: 'The quiet hours', text: 'Now playing: Weightless' },
  ];
  return `${label('NOTIFICATIONS', `${notificationIds.length} IN HISTORY`)}${toggle('dnd', 'Do Not Disturb', dnd, 'Critical notifications still come through.')}
  <div class="notification-list">${
    notifications
      .filter((n) => notificationIds.includes(n.id))
      .map(
        (n) =>
          `<div class="notification-row">${icon('bell')}<div><strong>${n.title}</strong><p>${n.text}</p></div><button class="icon-button" data-dismiss="${n.id}" aria-label="Dismiss ${n.title}">${icon('close')}</button></div>`,
      )
      .join('') ||
    '<p class="notification-empty">All clear. A little more quiet.</p><button class="surface-button" data-action="restore-notifications">Restore sample notifications</button>'
  }</div>`;
}
function controlsMarkup() {
  return `${label('CONTROLS', 'YOUR DESKTOP')}<div class="controls-slider"><label for="volume">Volume <span id="volume-value">${volume}%</span></label><input id="volume" type="range" min="0" max="100" value="${volume}" data-range="volume"/></div><div class="controls-slider"><label for="brightness">Brightness <span id="brightness-value">${brightness}%</span></label><input id="brightness" type="range" min="0" max="100" value="${brightness}" data-range="brightness"/></div><div class="controls-switches">${toggle('wifi', 'Wi-Fi', wifi)}${toggle('bluetooth', 'Bluetooth', bluetooth)}${toggle('microphone', 'Microphone', microphone)}${toggle('dnd', 'Do Not Disturb', dnd)}</div>${footer('Local demo settings')}`;
}
const apps = [
  { name: 'Firefox', type: 'Web browser', glyph: '◉' },
  { name: 'Files', type: 'File manager', glyph: '▱' },
  { name: 'Foot', type: 'Terminal', glyph: '>_' },
  { name: 'Settings', type: 'Preferences', glyph: '☷' },
];
function updateSearch() {
  const results = apps.filter((app) => app.name.toLowerCase().includes(query.toLowerCase()));
  $('#launcher-results').innerHTML =
    results
      .map(
        (app) =>
          `<button class="launcher-result" data-app="${app.name}"><span class="app-icon">${app.glyph}</span>${app.name}<small>${app.type}</small></button>`,
      )
      .join('') || '<p class="notification-empty">No matching apps. Try “Files”.</p>';
}
function launcherMarkup() {
  return `${label('LAUNCHER', 'KEYBOARD FIRST')}<label class="search-label" for="launcher-query">Find an application</label><input class="launcher-search" id="launcher-query" type="search" placeholder="Start typing…" autocomplete="off"/><div class="launcher-results" id="launcher-results"></div>${footer('Sample applications')}`;
}
function privacyMarkup() {
  return `${label('PRIVACY', 'VISIBLE, NOT INTRUSIVE')}<p class="privacy-explanation">Capture doesn’t compete for the Island.<br>A separate privacy cluster stays visible.<br>In the real shell, Controls names the apps.</p>${toggle('microphone', 'Simulate microphone capture', microphone, microphone ? 'Demo call is using the microphone.' : 'No capture in this demonstration.')}${footer('PipeWire / niri in the real shell')}`;
}
function wifiMarkup() {
  return `${label('WI-FI', 'NETWORKMANAGER')}${toggle('wifi', 'Wi-Fi', wifi)}${wifi ? ['Studio', 'Quiet network', 'Guest'].map((name) => `<div class="network-row">${icon('wifi')}<div><strong>${name}</strong><small>${connectedNetwork === name ? 'Connected · Sample network' : 'Open · Sample network'}</small></div><button data-network="${name}" ${connectedNetwork === name ? 'disabled' : ''}>${connectedNetwork === name ? 'Connected' : 'Connect'}</button></div>`).join('') : '<p class="notification-empty">Wi-Fi is off. Turn it on to see sample networks.</p>'}`;
}
function bluetoothMarkup() {
  return `${label('BLUETOOTH', 'BLUEZ')}${toggle('bluetooth', 'Bluetooth', bluetooth)}${bluetooth ? ['Headphones', 'Keyboard'].map((name) => `<div class="network-row">${icon('bluetooth')}<div><strong>${name}</strong><small>${connectedDevice === name ? 'Connected · Sample device' : 'Available · Sample device'}</small></div><button data-device="${name}">${connectedDevice === name ? 'Disconnect' : 'Connect'}</button></div>`).join('') : '<p class="notification-empty">Bluetooth is off. Turn it on to see sample devices.</p>'}${footer('No device permissions requested')}`;
}
function renderScenario() {
  const renderers = {
    media: mediaMarkup,
    timer: timerMarkup,
    notifications: notificationsMarkup,
    controls: controlsMarkup,
    launcher: launcherMarkup,
    privacy: privacyMarkup,
    wifi: wifiMarkup,
    bluetooth: bluetoothMarkup,
  };
  content.innerHTML = renderers[scenario]();
  if (scenario === 'launcher') {
    $<HTMLInputElement>('#launcher-query').value = query;
    updateSearch();
  }
  $('#scenario-description').textContent = descriptions[scenario];
  $('#scenario-presentation').textContent = `EXPANDED / ${scenario.toUpperCase()}`;
  updatePrivacy();
}
function updatePrivacy() {
  $('#privacy-overlay').hidden = !microphone || !['privacy', 'controls'].includes(scenario);
}
function announce(message: string) {
  $('#demo-status').textContent = message;
}

// These contents share one physical body. They crossfade, never replace the island.
const layers = document.createElement('div');
layers.className = 'hero-layers';
layers.setAttribute('aria-hidden', 'true');
const compact = (split = false) =>
  `<div class="compact-inner"><img src="/artwork.svg" alt=""/><div class="compact-text"><strong>Weightless</strong><small>The quiet hours</small></div>${wave}${split ? `<span class="compact-timer">${icon('timer')}24:59</span>` : ''}</div>`;
layers.innerHTML = `<div class="hero-layer rest-layer"><span class="rest-clock" data-local-time>--:--</span></div><div class="hero-layer compact-layer">${compact()}</div><div class="hero-layer peek-layer">${compact()}<span class="peek-hint">A LITTLE CLOSER</span></div><div class="hero-layer hero-expanded"><div class="island-content">${mediaMarkup()}</div></div><div class="hero-layer split-layer">${compact(true)}</div>`;
// The scroll illustration is never a second set of accessible controls.
layers.inert = true;
layers.querySelectorAll('[id]').forEach((node) => {
  node.removeAttribute('id');
});
island.append(layers);
const morphWordmark = document.createElement('p');
morphWordmark.className = 'footer-morph-wordmark';
morphWordmark.textContent = 'KANADE';
morphWordmark.setAttribute('aria-hidden', 'true');
island.append(morphWordmark);
const localClocks = document.querySelectorAll<HTMLElement>('[data-local-time]');
const clockFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
function updateClock() {
  const currentTime = clockFormat.format(new Date());
  localClocks.forEach((clock) => {
    if (clock.textContent !== currentTime) clock.textContent = currentTime;
  });
}
updateClock();
setInterval(updateClock, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateClock();
});
const heroLayers = [...layers.querySelectorAll<HTMLElement>('.hero-layer')];
const rest: Geometry = { width: 116, height: 40, radius: 24 };
const compactGeometry: Geometry = { width: 260, height: 52, radius: 28 };
const splitGeometry: Geometry = { width: 390, height: 58, radius: 30 };

function setContext(next: string) {
  if (context === next) return;
  context = next;
  const interactive = next === 'demo' || next === 'split';
  island.classList.toggle('interactive-mode', interactive);
  island.classList.toggle('footer-morph', next === 'footer');
  island.classList.remove('interacting');
  island.setAttribute('aria-hidden', String(!interactive));
  content.inert = !interactive;
  content.style.display = interactive ? '' : 'none';
  layers.style.display = interactive ? 'none' : '';
  if (next === 'demo') renderScenario();
  if (next === 'split') {
    content.style.padding = '0';
    content.style.height = '100%';
    content.innerHTML = `<div class="split-interactive"><button data-focus="media" aria-pressed="${splitFocus === 'media'}" aria-label="Focus media segment"><img src="/artwork.svg" alt=""/><span class="split-track-title">Weightless</span>${wave}</button><button class="split-timer-button" data-focus="timer" aria-pressed="${splitFocus === 'timer'}" aria-label="Focus timer segment"><span class="split-timer-content">${icon('timer')}24:59</span></button></div>`;
  } else {
    content.style.padding = '';
    content.style.height = '';
  }
}
function showHeroLayer(index: number) {
  heroLayers.forEach((layer, i) => {
    layer.style.opacity = String(i === index ? 1 : 0);
  });
}
function place(x: number, y: number, geometry: Geometry) {
  const width = Math.min(geometry.width, innerWidth - (innerWidth <= 760 ? 80 : 48));
  island.style.width = `${width}px`;
  const naturalHeight =
    context === 'demo' ? Math.max(geometry.height, content.offsetHeight + 2) : geometry.height;
  const height = Math.min(naturalHeight, Math.max(40, innerHeight - 100));
  island.style.height = `${height}px`;
  island.style.borderRadius = `${geometry.radius}px`;
  const centerX = clamp(x, width / 2 + 12, innerWidth - width / 2 - 12);
  const centerY = clamp(y, height / 2 + 70, innerHeight - height / 2 - 20);
  island.style.transform = `translate3d(${centerX - width / 2}px,${centerY - height / 2}px,0)`;
}
function morphFooter(progress: number, point: { x: number; y: number }) {
  const p = smooth(progress);
  const target = footerWordmark.getBoundingClientRect();
  const width = mix(rest.width, target.width, p);
  const startY = clamp(point.y - scrollY, 90, innerHeight - 40) - rest.height / 2;
  const y = mix(startY, target.top, p);
  // Let the letters grow naturally, cropping only at the viewport's closing edge.
  const height = Math.max(1, Math.min(mix(rest.height, target.height, p), innerHeight - y));
  island.style.width = `${width}px`;
  island.style.height = `${height}px`;
  island.style.borderRadius = `${mix(rest.radius, 0, p)}px`;
  island.style.transform = `translate3d(${mix(point.x - rest.width / 2, target.left, p)}px,${y}px,0)`;
  island.style.setProperty('--footer-progress', String(p));
  showHeroLayer(0);
  heroLayers[0].style.opacity = String(1 - smooth(p / 0.2));
  const fontSize = mix(16, parseFloat(getComputedStyle(footerWordmark).fontSize), p);
  morphWordmark.style.fontSize = `${fontSize}px`;
  morphWordmark.style.letterSpacing = `${mix(0.32, -fontSize * 0.065, p)}px`;
  morphWordmark.style.left = `${mix(18, 0, p)}px`;
  morphWordmark.style.top = `${mix(Math.max(0, (height - fontSize * 0.83) / 2), 0, p)}px`;
  morphWordmark.style.opacity = String(smooth((p - 0.03) / 0.35));
}
function docTop(element: HTMLElement) {
  return element.getBoundingClientRect().top + scrollY;
}
function anchor(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + scrollY + rect.height / 2 };
}
function bridge(
  startScroll: number,
  endScroll: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromGeometry: Geometry,
  toGeometry: Geometry,
) {
  setContext('bridge');
  const t = clamp((scrollY - startScroll) / Math.max(1, endScroll - startScroll));
  // Park the clock below navigation between stages, always inside the viewport.
  const parked = { x: innerWidth - 70, y: 98 };
  const arrival = smooth(clamp(t / 0.2));
  const departure = smooth(clamp((t - 0.8) / 0.2));
  const x = mix(mix(from.x, parked.x, arrival), to.x, departure);
  const y = mix(mix(from.y - scrollY, parked.y, arrival), to.y - scrollY, departure);
  const shape =
    t < 0.2
      ? blendGeometry(fromGeometry, rest, smooth(t / 0.2))
      : t > 0.8
        ? blendGeometry(rest, toGeometry, smooth((t - 0.8) / 0.2))
        : rest;
  showHeroLayer(t < 0.13 && fromGeometry.width > 200 ? 4 : 0);
  place(x, y, shape);
}
function layout() {
  frame = 0;
  $('#nav').classList.toggle('scrolled', scrollY > 45);
  if (reduced) return;
  const vh = innerHeight;
  const vw = innerWidth;
  const heroEnd = hero.offsetHeight - vh;
  const progress = clamp(scrollY / heroEnd);
  const open = smooth(progress / 0.66);
  $('.panel-left').style.transform = `translate3d(${-open * vw * 0.51}px,0,0)`;
  $('.panel-right').style.transform = `translate3d(${open * vw * 0.51}px,0,0)`;
  $('.desktop').style.transform = `scale(${mix(1.08, 1, open)})`;
  $('.desktop').style.opacity = String(mix(0.36, 1, open));
  $('.word-kana').style.transform = `translateX(${-progress * vw * 0.24}px)`;
  $('.word-de').style.transform = `translateX(${progress * vw * 0.24}px)`;
  $('.hero-wordmark').style.transform = `translateX(-50%) scale(${1 + progress * 0.08})`;
  $('.hero-wordmark').style.opacity = String(1 - progress * 0.55);
  $('.hero-wordmark').style.letterSpacing = `${mix(0.015, -0.055, progress)}em`;
  $('.hero-intro').style.opacity = String(1 - clamp(progress * 3));
  $('.scroll-cue').style.opacity = String(1 - clamp(progress * 3));
  $('.hero-track').style.opacity = String(clamp(progress * 4));
  $('.hero-track i').style.transform = `translateX(${progress * 400}%)`;
  document.querySelectorAll<HTMLElement>('.desktop-window').forEach((node) => {
    node.style.opacity = String(clamp((progress - 0.2) * 2.5) * 0.7);
  });
  $('.desktop-privacy').style.opacity = String(clamp((progress - 0.65) * 4));
  const stateIndex = heroSteps.reduce(
    (chosen, step, i) => (progress >= step.at - 0.035 ? i : chosen),
    0,
  );
  $('#hero-state').textContent = heroSteps[stateIndex].label;
  $('.coordinate-left').textContent = `[ 0${stateIndex + 1} / 05 ]`;
  document.querySelectorAll('.hero-track span').forEach((node, i) => {
    node.classList.toggle('active', i === stateIndex);
  });
  const heroY = mix(clamp(vh * 0.19, 138, 200), vh * 0.42, smooth(progress));
  const demoPoint = anchor(demo);
  const demoStart = docTop(experience) - vh * 0.25;
  const demoEnd = demoPoint.y - Math.max(vh * 0.3, sizes[scenario].height / 2 + 80);
  const demoArrival = { x: demoPoint.x, y: Math.min(demoPoint.y, demoStart + vh * 0.78) };
  const splitStart = docTop(splitSection);
  const splitEnd = splitStart + splitSection.offsetHeight - vh;
  const splitY = splitAnchor.offsetTop + splitAnchor.offsetHeight / 2;
  const footerPoint = anchor(footerAnchor);
  const footerEnd = document.documentElement.scrollHeight - vh;
  const footerStart = Math.min(docTop(footerWrap) - vh + 100, footerEnd - 1);
  if (scrollY <= heroEnd) {
    setContext('hero');
    let from = 0;
    for (let i = 0; i < heroSteps.length - 1; i++) if (progress >= heroSteps[i].at) from = i;
    const t = clamp(
      (progress - heroSteps[from].at) / (heroSteps[from + 1].at - heroSteps[from].at),
    );
    const fade = smooth(clamp((t - 0.4) / 0.2));
    heroLayers.forEach((node, i) => {
      node.style.opacity = String(i === from ? 1 - fade : i === from + 1 ? fade : 0);
    });
    place(vw / 2, heroY, heroGeometry(progress));
  } else if (scrollY < demoStart) {
    bridge(
      heroEnd,
      demoStart,
      { x: vw / 2, y: heroEnd + vh * 0.42 },
      demoArrival,
      splitGeometry,
      sizes[scenario],
    );
  } else if (scrollY <= demoEnd) {
    setContext('demo');
    place(demoPoint.x, Math.min(demoPoint.y - scrollY, vh * 0.78), sizes[scenario]);
  } else if (scrollY < splitStart) {
    bridge(
      demoEnd,
      splitStart,
      demoPoint,
      { x: vw / 2, y: splitStart + splitY },
      sizes[scenario],
      compactGeometry,
    );
  } else if (scrollY <= splitEnd) {
    setContext('split');
    const p = smooth(clamp((scrollY - splitStart) / Math.max(1, splitEnd - splitStart)));
    place(vw / 2, splitY, blendGeometry(compactGeometry, splitGeometry, p));
    $('.split-interactive').style.setProperty('--split-progress', String(p));
    const timerButton = $<HTMLButtonElement>('.split-timer-button');
    timerButton.inert = p < 0.6;
    $('.primary-annotation').style.transform = `translateX(${-p * 35}px)`;
    $('.satellite-annotation').style.transform = `translateX(${p * 35}px)`;
  } else if (scrollY < footerStart) {
    bridge(
      splitEnd,
      footerStart,
      { x: vw / 2, y: splitEnd + splitY },
      footerPoint,
      splitGeometry,
      rest,
    );
  } else {
    setContext('footer');
    morphFooter(clamp((scrollY - footerStart) / Math.max(1, footerEnd - footerStart)), footerPoint);
  }
  const markProgress = clamp((scrollY - heroEnd) / vh);
  $('.philosophy-mark').style.transform = `translateY(${markProgress * -35}px)`;
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(layout);
}
function applyMotionPreference() {
  reduced = motionPreference.matches;
  document.documentElement.classList.toggle('reduced-motion', reduced);
  if (reduced) {
    setContext('demo');
    island.style.cssText = '';
    island.style.width = `${sizes[scenario].width}px`;
    island.style.height = 'auto';
    layers.style.display = 'none';
  }
  schedule();
}
function chooseScenario(next: Scenario) {
  scenario = next;
  document.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.scenario === next));
  });
  setContext('demo');
  island.classList.add('interacting');
  renderScenario();
  announce(`${next === 'wifi' ? 'Wi-Fi' : next} demonstration selected.`);
  if (reduced) {
    island.style.width = `${sizes[next].width}px`;
    island.style.height = 'auto';
  } else schedule();
}
document.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((button) => {
  button.addEventListener('click', () => chooseScenario(button.dataset.scenario as Scenario));
});

function preserveFocusRender() {
  const focused = document.activeElement as HTMLElement | null;
  const action = focused?.dataset.action;
  renderScenario();
  if (action)
    content.querySelector<HTMLElement>(`[data-action="${action}"]`)?.focus({ preventScroll: true });
}
function stopTimerInterval() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}
function tickTimer() {
  if (!timerDeadline) return;
  timerRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
  const display = document.querySelector('#timer-value');
  if (display) display.textContent = time(timerRemaining);
  if (timerRemaining === 0) {
    timerDeadline = null;
    stopTimerInterval();
    if (scenario === 'timer' && context === 'demo') preserveFocusRender();
    announce('Timer complete.');
  }
}
function startTimer() {
  if (timerRemaining === 0) timerRemaining = timerDuration;
  timerDeadline = Date.now() + timerRemaining * 1000;
  stopTimerInterval();
  timerInterval = setInterval(tickTimer, 1000);
}
content.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'launcher-query') {
    query = input.value;
    updateSearch();
    return;
  }
  const value = Number(input.value);
  if (input.dataset.range === 'progress') {
    playback = value;
    $('#elapsed').textContent = time(value);
  }
  if (input.dataset.range === 'volume') {
    volume = value;
    $('#volume-value').textContent = `${value}%`;
  }
  if (input.dataset.range === 'brightness') {
    brightness = value;
    $('#brightness-value').textContent = `${value}%`;
  }
});
content.addEventListener('keydown', (event) => {
  if (
    event.target instanceof HTMLInputElement &&
    event.target.id === 'launcher-query' &&
    (event.key === 'Enter' || event.key === 'ArrowDown')
  ) {
    const first = content.querySelector<HTMLButtonElement>('[data-app]');
    if (first) {
      event.preventDefault();
      if (event.key === 'Enter') first.click();
      else first.focus();
    }
  }
});
content.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'play') {
    playing = !playing;
    button.innerHTML = icon(playing ? 'pause' : 'play');
    button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} playback`);
    announce(`Sample playback ${playing ? 'playing' : 'paused'}. No audio is played.`);
  } else if (action === 'previous' || action === 'next') {
    selectedTrack = (selectedTrack + (action === 'next' ? 1 : 2)) % tracks.length;
    playback = 0;
    preserveFocusRender();
    announce(`Sample track: ${tracks[selectedTrack]}.`);
  } else if (action === 'timer') {
    if (timerDeadline) {
      tickTimer();
      timerDeadline = null;
      stopTimerInterval();
    } else startTimer();
    preserveFocusRender();
    announce(timerDeadline ? 'Timer started.' : 'Timer paused.');
  } else if (action === 'reset-timer') {
    timerDeadline = null;
    stopTimerInterval();
    timerRemaining = timerDuration;
    preserveFocusRender();
    announce('Timer reset.');
  } else if (button.dataset.minutes) {
    timerDuration = Number(button.dataset.minutes) * 60;
    timerRemaining = timerDuration;
    timerDeadline = null;
    stopTimerInterval();
    renderScenario();
    content
      .querySelector<HTMLButtonElement>(`[data-minutes="${button.dataset.minutes}"]`)
      ?.focus({ preventScroll: true });
    announce(`Timer set to ${button.dataset.minutes} minutes.`);
  } else if (['dnd', 'microphone', 'wifi', 'bluetooth'].includes(action ?? '')) {
    if (action === 'dnd') dnd = !dnd;
    if (action === 'microphone') microphone = !microphone;
    if (action === 'wifi') wifi = !wifi;
    if (action === 'bluetooth') bluetooth = !bluetooth;
    preserveFocusRender();
    announce(
      `${button.getAttribute('aria-label')} ${button.getAttribute('aria-checked') === 'true' ? 'off' : 'on'} in this demo.`,
    );
  } else if (action === 'restore-notifications') {
    notificationIds = [1, 2];
    renderScenario();
    content.querySelector<HTMLButtonElement>('[data-dismiss]')?.focus({ preventScroll: true });
    announce('Sample notifications restored.');
  } else if (button.dataset.dismiss) {
    notificationIds = notificationIds.filter((id) => id !== Number(button.dataset.dismiss));
    renderScenario();
    content
      .querySelector<HTMLButtonElement>('[data-dismiss], [data-action="restore-notifications"]')
      ?.focus({ preventScroll: true });
    announce('Sample notification dismissed.');
  } else if (button.dataset.network) {
    connectedNetwork = button.dataset.network;
    renderScenario();
    content
      .querySelector<HTMLButtonElement>('[data-action="wifi"]')
      ?.focus({ preventScroll: true });
    announce(`Connected to sample network ${connectedNetwork}. No system settings changed.`);
  } else if (button.dataset.device) {
    connectedDevice = connectedDevice === button.dataset.device ? '' : button.dataset.device;
    renderScenario();
    content
      .querySelector<HTMLButtonElement>('[data-action="bluetooth"]')
      ?.focus({ preventScroll: true });
    announce(
      connectedDevice ? `Connected to sample ${connectedDevice}.` : 'Sample device disconnected.',
    );
  } else if (button.dataset.app) {
    announce(`${button.dataset.app} selected. This browser demo does not launch desktop apps.`);
    const detail = button.querySelector('small');
    if (detail) detail.textContent = 'Demo selected';
  } else if (button.dataset.focus) {
    splitFocus = button.dataset.focus;
    content.querySelectorAll<HTMLButtonElement>('[data-focus]').forEach((item) => {
      item.setAttribute('aria-pressed', String(item.dataset.focus === splitFocus));
    });
    announce(`${splitFocus} segment focused.`);
  }
});

const menuButton = $<HTMLButtonElement>('.menu-button');
const navLinks = $('#nav-links');
function closeMenu() {
  navLinks.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
}
menuButton.addEventListener('click', () => {
  const open = !navLinks.classList.contains('open');
  navLinks.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', `${open ? 'Close' : 'Open'} navigation`);
});
navLinks.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('a')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navLinks.classList.contains('open')) {
    closeMenu();
    menuButton.focus();
  }
});
$<HTMLButtonElement>('[data-action="copy"]').addEventListener('click', async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  try {
    await navigator.clipboard.writeText('git clone https://github.com/0x1d1e/kanade');
    button.innerHTML = icon('check');
    button.setAttribute('aria-label', 'Clone command copied');
    announce('Clone command copied.');
  } catch {
    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents($('.clone-command code'));
    selection?.removeAllRanges();
    selection?.addRange(range);
    button.innerHTML = 'Copy';
    button.setAttribute('aria-label', 'Command selected. Copy manually.');
    announce('Clipboard unavailable. Command selected; use your keyboard or browser menu to copy.');
  }
});

// One initial render, then frames only when scroll or layout changes.
document.documentElement.classList.add('enhanced');
motionPreference.addEventListener('change', applyMotionPreference);
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule);
new ResizeObserver(schedule).observe(document.body);
addEventListener('pagehide', stopTimerInterval);
addEventListener('pageshow', () => {
  updateClock();
  if (timerDeadline && !timerInterval) {
    tickTimer();
    timerInterval = setInterval(tickTimer, 1000);
  }
});
document.fonts.ready.then(schedule);
applyMotionPreference();
layout();
