const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'content', 'articles');
const DOMAIN = 'https://ai-globally.pages.dev';


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

    let currentKey = null;
    let currentList = null;

    for (const line of fm) {

        if (!line.trim()) {
            continue;
        }

        /* YAML LIST ITEM */
        const listItem = line.match(
            /^\s+-\s+(.*)$/
        );

        if (listItem && currentList) {

            data[currentList].push(
                parseScalar(listItem[1])
            );

            continue;
        }


        /* NORMAL key: value */
        const keyMatch = line.match(
            /^([^:\s][^:]*):\s*(.*)$/
        );

        if (keyMatch) {

            const key =
                keyMatch[1].trim();

            const value =
                keyMatch[2].trim();

            currentKey = key;

            if (value === '') {

                data[key] = [];
                currentList = key;

            } else {

                data[key] =
                    parseScalar(value);

                currentList = null;

            }

            continue;
        }


        /* CONTINUATION OF A LONG YAML VALUE */
        const continuation = line.match(
            /^\s+(.+)$/
        );

        if (
            continuation &&
            currentKey &&
            !currentList
        ) {

            const extra =
                continuation[1].trim();

            data[currentKey] =
                `${data[currentKey]} ${extra}`.trim();

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

            <button
                class="mobile-menu"
                id="mobileMenuButton"
                type="button"
                aria-label="Open navigation menu"
                aria-expanded="false"
                aria-controls="mobileMenuPanel"
            >
                ☰
            </button>

        </nav>

    </div>


    <nav
        class="mobile-menu-panel"
        id="mobileMenuPanel"
        aria-label="Mobile navigation"
        hidden
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

    </nav>

</header>


<script>
document.addEventListener(
    'DOMContentLoaded',
    () => {

        const button =
            document.getElementById(
                'mobileMenuButton'
            );

        const panel =
            document.getElementById(
                'mobileMenuPanel'
            );

        if (!button || !panel) {
            return;
        }

        button.addEventListener(
            'click',
            () => {

                const isOpen =
                    button.getAttribute(
                        'aria-expanded'
                    ) === 'true';

                button.setAttribute(
                    'aria-expanded',
                    String(!isOpen)
                );

                panel.hidden = isOpen;

                button.textContent =
                    isOpen
                        ? '☰'
                        : '×';
            }
        );

    }
);
</script>
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
    depth = '',
    image = ''
)

{

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
    image
        ? `
            <meta
                property="og:image"
                content="${image}"
            >

            <meta
                name="twitter:card"
                content="summary_large_image"
            >

            <meta
                name="twitter:image"
                content="${image}"
            >
        `
        : `
            <meta
                name="twitter:card"
                content="summary"
            >
        `
}

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
        a =>
            a.featured_home === true ||
            String(a.featured_home).toLowerCase() === 'true'
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
    src="${a.home_image || '/assets/agents.svg'}"
    alt="${esc(
        a.home_image_alt ||
        'AI Globally article illustration'
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
            DOMAIN + '/',

        logo: {
            '@type':
                'ImageObject',

            url:
                DOMAIN +
                '/assets/ai-globally-logo.png'
        }
    }
);


    return `
${pageHead(
    'AI Globally | AI News, Insights and Explainers',
    'AI Globally covers the AI developments that matter, with concise news, industry context, insights and explainers.',
    DOMAIN + '/',
    'website',
    schema,
    '',
    DOMAIN + '/assets/ai-globally-logo.png'
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

    </nav>

</div>


<main class="container">

    <h1 class="homepage-title">
        AI news, insights and explainers from around the world
    </h1>


    <section class="main-grid">


        <div class="popular">

            <h2 class="section-title">
                <span>
                    POPULAR NEWS
                </span>
            </h2>

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

        <a href="/privacy.html">
    Privacy
</a>

        <a href="/terms.html">
    Terms
</a>

        <a href="/contact.html">
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
    'keydown',
    event => {

        if (event.key !== 'Enter') {
            return;
        }

        const q =
            input.value.trim();

        if (!q) {
            return;
        }

        window.location.href =
            '/search/?q=' +
            encodeURIComponent(q);

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


    const schemaData = {
    '@context':
        'https://schema.org',

    '@type':
        news
            ? 'NewsArticle'
            : 'Article',

    headline:
        a.title,

    description:
        a.meta_description || '',

    datePublished:
        a.date,

    mainEntityOfPage: {
        '@type':
            'WebPage',

        '@id':
            `${DOMAIN}${articleUrl(a)}`
    },

    author: {
        '@type':
            'Person',

        name:
            a.author ||
            'Fara Sidhik'
    },

    publisher: {
        '@type':
            'NewsMediaOrganization',

        name:
            'AI Globally',

        url:
            DOMAIN + '/',

        logo: {
            '@type':
                'ImageObject',

            url:
                DOMAIN +
                '/assets/ai-globally-logo.png'
        }
    }
};


if (a.image) {

    schemaData.image =
        DOMAIN + a.image;

}


const schema =
    JSON.stringify(
        schemaData
    );




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

    '../',

    a.home_image
        ? DOMAIN + a.home_image
        : DOMAIN + '/assets/ai-globally-logo.png'
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
   SEARCH PAGE
========================= */

function renderSearchPage() {

    return `
