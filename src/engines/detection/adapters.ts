export interface PlatformAdapter {
  id: string;
  matches: (document: Document) => boolean;
  selectors: string[];
}
// Independently registered hints. No adapter owns the crawler, images or persistence.
export const adapters: PlatformAdapter[] = [
  {
    id: 'Shopify',
    matches: (d) =>
      !!d.querySelector(
        'script[src*="cdn.shopify.com"],link[href*="cdn.shopify.com"],meta[content*="Shopify"]',
      ),
    selectors: ['.product-card', '.grid__item:has([href*="/products/"])'],
  },
  {
    id: 'WooCommerce',
    matches: (d) => !!d.querySelector('body.woocommerce,.woocommerce,link[href*="woocommerce"]'),
    selectors: ['ul.products > li.product'],
  },
  {
    id: 'Magento',
    matches: (d) =>
      !!d.querySelector('script[src*="mage/"],[data-mage-init],body.catalog-category-view'),
    selectors: ['.products-grid .product-item'],
  },
  {
    id: 'PrestaShop',
    matches: (d) =>
      !!d.querySelector('meta[name="generator"][content*="PrestaShop"],script[src*="prestashop"]'),
    selectors: ['.product-miniature'],
  },
  {
    id: 'OpenCart',
    matches: (d) => !!d.querySelector('a[href*="route=product/"],script[src*="catalog/view/"]'),
    selectors: ['.product-thumb'],
  },
];
