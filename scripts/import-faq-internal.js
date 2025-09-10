const { readFileSync } = require('fs');
const { parse } = require('csv-parse/sync');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { config } = require('dotenv');

// HTML 정리 함수 (html-utils.ts와 동일한 로직)
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

// FAQ Internal 테이블 스키마 정의
const { pgTable, uuid, varchar, text, timestamp } = require('drizzle-orm/pg-core');

const faqInternal = pgTable('FAQ_Internal', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  brand: varchar('brand', { length: 100 }).notNull(),
  tag: varchar('tag', { length: 100 }), // nullable
  question: text('question').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

async function importFAQInternal() {
  try {
    console.log('Internal FAQ CSV 파일을 읽는 중...');
    
    // CSV 파일 읽기
    const csvData = readFileSync('FAQ_Internal.csv', 'utf-8');
    
    // CSV 파싱
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      quote: '"',
      escape: '"',
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true,
    });

    console.log(`총 ${records.length}개의 Internal FAQ 레코드를 찾았습니다.`);

    // 기존 데이터 삭제
    console.log('기존 Internal FAQ 데이터를 삭제하는 중...');
    await db.delete(faqInternal);

    // 데이터 삽입
    console.log('새로운 Internal FAQ 데이터를 삽입하는 중...');
    
    let insertCount = 0;
    let skippedCount = 0;
    
    for (const record of records) {
      if (record.brand && record.question && record.content) {
        // content를 정리하여 삽입
        const originalContent = record.content.trim();
        const cleanedContent = unescapeCSVHTML(originalContent);
        
        // 디버깅: 링크가 포함된 레코드의 변화 확인
        if (originalContent.includes('href') || originalContent.includes('https://')) {
          console.log('🔍 링크 정리 중:');
          console.log('질문:', record.question.substring(0, 50));
          console.log('원본:', originalContent.includes('href=""') ? '이중따옴표 발견' : '정상');
          console.log('정리후:', cleanedContent.includes('href="') && !cleanedContent.includes('href=""') ? '정상' : '여전히 문제');
        }
        
        await db.insert(faqInternal).values({
          brand: record.brand.trim(),
          tag: record.tag ? record.tag.trim() : null, // tag는 nullable
          question: record.question.trim(),
          content: cleanedContent,
        });
        insertCount++;
        
        if (insertCount % 10 === 0) {
          console.log(`${insertCount}개 Internal FAQ 레코드 삽입 완료...`);
        }
      } else {
        skippedCount++;
        console.log(`Internal FAQ 레코드 스킵됨 (${skippedCount}번째):`, {
          brand: record.brand ? '✓' : '✗',
          tag: record.tag ? '✓' : '선택사항',
          question: record.question ? '✓' : '✗',
          content: record.content ? '✓' : '✗',
          question_preview: record.question ? record.question.substring(0, 50) + '...' : 'null'
        });
      }
    }
    
    console.log(`스킵된 Internal FAQ 레코드: ${skippedCount}개`);
    console.log(`✅ 총 ${insertCount}개의 Internal FAQ 레코드가 성공적으로 삽입되었습니다.`);
    
    // 태그별 분포 확인
    const tagCounts = {};
    records.forEach(record => {
      if (record.tag) {
        tagCounts[record.tag] = (tagCounts[record.tag] || 0) + 1;
      } else {
        tagCounts['태그없음'] = (tagCounts['태그없음'] || 0) + 1;
      }
    });
    
    console.log(`\n📋 Internal FAQ 태그별 분포:`);
    Object.entries(tagCounts).forEach(([tag, count]) => {
      console.log(`- ${tag}: ${count}개`);
    });
    
  } catch (error) {
    console.error('❌ Internal FAQ 데이터 삽입 중 오류 발생:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// 스크립트 실행
importFAQInternal().catch(console.error);
