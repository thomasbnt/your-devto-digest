import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DARK,
  LIGHT,
  TAG_PALETTE,
  blend,
  cleanSummary,
  formatSummary,
  formatTitle,
  hashColor,
  articleTags,
  contrastRatio,
  escapeHtml,
  renderDigest,
  safeUrl,
  tagColors,
  withUtm,
  accentColors,
  normalizeHex,
  DEFAULT_ACCENT,
} from '../render.js';

const article = (over = {}) => ({
  id: 1,
  title: 'Hello <b>world</b>',
  url: 'https://dev.to/a/hello',
  cover_image: 'https://example.com/cover.png',
  tag_list: ['javascript', 'webdev'],
  positive_reactions_count: 42,
  reading_time_minutes: 4,
  user: { name: 'Ada', username: 'ada', profile_image_90: 'https://example.com/a.png' },
  ...over,
});

test('every tag pill pair meets WCAG AA (4.5:1)', () => {
  for (const [bg, fg] of TAG_PALETTE) {
    assert.ok(contrastRatio(bg, fg) >= 4.5, `${bg} on ${fg} = ${contrastRatio(bg, fg).toFixed(2)}`);
  }
});

for (const [name, theme] of [['light', LIGHT], ['dark', DARK]]) {
  test(`${name} theme color pairs meet WCAG AA and avoid pure white`, () => {
    for (const bg of [theme.page, theme.card]) {
      for (const fg of [theme.text, theme.muted, theme.link]) {
        assert.ok(contrastRatio(bg, fg) >= 4.5, `${fg} on ${bg} = ${contrastRatio(bg, fg).toFixed(2)}`);
      }
    }
    for (const color of Object.values(theme)) assert.notEqual(color.toLowerCase(), '#ffffff');
  });
}

test('the "#" before a tag keeps AA contrast at 80% opacity', () => {
  for (const pair of TAG_PALETTE) {
    assert.ok(contrastRatio(pair[0], hashColor(pair)) >= 4.5, `${pair} -> ${hashColor(pair)}`);
  }
  assert.equal(blend('#000000', '#ffffff', 0.8), '#333333');
});

test('formatSummary bolds **key words** safely', () => {
  assert.equal(formatSummary('Uses **local models** now'), 'Uses <strong>local models</strong> now');
  assert.equal(formatSummary('<b>x</b> **ok** **broken'), '&lt;b&gt;x&lt;/b&gt; <strong>ok</strong> broken');
});

test('descriptions never contain quotation marks', () => {
  assert.equal(cleanSummary('\u201CShows **x**\u201D and \u00ABy\u00BB, "z"'), 'Shows **x** and y, z');
  assert.equal(formatSummary('"Quoted" text'), 'Quoted text');
});

test('title is larger than the description and the description has no quote styling', () => {
  const { html } = renderDigest({ forYou: [{ article: article(), summary: 'A **short** blurb' }], discover: [] });
  const size = (re) => Number(html.match(re)[1]);
  assert.ok(size(/<h3[^>]*font-size:(\d+)px/) > size(/<p class="tx"[^>]*font-size:(\d+)px/));
  assert.doesNotMatch(html, /border-left|<blockquote/);
});

test('formatTitle fills {date} and falls back to the default', () => {
  const d = new Date('2026-10-19T00:00:00Z');
  assert.equal(formatTitle('Digest {date}', d), 'Digest 2026-10-19');
  assert.equal(formatTitle('', d), 'Your dev.to digest 2026-10-19');
});

test('contrastRatio matches known values', () => {
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrastRatio('#777777', '#777777').toFixed(1), '1.0');
});

test('tagColors is deterministic and inside the palette', () => {
  assert.deepEqual(tagColors('rust'), tagColors('rust'));
  assert.ok(TAG_PALETTE.some(([bg]) => bg === tagColors('rust')[0]));
});

test('escapeHtml and safeUrl neutralize hostile input', () => {
  assert.equal(escapeHtml(`<img src=x onerror="a">'`), '&lt;img src=x onerror=&quot;a&quot;&gt;&#39;');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('http://insecure.example'), '');
  assert.equal(safeUrl('https://ok.example/x'), 'https://ok.example/x');
});

test('articleTags handles array and comma-separated forms', () => {
  assert.deepEqual(articleTags({ tag_list: ['a', 'b'] }), ['a', 'b']);
  assert.deepEqual(articleTags({ tag_list: 'a, b' }), ['a', 'b']);
  assert.deepEqual(articleTags({}), []);
});

