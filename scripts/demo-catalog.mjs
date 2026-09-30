#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STORE = process.env.SHOPIFY_STORE || 'pwf9wa-01.myshopify.com';
const ONLINE_STORE_PUBLICATION_ID = 'gid://shopify/Publication/318327947546';

const PRODUCTS = [
  {
    title: 'Signature Open Abaya',
    handle: 'signature-open-abaya',
    type: 'Abaya',
    color: 'Black',
    price: '129.00',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    description:
      'Demo merchandising copy for a refined open abaya silhouette designed for visual storefront testing. This temporary product content will be replaced before launch.',
  },
  {
    title: 'Essential Belted Abaya',
    handle: 'essential-belted-abaya',
    type: 'Abaya',
    color: 'Mocha',
    price: '139.00',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    description:
      'Demo merchandising copy for a belted abaya with a polished everyday feel. This temporary product content is for development preview only.',
  },
  {
    title: 'Everyday Flow Abaya',
    handle: 'everyday-flow-abaya',
    type: 'Abaya',
    color: 'Sand',
    price: '119.00',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    description:
      'Demo merchandising copy for an easy flowing abaya concept created to test collection browsing, cards and variants.',
  },
  {
    title: 'Premium Chiffon Hijab',
    handle: 'premium-chiffon-hijab',
    type: 'Hijab',
    color: 'Taupe',
    price: '29.00',
    sizes: [],
    description:
      'Demo merchandising copy for a chiffon hijab concept used to preview styling, navigation and collection sections.',
  },
  {
    title: 'Soft Jersey Hijab',
    handle: 'soft-jersey-hijab',
    type: 'Hijab',
    color: 'Dusty Rose',
    price: '27.00',
    sizes: [],
    description:
      'Demo merchandising copy for a soft jersey hijab concept. This is temporary development catalog content only.',
  },
  {
    title: 'Essential Chiffon Hijab',
    handle: 'essential-chiffon-hijab',
    type: 'Hijab',
    color: 'Black',
    price: '25.00',
    sizes: [],
    description:
      'Demo merchandising copy for an essential chiffon hijab concept created for storefront visual testing.',
  },
];

const COLLECTIONS = [
  { title: 'ABAYAS', handle: 'abayas', productHandles: ['signature-open-abaya', 'essential-belted-abaya', 'everyday-flow-abaya'] },
  { title: 'HIJABS', handle: 'hijabs', productHandles: ['premium-chiffon-hijab', 'soft-jersey-hijab', 'essential-chiffon-hijab'] },
  { title: 'NEW ARRIVALS', handle: 'new-arrivals', productHandles: PRODUCTS.map((product) => product.handle) },
  { title: 'FEATURED ABAYAS', handle: 'featured-abayas', productHandles: ['signature-open-abaya', 'essential-belted-abaya', 'everyday-flow-abaya'] },
  { title: 'BEST SELLERS', handle: 'best-sellers', productHandles: ['signature-open-abaya', 'premium-chiffon-hijab', 'soft-jersey-hijab'] },
];

const TARGET_MENU_ITEMS = [
  { title: 'ABAYAS', handle: 'abayas' },
  { title: 'HIJABS', handle: 'hijabs' },
  { title: 'NEW ARRIVALS', handle: 'new-arrivals' },
  { title: 'BEST SELLERS', handle: 'best-sellers' },
];

const REPORT = {
  products: [],
  collections: [],
  assignments: {},
  navigation: null,
  imageStatus: 'No local demo-products/ imagery found. Products were created without media.',
};

function extractJson(output) {
  const start = output.indexOf('{');
  if (start === -1) throw new Error(`No JSON object found in Shopify CLI output:\n${output}`);
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < output.length; index += 1) {
    const character = output[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(output.slice(start, index + 1));
      }
    }
  }

  throw new Error(`Could not parse balanced JSON object from Shopify CLI output:\n${output}`);
}

function shopify(query, variables = {}, allowMutations = false) {
  const args = ['store', 'execute', `--store=${STORE}`, '--json', '--query', query, '--variables', JSON.stringify(variables)];
  if (allowMutations) args.push('--allow-mutations');

  const result = spawnSync('shopify', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10,
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) {
    throw new Error(output.trim());
  }

  return extractJson(output);
}

