const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const root = document.documentElement;
const desktop = $('#desktop');
const intro = $('#intro');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const touchInput = matchMedia('(pointer: coarse)');
const STORAGE = 'jz-desktop-preferences-v1';
let config = {
  name: 'James',
  subtitle: 'Electrical Engineering @ University of Waterloo',
  spotify: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO',
  quotes: [{ text: 'If the climb feels overwhelming and you begin to doubt your intellect, your choices, or your capacity, remember this: struggle does not disqualify you from greatness — it is the prerequisite shared by everyone who ever reached the summit.', author: 'Christina Koch' }],
};
let quotes = config.quotes;
let quoteIndex = 0;
let spotifyUrl = config.spotify;
let textured = true;
let toastTimer;
let previewReady = false;
let musicLoaded = false;
let desktopEntered = false;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3800);
}

function savePreferences() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify({ quotes, spotify: spotifyUrl, textured }));
    return true;
  } catch {
    toast('Changed for this visit. Browser storage is unavailable.');
    return false;
  }
}

function parseSpotify(value) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || url.username || url.password || url.port) return null;
    const match = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{22})\/?$/);
    if (!match) return null;
    return { url: `https://open.spotify.com/${match[1]}/${match[2]}`, embed: `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0` };
  } catch { return null; }
}

function validQuotes(value) {
  return Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every(q => q && typeof q.text === 'string' && q.text.trim() && q.text.length <= 1200 && typeof q.author === 'string' && q.author.length <= 100);
}

function renderQuote() {
  quoteIndex = Math.max(0, Math.min(quoteIndex, quotes.length - 1));
  const quote = quotes[quoteIndex];
  $('#quote-text').textContent = quote.text;
  $('#quote-author').textContent = quote.author ? `— ${quote.author}` : '— A personal note';
  $('#quote-count').textContent = `${String(quoteIndex + 1).padStart(2, '0')} / ${String(quotes.length).padStart(2, '0')}`;
  $('#prev-quote').disabled = quotes.length < 2;
  $('#next-quote').disabled = quotes.length < 2;
  if (previewReady) buildPreview();
}

function renderSpotify(force = false) {
  if (musicLoaded && !force) return;
  const source = parseSpotify(spotifyUrl);
  if (!source) return;
  musicLoaded = true;
  const frame = document.createElement('iframe');
  frame.src = source.embed;
  frame.title = 'James’s desktop soundtrack on Spotify';
  frame.width = '100%';
  frame.height = '152';
  frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.loading = 'lazy';
  $('#spotify-container').replaceChildren(frame);
  $('#spotify-external').href = source.url;
}

function buildPreview() {
  const clone = desktop.cloneNode(true);
  clone.className = 'desktop preview-desktop';
  clone.removeAttribute('style');
  clone.setAttribute('aria-hidden', 'true');
  clone.inert = true;
  $$('[id]', clone).forEach(el => el.removeAttribute('id'));
  clone.removeAttribute('id');
  $$('.dock,.dropdown', clone).forEach(el => el.remove());
  $$('.window', clone).forEach(el => { el.classList.remove('is-minimized', 'dragging'); el.removeAttribute('style'); });
  const music = $('.spotify-container', clone);
  music.replaceChildren();
  const previewMusic = document.createElement('div');
  previewMusic.className = 'preview-music';
  // This is our own decorative mini-player, never a simulated Spotify control.
  previewMusic.innerHTML = '<div class="preview-record"></div><div><strong>A little background music.</strong><p>A soundtrack for this corner of the internet.</p></div><div class="preview-play">♫</div>';
  music.append(previewMusic);
  $('#screen-preview').replaceChildren(clone);
  previewReady = true;
  fitPreview();
}

function fitPreview() {
  const screen = $('.screen');
  $('#screen-preview').style.transform = `scale(${screen.clientWidth / 1100},${screen.clientHeight / 750})`;
}

const keys = ['esc','1','2','3','4','5','6','7','8','9','0','−','=','⌫','⇥','Q','W','E','R','T','Y','U','I','O','P','[',']','\\','⇪','A','S','D','F','G','H','J','K','L',';','\'','↵','↵','⇧','Z','X','C','V','B','N','M',',','.','/','⇧','↑','↑','fn','⌃','⌥','⌘','SPACE','⌘','⌥','←','↓','→'];
keys.forEach(key => {
  const element = document.createElement('div');
  element.className = key === 'SPACE' ? 'key space' : 'key';
  element.textContent = key === 'SPACE' ? '' : key;
  $('#keyboard').append(element);
});

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, p) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };
let scrollEnd = 0;
let progress = 0;
let target = 0;
let frameId = 0;
let screenWidth = 700;
let screenHeight = 440;
let viewportHeight = innerHeight;