${pageHead(
    'Search | AI Globally',
    'Search AI Globally articles, topics and companies.',
    DOMAIN + '/search/',
    'website',
    '',
    '../'
)}

${header('../')}


<main class="container archive-page">

    <a href="/" class="page-back">
        ← BACK
    </a>

    <h1 class="archive-title">
        Search AI Globally
    </h1>

    <label class="search-box search-page-box">

        <span class="search-mark">
            ⌕
        </span>

        <input
            id="searchPageInput"
            placeholder="Search articles, topics, companies..."
            aria-label="Search AI Globally"
            autocomplete="off"
        >

    </label>


    <div
        id="searchStatus"
        class="search-status"
    ></div>


    <div
        id="searchResults"
        class="archive-list"
    ></div>

</main>


<script>

const searchInput =
    document.getElementById(
        'searchPageInput'
    );

const searchResults =
    document.getElementById(
        'searchResults'
    );

const searchStatus =
    document.getElementById(
        'searchStatus'
    );

let searchIndex = [];


function normalizeSearch(value) {

    return String(value || '')
        .toLowerCase()
        .trim();

}


function createSearchResult(article) {

    const link =
        document.createElement('a');

    link.className =
        'archive-story';

    link.href =
        article.url;


    if (article.image) {

        const img =
            document.createElement('img');

        img.src =
            article.image;

        img.alt =
            article.image_alt || '';

        img.loading =
            'lazy';

        link.appendChild(img);

    }


    const copy =
        document.createElement('div');


    const meta =
        document.createElement('div');

    meta.className =
        'card-meta';

    meta.textContent =
        article.type +
        ' · ' +
        article.date_display;

    copy.appendChild(meta);


    const heading =
        document.createElement('h2');

    heading.textContent =
        article.title;

    copy.appendChild(heading);


    if (article.description) {

        const description =
            document.createElement('p');

        description.textContent =
            article.description;

        copy.appendChild(description);

    }


    link.appendChild(copy);

    return link;

}


