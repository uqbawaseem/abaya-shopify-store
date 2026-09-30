#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STORE = process.env.SHOPIFY_STORE || 'pwf9wa-01.myshopify.com';
const ONLINE_STORE_PUBLICATION_ID = 'gid://shopify/Publication/318327947546';
const IMPORT_MARKER_NAMESPACE = 'catalog_import';
const IMPORT_MARKER_KEY = 'batch';
const IMPORT_MARKER_VALUE = 'abaya-collection-v1';
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const PRODUCTS = [
  {
    title: 'Cuff Line Abaya',
    handle: 'cuff-line-abaya',
    color: 'Black',
    price: '4490.00',
    feature: 'Minimal cuff line detail',
    description:
      'A clean black abaya shaped with a simple, understated silhouette and refined cuff line detail. Designed for modest everyday dressing with a polished, minimal finish.',
  },
  {
    title: 'Minimal Stitch Abaya',
    handle: 'minimal-stitch-abaya',
    color: 'Charcoal',
    price: '4490.00',
    feature: 'Clean stitch detail',
    description:
      'A charcoal abaya with a streamlined shape and subtle stitch detailing. An easy, versatile piece for a composed modest wardrobe.',
  },
  {
    title: 'Button Cuff Abaya',
    handle: 'button-cuff-abaya',
    color: 'Mocha',
    price: '4990.00',
    feature: 'Button cuff detail',
    description:
      'A mocha abaya with softly structured sleeves and button cuff detailing. A refined everyday style with a thoughtful finish at the wrist.',
  },
  {
    title: 'Layered Cuff Abaya',
    handle: 'layered-cuff-abaya',
    color: 'Deep Brown',
    price: '4990.00',
    feature: 'Layered sleeve cuff',
    description:
      'A deep brown abaya with layered sleeve cuffs for quiet visual interest. The relaxed silhouette keeps the look modest, simple and easy to wear.',
  },
  {
    title: 'Panel Flow Abaya',
    handle: 'panel-flow-abaya',
    color: 'Mauve',
    price: '5290.00',
    feature: 'Flowing panel silhouette',
    description:
      'A mauve abaya designed with flowing panels that add movement to the silhouette. A graceful option for understated occasion or everyday styling.',
  },
  {
    title: 'Piped Edge Abaya',
    handle: 'piped-edge-abaya',
    color: 'Olive',
    price: '5290.00',
    feature: 'Contrast piped edge',
    description:
      'An olive abaya finished with contrast piped edging for a defined, tailored look. Minimal in feel, with a crisp detail that frames the design.',
  },
  {
    title: 'Border Embroidery Abaya',
    handle: 'border-embroidery-abaya',
    color: 'Dove Taupe',
    price: '5990.00',
    feature: 'Embroidered sleeve border',
    description:
      'A dove taupe abaya with an embroidered sleeve border that brings soft detail to a modest silhouette. Elegant without feeling overdone.',
  },
  {
    title: 'Pearl Button Abaya',
    handle: 'pearl-button-abaya',
    color: 'Black',
    price: '5790.00',
    feature: 'Pearl-style cuff buttons',
    description:
      'A black abaya accented with pearl-style cuff buttons. The detail adds a delicate finish while keeping the overall look clean and versatile.',
  },
  {
    title: 'Pleated Sleeve Abaya',
    handle: 'pleated-sleeve-abaya',
    color: 'Warm Taupe',
    price: '5790.00',
    feature: 'Pleated sleeve detail',
    description:
      'A warm taupe abaya with pleated sleeve detailing for subtle texture and movement. A calm, feminine piece with an easy modest shape.',
  },
  {
    title: 'Tie Sleeve Abaya',
    handle: 'tie-sleeve-abaya',
    color: 'Sage',
    price: '5990.00',
    feature: 'Tie sleeve / embroidered cuff detail',
    description:
      'A sage abaya with tie sleeve styling and embroidered cuff detail. Softly detailed while remaining refined, modest and wearable.',
  },
];

const COLLECTION_ASSIGNMENTS = {
  abayas: PRODUCTS.map((product) => product.handle),
  'new-arrivals': PRODUCTS.map((product) => product.handle),
  'featured-abayas': ['border-embroidery-abaya', 'pearl-button-abaya', 'tie-sleeve-abaya', 'pleated-sleeve-abaya'],
};