function measureScene() {
  viewportHeight = innerHeight;
  scrollEnd = Math.max(1, intro.offsetHeight - $('.intro-sticky').offsetHeight);
  screenWidth = $('.screen').clientWidth || 700;
  screenHeight = $('.screen').clientHeight || 440;
  fitPreview();
  onScroll();
}

function setDesktopActive(active) {
  document.body.classList.toggle('desktop-active', active);
  desktop.inert = !active;
  if (active && !desktopEntered) { desktopEntered = true; renderSpotify(); }
}

function animateScene() {
  frameId = 0;
  if (reducedMotion.matches) {
    desktop.style.transform = '';
    intro.classList.add('is-complete');
    setDesktopActive(true);
    return;
  }
  progress += (target - progress) * .18;
  if (Math.abs(target - progress) < .0001) progress = target;
  const open = smooth(.015, .58, progress);
  const zoom = smooth(.56, .97, progress);
  const cover = Math.max(innerWidth / screenWidth, viewportHeight / screenHeight) * 1.08;
  const scale = .83 + zoom * (cover - .83);
  root.style.setProperty('--lid-angle', `${-96 + open * 96}deg`);
  root.style.setProperty('--model-scale', scale.toFixed(5));
  root.style.setProperty('--model-y', `${(1 - open) * viewportHeight * .015 - (innerWidth <= 600 ? zoom * viewportHeight * .05 : 0)}px`);
  root.style.setProperty('--copy-opacity', 1 - smooth(.015, .24, progress));
  root.style.setProperty('--hint-opacity', 1 - smooth(.06, .27, progress));
  root.style.setProperty('--hint-visible', progress > .29 ? 'hidden' : 'visible');
  root.style.setProperty('--screen-light', smooth(.13, .39, progress));
  root.style.setProperty('--deck-opacity', 1 - smooth(.58, .78, progress));
  root.style.setProperty('--progress', progress.toFixed(5));
  $('.intro-sticky').style.opacity = 1 - smooth(.86, .998, progress);
  const complete = target >= .999 && progress > .996;
  intro.classList.toggle('is-complete', complete);
  $('.intro-nav').style.opacity = 1 - smooth(.25, .5, progress);
  $('.intro-nav').style.visibility = progress > .52 ? 'hidden' : 'visible';
  // Hold the real desktop behind the zoom until its natural scroll position catches up.
  desktop.style.transform = target > .80 && scrollY < scrollEnd ? `translateY(${scrollY - scrollEnd}px)` : '';
  setDesktopActive(target >= .995);
  if (Math.abs(target - progress) > .0001) frameId = requestAnimationFrame(animateScene);
}

function onScroll() {
  target = reducedMotion.matches ? 1 : clamp(scrollY / scrollEnd);
  if (!frameId) frameId = requestAnimationFrame(animateScene);
}

