// HTML + plain-text rendering of the digest email.
//
// Design rules (see README "Accessibility"):
//  - Follows the reader's theme: light by default, dark via `prefers-color-scheme`.
//  - Never pure white or transparent: both palettes are tinted, every block sets an
//    explicit background AND text color (clients may invert or force their own mode).
//  - Every color pair has a contrast ratio >= 4.5:1 (WCAG AA), checked in tests.
//  - Tag names are always written out; color is decoration, never the only signal.
//  - Single fluid column: images and cards use 100% width, so it works on phones.

export const LIGHT = {
  page: '#e2e8f0',
  card: '#f1f5f9',
  text: '#0f172a',
  muted: '#334155',
  link: '#690014', // DEFAULT_ACCENT
  border: '#cbd5e1',
};

export const DARK = {
  page: '#0f172a',
  card: '#1e293b',
  text: '#f1f5f9',
  muted: '#cbd5e1',
  link: '#bc8c95', // accentColors(DEFAULT_ACCENT).dark
  border: '#334155',
};

// Pill palette: [background, foreground]. Pastel backgrounds with dark text, same in both themes.
export const TAG_PALETTE = [
  ['#fca5a5', '#0f172a'],
  ['#fdba74', '#0f172a'],
  ['#fde047', '#0f172a'],
  ['#bef264', '#0f172a'],
  ['#86efac', '#0f172a'],
  ['#5eead4', '#0f172a'],
  ['#7dd3fc', '#0f172a'],
  ['#a5b4fc', '#0f172a'],
  ['#d8b4fe', '#0f172a'],
  ['#f9a8d4', '#0f172a'],
];

