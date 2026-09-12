const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'content', 'articles');
const DOMAIN = 'https://readaiglobally.com';


/* =========================
   BASIC HELPERS
========================= */

function esc(s = '') {
    return String(s).replace(
        /[&<>"]/g,
        c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;'
        }[c])
    );
}


function slugify(s = '') {
    return String(s)
        .toLowerCase()
        .trim()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}


function cleanOut() {
    fs.rmSync(
        OUT,
        {
            recursive: true,
            force: true
        }
    );

    fs.mkdirSync(
        OUT,
        {
            recursive: true
        }
    );
}


function copy(src, dest) {
    fs.cpSync(
        src,
        dest,
        {
            recursive: true
        }
    );
}


function dateObj(a) {
    const d = new Date(
        `${a.date || '1970-01-01'}T${a.time || '00:00'}:00`
    );

    return isNaN(d) ? new Date(0) : d;
}


function fmtShort(date) {
    const d = new Date(date + 'T12:00:00');

    return d.toLocaleDateString(
        'en-US',
        {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }
    );
}


function fmtLong(date) {
    const d = new Date(date + 'T12:00:00');

    return d.toLocaleDateString(
        'en-US',
        {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        }
    );
}


function articleUrl(a) {
    return `/articles/${a.slug}.html`;
}


function tagUrl(tag) {
    return `/tags/${slugify(tag)}/`;
}


function categoryUrl(category) {
    return `/category/${slugify(category)}/`;
}


/* =========================
   FRONTMATTER PARSER
========================= */

function parseScalar(v) {

    v = v.trim();

    if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
    ) {
        try {
            return v.startsWith('"')
                ? JSON.parse(v)
                : v.slice(1, -1).replace(/''/g, "'");
        } catch {
            return v.slice(1, -1);
        }
    }

    if (v === 'true') {
        return true;
    }

    if (v === 'false') {
        return false;
    }

    if (v === 'null' || v === '~') {
        return null;
    }

    return v;
}


function parseFrontmatter(raw) {

    if (!raw.startsWith('---')) {
        return {
            data: {},
            content: raw
        };
    }

    const end = raw.indexOf('\n---', 3);

    if (end < 0) {
        return {
            data: {},
            content: raw
        };
    }

    const fm = raw
        .slice(4, end)
        .split(/\r?\n/);

    const data = {};

    let currentList = null;

    for (const line of fm) {

        if (!line.trim()) {
            continue;
        }

        const listItem = line.match(
            /^\s+-\s+(.*)$/
        );

        if (listItem && currentList) {

            data[currentList].push(
                parseScalar(listItem[1])
            );

            continue;
        }

        const keyMatch = line.match(
            /^([^:]+):\s*(.*)$/
        );

        if (!keyMatch) {
            continue;
        }

        const key = keyMatch[1].trim();
        const value = keyMatch[2].trim();

        if (value === '') {

            data[key] = [];
            currentList = key;

        } else {

            data[key] = parseScalar(value);
            currentList = null;

        }
    }


    return {
        data,
        content: raw
            .slice(end + 4)
            .replace(/^\r?\n/, '')
    };
}


/* =========================
   MARKDOWN
========================= */

