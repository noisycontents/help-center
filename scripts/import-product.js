const { readFileSync } = require('fs');
const { parse } = require('csv-parse/sync');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { config } = require('dotenv');

// 환경 변수 로드
config({ path: '.env.development.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const sql = postgres(connectionString);
const db = drizzle(sql);

// Product 테이블 스키마 정의
const { pgTable, uuid, varchar, text, timestamp, integer } = require('drizzle-orm/pg-core');

const product = pgTable('Product', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  sku: text('sku').notNull().unique(), // text 타입으로 변경하여 긴 SKU 지원
  language: text('language').notNull(),
  category: text('category'),
  productName: text('product_name').notNull(),
  price: integer('price').notNull(),
  discountPrice: integer('discount_price'),
  productUrl: text('product_url'), // 상품 URL 추가
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 가격 파싱 함수 (콤마 제거 및 숫자 변환)
function parsePrice(priceStr) {
  if (!priceStr || priceStr.trim() === '') {
    return null;
  }
  const cleanPrice = priceStr.replace(/,/g, '');
  const parsed = parseInt(cleanPrice, 10);
  return isNaN(parsed) ? null : parsed;
}

async function importProduct() {
  try {
    console.log('CSV 파일을 파싱하는 중...');
    
    // CSV 파일을 표준 라이브러리로 파싱 (BOM 제거)
    let csvData = readFileSync('product.csv', 'utf-8');
    // BOM 제거
    if (csvData.charCodeAt(0) === 0xFEFF) {
      csvData = csvData.slice(1);
    }
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`파싱 완료: ${records.length}개의 레코드`);
    
    // 첫 몇 개 레코드 확인
    if (records.length > 0) {
      console.log('첫 번째 레코드 샘플:', {
        sku: records[0].sku,
        language: records[0].language,
        category: records[0].category,
        product_name: records[0].product_name?.substring(0, 50) + '...',
        price: records[0].price,
        discount_price: records[0].discount_price,
        product_url: records[0].product_url
      });
    }

    // 기존 데이터 삭제
    console.log('기존 Product 데이터를 삭제하는 중...');
    await db.delete(product);

    // 데이터 삽입
    console.log('새로운 Product 데이터를 삽입하는 중...');
    
    let insertCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    for (const [index, record] of records.entries()) {
      try {
        // 필수 필드 검증 (language는 빈 경우 기본값 설정)
        if (!record.sku || !record.product_name || !record.price) {
          skippedCount++;
          console.log(`레코드 스킵됨 (${index + 1}행):`, {
            sku: record.sku ? '✓' : '✗',
            product_name: record.product_name ? '✓' : '✗',
            price: record.price ? '✓' : '✗',
          });
          continue;
        }

        // language가 빈 경우 기본값 설정
        let language = record.language && record.language.trim() !== '' ? record.language.trim() : '기타';

        // 가격 파싱
        const price = parsePrice(record.price);
        const discountPrice = parsePrice(record.discount_price);

        if (price === null) {
          skippedCount++;
          console.log(`가격 파싱 실패로 스킵됨 (${index + 1}행): ${record.price}`);
          continue;
        }

        // 데이터 삽입 (SKU 길이 제한 제거)
        await db.insert(product).values({
          sku: record.sku.trim(),
          language: language,
          category: record.category ? record.category.trim() : null,
          productName: record.product_name.trim(),
          price: price,
          discountPrice: discountPrice,
          productUrl: record.product_url ? record.product_url.trim() : null,
        });
        
        insertCount++;
        
        if (insertCount % 50 === 0) {
          console.log(`${insertCount}개 레코드 삽입 완료...`);
        }
        
      } catch (error) {
        errors.push({
          row: index + 1,
          sku: record.sku,
          error: error.message
        });
        
        // 중복 SKU 에러인 경우 특별 처리
        if (error.message.includes('duplicate key')) {
          console.log(`⚠️  중복 SKU 발견 (${index + 1}행): ${record.sku}`);
        } else {
          console.error(`❌ 삽입 오류 (${index + 1}행):`, error.message);
        }
        
        skippedCount++;
      }
    }
    
    console.log('\n=== 업로드 완료 ===');
    console.log(`✅ 성공적으로 삽입된 레코드: ${insertCount}개`);
    console.log(`⚠️  스킵된 레코드: ${skippedCount}개`);
    
    if (errors.length > 0) {
      console.log('\n=== 오류 상세 ===');
      errors.slice(0, 10).forEach(err => {
        console.log(`행 ${err.row} (SKU: ${err.sku}): ${err.error}`);
      });
      if (errors.length > 10) {
        console.log(`... 및 ${errors.length - 10}개의 추가 오류`);
      }
    }
    
  } catch (error) {
    console.error('❌ Product 데이터 삽입 중 오류 발생:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// 스크립트 실행
importProduct().catch(console.error);
