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

// FAQ 테이블 스키마 정의
const { pgTable, uuid, varchar, text, timestamp } = require('drizzle-orm/pg-core');

const faq = pgTable('FAQ', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  brand: varchar('brand', { length: 100 }).notNull(),
  tag: varchar('tag', { length: 100 }).notNull(),
  question: text('question').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

async function importFAQ() {
  try {
    console.log('CSV 파일을 읽는 중...');
    
    // CSV 파일 읽기
    const csvData = readFileSync('ai_chat_doc.csv', 'utf-8');
    
    // CSV 파싱
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`총 ${records.length}개의 레코드를 찾았습니다.`);

    // 기존 데이터 삭제
    console.log('기존 FAQ 데이터를 삭제하는 중...');
    await db.delete(faq);

    // 데이터 삽입
    console.log('새로운 FAQ 데이터를 삽입하는 중...');
    
    let insertCount = 0;
    for (const record of records) {
      if (record.brand && record.tag && record.question && record.content) {
        await db.insert(faq).values({
          brand: record.brand.trim(),
          tag: record.tag.trim(),
          question: record.question.trim(),
          content: record.content.trim(),
        });
        insertCount++;
        
        if (insertCount % 100 === 0) {
          console.log(`${insertCount}개 레코드 삽입 완료...`);
        }
      }
    }

    console.log(`✅ 총 ${insertCount}개의 FAQ 레코드가 성공적으로 삽입되었습니다.`);
    
  } catch (error) {
    console.error('❌ FAQ 데이터 삽입 중 오류 발생:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// 스크립트 실행
importFAQ().catch(console.error);
