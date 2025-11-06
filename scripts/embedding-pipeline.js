const { config } = require('dotenv');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, and } = require('drizzle-orm');

// 환경 변수 로드
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

// 테이블 스키마 정의
const { pgTable, uuid, varchar, text, timestamp, bigserial, integer, customType, pgEnum } = require('drizzle-orm/pg-core');

const faqKindEnum = pgEnum('faq_kind', ['public', 'internal']);

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

const faq = pgTable('FAQ', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  brand: varchar('brand', { length: 100 }).notNull(),
  tag: varchar('tag', { length: 100 }).notNull(),
  question: text('question').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

const faqInternal = pgTable('FAQ_Internal', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  brand: varchar('brand', { length: 100 }).notNull(),
  tag: varchar('tag', { length: 100 }),
  question: text('question').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

const faqChunks = pgTable('FAQ_Chunks', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  kind: faqKindEnum('kind').notNull(),
  sourceId: uuid('source_id').notNull(),
  brand: varchar('brand', { length: 100 }),
  tag: varchar('tag', { length: 100 }),
  chunkIdx: integer('chunk_idx').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const product = pgTable('Product', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  sku: varchar('sku', { length: 64 }).notNull().unique(),
  language: text('language').notNull(),
  category: text('category'),
  productName: text('product_name').notNull(),
  price: integer('price').notNull(),
  discountPrice: integer('discount_price'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// OpenAI 임베딩 생성 함수
async function generateEmbedding(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // 토큰 제한
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('임베딩 생성 실패:', error);
    throw error;
  }
}

// 텍스트를 청크로 분할
function splitIntoChunks(text, maxLength = 500) {
  const sentences = text.split(/[.!?]\s+/);
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(chunk => chunk.length > 10); // 너무 짧은 청크 제외
}

// 공개 FAQ 임베딩 처리
async function processPublicFAQ() {
  console.log('📊 공개 FAQ 임베딩 처리 시작...');
  
  const faqs = await db.select().from(faq);
  console.log(`총 ${faqs.length}개의 공개 FAQ 발견`);

  let processedCount = 0;
  
  for (const faqItem of faqs) {
    try {
      // 기존 청크 삭제
      await db.delete(faqChunks).where(
        and(
          eq(faqChunks.kind, 'public'),
          eq(faqChunks.sourceId, faqItem.id)
        )
      );

      // 질문과 답변을 합쳐서 청크 생성
      const fullText = `${faqItem.question}\n\n${faqItem.content}`;
      const chunks = splitIntoChunks(fullText);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk);

        await db.insert(faqChunks).values({
          kind: 'public',
          sourceId: faqItem.id,
          brand: faqItem.brand,
          tag: faqItem.tag,
          chunkIdx: i,
          content: chunk,
          embedding,
        });
      }

      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(`✅ ${processedCount}/${faqs.length} 공개 FAQ 처리 완료`);
      }

      // API 제한을 위한 지연
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`공개 FAQ 처리 실패 (ID: ${faqItem.id}):`, error);
    }
  }

  console.log(`🎉 공개 FAQ 임베딩 완료: ${processedCount}개`);
}

// 내부 FAQ 임베딩 처리
async function processInternalFAQ() {
  console.log('🔒 내부 FAQ 임베딩 처리 시작...');
  
  const faqs = await db.select().from(faqInternal);
  console.log(`총 ${faqs.length}개의 내부 FAQ 발견`);

  let processedCount = 0;
  
  for (const faqItem of faqs) {
    try {
      // 기존 청크 삭제
      await db.delete(faqChunks).where(
        and(
          eq(faqChunks.kind, 'internal'),
          eq(faqChunks.sourceId, faqItem.id)
        )
      );

      // 질문과 답변을 합쳐서 청크 생성
      const fullText = `${faqItem.question}\n\n${faqItem.content}`;
      const chunks = splitIntoChunks(fullText);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk);

        await db.insert(faqChunks).values({
          kind: 'internal',
          sourceId: faqItem.id,
          brand: faqItem.brand,
          tag: faqItem.tag,
          chunkIdx: i,
          content: chunk,
          embedding,
        });
      }

      processedCount++;
      console.log(`✅ ${processedCount}/${faqs.length} 내부 FAQ 처리 완료`);

      // API 제한을 위한 지연
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`내부 FAQ 처리 실패 (ID: ${faqItem.id}):`, error);
    }
  }

  console.log(`🎉 내부 FAQ 임베딩 완료: ${processedCount}개`);
}

// 상품 정보 임베딩 처리 (향후 확장용)
async function processProducts() {
  console.log('🛍️ 상품 정보 임베딩 처리 시작...');
  
  const products = await db.select().from(product);
  console.log(`총 ${products.length}개의 상품 발견`);

  if (products.length === 0) {
    console.log('상품 데이터가 없어 건너뜁니다.');
    return;
  }

  // 향후 상품 정보도 임베딩 처리할 수 있도록 준비
  console.log('상품 임베딩은 향후 구현 예정입니다.');
}

// 메인 실행 함수
async function runEmbeddingPipeline() {
  console.log('🚀 임베딩 파이프라인 시작...');
  console.log(`OpenAI API 키: ${openaiApiKey ? '설정됨' : '없음'}`);
  
  try {
    await processPublicFAQ();
    await processInternalFAQ();
    await processProducts();
    
    console.log('🎉 모든 임베딩 파이프라인 완료!');
  } catch (error) {
    console.error('❌ 임베딩 파이프라인 실패:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// 스크립트 실행
if (require.main === module) {
  runEmbeddingPipeline();
}

module.exports = { runEmbeddingPipeline, generateEmbedding };
