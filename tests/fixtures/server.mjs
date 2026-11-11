import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = fileURLToPath(new URL('./assets/', import.meta.url));
let rateCount = 0;
const products = Array.from({ length: 100 }, (_, i) => ({
  id: String(i + 1).padStart(3, '0'),
  name: i % 4 === 0 ? 'لنت ترمز پژو ' + (i + 1) : 'Precision part ' + (i + 1),
  price: 850000 + i * 1000,
  image:
    '/assets/' +
    ['photo.jpg', 'photo.png', 'photo.webp', 'photo.avif', 'photo.gif', 'photo.bmp', 'diagram.svg'][
      i % 7
    ],
}));
const style = `body{font:16px system-ui;background:#f1f5f3;color:#152d24;padding:28px}nav{display:flex;gap:20px;margin-bottom:25px}a{color:#116b48}.catalog,.cards,.products{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;list-style:none;padding:0}.unit,.product,article{background:white;padding:18px;border:1px solid #ddd;border-radius:12px}img{width:120px;height:90px;object-fit:contain}table{background:white;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #ccc;padding:12px}button{padding:12px;background:#def5e8;border:1px solid #5a8;border-radius:5px}`;
const page = (title, body, extra = '') =>
  `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>${title}</title><meta property="og:image" content="/assets/photo.png"><style>${style}</style>${extra}</head><body><nav><a href="/custom">Custom</a><a href="/commerce">Commerce</a><a href="/tables">Tables</a><a href="/rtl">فارسی</a><a href="/dynamic">Dynamic</a><a href="/private">Private</a><a href="http://127.0.0.1:4174/external">External</a></nav>${body}</body></html>`;