function descriptionHtml(product) {
  return `<p>${escapeHtml(product.description)}</p><p><strong>Demo product:</strong> temporary catalog data for storefront development only.</p>`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function desiredVariantKeys(product) {
  if (product.type === 'Abaya') {
    return product.sizes.map((size) => `${product.color} / ${size}`);
  }
  return [product.color];
}

function variantInput(product, key) {
  const values = product.type === 'Abaya'
    ? [
        { optionName: 'Color', name: product.color },
        { optionName: 'Size', name: key.split(' / ')[1] },
      ]
    : [{ optionName: 'Color', name: product.color }];

  return {
    price: product.price,
    inventoryPolicy: 'CONTINUE',
    taxable: true,
    optionValues: values,
  };
}

function getExistingState() {
  const query = `#graphql
    query ExistingDemoState {
      products(first: 50, query: "tag:ai-demo") {
        nodes {
          id
          title
          handle
          status
          tags
          productType
          options { id name values }
          variants(first: 50) {
            nodes {
              id
              title
              price
              selectedOptions { name value }
            }
          }
          collections(first: 20) {
            nodes { id handle title }
          }
        }
      }
      collections(first: 100) {
        nodes {
          id
          title
          handle
          products(first: 50) {
            nodes { id title handle }
          }
        }
      }
      menus(first: 20) {
        nodes {
          id
          handle
          title
          items {
            id
            title
            type
            url
            resourceId
            items {
              id
              title
              type
              url
              resourceId
            }
          }
        }
      }
    }
  `;

  const data = shopify(query);
  return {
    productsByHandle: new Map(data.products.nodes.map((product) => [product.handle, product])),
    collectionsByHandle: new Map(data.collections.nodes.map((collection) => [collection.handle, collection])),
    mainMenu: data.menus.nodes.find((menu) => menu.handle === 'main-menu'),
  };
}

function createCollection(collection) {
  const mutation = `#graphql
    mutation CreateDemoCollection($collection: CollectionCreateInput!) {
      collectionCreate(collection: $collection) {
        collection { id title handle }
        userErrors { field message }
      }
    }
  `;
  const data = shopify(
    mutation,
    {
      collection: {
        title: collection.title,
        handle: collection.handle,
        descriptionHtml: `<p>Temporary development collection for visual storefront testing.</p>`,
        sortOrder: 'MANUAL',
        metafields: [
          {
            namespace: 'demo',
            key: 'workflow',
            type: 'single_line_text_field',
            value: 'ai-demo',
          },
        ],
      },
    },
    true
  );

  assertNoErrors(data.collectionCreate.userErrors, `create collection ${collection.handle}`);
  return data.collectionCreate.collection;
}

function createProduct(product) {
  const mutation = `#graphql
    mutation CreateDemoProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product {
          id
          title
          handle
          status
          tags
          options { id name values }
          variants(first: 20) {
            nodes { id title price selectedOptions { name value } }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const productOptions = product.type === 'Abaya'
    ? [
        { name: 'Color', position: 1, values: [{ name: product.color }] },
        { name: 'Size', position: 2, values: product.sizes.map((size) => ({ name: size })) },
      ]
    : [{ name: 'Color', position: 1, values: [{ name: product.color }] }];

  const data = shopify(
    mutation,
    {
      product: {
        title: product.title,
        handle: product.handle,
        descriptionHtml: descriptionHtml(product),
        productType: product.type,
        vendor: 'YOUR BRAND',
        tags: ['ai-demo', product.type, product.color],
        status: 'ACTIVE',
        productOptions,
        metafields: [
          {
            namespace: 'demo',
            key: 'workflow',
            type: 'single_line_text_field',
            value: 'ai-demo',
          },
        ],
      },
    },
    true
  );

  assertNoErrors(data.productCreate.userErrors, `create product ${product.handle}`);
  return data.productCreate.product;
}

function updateProduct(productId, product, collectionIds) {
  const mutation = `#graphql
    mutation UpdateDemoProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product {
          id
          title
          handle
          status
          tags
          options { id name values }
          variants(first: 50) {
            nodes { id title price selectedOptions { name value } }
          }
          collections(first: 20) {
            nodes { id handle title }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const data = shopify(
    mutation,
    {
      product: {
        id: productId,
        title: product.title,
        descriptionHtml: descriptionHtml(product),
        productType: product.type,
        vendor: 'YOUR BRAND',
        tags: ['ai-demo', product.type, product.color],
        status: 'ACTIVE',
        collectionsToJoin: collectionIds,
      },
    },
    true
  );

  assertNoErrors(data.productUpdate.userErrors, `update product ${product.handle}`);
  return data.productUpdate.product;
}

function createMissingVariants(productId, product, existingProduct, isNewProduct) {
  const existingKeys = new Set(
    (existingProduct.variants?.nodes || []).map((variant) => variant.selectedOptions.map((option) => option.value).join(' / '))
  );
  const missingKeys = desiredVariantKeys(product).filter((key) => !existingKeys.has(key));
  if (!missingKeys.length) return existingProduct;

  const mutation = `#graphql
    mutation CreateDemoVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
      productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
        product {
          id
          title
          handle
          status
          options { id name values }
          variants(first: 50) {
            nodes { id title price selectedOptions { name value } }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const data = shopify(
    mutation,
    {
      productId,
      variants: missingKeys.map((key) => variantInput(product, key)),
      strategy: isNewProduct ? 'REMOVE_STANDALONE_VARIANT' : 'DEFAULT',
    },
    true
  );

  assertNoErrors(data.productVariantsBulkCreate.userErrors, `create variants for ${product.handle}`);
  return data.productVariantsBulkCreate.product;
}

function updateVariantPrices(productId, product, existingProduct) {
  const desiredKeys = new Set(desiredVariantKeys(product));
  const updates = (existingProduct.variants?.nodes || [])
    .filter((variant) => desiredKeys.has(variant.selectedOptions.map((option) => option.value).join(' / ')))
    .filter((variant) => variant.price !== product.price)
    .map((variant) => ({
      id: variant.id,
      price: product.price,
      inventoryPolicy: 'CONTINUE',
      taxable: true,
    }));

  if (!updates.length) return existingProduct;

  const mutation = `#graphql
    mutation UpdateDemoVariantPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants, allowPartialUpdates: false) {
        product {
          id
          title
          handle
          status
          options { id name values }
          variants(first: 50) {
            nodes { id title price selectedOptions { name value } }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const data = shopify(
    mutation,
    {
      productId,
      variants: updates,
    },
    true
  );

  assertNoErrors(data.productVariantsBulkUpdate.userErrors, `update variant prices for ${product.handle}`);
  return data.productVariantsBulkUpdate.product;
}

function publishResource(id) {
  const mutation = `#graphql
    mutation PublishDemoResource($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        publishable { ... on Product { id } ... on Collection { id } }
        userErrors { field message }
      }
    }
  `;

  const data = shopify(
    mutation,
    {
      id,
      input: [{ publicationId: ONLINE_STORE_PUBLICATION_ID }],
    },
    true
  );

  const errors = data.publishablePublish.userErrors || [];
  const ignorable = errors.every((error) => /already published/i.test(error.message));
  if (errors.length && !ignorable) {
    assertNoErrors(errors, `publish ${id}`);
  }
}

function updateMainMenu(mainMenu, collectionsByHandle) {
  if (!mainMenu) return null;

  const mutation = `#graphql
    mutation UpdateMainMenu($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
      menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
        menu {
          id
          handle
          title
          items { id title type url resourceId }
        }
        userErrors { field message }
      }
    }
  `;

  const existingByTitle = new Map(mainMenu.items.map((item) => [item.title.toUpperCase(), item]));
  const desiredItems = TARGET_MENU_ITEMS.map((item) => {
    const collection = collectionsByHandle.get(item.handle);
    return {
      title: item.title,
      type: 'COLLECTION',
      resourceId: collection.id,
    };
  });

  const preservedItems = mainMenu.items
    .filter((item) => !TARGET_MENU_ITEMS.some((target) => target.title === item.title.toUpperCase()))
    .map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      resourceId: item.resourceId,
      url: item.resourceId ? undefined : item.url,
      items: item.items?.map((child) => ({
        id: child.id,
        title: child.title,
        type: child.type,
        resourceId: child.resourceId,
        url: child.resourceId ? undefined : child.url,
      })),
    }));

  const mergedItems = [
    ...desiredItems.map((item) => {
      const existing = existingByTitle.get(item.title);
      return existing ? { id: existing.id, ...item } : item;
    }),
    ...preservedItems,
  ];

  const data = shopify(
    mutation,
    {
      id: mainMenu.id,
      title: mainMenu.title,
      handle: mainMenu.handle,
      items: mergedItems,
    },
    true
  );

  assertNoErrors(data.menuUpdate.userErrors, 'update main menu');
  return data.menuUpdate.menu;
}

function removeDemoMenuItems(mainMenu) {
  if (!mainMenu) return;

  const targetTitles = new Set(TARGET_MENU_ITEMS.map((item) => item.title));
  const remainingItems = mainMenu.items
    .filter((item) => !targetTitles.has(item.title.toUpperCase()))
    .map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      resourceId: item.resourceId,
      url: item.resourceId ? undefined : item.url,
      items: item.items?.map((child) => ({
        id: child.id,
        title: child.title,
        type: child.type,
        resourceId: child.resourceId,
        url: child.resourceId ? undefined : child.url,
      })),
    }));

  const mutation = `#graphql
    mutation RemoveDemoMenuItems($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
      menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
        menu { id handle title }
        userErrors { field message }
      }
    }
  `;

  const data = shopify(
    mutation,
    {
      id: mainMenu.id,
      title: mainMenu.title,
      handle: mainMenu.handle,
      items: remainingItems,
    },
    true
  );

  assertNoErrors(data.menuUpdate.userErrors, 'remove demo menu items');
  console.log('Removed demo navigation items from main-menu');
}

