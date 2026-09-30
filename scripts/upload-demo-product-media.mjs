#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STORE = process.env.SHOPIFY_STORE || 'pwf9wa-01.myshopify.com';

const PRODUCTS = {
  'essential-belted-abaya': {
    id: 'gid://shopify/Product/10438036816154',
    images: [
      {
        path: 'demo-products/essential-belted-abaya/01-primary.png',
        filename: 'essential-belted-abaya-01-primary.png',
        alt: 'ai-demo:essential-belted-abaya:01-primary',
      },
      {
        path: 'demo-products/essential-belted-abaya/02-secondary.png',
        filename: 'essential-belted-abaya-02-secondary.png',
        alt: 'ai-demo:essential-belted-abaya:02-secondary',
      },
      {
        path: 'demo-products/essential-belted-abaya/03-detail.png',
        filename: 'essential-belted-abaya-03-detail.png',
        alt: 'ai-demo:essential-belted-abaya:03-detail',
      },
    ],
  },
  'everyday-flow-abaya': {
    id: 'gid://shopify/Product/10438037799194',
    images: [
      {
        path: 'demo-products/everyday-flow-abaya/01-primary.png',
        filename: 'everyday-flow-abaya-01-primary.png',
        alt: 'ai-demo:everyday-flow-abaya:01-primary',
      },
      {
        path: 'demo-products/everyday-flow-abaya/02-secondary.png',
        filename: 'everyday-flow-abaya-02-secondary.png',
        alt: 'ai-demo:everyday-flow-abaya:02-secondary',
      },
      {
        path: 'demo-products/everyday-flow-abaya/03-detail.png',
        filename: 'everyday-flow-abaya-03-detail.png',
        alt: 'ai-demo:everyday-flow-abaya:03-detail',
      },
    ],
  },
  'premium-chiffon-hijab': {
    id: 'gid://shopify/Product/10438038815002',
    images: [
      {
        path: 'demo-products/premium-chiffon-hijab/01-primary.png',
        filename: 'premium-chiffon-hijab-01-primary.png',
        alt: 'ai-demo:premium-chiffon-hijab:01-primary',
      },
      {
        path: 'demo-products/premium-chiffon-hijab/02-secondary.png',
        filename: 'premium-chiffon-hijab-02-secondary.png',
        alt: 'ai-demo:premium-chiffon-hijab:02-secondary',
      },
      {
        path: 'demo-products/premium-chiffon-hijab/03-detail.png',
        filename: 'premium-chiffon-hijab-03-detail.png',
        alt: 'ai-demo:premium-chiffon-hijab:03-detail',
      },
    ],
  },
  'soft-jersey-hijab': {
    id: 'gid://shopify/Product/10438039470362',
    images: [
      {
        path: 'demo-products/soft-jersey-hijab/01-primary.png',
        filename: 'soft-jersey-hijab-01-primary.png',
        alt: 'ai-demo:soft-jersey-hijab:01-primary',
      },
      {
        path: 'demo-products/soft-jersey-hijab/02-secondary.png',
        filename: 'soft-jersey-hijab-02-secondary.png',
        alt: 'ai-demo:soft-jersey-hijab:02-secondary',
      },
      {
        path: 'demo-products/soft-jersey-hijab/03-detail.png',
        filename: 'soft-jersey-hijab-03-detail.png',
        alt: 'ai-demo:soft-jersey-hijab:03-detail',
      },
    ],
  },
  'essential-chiffon-hijab': {
    id: 'gid://shopify/Product/10438040355098',
    images: [
      {
        path: 'demo-products/essential-chiffon-hijab/01-primary.png',
        filename: 'essential-chiffon-hijab-01-primary.png',
        alt: 'ai-demo:essential-chiffon-hijab:01-primary',
      },
      {
        path: 'demo-products/essential-chiffon-hijab/02-secondary.png',
        filename: 'essential-chiffon-hijab-02-secondary.png',
        alt: 'ai-demo:essential-chiffon-hijab:02-secondary',
      },
      {
        path: 'demo-products/essential-chiffon-hijab/03-detail.png',
        filename: 'essential-chiffon-hijab-03-detail.png',
        alt: 'ai-demo:essential-chiffon-hijab:03-detail',
      },
    ],
  },
};

const PRODUCT_HANDLE = process.argv[2];
const PRODUCT = PRODUCTS[PRODUCT_HANDLE];