test('rendered email follows the spec: no white, no underline, # tags, full-width image, no tag list', () => {
  const { html, text, subject } = renderDigest({
    forYou: [{ article: article(), summary: 'Because **you** follow <script>alert(1)</script>' }],
    discover: [{ article: article({ id: 2, cover_image: null, social_image: null }), summary: '' }],
    title: 'Weekly {date}',
    date: new Date('2026-10-19T00:00:00Z'),
  });
  assert.equal(subject, 'Weekly 2026-10-19');
  assert.doesNotMatch(html, /#fff(fff)?\b|background(-color)?:\s*white|bgcolor="white"/i);
  assert.doesNotMatch(html, /underline/);
  assert.doesNotMatch(html, /Read on dev\.to/);
  assert.doesNotMatch(html, /following /);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<strong>you<\/strong>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<h1[^>]*text-transform:uppercase/);
  assert.match(html, /<h2[^>]*text-transform:uppercase/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /font-family:'Space Grotesk'/);
  assert.match(html, /@font-face\{font-family:'Space Grotesk'[^}]*cdn\.jsdelivr\.net\/fontsource\/fonts\/space-grotesk@5\.2\.10\/latin-400-normal\.woff2/);
  assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.match(html, /max-width:480px/);
  assert.match(html, /alt="Hello &lt;b&gt;world&lt;\/b&gt;"/);
  assert.match(html, /style="display:block;width:100%;height:auto/);
  assert.match(html, /width="33%"/);
  assert.match(html, /width="67%"/);
  assert.match(html, /width="100%" valign="top"/); // card without cover: text takes the full width
  assert.match(html, />#<\/span>javascript</); // "#" prefix, name written out
  assert.match(text, /#javascript #webdev/); // article() has exactly 2 tags
  assert.doesNotMatch(text, /\*\*/);
  assert.match(html, /text-align:center[^>]*>Generated by/);
  assert.match(html, /href="https:\/\/github\.com\/thomasbnt\/your-devto-digest\?utm_source=github-devto-digest-thomasbnt"/);
  assert.match(text, /your-devto-digest/);
});

test('image is the left third, text the right two thirds, stacking below 650px', () => {
  const { html } = renderDigest({ forYou: [{ article: article(), summary: 's' }], discover: [] });
  assert.ok(html.indexOf('img-col') < html.indexOf('width="67%"'));
  assert.match(html, /@media \(max-width:649px\)\{[^@]*\.col\{display:block[^}]*box-sizing:border-box[^@]*\.img-col\{padding:12px 12px 0 12px/);
});

test('at most 2 tags are displayed, in html and text', () => {
  const many = article({ tag_list: ['a', 'b', 'c', 'd'] });
  const { html, text } = renderDigest({ forYou: [{ article: many, summary: 's' }], discover: [] });
  assert.equal((html.match(/>#<\/span>/g) || []).length, 2);
  assert.match(html, />#<\/span>a</);
  assert.match(html, />#<\/span>b</);
  assert.doesNotMatch(html, />#<\/span>c</);
  assert.match(text, /#a #b\n/);
  assert.doesNotMatch(text, /#c/);
});

test('every border radius is 5px', () => {
  const { html } = renderDigest({ forYou: [{ article: article(), summary: 's' }], discover: [] });
  const radii = new Set(html.match(/border-radius:\d+px/g));
  assert.deepEqual([...radii], ['border-radius:5px']);
  // the card is clipped and its cells are rounded too, otherwise their square backgrounds hide the corners
  assert.match(html, /border-collapse:separate;border-spacing:0;border-radius:5px;overflow:hidden/);
  assert.match(html, /width:33%;[^"]*border-radius:5px 0 0 5px/);
  assert.match(html, /width:67%;[^"]*border-radius:0 5px 5px 0/);
});

test('from 650px the column widens and the image gets 40% of the card', () => {
  const { html } = renderDigest({ forYou: [{ article: article(), summary: 's' }], discover: [] });
  assert.match(html, /@media \(min-width:650px\)\{[^@]*\.wrap\{max-width:900px!important\}/);
  assert.match(html, /@media \(min-width:650px\)\{[^@]*\.img-col\{width:40%!important\}/);
  assert.match(html, /@media \(min-width:650px\)\{[^@]*\.txt-col\{width:60%!important\}/);
  // the 1200px grid media query comes later so its stacked layout wins over the 40/60 split
  assert.ok(html.indexOf('min-width:650px') < html.indexOf('min-width:1200px'));
});

test('two cards per row from 1200px with the image on top, single column below', () => {
  const { html } = renderDigest({
    forYou: [{ article: article(), summary: 's' }, { article: article({ id: 2 }), summary: 's' }],
    discover: [],
  });
  assert.match(html, /@media \(min-width:1200px\)\{[^@]*\.wrap\{max-width:1100px!important\}/);
  assert.match(html, /@media \(min-width:1200px\)\{[^@]*\.cell\{width:49%!important/);
  assert.match(html, /@media \(min-width:1200px\)\{[^@]*\.grid\{display:flex!important;flex-wrap:wrap/);
  assert.match(html, /@media \(min-width:1200px\)\{[^@]*\.col\{display:block!important;width:100%!important/); // image stacks on top in the grid
  assert.equal((html.match(/class="cell"/g) || []).length, 2);
  assert.match(html, /class="wrap"[^>]*max-width:600px/); // default stays a 600px single column
});

test('the auto-generated dev.to preview (social_image) is never shown', () => {
  const generated = article({ cover_image: null, social_image: 'https://media2.dev.to/dynamic/image/generated.png' });
  const { html } = renderDigest({ forYou: [{ article: generated, summary: 's' }], discover: [] });
  assert.doesNotMatch(html, /generated\.png/);
  assert.doesNotMatch(html, /width="33%"/); // no image column, text takes the full card
});

test('cover image is omitted when missing or not https', () => {
  const { html } = renderDigest({
    forYou: [{ article: article({ cover_image: 'http://insecure.example/c.png' }), summary: 's' }],
    discover: [],
  });
  assert.doesNotMatch(html, /insecure\.example/);
});

test('the author is a link to their dev.to profile', () => {
  const { html, text } = renderDigest({ forYou: [{ article: article(), summary: '' }], discover: [] });
  assert.match(html, /<a class="lk" href="https:\/\/dev\.to\/ada\?utm_source=github-devto-digest-thomasbnt"[^>]*><img[^>]*><strong class="lk"[^>]*>Ada<\/strong><\/a>/);
  assert.match(text, /By Ada \(https:\/\/dev\.to\/ada\?utm_source=github-devto-digest-thomasbnt\)/);
});

test('an unsafe username does not produce an author link', () => {
  const user = { name: 'Eve', username: '"><script>', profile_image_90: null };
  const { html } = renderDigest({ forYou: [{ article: article({ user }), summary: '' }], discover: [] });
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /href="https:\/\/dev\.to\/%22/);
});

test('every link in the email carries utm_source, in html and text', () => {
  const { html, text } = renderDigest({ forYou: [{ article: article() }], discover: [{ article: article({ id: 2 }) }] });
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 5);
  for (const href of hrefs) assert.match(href, /[?&]utm_source=github-devto-digest-thomasbnt/);
  const links = text.match(/https:\/\/\S+/g) ?? [];
  for (const link of links) assert.match(link, /utm_source=github-devto-digest-thomasbnt/);
});

test('withUtm keeps existing query params and rejects non-https urls', () => {
  assert.equal(withUtm('https://dev.to/a?x=1'), 'https://dev.to/a?x=1&utm_source=github-devto-digest-thomasbnt');
  assert.equal(withUtm('http://dev.to/a'), '');
  assert.equal(withUtm(undefined), '');
});

test('the default accent is #690014 and matches the theme link colors', () => {
  assert.equal(DEFAULT_ACCENT, '#690014');
  const { light, dark } = accentColors();
  assert.equal(light, LIGHT.link);
  assert.equal(dark, DARK.link);
});

test('any accent color stays readable (WCAG AA) in both themes', () => {
  for (const hex of ['#690014', '#000000', '#ffffff', '#ffff00', '#0000ff', '#ff0000', '#808080']) {
    const { light, dark } = accentColors(hex);
    for (const bg of [LIGHT.page, LIGHT.card]) assert.ok(contrastRatio(light, bg) >= 4.5, `${hex} light on ${bg}`);
    for (const bg of [DARK.page, DARK.card]) assert.ok(contrastRatio(dark, bg) >= 4.5, `${hex} dark on ${bg}`);
  }
});

test('normalizeHex accepts #rgb and #rrggbb only', () => {
  assert.equal(normalizeHex('#ABC'), '#aabbcc');
  assert.equal(normalizeHex(' #690014 '), '#690014');
  for (const bad of ['690014', '#12345', '#gggggg', 'red', null, undefined, 12]) assert.equal(normalizeHex(bad), null);
});

test('the accent colors links and headings, and can be changed', () => {
  const input = { forYou: [{ article: article(), summary: '' }], discover: [] };
  const byDefault = renderDigest(input).html;
  assert.match(byDefault, /<h1[^>]*color:#690014/);
  assert.match(byDefault, /<h2[^>]*color:#690014/);
  assert.match(byDefault, /\.lk\{color:#bc8c95!important\}/);
  const custom = renderDigest({ ...input, accentColor: '#0369a1' }).html;
  assert.match(custom, /<h1[^>]*color:#0369a1/);
  assert.doesNotMatch(custom, /#690014/);
});