function cleanup() {
  const state = getExistingState();
  const targetCollectionHandles = new Set(COLLECTIONS.map((collection) => collection.handle));
  const targetProductHandles = new Set(PRODUCTS.map((product) => product.handle));

  removeDemoMenuItems(state.mainMenu);

  for (const product of state.productsByHandle.values()) {
    if (!targetProductHandles.has(product.handle) || !product.tags.includes('ai-demo')) continue;
    const mutation = `#graphql
      mutation DeleteDemoProduct($input: ProductDeleteInput!) {
        productDelete(input: $input, synchronous: true) {
          deletedProductId
          userErrors { field message }
        }
      }
    `;
    const data = shopify(mutation, { input: { id: product.id } }, true);
    assertNoErrors(data.productDelete.userErrors, `delete product ${product.handle}`);
    console.log(`Deleted product ${product.handle}`);
  }

  for (const collection of state.collectionsByHandle.values()) {
    if (!targetCollectionHandles.has(collection.handle)) continue;
    const mutation = `#graphql
      mutation DeleteDemoCollection($input: CollectionDeleteInput!) {
        collectionDelete(input: $input) {
          deletedCollectionId
          userErrors { field message }
        }
      }
    `;
    const data = shopify(mutation, { input: { id: collection.id } }, true);
    assertNoErrors(data.collectionDelete.userErrors, `delete collection ${collection.handle}`);
    console.log(`Deleted collection ${collection.handle}`);
  }
}