const REQUIRED_COLLECTION_HANDLES = Object.keys(COLLECTION_ASSIGNMENTS);
const BASELINE_PRODUCT_HANDLES = [
  'signature-open-abaya',
  'essential-belted-abaya',
  'everyday-flow-abaya',
  'premium-chiffon-hijab',
  'soft-jersey-hijab',
  'essential-chiffon-hijab',
];

function extractJson(output) {
  const start = output.indexOf('{');
  if (start === -1) throw new Error(`No JSON object found in Shopify CLI output:\n${output}`);

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < output.length; index += 1) {
    const character = output[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(output.slice(start, index + 1));
    }
  }

  throw new Error(`Could not parse Shopify CLI JSON output:\n${output}`);
}

function shopify(query, variables = {}, allowMutations = false) {
  const args = ['store', 'execute', `--store=${STORE}`, '--json', '--query', query, '--variables', JSON.stringify(variables)];
  if (allowMutations) args.push('--allow-mutations');

  const result = spawnSync('shopify', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) throw new Error(output.trim());
  return extractJson(output);
}

function assertNoErrors(errors, action) {
  if (errors?.length) {
    throw new Error(`Shopify userErrors during ${action}: ${JSON.stringify(errors, null, 2)}`);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function productDescription(product) {
  return `<p>${escapeHtml(product.description)}</p>`;
}

function imageDefinitions(product) {
  return [
    {
      path: `demo-products/${product.handle}/01-primary.png`,
      filename: `${product.handle}-01-primary.png`,
      alt: `catalog:${product.handle}:01-primary`,
    },
    {
      path: `demo-products/${product.handle}/02-secondary.png`,
      filename: `${product.handle}-02-secondary.png`,
      alt: `catalog:${product.handle}:02-secondary`,
    },
    {
      path: `demo-products/${product.handle}/03-detail.png`,
      filename: `${product.handle}-03-detail.png`,
      alt: `catalog:${product.handle}:03-detail`,
    },
  ];
}

function selectedOptionsKey(variant) {
  return variant.selectedOptions.map((option) => option.value).join(' / ');
}

function desiredVariantKeys(product) {
  return SIZES.map((size) => `${product.color} / ${size}`);
}

function variantInput(product, key) {
  return {
    price: product.price,
    inventoryPolicy: 'CONTINUE',
    taxable: true,
    optionValues: [
      { optionName: 'Color', name: product.color },
      { optionName: 'Size', name: key.split(' / ')[1] },
    ],
  };
}

function productQueryFields() {
  return `
    id
    title
    handle
    status
    productType
    tags
    vendor
    descriptionHtml
    metafield(namespace: "${IMPORT_MARKER_NAMESPACE}", key: "${IMPORT_MARKER_KEY}") { value }
    options { id name values }
    variants(first: 50) {
      nodes {
        id
        title
        price
        compareAtPrice
        inventoryPolicy
        selectedOptions { name value }
      }
    }
    featuredMedia {
      ... on MediaImage {
        id
        image { altText width height url }
      }
    }
    media(first: 20) {
      nodes {
        id
        alt
        status
        mediaContentType
        preview { image { width height altText url } }
        ... on MediaImage {
          image { width height altText url }
        }
      }
    }
    resourcePublications(first: 20) {
      nodes {
        publication { id name }
        isPublished
      }
    }
    collections(first: 20) {
      nodes { id title handle }
    }
  `;
}

function getProductByHandle(handle) {
  const query = `#graphql
    query ProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        ${productQueryFields()}
      }
    }
  `;
  return shopify(query, { handle }).productByHandle;
}

function getCollections() {
  const query = `#graphql
    query Collections {
      collections(first: 100) {
        nodes {
          id
          title
          handle
          products(first: 100) {
            nodes { id title handle }
          }
        }
      }
    }
  `;
  const data = shopify(query);
  return new Map(data.collections.nodes.map((collection) => [collection.handle, collection]));
}

function validateLocalImages() {
  for (const product of PRODUCTS) {
    for (const image of imageDefinitions(product)) {
      statSync(image.path);
    }
  }
}

function createProduct(product) {
  const mutation = `#graphql
    mutation CreateCatalogProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product { ${productQueryFields()} }
        userErrors { field message }
      }
    }
  `;

  const data = shopify(
    mutation,
    {
      product: {
        title: product.title,
        handle: product.handle,
        descriptionHtml: productDescription(product),
        productType: 'Abaya',
        vendor: 'YOUR BRAND',
        tags: ['Abaya', product.color, product.feature],
        status: 'ACTIVE',
        productOptions: [
          { name: 'Color', position: 1, values: [{ name: product.color }] },
          { name: 'Size', position: 2, values: SIZES.map((size) => ({ name: size })) },
        ],
        metafields: [
          {
            namespace: IMPORT_MARKER_NAMESPACE,
            key: IMPORT_MARKER_KEY,
            type: 'single_line_text_field',
            value: IMPORT_MARKER_VALUE,
          },
        ],
      },
    },
    true
  );

  assertNoErrors(data.productCreate.userErrors, `create product ${product.handle}`);
  return data.productCreate.product;
}

function updateManagedProduct(productId, product) {
  const mutation = `#graphql
    mutation UpdateCatalogProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { ${productQueryFields()} }
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
        descriptionHtml: productDescription(product),
        productType: 'Abaya',
        vendor: 'YOUR BRAND',
        tags: ['Abaya', product.color, product.feature],
        status: 'ACTIVE',
        metafields: [
          {
            namespace: IMPORT_MARKER_NAMESPACE,
            key: IMPORT_MARKER_KEY,
            type: 'single_line_text_field',
            value: IMPORT_MARKER_VALUE,
          },
        ],
      },
    },
    true
  );

  assertNoErrors(data.productUpdate.userErrors, `update product ${product.handle}`);
  return data.productUpdate.product;
}

function assertProductSafeToManage(existing, product) {
  if (!existing) return;
  const marker = existing.metafield?.value;
  if (marker !== IMPORT_MARKER_VALUE) {
    throw new Error(
      `Handle collision for ${product.handle}: existing product ${existing.id} (${existing.title}) does not have ${IMPORT_MARKER_NAMESPACE}.${IMPORT_MARKER_KEY}=${IMPORT_MARKER_VALUE}.`
    );
  }
}

function createMissingVariants(productId, product, existingProduct, isNewProduct) {
  const existingKeys = new Set((existingProduct.variants?.nodes || []).map(selectedOptionsKey));
  const missingKeys = desiredVariantKeys(product).filter((key) => !existingKeys.has(key));
  if (!missingKeys.length) return existingProduct;

  const mutation = `#graphql
    mutation CreateCatalogVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
      productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
        product { ${productQueryFields()} }
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
    .filter((variant) => desiredKeys.has(selectedOptionsKey(variant)))
    .filter((variant) => variant.price !== product.price || variant.compareAtPrice !== null)
    .map((variant) => ({
      id: variant.id,
      price: product.price,
      compareAtPrice: null,
      inventoryPolicy: 'CONTINUE',
      taxable: true,
    }));

  if (!updates.length) return existingProduct;

  const mutation = `#graphql
    mutation UpdateCatalogVariantPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants, allowPartialUpdates: false) {
        product { ${productQueryFields()} }
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

function ensureOptionOrder(productId, product) {
  const mutation = `#graphql
    mutation ReorderCatalogOptions($productId: ID!, $options: [OptionReorderInput!]!) {
      productOptionsReorder(productId: $productId, options: $options) {
        product { ${productQueryFields()} }
        userErrors { field message }
      }
    }
  `;

  const data = shopify(
    mutation,
    {
      productId,
      options: [
        {
          name: 'Color',
          values: [{ name: product.color }],
        },
        {
          name: 'Size',
          values: SIZES.map((size) => ({ name: size })),
        },
      ],
    },
    true
  );

  assertNoErrors(data.productOptionsReorder.userErrors, `reorder options for ${product.handle}`);
  return data.productOptionsReorder.product;
}

function stagedUploads(images) {
  const mutation = `#graphql
    mutation StagedUploads($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }
  `;

  const input = images.map((image) => ({
    resource: 'IMAGE',
    filename: image.filename,
    mimeType: 'image/png',
    fileSize: String(statSync(image.path).size),
    httpMethod: 'POST',
  }));

  const data = shopify(mutation, { input }, true);
  assertNoErrors(data.stagedUploadsCreate.userErrors, 'create staged upload targets');
  return data.stagedUploadsCreate.stagedTargets;
}

function uploadToTarget(image, target) {
  const args = ['-sS', '-X', 'POST'];
  for (const parameter of target.parameters) {
    args.push('-F', `${parameter.name}=${parameter.value}`);
  }
  args.push('-F', `file=@${resolve(image.path)};type=image/png`);
  args.push(target.url);

  const result = spawnSync('curl', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10,
  });
  if (result.status !== 0) {
    throw new Error(`Upload failed for ${image.path}:\n${result.stdout || ''}${result.stderr || ''}`);
  }
}

function attachMedia(productId, images, targets) {
  const mutation = `#graphql
    mutation AttachCatalogMedia($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
      productUpdate(product: $product, media: $media) {
        product { ${productQueryFields()} }
        userErrors { field message }
      }
    }
  `;

  const media = images.map((image, index) => ({
    originalSource: targets[index].resourceUrl,
    alt: image.alt,
    mediaContentType: 'IMAGE',
  }));

  const data = shopify(mutation, { product: { id: productId }, media }, true);
  assertNoErrors(data.productUpdate.userErrors, 'attach product media');
  return data.productUpdate.product;
}

function reorderMedia(productId, mediaIds) {
  const mutation = `#graphql
    mutation ReorderCatalogMedia($id: ID!, $moves: [MoveInput!]!) {
      productReorderMedia(id: $id, moves: $moves) {
        job { id done }
        userErrors { field message }
      }
    }
  `;

  const moves = mediaIds.map((id, index) => ({ id, newPosition: String(index) }));
  const data = shopify(mutation, { id: productId, moves }, true);
  assertNoErrors(data.productReorderMedia.userErrors, 'reorder product media');
  return data.productReorderMedia.job;
}

function waitForMedia(product, images) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const current = getProductByHandle(product.handle);
    const targetNodes = images.map((image) => current.media.nodes.find((node) => node.alt === image.alt)).filter(Boolean);
    if (targetNodes.length === images.length && targetNodes.every((node) => node.status === 'READY')) {
      return current;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500);
  }
  return getProductByHandle(product.handle);
}

function ensureMedia(existingProduct, product) {
  const images = imageDefinitions(product);
  let productState = existingProduct;
  const existingByAlt = new Map(productState.media.nodes.map((node) => [node.alt, node]));
  const missingImages = images.filter((image) => !existingByAlt.has(image.alt));

  if (missingImages.length) {
    const targets = stagedUploads(missingImages);
    missingImages.forEach((image, index) => uploadToTarget(image, targets[index]));
    productState = attachMedia(productState.id, missingImages, targets);
    productState = waitForMedia(product, images);
  }

  const byAlt = new Map(productState.media.nodes.map((node) => [node.alt, node]));
  const orderedIds = images.map((image) => byAlt.get(image.alt)?.id);
  if (orderedIds.some((id) => !id)) {
    throw new Error(`Missing expected media after upload for ${product.handle}`);
  }

  reorderMedia(productState.id, orderedIds);
  return waitForMedia(product, images);
}

function publishResource(id) {
  const mutation = `#graphql
    mutation PublishCatalogResource($id: ID!, $input: [PublicationInput!]!) {
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

function addProductsToCollection(collectionId, productIds, label) {
  if (!productIds.length) return;

  const mutation = `#graphql
    mutation AddCatalogProductsToCollection($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        collection { id title handle products(first: 100) { nodes { id handle title } } }
        userErrors { field message }
      }
    }
  `;

  const data = shopify(mutation, { id: collectionId, productIds }, true);
  const errors = data.collectionAddProducts.userErrors || [];
  const nonDuplicateErrors = errors.filter((error) => !/already exists|already.*collection/i.test(error.message));
  if (nonDuplicateErrors.length) {
    assertNoErrors(nonDuplicateErrors, `add products to ${label}`);
  }
}

function verifyCollectionsExist(collectionsByHandle) {
  for (const handle of REQUIRED_COLLECTION_HANDLES) {
    if (!collectionsByHandle.has(handle)) {
      throw new Error(`Required collection ${handle} was not found. Create it before running this script.`);
    }
  }
}

function verifyProduct(product, saved) {
  const variantKeys = saved.variants.nodes.map(selectedOptionsKey).sort();
  const desiredKeys = desiredVariantKeys(product).sort();
  const options = saved.options.map((option) => `${option.name}:${option.values.join('|')}`);
  return {
    id: saved.id,
    title: saved.title,
    handle: saved.handle,
    status: saved.status,
    productType: saved.productType,
    tags: saved.tags,
    options,
    variantCount: saved.variants.nodes.length,
    variants: saved.variants.nodes.map((variant) => ({
      id: variant.id,
      title: variant.title,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      options: variant.selectedOptions,
    })),
    desiredVariantKeysMatch: JSON.stringify(variantKeys) === JSON.stringify(desiredKeys),
    media: saved.media.nodes.map((node) => ({
      id: node.id,
      alt: node.alt,
      status: node.status,
      width: node.image?.width || node.preview?.image?.width,
      height: node.image?.height || node.preview?.image?.height,
    })),
    featuredMedia: saved.featuredMedia
      ? {
          id: saved.featuredMedia.id,
          alt: saved.featuredMedia.image?.altText,
          width: saved.featuredMedia.image?.width,
          height: saved.featuredMedia.image?.height,
        }
      : null,
    publishedToOnlineStore: saved.resourcePublications.nodes.some(
      (node) => node.publication.id === ONLINE_STORE_PUBLICATION_ID && node.isPublished
    ),
    collections: saved.collections.nodes.map((collection) => collection.handle),
  };
}

function run() {
  validateLocalImages();

  const collectionsByHandle = getCollections();
  verifyCollectionsExist(collectionsByHandle);

  const report = {
    products: [],
    collections: {},
    baselineProducts: [],
    totals: {},
  };

  const productIdsByHandle = new Map();

  for (const product of PRODUCTS) {
    let existing = getProductByHandle(product.handle);
    const isNewProduct = !existing;
    assertProductSafeToManage(existing, product);

    if (!existing) {
      existing = createProduct(product);
      console.log(`Created product ${product.handle}`);
    } else {
      console.log(`Found managed product ${product.handle}`);
    }

    existing = updateManagedProduct(existing.id, product);
    existing = createMissingVariants(existing.id, product, existing, isNewProduct);
    existing = updateVariantPrices(existing.id, product, existing);
    existing = ensureOptionOrder(existing.id, product);
    existing = ensureMedia(existing, product);
    publishResource(existing.id);
    existing = getProductByHandle(product.handle);
    productIdsByHandle.set(product.handle, existing.id);
    report.products.push(verifyProduct(product, existing));
  }

  for (const [collectionHandle, productHandles] of Object.entries(COLLECTION_ASSIGNMENTS)) {
    const collection = collectionsByHandle.get(collectionHandle);
    const productIds = productHandles.map((handle) => productIdsByHandle.get(handle));
    addProductsToCollection(collection.id, productIds, collectionHandle);
  }

  const refreshedCollections = getCollections();
  for (const handle of [...REQUIRED_COLLECTION_HANDLES, 'best-sellers']) {
    const collection = refreshedCollections.get(handle);
    report.collections[handle] = collection
      ? {
          id: collection.id,
          title: collection.title,
          handle: collection.handle,
          productHandles: collection.products.nodes.map((product) => product.handle),
        }
      : null;
  }

  for (const handle of BASELINE_PRODUCT_HANDLES) {
    const product = getProductByHandle(handle);
    report.baselineProducts.push({
      id: product?.id,
      title: product?.title,
      handle: product?.handle,
      variantCount: product?.variants.nodes.length,
      mediaCount: product?.media.nodes.length,
      mediaAlts: product?.media.nodes.map((node) => node.alt),
    });
  }

  report.totals = {
    productCount: report.products.length,
    variantCount: report.products.reduce((sum, product) => sum + product.variantCount, 0),
    mediaCount: report.products.reduce((sum, product) => sum + product.media.length, 0),
    onlineStorePublishedCount: report.products.filter((product) => product.publishedToOnlineStore).length,
  };

  writeFileSync(resolve('tmp-abaya-catalog-expansion-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

run();