if (!PRODUCT) {
  console.error(`Usage: node scripts/upload-demo-product-media.mjs ${Object.keys(PRODUCTS).join('|')}`);
  process.exit(1);
}

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
    maxBuffer: 1024 * 1024 * 10,
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

function currentProductMedia() {
  const query = `#graphql
    query ProductMedia($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        handle
        featuredMedia {
          ... on MediaImage {
            id
            image { url altText width height }
          }
        }
        media(first: 20) {
          nodes {
            id
            alt
            status
            mediaContentType
            preview { image { url width height altText } }
            ... on MediaImage {
              image { url width height altText }
            }
          }
        }
      }
    }
  `;

  const data = shopify(query, { handle: PRODUCT_HANDLE });
  if (!data.productByHandle || data.productByHandle.id !== PRODUCT.id) {
    throw new Error(`Expected product ${PRODUCT_HANDLE} with ID ${PRODUCT.id}, but query returned ${data.productByHandle?.id}`);
  }
  return data.productByHandle;
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

function attachMedia(images, targets) {
  const mutation = `#graphql
    mutation AttachProductMedia($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
      productUpdate(product: $product, media: $media) {
        product {
          id
          media(first: 20) {
            nodes {
              id
              alt
              status
              ... on MediaImage {
                image { url width height altText }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const media = images.map((image, index) => ({
    originalSource: targets[index].resourceUrl,
    alt: image.alt,
    mediaContentType: 'IMAGE',
  }));

  const data = shopify(mutation, { product: { id: PRODUCT.id }, media }, true);
  assertNoErrors(data.productUpdate.userErrors, 'attach product media');
  return data.productUpdate.product;
}

function reorderMedia(mediaIds) {
  const mutation = `#graphql
    mutation ReorderProductMedia($id: ID!, $moves: [MoveInput!]!) {
      productReorderMedia(id: $id, moves: $moves) {
        job { id done }
        userErrors { field message }
      }
    }
  `;

  const moves = mediaIds.map((id, index) => ({ id, newPosition: String(index) }));
  const data = shopify(mutation, { id: PRODUCT.id, moves }, true);
  assertNoErrors(data.productReorderMedia.userErrors, 'reorder product media');
  return data.productReorderMedia.job;
}

function waitForProcessing() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const product = currentProductMedia();
    const nodes = product.media.nodes;
    const targetNodes = PRODUCT.images.map((image) => nodes.find((node) => node.alt === image.alt)).filter(Boolean);
    if (targetNodes.length === PRODUCT.images.length && targetNodes.every((node) => node.status === 'READY')) {
      return product;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500);
  }
  return currentProductMedia();
}

function main() {
  for (const image of PRODUCT.images) statSync(image.path);

  let product = currentProductMedia();
  const existingByAlt = new Map(product.media.nodes.map((node) => [node.alt, node]));
  const missingImages = PRODUCT.images.filter((image) => !existingByAlt.has(image.alt));

  if (missingImages.length) {
    const targets = stagedUploads(missingImages);
    missingImages.forEach((image, index) => uploadToTarget(image, targets[index]));
    attachMedia(missingImages, targets);
    product = waitForProcessing();
  }

  const refreshedByAlt = new Map(product.media.nodes.map((node) => [node.alt, node]));
  const orderedMediaIds = PRODUCT.images.map((image) => refreshedByAlt.get(image.alt)?.id);
  if (orderedMediaIds.some((id) => !id)) {
    throw new Error(`Missing expected media after upload: ${JSON.stringify(PRODUCT.images.map((image) => image.alt))}`);
  }

  reorderMedia(orderedMediaIds);
  product = waitForProcessing();

  const finalOrder = product.media.nodes.map((node) => ({
    id: node.id,
    alt: node.alt,
    status: node.status,
    width: node.image?.width || node.preview?.image?.width,
    height: node.image?.height || node.preview?.image?.height,
  }));
  const featured = product.featuredMedia;

  const report = {
    product: {
      id: product.id,
      title: product.title,
      handle: product.handle,
    },
    uploaded: missingImages.map((image) => image.path),
    mediaOrder: finalOrder,
    featuredMedia: featured
      ? {
          id: featured.id,
          alt: featured.image?.altText,
          width: featured.image?.width,
          height: featured.image?.height,
        }
      : null,
  };

  writeFileSync(`tmp-${PRODUCT_HANDLE}-media-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