function enterDesktop(event) {
  event?.preventDefault();
  scrollTo({ top: reducedMotion.matches ? 0 : scrollEnd, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  // Wait for smooth scrolling to complete before placing keyboard focus.
  const started = performance.now();
  const focusWhenReady = () => {
    if (reducedMotion.matches || Math.abs(scrollY - scrollEnd) < 3) {
      setDesktopActive(true);
      desktop.focus({ preventScroll: true });
    } else if (performance.now() - started < 2200) requestAnimationFrame(focusWhenReady);
  };
  requestAnimationFrame(focusWhenReady);
}

$$('[data-enter]').forEach(button => button.addEventListener('click', enterDesktop));
$('.scroll-label').textContent = touchInput.matches ? 'SWIPE UP TO OPEN' : 'SCROLL TO OPEN';
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', measureScene, { passive: true });
reducedMotion.addEventListener('change', () => {
  measureScene();
  if (reducedMotion.matches) scrollTo({ top: 0, behavior: 'instant' });
  else { progress = 0; intro.classList.remove('is-complete'); }
});

// Pointer capture keeps a drag stable outside its handle. Only the handle blocks touch panning.
let topWindow = 2;
const springs = new Map();
function springHome(win, x, y, rotate) {
  if (springs.has(win)) cancelAnimationFrame(springs.get(win));
  if (reducedMotion.matches) { win.style.transform = ''; return; }
  let vx = 0, vy = 0, last = performance.now();
  function step(time) {
    const dt = Math.min((time - last) / 1000, .032);
    last = time;
    vx += (-280 * x - 25 * vx) * dt;
    vy += (-280 * y - 25 * vy) * dt;
    x += vx * dt;
    y += vy * dt;
    rotate *= Math.exp(-12 * dt);
    win.style.transform = `translate3d(${x}px,${y}px,0) rotate(${rotate}deg)`;
    if (Math.abs(x) + Math.abs(y) + Math.abs(vx) + Math.abs(vy) < .25) {
      win.style.transform = '';
      win.style.willChange = '';
      springs.delete(win);
    } else springs.set(win, requestAnimationFrame(step));
  }
  springs.set(win, requestAnimationFrame(step));
}

$$('.window', desktop).forEach(win => {
  const handle = $('.titlebar', win);
  let active = null;
  const stop = () => {
    if (!active) return;
    const { x, y, rotation, id } = active;
    active = null;
    win.classList.remove('dragging');
    if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
    springHome(win, x, y, rotation);
  };
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button') || active) return;
    if (springs.has(win)) { cancelAnimationFrame(springs.get(win)); springs.delete(win); }
    event.preventDefault();
    active = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: 0, y: 0, rotation: 0 };
    win.style.transform = '';
    win.style.zIndex = ++topWindow;
    win.style.willChange = 'transform';
    win.classList.add('dragging');
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (!active || active.id !== event.pointerId) return;
    active.x = clamp(event.clientX - active.startX, -innerWidth * .4, innerWidth * .4);
    active.y = clamp(event.clientY - active.startY, -innerHeight * .35, innerHeight * .35);
    active.rotation = reducedMotion.matches ? 0 : clamp(active.x / 110, -2.2, 2.2);
    win.style.transform = `translate3d(${active.x}px,${active.y}px,0) rotate(${active.rotation}deg)`;
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => handle.addEventListener(event, stop));
  handle.addEventListener('keydown', event => {
    if (event.target !== handle || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const x = event.key === 'ArrowLeft' ? -40 : event.key === 'ArrowRight' ? 40 : 0;
    const y = event.key === 'ArrowUp' ? -30 : event.key === 'ArrowDown' ? 30 : 0;
    springHome(win, x, y, x / 80);
  });
});

$$('[data-minimize]', desktop).forEach(button => button.addEventListener('click', () => {
  const name = button.dataset.minimize;
  $(`[data-window="${name}"]`, desktop).classList.add('is-minimized');
  $(`[data-restore="${name}"]`, desktop).focus({ preventScroll: true });
  toast('Window tucked away. Bring it back from the dock.');
}));
$$('[data-restore]', desktop).forEach(button => button.addEventListener('click', () => {
  const win = $(`[data-window="${button.dataset.restore}"]`, desktop);
  win.classList.remove('is-minimized');
  win.style.zIndex = ++topWindow;
  const top = scrollY + win.getBoundingClientRect().top - 75;
  scrollTo({ top: Math.max(reducedMotion.matches ? 0 : scrollEnd, top), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  $('.titlebar', win).focus({ preventScroll: true });
}));

function closeMenus() {
  $$('.menu-trigger').forEach(button => button.setAttribute('aria-expanded', 'false'));
  $$('.dropdown').forEach(menu => menu.hidden = true);
}
$$('.menu-trigger', desktop).forEach(button => button.addEventListener('click', event => {
  event.stopPropagation();
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  closeMenus();
  if (!wasOpen) { button.setAttribute('aria-expanded', 'true'); $(`#${button.getAttribute('aria-controls')}`).hidden = false; }
}));
document.addEventListener('click', event => { if (!event.target.closest('.menu-wrap')) closeMenus(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenus(); });
$$('.dropdown button,.dropdown a').forEach(button => button.addEventListener('click', closeMenus));

function showDialog(id) {
  if (id === 'music-dialog') { $('#spotify-url').value = spotifyUrl; $('#music-error').textContent = ''; }
  if (id === 'quote-dialog') prepareQuoteEditor(quoteIndex);
  closeMenus();
  $(`#${id}`).showModal();
}
$$('[data-dialog]').forEach(button => button.addEventListener('click', () => showDialog(button.dataset.dialog)));
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));

$('#music-form').addEventListener('submit', event => {
  event.preventDefault();
  const source = parseSpotify($('#spotify-url').value);
  if (!source) { $('#music-error').textContent = 'Use a full open.spotify.com link to a song, playlist, album, artist, show, or episode.'; $('#spotify-url').focus(); return; }
  spotifyUrl = source.url;
  renderSpotify(true);
  const saved = savePreferences();
  $('#music-dialog').close();
  if (saved) toast('New soundtrack saved to this browser.');
});

function prepareQuoteEditor(index) {
  const select = $('#quote-select');
  select.replaceChildren();
  quotes.forEach((quote, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${String(i + 1).padStart(2, '0')} · ${quote.text.slice(0, 43)}${quote.text.length > 43 ? '…' : ''}`;
    select.append(option);
  });
  const add = document.createElement('option');
  add.value = 'new';
  add.textContent = '+ Add a new note';
  select.append(add);
  select.value = String(index);
  fillQuoteFields();
}

function fillQuoteFields() {
  const isNew = $('#quote-select').value === 'new';
  const quote = isNew ? { text: '', author: '' } : quotes[Number($('#quote-select').value)];
  $('#quote-input').value = quote.text;
  $('#author-input').value = quote.author;
  $('#delete-quote').disabled = isNew || quotes.length < 2;
}
$('#quote-select').addEventListener('change', fillQuoteFields);
$('#quote-form').addEventListener('submit', event => {
  event.preventDefault();
  const text = $('#quote-input').value.trim();
  if (!text) { $('#quote-input').focus(); return; }
  const quote = { text, author: $('#author-input').value.trim() };
  if ($('#quote-select').value === 'new') {
    if (quotes.length >= 50) { toast('There’s room for 50 notes. Edit or delete one first.'); return; }
    quotes.push(quote); quoteIndex = quotes.length - 1;
  } else { quoteIndex = Number($('#quote-select').value); quotes[quoteIndex] = quote; }
  renderQuote();
  const saved = savePreferences();
  $('#quote-dialog').close();
  if (saved) toast('Note saved to this browser.');
});
$('#delete-quote').addEventListener('click', () => {
  if (quotes.length < 2 || $('#quote-select').value === 'new') return;
  quotes.splice(Number($('#quote-select').value), 1);
  quoteIndex = 0;
  renderQuote();
  savePreferences();
  prepareQuoteEditor(0);
});
$('#prev-quote').addEventListener('click', () => { quoteIndex = (quoteIndex - 1 + quotes.length) % quotes.length; renderQuote(); });
$('#next-quote').addEventListener('click', () => { quoteIndex = (quoteIndex + 1) % quotes.length; renderQuote(); });

$('#share-button').addEventListener('click', async () => {
  const url = new URL(location.href); url.hash = '';
  try { await navigator.clipboard.writeText(url.href); toast('Website link copied. Pass it along.'); }
  catch { toast('Copy the website address from your browser’s address bar.'); }
});
$('#download-config').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ ...config, spotify: spotifyUrl, quotes }, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'config.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Preferences exported. Replace the site’s config.json to share them.');
});
$('#texture-toggle').addEventListener('click', () => {
  textured = !textured;
  desktop.classList.toggle('no-texture', !textured);
  savePreferences();
});
$('#restore-windows').addEventListener('click', () => {
  $$('.window', desktop).forEach(win => win.classList.remove('is-minimized'));
  toast('Everything is back where it belongs.');
});
$('#replay').addEventListener('click', () => {
  if (reducedMotion.matches) { toast('Opening skipped because reduced motion is enabled on your device.'); return; }
  scrollTo({ top: 0, behavior: 'smooth' });
});
$('#trash-button').addEventListener('click', () => toast('The trash is empty. Keeping a little room for good ideas.'));

function updateClock() {
  $('#clock').textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
  $('#clock').dateTime = new Date().toISOString();
}
updateClock();
setInterval(updateClock, 30000);

async function initialize() {
  try {
    const response = location.protocol === 'file:' ? null : await fetch('./config.json');
    if (response?.ok) {
      const supplied = await response.json();
      if (typeof supplied.name === 'string') config.name = supplied.name;
      if (typeof supplied.subtitle === 'string') config.subtitle = supplied.subtitle;
      if (parseSpotify(supplied.spotify ?? '')) config.spotify = supplied.spotify;
      if (validQuotes(supplied.quotes)) config.quotes = supplied.quotes;
    }
  } catch { /* The built-in profile remains usable if configuration cannot be fetched. */ }
  quotes = structuredClone(config.quotes);
  spotifyUrl = config.spotify;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (saved) {
      if (validQuotes(saved.quotes)) quotes = saved.quotes;
      if (parseSpotify(saved.spotify ?? '')) spotifyUrl = saved.spotify;
      if (typeof saved.textured === 'boolean') textured = saved.textured;
    }
  } catch { /* Malformed or unavailable local preferences must never break the desktop. */ }
  $('#display-name').replaceChildren(document.createTextNode(`I’m ${config.name}`));
  const dot = document.createElement('span'); dot.className = 'period'; dot.textContent = '.'; $('#display-name').append(dot);
  $('#profile-subtitle').textContent = config.subtitle;
  desktop.classList.toggle('no-texture', !textured);
  renderQuote();
  buildPreview();
  measureScene();
  if (location.hash === '#desktop') enterDesktop();
}
initialize();
