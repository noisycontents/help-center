const { readFileSync } = require('fs');
const { parse } = require('csv-parse/sync');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { config } = require('dotenv');

// HTML 정리 함수들 (html-utils.ts와 동일한 로직)
function unescapeCSVHTML(content) {
  let result = content;
  
  // 1. 완전한 a 태그 패턴 처리
  result = result.replace(/<a href=""([^"]*)"" target=""([^"]*)"">/g, '<a href="$1" target="$2">');
  
  // 2. 개별 HTML 속성 처리
  result = result.replace(/href=""([^"]*)""/g, 'href="$1"');
  result = result.replace(/target=""([^"]*)""/g, 'target="$1"');
  result = result.replace(/class=""([^"]*)""/g, 'class="$1"');
  result = result.replace(/src=""([^"]*)""/g, 'src="$1"');
  result = result.replace(/alt=""([^"]*)""/g, 'alt="$1"');
  result = result.replace(/title=""([^"]*)""/g, 'title="$1"');
  result = result.replace(/id=""([^"]*)""/g, 'id="$1"');
  
  // 3. 일반적인 속성=""값"" 패턴
  result = result.replace(/(\w+)=""([^"]*)""/g, '$1="$2"');
  
  // 4. HTML 엔티티 복원
  result = result.replace(/&amp;/g, '&');
  result = result.replace(/&lt;/g, '<');
  result = result.replace(/&gt;/g, '>');
  result = result.replace(/&quot;/g, '"');
  
  // 5. 텍스트 내용의 이중 따옴표 처리
  result = result.replace(/""([^"<>]*)""/g, '"$1"');
  
  return result;
}

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
    console.log('CSV 파일을 파싱하는 중...');
    
    // CSV 파일을 표준 라이브러리로 파싱
    const csvData = readFileSync('ai_chat_doc.csv', 'utf-8');
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`파싱 완료: ${records.length}개의 레코드`);
    
    // 첫 몇 개 레코드 확인
    if (records.length > 0) {
      console.log('첫 번째 레코드 샘플:', {
        brand: records[0].brand,
        tag: records[0].tag,
        question: records[0].question?.substring(0, 50) + '...',
        content: records[0].content?.substring(0, 100) + '...'
      });
    }

    // 기존 데이터 삭제
    console.log('기존 FAQ 데이터를 삭제하는 중...');
    await db.delete(faq);

    // 데이터 삽입
    console.log('새로운 FAQ 데이터를 삽입하는 중...');
    
    let insertCount = 0;
    let skippedCount = 0;
    
    for (const record of records) {
      if (record.brand && record.tag && record.question && record.content) {
        // content를 정리하여 삽입
        const originalContent = record.content.trim();
        const cleanedContent = unescapeCSVHTML(originalContent);
        
        // 디버깅: 중요한 레코드의 변화 확인
        if (record.question && record.question.includes('기타 문의하기')) {
          console.log('🔍 중요 레코드 처리:');
          console.log('질문:', record.question);
          console.log('원본 content:', originalContent.substring(0, 150));
          console.log('정리된 content:', cleanedContent.substring(0, 150));
        }
        
        await db.insert(faq).values({
          brand: record.brand.trim(),
          tag: record.tag.trim(),
          question: record.question.trim(),
          content: cleanedContent,
        });
        insertCount++;
        
        if (insertCount % 100 === 0) {
          console.log(`${insertCount}개 레코드 삽입 완료...`);
        }
      } else {
        skippedCount++;
        console.log(`레코드 스킵됨 (${skippedCount}번째):`, {
          brand: record.brand ? '✓' : '✗',
          tag: record.tag ? '✓' : '✗', 
          question: record.question ? '✓' : '✗',
          content: record.content ? '✓' : '✗',
          question_preview: record.question ? record.question.substring(0, 50) + '...' : 'null'
        });
      }
    }
    
    console.log(`스킵된 레코드: ${skippedCount}개`);

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
