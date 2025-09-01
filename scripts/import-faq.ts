import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { faq } from '../lib/db/schema';
import { config } from 'dotenv';

// 환경 변수 로드
config({ path: '.env.development.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const sql = postgres(connectionString);
const db = drizzle(sql);

interface FAQRecord {
  brand: string;
  tag: string;
  question: string;
  content: string;
}

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
    }) as FAQRecord[];

    console.log(`총 ${records.length}개의 레코드를 찾았습니다.`);

    // 기존 데이터 삭제 (선택적)
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
