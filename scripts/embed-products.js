const { config } = require('dotenv');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigserial,
  customType,
} = require('drizzle-orm/pg-core');
const { eq } = require('drizzle-orm');

config({ path: '.env.development.local' });

const connectionString = process.env.DATABASE_URL;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

if (!openaiApiKey) {
  throw new Error('OPENAI_API_KEY is not set');
}

const sql = postgres(connectionString);
const db = drizzle(sql);

const vector = customType({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value) {
    if (!Array.isArray(value)) {
      throw new Error('Vector values must be number arrays');
    }
    return JSON.stringify(value);
  },
  fromDriver(value) {
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('Failed to parse vector from driver:', error);
      return [];
    }
  },
});

const product = pgTable('Product', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  sku: text('sku').notNull(),
  language: text('language').notNull(),
  category: text('category'),
  productName: text('product_name').notNull(),
  price: integer('price').notNull(),
  discountPrice: integer('discount_price'),
  productUrl: text('product_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const productChunks = pgTable('Product_Chunks', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  productId: uuid('product_id').notNull(),
  sku: text('sku').notNull(),
  language: text('language').notNull(),
  category: text('category'),
  productName: text('product_name').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 7500),
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data.data[0].embedding;
}

function buildProductText(prod) {
  const parts = [
    `상품명: ${prod.productName}`,
    prod.category ? `카테고리: ${prod.category}` : null,
    `언어: ${prod.language}`,
    `가격: ${prod.price}`,
  ];

  if (prod.discountPrice) {
    parts.push(`할인 가격: ${prod.discountPrice}`);
  }

  parts.push(`SKU: ${prod.sku}`);

  if (prod.productUrl) {
    parts.push(`URL: ${prod.productUrl}`);
  }

  return parts.filter(Boolean).join('\n');
}

async function processProducts() {
  console.log('🛍️ 상품 임베딩 생성 시작...');

  const products = await db.select().from(product);
  if (products.length === 0) {
    console.log('상품 데이터가 없습니다. import-product.js 실행을 확인하세요.');
    return;
  }

  let processedCount = 0;
  for (const prod of products) {
    try {
      await db.delete(productChunks).where(eq(productChunks.productId, prod.id));

      const fullText = buildProductText(prod);
      const embedding = await generateEmbedding(fullText);

      await db.insert(productChunks).values({
        productId: prod.id,
        language: prod.language,
        category: prod.category,
        sku: prod.sku,
        productName: prod.productName,
        content: fullText,
        embedding,
      });

      processedCount += 1;
      if (processedCount % 10 === 0) {
        console.log(`✅ ${processedCount}/${products.length} 상품 처리 완료`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`상품 임베딩 실패 (SKU: ${prod.sku}):`, error);
    }
  }

  console.log(`🎉 상품 임베딩 완료: ${processedCount}개`);
}

async function runProductEmbeddingPipeline() {
  console.log('🚀 상품 임베딩 파이프라인 시작...');

  try {
    await processProducts();
    console.log('🎉 상품 임베딩 파이프라인 완료!');
  } catch (error) {
    console.error('❌ 상품 임베딩 파이프라인 실패:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  runProductEmbeddingPipeline();
}

module.exports = { runProductEmbeddingPipeline };