const HASH_OPACITY = 0.8;

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex) {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two #rrggbb colors. */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `fg` at `alpha` opacity over `bg`, as a solid color. Mail clients support
 * `opacity` unevenly, a precomputed solid color renders the same everywhere.
 */
export function blend(fg, bg, alpha) {
  const [f, b] = [rgb(fg), rgb(bg)];
  const mix = f.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Color of the "#" in front of a tag name (80% opacity of the pill's text color). */
export function hashColor([bg, fg]) {
  return blend(fg, bg, HASH_OPACITY);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const QUOTES = /["\u201C\u201D\u201E\u00AB\u00BB]/g;

/** Descriptions never carry quotation marks: strips straight/curly/French double quotes. */
export function cleanSummary(value) {
  return String(value ?? '')
    .replace(QUOTES, '')
    .replace(/^\s*['\u2018\u2019]+|['\u2018\u2019]+\s*$/g, '')
    .trim();
}

/** Escapes text, then turns `**important**` into <strong>. Stray markers are dropped. */
export function formatSummary(value) {
  return escapeHtml(cleanSummary(value))
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*\*/g, '');
}

const stripEmphasis = (value) => cleanSummary(value).replace(/\*\*/g, '');

/** Returns the URL if it is a valid https URL, otherwise ''. */
export function safeUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

export const UTM_SOURCE = 'github-devto-digest-thomasbnt';

/** Adds `utm_source` to a link so click origins are identifiable. Returns '' for an empty or invalid URL. */
export function withUtm(value) {
  const href = safeUrl(value);
  if (!href) return '';
  const u = new URL(href);
  u.searchParams.set('utm_source', UTM_SOURCE);
  return u.href;
}

/** Deterministic pill colors for a tag name. */
export function tagColors(tag) {
  let h = 0;
  for (const ch of String(tag)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

/** dev.to returns tags as an array, or as a comma separated string depending on the endpoint. */
export function articleTags(article) {
  const raw = article.tag_list ?? article.tags ?? [];
  const list = Array.isArray(raw) ? raw : String(raw).split(',');
  return list.map((t) => String(t).trim()).filter(Boolean);
}

export const DEFAULT_ACCENT = '#690014';

/** `#rgb` or `#rrggbb` (any case) as lowercase `#rrggbb`, or null when it is not a hex color. */
export function normalizeHex(value) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${hex.toLowerCase()}`;
}

/** Nudges `color` toward `toward` until it reaches 4.5:1 (WCAG AA) on every background. */
function readable(color, backgrounds, toward) {
  for (let step = 0; step <= 20; step++) {
    const candidate = blend(toward, color, step / 20);
    if (backgrounds.every((bg) => contrastRatio(candidate, bg) >= 4.5)) return candidate;
  }
  return toward;
}

/** Accent color for links and headings in both themes. Any hex stays readable: it is darkened or lightened as needed. */
export function accentColors(hex = DEFAULT_ACCENT) {
  const base = normalizeHex(hex) ?? DEFAULT_ACCENT;
  return {
    light: readable(base, [LIGHT.page, LIGHT.card], '#000000'),
    dark: readable(base, [DARK.page, DARK.card], '#ffffff'),
  };
}

export const PROJECT_URL = 'https://github.com/thomasbnt/your-devto-digest';

export const MAX_TAGS = 2;

export const DEFAULT_TITLE = 'Your dev.to digest {date}';

export function formatTitle(template, date) {
  return String(template || DEFAULT_TITLE).replaceAll('{date}', date.toISOString().slice(0, 10));
}

const FONT_CDN = 'https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@5.2.10';
const FONT = "font-family:'Space Grotesk',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

// Space Grotesk from jsDelivr (Fontsource), pinned version. Clients that block remote
// fonts (Gmail, Outlook) fall back to the system stack in FONT.
const FONT_FACES = [400, 500, 600, 700]
  .map(
    (w) =>
      `@font-face{font-family:'Space Grotesk';font-style:normal;font-weight:${w};font-display:swap;` +
      `src:url(${FONT_CDN}/latin-${w}-normal.woff2) format('woff2')}`,
  )
  .join('\n');

// Inline styles carry the light theme. The classes let the <style> block below swap in
// the dark theme (and tighten spacing on small screens) in clients that support it.
const styleBlock = (darkLink) => `<style>
${FONT_FACES}
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme:dark){
.bg-page{background-color:${DARK.page}!important}
.bg-card{background-color:${DARK.card}!important}
.tx{color:${DARK.text}!important}
.mu{color:${DARK.muted}!important}
.lk{color:${darkLink}!important}
.bd{border-color:${DARK.border}!important}
}
@media (max-width:649px){
.col{display:block!important;width:100%!important;box-sizing:border-box!important}
.img-col{padding:12px 12px 0 12px!important}
}
@media (max-width:480px){
.pad-page{padding:8px!important}
.pad-card{padding:12px!important}
.h1{font-size:20px!important;line-height:28px!important}
}
@media (min-width:650px){
.wrap{max-width:900px!important}
.img-col{width:40%!important}
.txt-col{width:60%!important}
}
@media (min-width:1200px){
.wrap{max-width:1100px!important}
.grid{display:flex!important;flex-wrap:wrap;justify-content:space-between}
.cell{width:49%!important;box-sizing:border-box}
.cell table{height:100%}
.col{display:block!important;width:100%!important;box-sizing:border-box!important}
.img-col{padding:12px 12px 0 12px!important}
}
</style>`;

function pill(tag) {
  const colors = tagColors(tag);
  const [bg, fg] = colors;
  return (
    `<span style="display:inline-block;background-color:${bg};color:${fg};` +
    `font-size:14px;line-height:20px;font-weight:600;padding:2px 8px;border-radius:5px;margin:0 4px 4px 0;">` +
    `<span style="color:${hashColor(colors)};">#</span>${escapeHtml(tag)}</span>`
  );
}

function authorUrl(user) {
  const username = user?.username;
  return typeof username === 'string' && /^[A-Za-z0-9_]+$/.test(username) ? withUtm(`https://dev.to/${username}`) : null;
}

function card({ article, summary }, link) {
  const url = withUtm(article.url);
  // Only a real cover image: `social_image` is the auto-generated dev.to preview (title, author, DEV logo).
  const cover = safeUrl(article.cover_image);
  const avatar = safeUrl(article.user?.profile_image_90);
  const authorName = article.user?.name || article.user?.username || 'Unknown author';
  const tags = articleTags(article).slice(0, MAX_TAGS);
  const reactions = article.positive_reactions_count ?? article.public_reactions_count ?? 0;
  const meta = [`${reactions} reactions`, article.reading_time_minutes ? `${article.reading_time_minutes} min read` : '']
    .filter(Boolean)
    .join(' · ');

  // Image on the left (1/3 of the card) when there is one, text takes the rest (2/3).
  // Without an image the text uses the full width. On small screens the two stack.
  const imageCell = cover
    ? `<td class="col img-col bg-card" width="33%" valign="top" bgcolor="${LIGHT.card}" ` +
      `style="width:33%;background-color:${LIGHT.card};border-radius:5px 0 0 5px;padding:12px 0 12px 12px;font-size:0;line-height:0;">` +
      `<a href="${escapeHtml(url)}"><img src="${escapeHtml(cover)}" width="190" alt="${escapeHtml(article.title)}" ` +
      `style="display:block;width:100%;height:auto;border:0;border-radius:5px;"></a></td>`
    : '';

  const avatarImg = avatar
    ? `<img src="${escapeHtml(avatar)}" width="20" height="20" alt="" ` +
      `style="vertical-align:middle;border:0;border-radius:5px;margin-right:6px;">`
    : '';

  const profile = authorUrl(article.user);
  // The name carries the `lk` class too: its inline color would otherwise beat the dark-theme color set on the <a>.
  const author = `${avatarImg}<strong${profile ? ' class="lk"' : ''} style="color:${profile ? link : LIGHT.text};">${escapeHtml(authorName)}</strong>`;
  const authorHtml = profile
    ? `<a class="lk" href="${escapeHtml(profile)}" style="color:${link};text-decoration:none;">${author}</a>`
    : author.replace('<strong style=', '<strong class="tx" style=');

  const textWidth = cover ? '67%' : '100%';

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-card bd" ` +
    `bgcolor="${LIGHT.card}" style="background-color:${LIGHT.card};border:1px solid ${LIGHT.border};border-collapse:separate;border-spacing:0;border-radius:5px;overflow:hidden;margin:0;">` +
    `<tr>${imageCell}` +
    `<td class="col txt-col bg-card pad-card tx" width="${textWidth}" valign="top" bgcolor="${LIGHT.card}" ` +
    `style="width:${textWidth};background-color:${LIGHT.card};border-radius:${cover ? '0 5px 5px 0' : '5px'};padding:12px 16px;${FONT}color:${LIGHT.text};">` +
    `<h3 style="margin:0 0 10px 0;font-size:20px;line-height:26px;">` +
    `<a class="lk" href="${escapeHtml(url)}" style="color:${link};text-decoration:none;">${escapeHtml(article.title)}</a></h3>` +
    (tags.length ? `<div style="margin:0 0 12px 0;">${tags.map(pill).join('')}</div>` : '') +
    (summary
      ? `<p class="tx" style="margin:0 0 12px 0;font-size:16px;line-height:24px;font-weight:500;color:${LIGHT.text};">${formatSummary(summary)}</p>`
      : '') +
    `<p class="mu" style="margin:0;font-size:14px;line-height:20px;color:${LIGHT.muted};">` +
    `${authorHtml} · ${escapeHtml(meta)}</p>` +
    `</td></tr></table>`
  );
}

const TAGS_URL = withUtm('https://dev.to/tags');
const PROJECT_LINK = withUtm(PROJECT_URL);
const INTRO = {
  'For you': {
    text: `Based on the tags you follow. Edit them on dev.to/tags: ${TAGS_URL}`,
    html: (link) =>
      `Based on the tags you follow. Edit them on <a class="lk" href="${TAGS_URL}" style="color:${link};text-decoration:none;">dev.to/tags</a>.`,
  },
  Discover: {
    text: 'Popular posts outside your usual tags.',
    html: () => 'Popular posts outside your usual tags.',
  },
};

function section(title, items, link) {
  if (!items.length) return '';
  return (
    `<h2 class="lk" style="margin:20px 0 4px 0;font-size:18px;line-height:26px;text-transform:uppercase;letter-spacing:0.5px;color:${link};${FONT}">${escapeHtml(title)}</h2>` +
    `<p class="mu" style="margin:0 0 12px 0;font-size:14px;line-height:20px;color:${LIGHT.muted};">${INTRO[title].html(link)}</p>` +
    `<div class="grid">${items.map((item) => `<div class="cell" style="margin:0 0 12px 0;">${card(item, link)}</div>`).join('')}</div>`
  );
}

/**
 * @param {{forYou: Array, discover: Array, title?: string, date?: Date, accentColor?: string}} input
 * items are `{ article, summary }`. `title` may contain `{date}`.
 */
export function renderDigest({ forYou, discover, title = DEFAULT_TITLE, date = new Date(), accentColor = DEFAULT_ACCENT }) {
  const accent = accentColors(accentColor);
  const subject = formatTitle(title, date);
  const preheader = `${forYou.length} picks for you, ${discover.length} to discover.`;

  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">` +
    `<title>${escapeHtml(subject)}</title>${styleBlock(accent.dark)}</head>` +
    `<body class="bg-page" bgcolor="${LIGHT.page}" style="margin:0;padding:0;background-color:${LIGHT.page};color:${LIGHT.text};">` +
    `<div style="display:none;max-height:0;overflow:hidden;color:${LIGHT.page};">${escapeHtml(preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" bgcolor="${LIGHT.page}" style="background-color:${LIGHT.page};">` +
    `<tr><td align="center" class="bg-page pad-page" bgcolor="${LIGHT.page}" style="background-color:${LIGHT.page};padding:16px;">` +
    `<table role="presentation" class="wrap" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;"><tr>` +
    `<td class="bg-page tx" bgcolor="${LIGHT.page}" style="background-color:${LIGHT.page};${FONT}color:${LIGHT.text};">` +
    `<h1 class="h1 lk" style="margin:0;font-size:24px;line-height:32px;text-transform:uppercase;letter-spacing:0.5px;color:${accent.light};">${escapeHtml(subject)}</h1>` +
    section('For you', forYou, accent.light) +
    section('Discover', discover, accent.light) +
    `<p class="mu" style="margin:16px 0 0 0;font-size:14px;line-height:20px;text-align:center;color:${LIGHT.muted};">` +
    `Generated by <a class="lk" href="${PROJECT_LINK}" style="color:${accent.light};text-decoration:none;">devto-digest</a>. ` +
    `Summaries are written by an LLM and may be imperfect.</p>` +
    `</td></tr></table></td></tr></table></body></html>`;

  const textItem = ({ article, summary }) =>
    [
      article.title,
      articleTags(article)
        .slice(0, MAX_TAGS)
        .map((t) => `#${t}`)
        .join(' '),
      summary ? stripEmphasis(summary) : null,
      `By ${article.user?.name || article.user?.username || 'unknown'}${authorUrl(article.user) ? ` (${authorUrl(article.user)})` : ''} · ${article.positive_reactions_count ?? 0} reactions`,
      withUtm(article.url),
    ]
      .filter(Boolean)
      .join('\n');

  const textSection = (name, items) =>
    items.length ? `${name}\n${'='.repeat(name.length)}\n${INTRO[name].text}\n\n${items.map(textItem).join('\n\n')}\n` : '';

  const text = [subject, '', textSection('For you', forYou), textSection('Discover', discover), `Generated by devto-digest: ${PROJECT_LINK}`]
    .filter((s) => s !== '')
    .join('\n');

  return { subject, html, text };
}