function runSearch() {

    const query =
        searchInput.value.trim();

    const q =
        normalizeSearch(query);


    const currentUrl =
        new URL(
            window.location.href
        );

    if (query) {

        currentUrl.searchParams.set(
            'q',
            query
        );

    } else {

        currentUrl.searchParams.delete(
            'q'
        );

    }

    history.replaceState(
        null,
        '',
        currentUrl
    );


    searchResults.innerHTML = '';


    if (!q) {

        searchStatus.textContent =
            'Enter a search term.';

        return;

    }


    const terms =
        q
            .split(/\\s+/)
            .filter(Boolean);


    const matches =
        searchIndex.filter(
            article => {

                const haystack =
                    normalizeSearch(
                        [
                            article.title,
                            article.description,
                            article.type,
                            article.category,
                            ...(article.tags || []),
                            article.body
                        ].join(' ')
                    );

                return terms.every(
                    term =>
                        haystack.includes(term)
                );

            }
        );


    searchStatus.textContent =
        matches.length === 1
            ? '1 result'
            : matches.length + ' results';


    if (!matches.length) {

        const empty =
            document.createElement('div');

        empty.className =
            'archive-empty';

        empty.textContent =
            'No articles found. Try a different search.';

        searchResults.appendChild(
            empty
        );

        return;

    }


    matches.forEach(
        article => {

            searchResults.appendChild(
                createSearchResult(
                    article
                )
            );

        }
    );

}


fetch('/search.json')

    .then(
        response => {

            if (!response.ok) {

                throw new Error(
                    'Could not load search index.'
                );

            }

            return response.json();

        }
    )

    .then(
        data => {

            searchIndex =
                Array.isArray(data)
                    ? data
                    : [];

            const params =
                new URLSearchParams(
                    window.location.search
                );

            searchInput.value =
                params.get('q') || '';

            runSearch();

        }
    )

    .catch(
        () => {

            searchStatus.textContent =
                'Search is temporarily unavailable.';

        }
    );


searchInput.addEventListener(
    'keydown',
    event => {

        if (event.key === 'Enter') {
            runSearch();
        }

    }
);

</script>


</body>

</html>
`;
}

/* =========================
   CONTACT PAGE
========================= */

function renderContactPage() {

    return `
${pageHead(
    'Contact AI Globally',
    'Contact AI Globally for news tips, press releases, corrections, partnerships and general enquiries.',
    DOMAIN + '/contact.html',
    'website',
    '',
    ''
)}

${header('')}


<main class="container contact-page">

    <a href="/" class="page-back">
        ← BACK
    </a>


    <div class="contact-kicker">
        CONTACT
    </div>


    <h1>
        Contact AI Globally
    </h1>


    <p class="contact-intro">
        Get in touch with AI Globally for news tips, press releases, corrections, partnerships or questions about our coverage.
    </p>


    <div class="contact-grid">


        <div class="contact-item">

            <h2>
                News tips & press releases
            </h2>

            <p>
                Have an AI development, announcement or story you think we should know about? Send us the details and any relevant supporting material.
            </p>

        </div>


        <div class="contact-item">

            <h2>
                Corrections
            </h2>

            <p>
                Spot an error in our coverage? Please send the article link and details of the correction.
            </p>

        </div>


        <div class="contact-item">

            <h2>
                General & partnership enquiries
            </h2>

            <p>
                For general questions, collaborations, partnerships or other enquiries, get in touch by email.
            </p>

        </div>


    </div>


    <div class="contact-email">

        <span>
            EMAIL
        </span>

        <a href="mailto:readaiglobally@gmail.com">
            readaiglobally@gmail.com
        </a>

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

        <a href="/contact.html">
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
   PRIVACY PAGE
========================= */