function inlineMarkdown(s) {

    let x = esc(s);

    x = x.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2">$1</a>'
    );

    x = x.replace(
        /\*\*([^*]+)\*\*/g,
        '<strong>$1</strong>'
    );

    x = x.replace(
        /__([^_]+)__/g,
        '<strong>$1</strong>'
    );

    x = x.replace(
        /\*([^*]+)\*/g,
        '<em>$1</em>'
    );

    x = x.replace(
        /`([^`]+)`/g,
        '<code>$1</code>'
    );

    return x;
}


function renderMarkdown(md) {

    const lines = md
        .replace(/\r/g, '')
        .split('\n');

    let out = [];
    let para = [];

    let inUl = false;
    let inOl = false;


    const flushPara = () => {

        if (para.length) {

            out.push(
                `<p>${inlineMarkdown(
                    para.join(' ')
                )}</p>`
            );

            para = [];
        }
    };


    const closeLists = () => {

        if (inUl) {
            out.push('</ul>');
            inUl = false;
        }

        if (inOl) {
            out.push('</ol>');
            inOl = false;
        }
    };


    for (const line of lines) {

        if (/^###\s+/.test(line)) {

            flushPara();
            closeLists();

            out.push(
                `<h3>${inlineMarkdown(
                    line.replace(/^###\s+/, '')
                )}</h3>`
            );

            continue;
        }


        if (/^##\s+/.test(line)) {

            flushPara();
            closeLists();

            out.push(
                `<h2>${inlineMarkdown(
                    line.replace(/^##\s+/, '')
                )}</h2>`
            );

            continue;
        }


        if (/^#\s+/.test(line)) {

            flushPara();
            closeLists();

            out.push(
                `<h1>${inlineMarkdown(
                    line.replace(/^#\s+/, '')
                )}</h1>`
            );

            continue;
        }


        let m = line.match(
            /^[-*]\s+(.+)/
        );

        if (m) {

            flushPara();

            if (inOl) {
                out.push('</ol>');
                inOl = false;
            }

            if (!inUl) {
                out.push('<ul>');
                inUl = true;
            }

            out.push(
                `<li>${inlineMarkdown(m[1])}</li>`
            );

            continue;
        }


        m = line.match(
            /^\d+\.\s+(.+)/
        );

        if (m) {

            flushPara();

            if (inUl) {
                out.push('</ul>');
                inUl = false;
            }

            if (!inOl) {
                out.push('<ol>');
                inOl = true;
            }

            out.push(
                `<li>${inlineMarkdown(m[1])}</li>`
            );

            continue;
        }


        if (!line.trim()) {

            flushPara();
            closeLists();

            continue;
        }


        para.push(
            line.trim()
        );
    }


    flushPara();
    closeLists();

    return out.join('\n');
}


/* =========================
   READ ARTICLES
========================= */

function readArticles() {

    return fs
        .readdirSync(CONTENT)

        .filter(
            f => f.endsWith('.md')
        )

        .map(file => {

            const raw = fs.readFileSync(
                path.join(CONTENT, file),
                'utf8'
            );

            const parsed =
                parseFrontmatter(raw);

            const slug =
                path.basename(file, '.md');


            return {
                ...parsed.data,
                slug,
                body: parsed.content,
                html: renderMarkdown(
                    parsed.content
                )
            };
        })

        .sort(
            (a, b) =>
                dateObj(b) - dateObj(a)
        );
}


/* =========================
   HEADER
========================= */

const header = () => `
<header class="site-header">

    <div class="container header-row">

        <div>

            <a
    href="/"
    class="brand brand-logo"
    aria-label="AI Globally homepage"
>
    <img
        src="/assets/ai-globally-logo.png"
        alt="AI Globally"
    >
</a>

        </div>


        <nav
            class="nav-box"
            aria-label="Primary"
        >

            <a href="/news/">
                NEWS
            </a>

            <a href="/insights/">
                INSIGHTS
            </a>

            <a href="/explainers/">
                EXPLAINERS
            </a>

            <a href="/about.html">
                ABOUT
            </a>

            <span class="search-icon">
                ⌕
            </span>

            <span class="mobile-menu">
                ☰
            </span>

        </nav>

    </div>

</header>
`;


/* =========================
   PAGE HEAD
========================= */

function pageHead(
    title,
    description,
    canonical,
    type = 'website',
    schema = '',
    depth = ''
) {

    return `
<!doctype html>

<html lang="en">

<head>

    <meta charset="utf-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>${esc(title)}</title>

    <meta
        name="description"
        content="${esc(description)}"
    >

    <link
        rel="canonical"
        href="${canonical}"
    >

    <link
        rel="stylesheet"
        href="${depth}styles.css"
    >

    <link
    rel="icon"
    type="image/png"
    href="/assets/flavicon.png"
>

<link
    rel="shortcut icon"
    href="/assets/flavicon.png"
>

    <meta
        property="og:title"
        content="${esc(title)}"
    >

    <meta
        property="og:description"
        content="${esc(description)}"
    >

    <meta
        property="og:type"
        content="${type}"
    >

    <meta
        property="og:url"
        content="${canonical}"
    >

    ${
        schema
            ? `<script type="application/ld+json">${schema}</script>`
            : ''
    }

</head>

<body>
`;
}


/* =========================
   AUTHOR
========================= */

function authorHtml(a) {

    const image = a.author_image
        ? `
            <img
                class="author-photo"
                src="${a.author_image}"
                alt="${esc(a.author || 'Author')}"
                width="44"
                height="44"
            >
        `
        : `
            <div class="avatar">
                ${esc(
                    (a.author || 'Fara Sidhik')
                        .split(' ')
                        .map(x => x[0])
                        .join('')
                        .slice(0, 2)
                )}
            </div>
        `;


    return `
        <div class="article-author">

            ${image}

            <div>

                <strong>
                    ${esc(
                        a.author || 'Fara Sidhik'
                    )}
                </strong>

                <span>
                    ${fmtLong(a.date)}
                    · AI Globally
                </span>

            </div>

        </div>
    `;
}


/* =========================
   TAGS
========================= */

function tagsHtml(tags) {

    if (
        !Array.isArray(tags) ||
        !tags.length
    ) {
        return '';
    }


    return `
        <div class="article-tags">

            ${tags
                .map(
                    tag => `
                        <a
                            href="${tagUrl(tag)}"
                            class="article-tag"
                        >
                            ${esc(tag)}
                        </a>
                    `
                )
                .join('')}

        </div>
    `;
}


/* =========================
   HOMEPAGE
========================= */

function renderHome(articles) {

    const popular = articles
        .filter(
            a => a.featured_home === true
        )
        .slice(0, 2);


    const latest = articles
        .filter(
            a => a.type === 'News'
        )
        .slice(0, 5);


    const insights = articles
        .filter(
            a => a.type === 'Insight'
        )
        .slice(0, 3);


    const explainers = articles
        .filter(
            a => a.type === 'Explainer'
        )
        .slice(0, 2);


    const popularHtml = popular
        .map(
            (a, i) => `

<article
    class="pop-item searchable${i % 2 ? ' reverse' : ''}"
>

    <a
        class="story-media"
        href="${articleUrl(a)}"
    >

        <img
            src="${a.image || '/assets/agents.svg'}"
            alt="${esc(
                a.image_alt ||
                'Abstract technology illustration'
            )}"
        >

    </a>


    <div class="story-copy">

        <h2 class="story-title">

            <a href="${articleUrl(a)}">
                ${esc(a.title)}
            </a>

        </h2>


        <div class="byline">

            ${
                a.author_image
                    ? `
                        <img
                            class="author-photo"
                            src="${a.author_image}"
                            alt="${esc(a.author || 'Author')}"
                            width="46"
                            height="46"
                        >
                    `
                    : `
                        <div class="avatar">
                            FS
                        </div>
                    `
            }

            <div>

                <strong>
                    ${esc(
                        a.author ||
                        'Fara Sidhik'
                    )}
                </strong>

                <span>
                    ${esc(a.type)}
                    ·
                    ${fmtShort(a.date)}
                </span>

            </div>

        </div>

    </div>

</article>
`
        )
        .join('');


    const latestHtml = latest
        .map(
            a => `

<a
    class="latest-row searchable"
    href="${articleUrl(a)}"
>

    <span class="latest-time">
        ${esc(
            a.time ||
            fmtShort(a.date)
        )}
    </span>

    <span class="latest-head">
        ${esc(a.title)}
    </span>

    <span class="latest-arrow">
        →
    </span>

</a>
`
        )
        .join('');


    const insightHtml = insights
        .map(
            a => `

<a
    class="card searchable"
    href="${articleUrl(a)}"
>

    <img
        src="${a.image || '/assets/architecture.svg'}"
        alt="${esc(a.image_alt || '')}"
        loading="lazy"
    >

    <h3 class="card-title">
        ${esc(a.title)}
    </h3>

    <div class="card-meta">
        ${fmtShort(a.date)}
    </div>

</a>
`
        )
        .join('');


    const explainerHtml = explainers
        .map(
            a => `

<a
    class="explain-item searchable"
    href="${articleUrl(a)}"
>

    <img
        src="${a.image || '/assets/waves.svg'}"
        alt="${esc(a.image_alt || '')}"
        loading="lazy"
    >

    <div class="explain-copy">

        <h3>
            ${esc(a.title)}
        </h3>

        <p>
            ${esc(
                a.meta_description || ''
            )}
        </p>

        <div class="card-meta">
            ${fmtShort(a.date)}
        </div>

    </div>

</a>
`
        )
        .join('');


    const schema = JSON.stringify(
        {
            '@context':
                'https://schema.org',

            '@type':
                'NewsMediaOrganization',

            name:
                'AI Globally',

            url:
                DOMAIN + '/'
        }
    );


    return `
${pageHead(
    'AI Globally | AI News, Insights and Explainers',
    'AI Globally covers the AI developments that matter, with concise news, industry context, insights and explainers.',
    DOMAIN + '/',
    'website',
    schema,
    ''
)}

${header('')}


<div class="container discovery-row">

    <label class="search-box">

        <span class="search-mark">
            ⌕
        </span>

        <input
            id="siteSearch"
            placeholder="Search articles, topics, companies..."
            aria-label="Search articles"
        >

    </label>


    <nav
        class="category-box"
        aria-label="Topics"
    >

        <a
            href="/"
            class="active"
        >
            ALL
        </a>

        <a href="/category/innovation/">
            INNOVATION
        </a>

        <a href="/category/policy/">
            POLICY
        </a>

        <a href="/category/business/">
            BUSINESS
        </a>

        <a href="/category/infrastructure/">
            INFRASTRUCTURE
        </a>

        <a href="/category/people/">
            PEOPLE
        </a>

        <a href="#" class="more-link">
            MORE
        </a>

    </nav>

</div>


<main class="container">


    <section class="main-grid">


        <div class="popular">

            <h1 class="section-title">
                <span>
                    POPULAR NEWS
                </span>
            </h1>

            ${popularHtml}

        </div>


        <aside
            class="latest"
            id="latest"
        >

            <h2 class="section-title">
                <span>
                    LATEST NEWS
                </span>
            </h2>

            <div class="latest-list">

                ${latestHtml}

            </div>

        </aside>


    </section>


    <section class="lower-grid">


        <div
            class="insights"
            id="insights"
        >

            <h2 class="sub-title">
                INSIGHTS
            </h2>

            <div class="insight-grid">

                ${insightHtml}

            </div>

        </div>


        <div
            class="explainers"
            id="explainers"
        >

            <h2 class="sub-title">
                EXPLAINERS
            </h2>

            ${explainerHtml}

        </div>


    </section>


</main>


<footer class="container site-footer">

    <div>

        <div class="footer-brand">
            AI GLOBALLY
        </div>

        <div class="tagline">
            News, analysis and context on AI, globally.
        </div>

    </div>


    <div class="footer-links">

        <a href="about.html">
            About
        </a>

        <a href="#">
            Privacy
        </a>

        <a href="#">
            Terms
        </a>

        <a href="#">
            Contact
        </a>

        <span>
            © 2026 AI Globally
        </span>

    </div>

</footer>


<script>

const input =
    document.getElementById(
        'siteSearch'
    );

input?.addEventListener(
    'input',
    () => {

        const q =
            input.value
                .toLowerCase()
                .trim();

        document
            .querySelectorAll(
                '.searchable'
            )
            .forEach(
                el => {

                    el.style.opacity =
                        !q ||
                        el.innerText
                            .toLowerCase()
                            .includes(q)
                            ? '1'
                            : '.18';

                }
            );

    }
);

</script>


</body>

</html>
`;
}


/* =========================
   ARTICLE PAGE
========================= */

function renderArticle(
    a,
    articles
) {

    const news =
        a.type === 'News';


    let related = (
        news
            ? articles.filter(
                x => x.type === 'News'
            )
            : articles.filter(
                x => x.type === a.type
            )
    )
        .filter(
            x => x.slug !== a.slug
        )
        .slice(0, 5);


    if (related.length < 5) {

        related = [
            ...related,

            ...articles
                .filter(
                    x =>
                        x.slug !== a.slug &&
                        !related.some(
                            r =>
                                r.slug === x.slug
                        )
                )
                .slice(
                    0,
                    5 - related.length
                )
        ];
    }


    const sidebar = related
        .map(
            (x, i) => `

<a
    href="${x.slug}.html"
    class="sidebar-story"
>

    <span class="sidebar-number">
        ${String(i + 1).padStart(2, '0')}
    </span>

    <span class="sidebar-headline">
        ${esc(x.title)}
    </span>

</a>
`
        )
        .join('');


    const keys = [
        a.key_point_1,
        a.key_point_2,
        a.key_point_3
    ]
        .filter(Boolean)
        .map(
            k => `<li>${esc(k)}</li>`
        )
        .join('');


    const schema = JSON.stringify(
        {
            '@context':
                'https://schema.org',

            '@type':
                news
                    ? 'NewsArticle'
                    : 'Article',

            headline:
                a.title,

            datePublished:
                a.date,

            author: {
                '@type':
                    'Person',

                name:
                    a.author ||
                    'Fara Sidhik'
            },

            publisher: {
                '@type':
                    'Organization',

                name:
                    'AI Globally'
            }
        }
    );


    const img = a.image
        ? `

<figure class="article-featured">

    <img
        src="${a.image}"
        alt="${esc(a.image_alt || '')}"
        width="1200"
        height="675"
    >

</figure>
`
        : '';


    const backType =
        news
            ? 'NEWS'
            : a.type === 'Insight'
                ? 'INSIGHTS'
                : 'EXPLAINERS';


    const backUrl =
        news
            ? '../news/'
            : a.type === 'Insight'
                ? '../insights/'
                : '../explainers/';


    return `
${pageHead(
    a.seo_title ||
        a.title +
        ' | AI Globally',

    a.meta_description || '',

    `${DOMAIN}${articleUrl(a)}`,

    'article',

    schema,

    '../'
)}

${header('../')}


<main class="article-page container">


    <a
        href="${backUrl}"
        class="article-back"
    >
        ← BACK TO ${backType}
    </a>


    <div class="article-layout">


        <article class="article-shell">


            <div class="kicker">
                ${esc(a.type)}
            </div>


            <h1>
                ${esc(a.title)}
            </h1>


            ${authorHtml(a)}


            ${tagsHtml(a.tags)}


            ${img}


            ${
                keys
                    ? `

<div class="keypoints">

    <h2>
        Key Points
    </h2>

    <ul>
        ${keys}
    </ul>

</div>
`
                    : ''
            }


            ${a.html}


        </article>


        <aside class="article-sidebar">

            <h2 class="sidebar-title">
                ${
                    news
                        ? 'LATEST STORIES'
                        : 'RELATED STORIES'
                }
            </h2>

            <div class="sidebar-list">

                ${sidebar}

            </div>

        </aside>


    </div>


</main>


</body>

</html>
`;
}


/* =========================
   LISTING PAGES
========================= */

function renderListingPage(
    title,
    description,
    articles,
    urlPath
) {

    const cards = articles
        .map(
            a => `

<a
    class="archive-story"
    href="${articleUrl(a)}"
>

    ${
        a.image
            ? `

<img
    src="${a.image}"
    alt="${esc(a.image_alt || '')}"
    loading="lazy"
>
`
            : ''
    }


    <div>

        <div class="card-meta">
            ${esc(a.type)}
            ·
            ${fmtShort(a.date)}
        </div>

        <h2>
            ${esc(a.title)}
        </h2>

        <p>
            ${esc(
                a.meta_description || ''
            )}
        </p>

    </div>

</a>
`
        )
        .join('');


    const empty =
        articles.length
            ? cards
            : `
                <div class="archive-empty">
                    No articles here yet.
                </div>
            `;


    return `
${pageHead(
    title + ' | AI Globally',
    description,
    DOMAIN + urlPath,
    'website',
    '',
    '/'
)}

${header('../')}


<main class="container archive-page">

    <a href="/" class="page-back">
        ← BACK
    </a>

    <h1 class="archive-title">
        ${esc(title)}
    </h1>

    <div class="archive-list">

        ${empty}

    </div>

</main>


</body>

</html>
`;
}


/* =========================
   TAG PAGE
========================= */

function renderTagPage(
    tag,
    articles
) {

    return renderListingPage(
        tag,

        `Latest AI Globally articles tagged ${tag}.`,

        articles,

        `/tags/${slugify(tag)}/`
    );
}


/* =========================
   ABOUT PAGE
========================= */

function renderAboutPage() {

    return `
${pageHead(
    'About AI Globally',
    'Learn about AI Globally, an independent publication covering artificial intelligence news, analysis and explainers.',
    DOMAIN + '/about.html',
    'website',
    '',
    ''
)}

${header('')}


<main class="container about-page">

    <a href="/" class="page-back">
        ← BACK
    </a>

    <div class="about-kicker">


    <h1>
        AI news with context,<br>
        not noise.
    </h1>


    <div class="about-grid">


        <div class="about-intro">

            <p>
                AI Globally is an independent publication covering the developments shaping artificial intelligence across innovation, business, policy and infrastructure.
            </p>

        </div>


        <div class="about-copy">

            <p>
                Our aim is simple: identify what matters, verify it, explain what changed and give readers enough context to understand the bigger picture.
            </p>

            <p>
                Alongside daily news, AI Globally publishes explainers and analysis designed to make increasingly complex developments in artificial intelligence easier to understand.
            </p>

            <p>
                Coverage includes frontier AI models, agents, regulation, infrastructure, industry competition and the growing impact of AI across sectors.
            </p>


            <h2>
                What we publish
            </h2>


            <div class="about-types">


                <div>

                    <strong>
                        NEWS
                    </strong>

                    <span>
                        Important AI developments, reported clearly and concisely.
                    </span>

                </div>


                <div>

                    <strong>
                        INSIGHTS
                    </strong>

                    <span>
                        Analysis of the forces shaping the AI industry.
                    </span>

                </div>


                <div>

                    <strong>
                        EXPLAINERS
                    </strong>

                    <span>
                        Clear guides to the technologies, companies and concepts behind the headlines.
                    </span>

                </div>


            </div>


        </div>


    </div>


</main>


<footer class="container site-footer">

    <div>

        <div class="footer-brand">
            AI GLOBALLY
        </div>

        <div class="tagline">
            News, analysis and context on AI, globally.
        </div>

    </div>


    <div class="footer-links">

        <a href="/about.html">
            About
        </a>

        <a href="#">
            Privacy
        </a>

        <a href="#">
            Terms
        </a>

        <a href="#">
            Contact
        </a>

        <span>
            © 2026 AI Globally
        </span>

    </div>

</footer>


</body>

</html>
`;
}


/* =========================
   WRITE DIRECTORY PAGE
========================= */

function writeDirPage(
    relativePath,
    html
) {

    const dir =
        path.join(
            OUT,
            relativePath
        );

    fs.mkdirSync(
        dir,
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        path.join(
            dir,
            'index.html'
        ),
        html
    );
}


/* =========================
   BUILD
========================= */

function build() {

    cleanOut();


    const articles =
        readArticles();


    copy(
        path.join(ROOT, 'assets'),
        path.join(OUT, 'assets')
    );


    copy(
        path.join(ROOT, 'styles.css'),
        path.join(OUT, 'styles.css')
    );


    /* ABOUT */

    fs.writeFileSync(
        path.join(
            OUT,
            'about.html'
        ),

        renderAboutPage()
    );


    /* HOMEPAGE */

    fs.writeFileSync(
        path.join(
            OUT,
            'index.html'
        ),

        renderHome(
            articles
        )
    );


    /* ARTICLES */

    fs.mkdirSync(
        path.join(
            OUT,
            'articles'
        ),
        {
            recursive: true
        }
    );


    for (const a of articles) {

        fs.writeFileSync(
            path.join(
                OUT,
                'articles',
                `${a.slug}.html`
            ),

            renderArticle(
                a,
                articles
            )
        );
    }


    /* NEWS */

    writeDirPage(
        'news',

        renderListingPage(
            'News',

            'Latest artificial intelligence news from AI Globally.',

            articles.filter(
                a =>
                    a.type ===
                    'News'
            ),

            '/news/'
        )
    );


    /* INSIGHTS */

    writeDirPage(
        'insights',

        renderListingPage(
            'Insights',

            'Analysis and context on the AI industry.',

            articles.filter(
                a =>
                    a.type ===
                    'Insight'
            ),

            '/insights/'
        )
    );


    /* EXPLAINERS */

    writeDirPage(
        'explainers',

        renderListingPage(
            'Explainers',

            'Clear explanations of artificial intelligence and the technologies shaping it.',

            articles.filter(
                a =>
                    a.type ===
                    'Explainer'
            ),

            '/explainers/'
        )
    );


    /* =========================
       CATEGORIES
    ========================= */

    const categories = [
        'Innovation',
        'Policy',
        'Business',
        'Infrastructure',
        'People'
    ];


    for (const category of categories) {

        writeDirPage(
            path.join(
                'category',
                slugify(category)
            ),

            renderListingPage(
                category,

                `Latest AI Globally coverage in ${category}.`,

                articles.filter(
                    article =>
                        article.category === category
                ),

                `/category/${slugify(category)}/`
            )
        );
    }


    /* =========================
       TAGS
    ========================= */

    const tagMap =
        new Map();


    for (const article of articles) {

        if (
            !Array.isArray(
                article.tags
            )
        ) {
            continue;
        }


        for (const tag of article.tags) {

            if (
                !tagMap.has(tag)
            ) {

                tagMap.set(
                    tag,
                    []
                );
            }


            tagMap
                .get(tag)
                .push(article);
        }
    }


    for (
        const [
            tag,
            taggedArticles
        ] of tagMap
    ) {

        writeDirPage(
            path.join(
                'tags',
                slugify(tag)
            ),

            renderTagPage(
                tag,
                taggedArticles
            )
        );
    }


    /* =========================
       SITEMAP
    ========================= */

    const urls = [

        DOMAIN + '/',

        DOMAIN + '/about.html',

        DOMAIN + '/news/',

        DOMAIN + '/insights/',

        DOMAIN + '/explainers/',


        ...categories.map(
            category =>
                DOMAIN +
                categoryUrl(category)
        ),


        ...articles.map(
            a =>
                DOMAIN +
                articleUrl(a)
        ),


        ...Array
            .from(
                tagMap.keys()
            )
            .map(
                tag =>
                    DOMAIN +
                    tagUrl(tag)
            )

    ];


    fs.writeFileSync(
        path.join(
            OUT,
            'sitemap.xml'
        ),

        `<?xml version="1.0" encoding="UTF-8"?>

<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls
    .map(
        u =>
            `  <url><loc>${u}</loc></url>`
    )
    .join('\n')}

</urlset>`
    );


    /* ROBOTS */

    fs.writeFileSync(
        path.join(
            OUT,
            'robots.txt'
        ),

        `User-agent: *

Allow: /

Sitemap: ${DOMAIN}/sitemap.xml
`
    );


    console.log(
        `Built ${articles.length} articles into dist/`
    );
}


build();