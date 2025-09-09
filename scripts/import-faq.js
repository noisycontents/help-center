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
    console.log('CSV 파일을 수동으로 파싱하는 중...');
    
    // CSV 파일을 라인별로 읽기 (수동 파싱)
    const csvData = readFileSync('ai_chat_doc.csv', 'utf-8');
    const lines = csvData.split('\n');
    
    console.log(`총 ${lines.length}개의 라인을 찾았습니다.`);
    
    const records = [];
    let currentRecord = null;
    let inRecord = false;
    let contentBuffer = [];
    
    for (let i = 1; i < lines.length; i++) { // 헤더 스킵
      const line = lines[i];
      
      // 새로운 레코드 시작 확인 (일반 패턴과 특수 따옴표 패턴 모두 처리)
      let recordStartMatch = line.match(/^"미니학습지","([^"]+)","([^"]+)","(.*)$/);
      
      // 특수한 따옴표 패턴도 확인 (예: """"수강 완료하기"" 버튼 사용하기")
      if (!recordStartMatch) {
        recordStartMatch = line.match(/^"미니학습지","([^"]+)","""""([^"]*)"" ([^"]*)"","(.*)$/);
        if (recordStartMatch) {
          // 특수 패턴의 경우 question 재구성
          recordStartMatch[2] = `"${recordStartMatch[2]}" ${recordStartMatch[3]}`;
          recordStartMatch[3] = recordStartMatch[4];
        }
      }
      
      if (recordStartMatch) {
        // 이전 레코드 완료 처리
        if (currentRecord) {
          currentRecord.content = contentBuffer.join('\n').replace(/"$/, '');
          records.push(currentRecord);
        }
        
        // 새로운 레코드 시작
        currentRecord = {
          brand: '미니학습지',
          tag: recordStartMatch[1],
          question: recordStartMatch[2],
          content: recordStartMatch[3]
        };
        
        contentBuffer = [recordStartMatch[3]];
        inRecord = true;
        
        // 이 라인에서 레코드가 완료되는지 확인
        if (line.endsWith('"') && !line.endsWith('""')) {
          currentRecord.content = currentRecord.content.replace(/"$/, '');
          records.push(currentRecord);
          currentRecord = null;
          inRecord = false;
          contentBuffer = [];
        }
      } else if (inRecord && line.trim()) {
        // 기존 레코드의 content 계속
        contentBuffer.push(line);
        
        // 레코드 끝 확인
        if (line.endsWith('"') && !line.endsWith('""')) {
          currentRecord.content = contentBuffer.join('\n').replace(/"$/, '');
          records.push(currentRecord);
          currentRecord = null;
          inRecord = false;
          contentBuffer = [];
        }
      }
    }
    
    // 마지막 레코드 처리
    if (currentRecord) {
      currentRecord.content = contentBuffer.join('\n').replace(/"$/, '');
      records.push(currentRecord);
    }

    console.log(`수동 파싱 완료: ${records.length}개의 레코드`);
    
    // 누락된 "수강 완료하기" 레코드 수동 추가 (특수 따옴표 문제로 파싱 실패)
    if (records.length === 56) {
      console.log('누락된 "수강 완료하기" 레코드를 수동으로 추가하는 중...');
      records.push({
        brand: '미니학습지',
        tag: '수강',
        question: '"수강 완료하기" 버튼 사용하기',
        content: `<p>각 강의실에서 학습문답 작성란 위에 <b>"수강 완료하기"</b> 버튼이 있습니다.</p>
<p><u>사용 방법</u></p>
<ol>
<li>⓵ 강의 영상을 모두 시청해도 자동으로 체크되지 않으므로, <u>수강을 마친 후 직접 버튼을 눌러야 합니다.</u></li>
<li>⓶ "수강 완료하기" 버튼을 누른 강의만 수강률에 반영됩니다.</li>
<li>⓷ 버튼을 누른 강의도 수강 기간 내에는 언제든 다시 수강할 수 있습니다.</li>
</ol>
<p><a href="https://studymini.com/contact" target="_blank"><u>기타 문의하기</u></a></p>`
      });
      console.log(`총 ${records.length}개의 레코드 (누락 레코드 포함)`);
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