function renderPrivacyPage() {

    return `
${pageHead(
    'Privacy Policy | AI Globally',
    'Privacy information for readers and visitors of AI Globally.',
    DOMAIN + '/privacy.html',
    'website',
    '',
    ''
)}

${header('')}


<main class="container legal-page">

    <a href="/" class="page-back">
        ← BACK
    </a>

    <div class="legal-kicker">
        PRIVACY
    </div>

    <h1>
        Privacy Policy
    </h1>

    <p class="legal-updated">
        Last updated: September 2026
    </p>


    <div class="legal-content">

        <p>
            AI Globally is an independent publication covering artificial intelligence news, analysis and explainers. This page explains how information may be handled when you visit the website or contact us.
        </p>


        <h2>
            Information you provide
        </h2>

        <p>
            AI Globally does not currently require readers to create accounts or provide personal information to access published content.
        </p>

        <p>
            If you contact us by email, we may receive information you choose to provide, including your name, email address and the contents of your message.
        </p>


        <h2>
            Technical information
        </h2>

        <p>
            The website is hosted using third-party infrastructure. Hosting, security and network providers may process technical information such as IP addresses, browser information, device information, request data and security logs as part of operating and protecting the website.
        </p>


        <h2>
            Cookies and analytics
        </h2>

        <p>
            AI Globally does not currently use advertising or marketing cookies.
        </p>

        <p>
            If analytics, advertising, newsletter tools or other services that involve additional data collection are introduced in the future, this policy may be updated to reflect those changes.
        </p>


        <h2>
            External links
        </h2>

        <p>
            Articles may contain links to external websites, including companies, government bodies, research organisations and other sources. AI Globally is not responsible for the privacy practices of external websites.
        </p>


        <h2>
            How information may be used
        </h2>

        <p>
            Information sent directly to AI Globally may be used to respond to enquiries, review news tips, consider press releases, handle correction requests or manage legitimate publication-related communications.
        </p>


        <h2>
            Data sharing
        </h2>

        <p>
            AI Globally does not sell personal information.
        </p>

        <p>
            Information may be processed by service providers where necessary to operate, secure or maintain the website and publication services.
        </p>


        <h2>
            Changes to this policy
        </h2>

        <p>
            This Privacy Policy may be updated as AI Globally introduces new features, services or technologies.
        </p>


        <h2>
            Contact
        </h2>

        <p>
            Questions about this Privacy Policy can be sent to
            <a href="mailto:readaiglobally@gmail.com">
                readaiglobally@gmail.com
            </a>.
        </p>

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

        <a href="/privacy.html">
            Privacy
        </a>

        <a href="/terms.html">
            Terms
        </a>

        <a href="/contact.html">
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
   TERMS PAGE
========================= */

function renderTermsPage() {

    return `
${pageHead(
    'Terms of Use | AI Globally',
    'Terms governing the use of the AI Globally website and published content.',
    DOMAIN + '/terms.html',
    'website',
    '',
    ''
)}

${header('')}


<main class="container legal-page">

    <a href="/" class="page-back">
        ← BACK
    </a>

    <div class="legal-kicker">
        TERMS
    </div>

    <h1>
        Terms of Use
    </h1>

    <p class="legal-updated">
        Last updated: September 2026
    </p>


    <div class="legal-content">

        <p>
            These Terms of Use apply to your use of the AI Globally website and its published content.
        </p>


        <h2>
            Editorial content
        </h2>

        <p>
            AI Globally publishes news, analysis and explanatory content about artificial intelligence, technology, business, policy and related subjects.
        </p>

        <p>
            We aim to publish accurate and useful information, but published material may contain errors, omissions or information that later becomes outdated.
        </p>


        <h2>
            No professional advice
        </h2>

        <p>
            Content published by AI Globally is provided for informational and editorial purposes only. It should not be treated as legal, financial, investment, medical or other professional advice.
        </p>


        <h2>
            Corrections and updates
        </h2>

        <p>
            AI Globally may correct, update, clarify or remove published content when necessary.
        </p>

        <p>
            Readers who identify a potential error can contact us at
            <a href="mailto:readaiglobally@gmail.com">
                readaiglobally@gmail.com
            </a>.
        </p>


        <h2>
            Intellectual property
        </h2>

        <p>
            Unless otherwise stated, original text, branding, design and other original material published by AI Globally are protected by applicable intellectual property laws.
        </p>

        <p>
            Limited quotation or linking for commentary, reporting, research or other lawful purposes is permitted where appropriate attribution is provided. Republishing substantial portions of AI Globally content without permission is not permitted.
        </p>


        <h2>
            Third-party material
        </h2>

        <p>
            AI Globally may reference or link to third-party websites, documents, research, announcements and other materials. Ownership of third-party material remains with its respective owners.
        </p>

        <p>
            Links to third-party websites do not necessarily constitute endorsement, and AI Globally is not responsible for the availability, accuracy or policies of external websites.
        </p>


        <h2>
            Website availability
        </h2>

        <p>
            We may modify, suspend or discontinue parts of the website without notice. We do not guarantee uninterrupted availability of the website or any particular feature.
        </p>


        <h2>
            Limitation of liability
        </h2>

        <p>
            To the extent permitted by applicable law, AI Globally is not responsible for losses or damages arising from reliance on information published on the website or from the use of third-party websites linked from our content.
        </p>


        <h2>
            Changes to these terms
        </h2>

        <p>
            These Terms may be updated as AI Globally develops new features, products or services.
        </p>


        <h2>
            Contact
        </h2>

        <p>
            Questions about these Terms can be sent to
            <a href="mailto:readaiglobally@gmail.com">
                readaiglobally@gmail.com
            </a>.
        </p>

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

        <a href="/privacy.html">
            Privacy
        </a>

        <a href="/terms.html">
            Terms
        </a>

        <a href="/contact.html">
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
   ABOUT PAGE
========================= */

/* =========================
   404 PAGE
========================= */

function render404Page() {

    return `
${pageHead(
    'Page Not Found | AI Globally',
    'The page you are looking for could not be found.',
    DOMAIN + '/404.html',
    'website',
    '',
    ''
)}

${header('')}

<main class="container error-page">

    <div class="error-code">
        404
    </div>

    <h1>
        Page not found
    </h1>

    <p>
        The page you’re looking for may have moved, changed or no longer exists.
    </p>

    <div class="error-actions">

        <a href="/">
            ← BACK TO HOME
        </a>

        <a href="/news/">
            LATEST NEWS →
        </a>

    </div>

</main>

</body>
</html>
`;
}

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

    /* CONTACT */

    fs.writeFileSync(
        path.join(
            OUT,
            'contact.html'
        ),

        renderContactPage()
    );

        /* PRIVACY */

    fs.writeFileSync(
        path.join(
            OUT,
            'privacy.html'
        ),

        renderPrivacyPage()
    );


    /* TERMS */

    fs.writeFileSync(
        path.join(
            OUT,
            'terms.html'
        ),

        renderTermsPage()
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

        /* 404 */

    fs.writeFileSync(
        path.join(
            OUT,
            '404.html'
        ),

        render404Page()
    );

    /* =========================
       SEARCH
    ========================= */

    const searchIndex =
        articles.map(
            a => ({

                title:
                    a.title || '',

                description:
                    a.meta_description || '',

                type:
                    a.type || '',

                category:
                    a.category || '',

                tags:
                    Array.isArray(a.tags)
                        ? a.tags.map(
                            tag =>
                                String(tag).trim()
                        )
                        : [],

                body:
                    a.body || '',

                image:
                    a.image || '',

                image_alt:
                    a.image_alt || '',

                date:
                    a.date || '',

                date_display:
                    a.date
                        ? fmtShort(a.date)
                        : '',

                url:
                    articleUrl(a)

            })
        );


    fs.writeFileSync(
        path.join(
            OUT,
            'search.json'
        ),

        JSON.stringify(
            searchIndex,
            null,
            2
        )
    );


    writeDirPage(
        'search',
        renderSearchPage()
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

        DOMAIN + '/contact.html',

DOMAIN + '/privacy.html',

DOMAIN + '/terms.html',

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

    /* GOOGLE SEARCH CONSOLE VERIFICATION */

    fs.copyFileSync(
        path.join(ROOT, 'google3634daa9c093b941.html'),
        path.join(OUT, 'google3634daa9c093b941.html')
    );

    console.log(
        `Built ${articles.length} articles into dist/`
    );
}


build();