function setup() {
  let state = getExistingState();
  const collectionsByHandle = new Map(state.collectionsByHandle);

  for (const collection of COLLECTIONS) {
    let existing = collectionsByHandle.get(collection.handle);
    if (!existing) {
      existing = createCollection(collection);
      console.log(`Created collection ${collection.handle}`);
    } else {
      console.log(`Found collection ${collection.handle}`);
    }
    collectionsByHandle.set(collection.handle, existing);
    publishResource(existing.id);
  }

  const productsByHandle = new Map(state.productsByHandle);

  for (const product of PRODUCTS) {
    const isNewProduct = !productsByHandle.has(product.handle);
    let existing = productsByHandle.get(product.handle);
    if (!existing) {
      existing = createProduct(product);
      console.log(`Created product ${product.handle}`);
    } else {
      console.log(`Found product ${product.handle}`);
    }

    existing = createMissingVariants(existing.id, product, existing, isNewProduct);
    existing = updateVariantPrices(existing.id, product, existing);

    const collectionIds = COLLECTIONS
      .filter((collection) => collection.productHandles.includes(product.handle))
      .map((collection) => collectionsByHandle.get(collection.handle).id);

    existing = updateProduct(existing.id, product, collectionIds);
    publishResource(existing.id);
    productsByHandle.set(product.handle, existing);
  }

  const refreshed = getExistingState();
  const navigation = updateMainMenu(refreshed.mainMenu, collectionsByHandle);
  REPORT.navigation = navigation
    ? navigation.items.map((item) => ({ title: item.title, type: item.type, resourceId: item.resourceId, url: item.url }))
    : 'main-menu not found';

  const finalState = getExistingState();
  for (const product of PRODUCTS) {
    const saved = finalState.productsByHandle.get(product.handle);
    REPORT.products.push({
      title: saved.title,
      handle: saved.handle,
      id: saved.id,
      status: saved.status,
      variants: saved.variants.nodes.map((variant) => ({
        id: variant.id,
        title: variant.title,
        price: variant.price,
        options: variant.selectedOptions,
      })),
    });
  }

  for (const collection of COLLECTIONS) {
    const saved = finalState.collectionsByHandle.get(collection.handle);
    REPORT.collections.push({
      title: saved.title,
      handle: saved.handle,
      id: saved.id,
    });
    REPORT.assignments[collection.handle] = saved.products.nodes.map((product) => product.handle);
  }

  writeFileSync(resolve('tmp-demo-catalog-report.json'), `${JSON.stringify(REPORT, null, 2)}\n`);
  console.log(JSON.stringify(REPORT, null, 2));
}

function assertNoErrors(errors, action) {
  if (errors?.length) {
    throw new Error(`Shopify userErrors during ${action}: ${JSON.stringify(errors, null, 2)}`);
  }
}

const command = process.argv[2] || 'setup';
if (command === 'setup') {
  setup();
} else if (command === 'cleanup') {
  cleanup();
} else {
  console.error('Usage: node scripts/demo-catalog.mjs [setup|cleanup]');
  process.exit(1);
}