const card = (p, tag = 'section', className = 'unit') =>
  `<${tag} class="${className}" data-sku="${p.id}"><a href="/product/${p.id}"><img src="${p.image}" alt="${p.name}" loading="lazy"><h3>${p.name}</h3></a><span class="price">${p.price.toLocaleString('en')} تومان</span><span class="sku">${p.id}</span><dl><dt>Brand</dt><dd>Hashira</dd></dl></${tag}>`;
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4173');
    const send = (body, status = 200, type = 'text/html; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type });
      res.end(body);
    };
    if (
      /^\/(?:sidepanel|popup|offscreen|background)\.js$/.test(url.pathname) ||
      /^\/assets\/[\w-]+\.(?:js|css)$/.test(url.pathname)
    ) {
      return send(
        await readFile(fileURLToPath(new URL('../../dist' + url.pathname, import.meta.url))),
        200,
        url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript',
      );
    }
    if (url.pathname === '/harness.js')
      return send(
        await readFile(fileURLToPath(new URL('./.generated/harness.js', import.meta.url))),
        200,
        'text/javascript',
      );
    if (url.pathname.startsWith('/extension/')) {
      const path = url.pathname.slice('/extension/'.length);
      if (path.includes('..') || !/^[-\w./]+$/.test(path)) return send('', 400);
      const type = path.endsWith('.js')
        ? 'text/javascript'
        : path.endsWith('.css')
          ? 'text/css'
          : 'text/html';
      return send(
        await readFile(fileURLToPath(new URL('../../dist/' + path, import.meta.url))),
        200,
        type,
      );
    }
    if (url.pathname === '/semantic')
      return send(await readFile(fileURLToPath(new URL('./semantic.html', import.meta.url))));
    if (url.pathname === '/media/full')
      return send(await readFile(base + 'photo.avif'), 200, 'image/avif');
    if (url.pathname === '/robots.txt')
      return send('User-agent: *\nDisallow: /private\nDisallow: /logout\n', 200, 'text/plain');
    if (url.pathname.startsWith('/assets/')) {
      const filename = url.pathname.split('/').pop();
      if (!/^[\w.-]+$/.test(filename)) return send('', 400);
      const mime =
        {
          jpg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          avif: 'image/avif',
          gif: 'image/gif',
          bmp: 'image/bmp',
          svg: 'image/svg+xml',
          pdf: 'application/pdf',
        }[filename.split('.').pop()] || 'text/plain';
      try {
        return send(await readFile(base + filename), 200, mime);
      } catch {
        return send('not found', 404);
      }
    }
    if (url.pathname === '/api/products')
      return send(
        JSON.stringify({
          products: products.slice(0, 5),
          token: 'never-export-this',
          password: 'never-export-this',
        }),
        200,
        'application/json',
      );
    if (url.pathname === '/errors/429') {
      if (rateCount++ < 1) {
        res.writeHead(429, { 'Retry-After': '2', 'Content-Type': 'text/plain' });
        return res.end('Rate limited');
      }
      return send(await readFile(base + 'photo.png'), 200, 'image/png');
    }
    if (url.pathname === '/errors/403')
      return send(page('Access denied', '<h1>Forbidden</h1>'), 403);
    if (url.pathname === '/errors/404') return send('Missing', 404);
    if (url.pathname === '/auth')
      return send(
        page(
          'Sign in',
          '<form><input type="password" value="never-export-this"><input name="csrf" value="secret"></form>',
        ),
      );
    if (url.pathname === '/corrupt.png') return send('not an image', 200, 'image/png');
    if (url.pathname === '/private') return send(page('Private', '<h1>Do not crawl</h1>'));
    if (url.pathname.startsWith('/product/')) {
      const p = products.find((x) => x.id === url.pathname.split('/').pop()) || products[0];
      return send(
        page(
          p.name,
          `<main><h1>${p.name}</h1><p class="price">${p.price}</p><div class="gallery"><picture><source srcset="/assets/photo.webp 2x"><img src="${p.image}" srcset="/assets/thumb.jpg 120w, /assets/photo.jpg 640w" width="640" height="480" alt="product gallery"></picture><img data-original="/assets/photo.png" src="/assets/thumb.jpg"><div style="width:60px;height:60px;background-image:url('/assets/diagram.svg')"></div></div><dl><dt>کد فنی</dt><dd>${p.id}</dd><dt>وزن</dt><dd>۲ کیلوگرم</dd></dl><a href="/assets/manual.pdf">Manual PDF</a></main>`,
          `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.id, url: 'http://127.0.0.1:4173/product/' + p.id, image: [p.image, '/assets/photo.png'], offers: { '@type': 'Offer', price: p.price, priceCurrency: 'IRR' } })}</script>`,
        ),
      );
    }
    if (url.pathname === '/commerce') {
      const n = Number(url.searchParams.get('page') || 1);
      return send(
        page(
          'Commerce fixture',
          `<main class="woocommerce"><h1>Commerce collection</h1><ul class="products">${products
            .slice((n - 1) * 3, n * 3)
            .map((p) => card(p, 'li', 'product'))
            .join('')}</ul>${n < 2 ? '<a rel="next" href="/commerce?page=2">Next</a>' : ''}</main>`,
          `<meta name="generator" content="WooCommerce">`,
        ),
      );
    }
    if (url.pathname === '/tables') {
      const n = Number(url.searchParams.get('page') || 1);
      return send(
        page(
          'Table fixture',
          `<h1>Inventory</h1><table><caption>Inventory ${n}</caption><thead><tr><th rowspan="2">کد</th><th colspan="2">Stock</th></tr><tr><th>Available</th><th>Reserved</th></tr></thead><tbody><tr><td rowspan="2">A${n}</td><td>10</td><td>2</td></tr><tr><td>20</td><td>3</td></tr><tr><td>B${n}</td><td colspan="2">5<table><tr><th>Inner</th></tr><tr><td>Nested</td></tr></table></td></tr></tbody></table>${n < 2 ? '<a rel="next" href="/tables?page=2">Next</a>' : ''}<img src="/assets/photo.gif">`,
        ),
      );
    }
    if (url.pathname === '/rtl') {
      return send(
        page(
          'کاتالوگ فارسی',
          `<main dir="rtl"><h1>قطعات خودرو</h1><div class="cards">${products
            .slice(0, 4)
            .map(
              (p) =>
                `<article class="rtl-card"><a href="/product/${p.id}"><h2>لنت ترمز ${p.id}</h2><img data-src="${p.image}" src="/assets/thumb.jpg" alt="محصول"></a><b class="price">۸۵۰٬۰۰۰ تومان</b><span class="sku">کد ${p.id}</span><dl><dt>شركت</dt><dd>ایساكو</dd></dl></article>`,
            )
            .join('')}</div></main>`,
        ),
      );
    }
    if (url.pathname === '/dynamic') {
      return send(
        page(
          'JavaScript fixture',
          '<main><h1>Dynamic stock</h1><div id="list" class="cards"></div><button id="more">Load more</button><div style="height:1500px"></div></main>',
          `<script>const items=${JSON.stringify(products.slice(0, 12))};let count=0;function add(){const list=document.getElementById('list');for(const p of items.slice(count,count+3)){const el=document.createElement('article');el.className='js-card';el.innerHTML='<a href="/product/'+p.id+'"><h2>'+p.name+'</h2><img src="'+p.image+'"></a><span class="price">'+p.price+'</span>';list.append(el);}count+=3;if(count>=items.length)document.getElementById('more').hidden=true;}addEventListener('DOMContentLoaded',()=>{setTimeout(add,150);document.getElementById('more').onclick=add;addEventListener('scroll',()=>{if(scrollY>300&&count<6)add();});});</script>`,
        ),
      );
    }
    const n = Math.min(4, Math.max(1, Number(url.searchParams.get('page') || 1)));
    return send(
      page(
        'Unfamiliar custom catalog',
        `<main><h1>Workshop catalog</h1><div class="catalog">${products
          .slice((n - 1) * 25, n * 25)
          .map((p) => card(p))
          .join(
            '',
          )}</div><div role="navigation">${[1, 2, 3, 4].map((i) => `<a href="/custom?page=${i}">${i}</a>`).join(' ')}${n < 4 ? `<a rel="next" href="/custom?page=${n + 1}">Next</a>` : ''}</div></main>`,
      ),
    );
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
}).listen(4173, '127.0.0.1', () => process.stdout.write('Fixtures: http://127.0.0.1:4173\n'));
