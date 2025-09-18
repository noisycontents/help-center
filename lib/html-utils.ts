'use client';

// DOMPurify import 제거 (문제 해결을 위해 임시로)

/**
 * FAQ content의 HTML 태그를 안전하게 sanitize하고 렌더링을 위해 준비합니다.
 * 허용되는 태그: b, strong, i, em, u, ol, ul, li, a, br, p
 */
export function sanitizeHTML(html: string): string {
  if (typeof window === 'undefined') {
    // 서버사이드에서는 HTML 태그를 제거하고 텍스트만 반환
    return html.replace(/<[^>]*>/g, '');
  }

  // 임시로 DOMPurify 없이 직접 처리 (디버깅용)
  // 안전한 태그들만 허용하는 간단한 필터
  const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ol', 'ul', 'li', 'a', 'br', 'p', 'div', 'img', 'iframe'];
  const allowedAttrs = ['href', 'target', 'rel', 'src', 'alt', 'style', 'allowfullscreen', 'loading', 'title'];
  
  // 위험한 태그 제거 (script, object 등)
  let result = html.replace(/<(script|object|embed|form|input|button)[^>]*>.*?<\/\1>/gi, '');
  
  // 이벤트 핸들러 제거
  result = result.replace(/on\w+="[^"]*"/gi, '');
  result = result.replace(/on\w+='[^']*'/gi, '');
  
  return result;
}

/**
 * HTML content를 React에서 안전하게 렌더링하기 위한 props를 생성합니다.
 * 이미지와 YouTube/Vimeo 비디오도 자동으로 처리합니다.
 */
export function createSafeHTML(html: string) {
  // 먼저 미디어 컨텐츠 처리
  const processedContent = processMediaContent(html);
  const sanitizedHTML = sanitizeHTML(processedContent);
  
  // 디버깅을 위한 로그 (개발 환경에서만)
  if (typeof window !== 'undefined' && html.includes('기타 문의하기')) {
    console.log('🔍 HTML 처리 디버깅:');
    console.log('원본:', html.substring(0, 200));
    console.log('미디어 처리 후:', processedContent.substring(0, 200));
    console.log('sanitize 후:', sanitizedHTML.substring(0, 200));
  }
  
  return {
    dangerouslySetInnerHTML: {
      __html: sanitizedHTML
    }
  };
}

/**
 * HTML 태그를 제거하고 순수 텍스트만 반환합니다.
 * 미리보기나 검색 결과에서 사용하기 좋습니다.
 */
export function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * YouTube URL에서 비디오 ID를 추출합니다.
 */
export function getYouTubeVideoId(url: string): string | null {
  const regexes = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    // 파라미터가 포함된 embed URL 처리
    /youtube\.com\/embed\/([^?&\n#]+)(?:\?.*)?/,
  ];
  
  for (const regex of regexes) {
    const match = url.match(regex);
    if (match) return match[1];
  }
  return null;
}

/**
 * Vimeo URL에서 비디오 ID를 추출합니다.
 */
export function getVimeoVideoId(url: string): string | null {
  const regex = /(?:vimeo\.com\/)([0-9]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

/**
 * URL이 이미지인지 확인합니다.
 */
export function isImageUrl(url: string): boolean {
  // 더 관대한 이미지 URL 감지 (studymini.com의 이미지 경로 포함)
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url) || 
         /wp-content\/uploads.*\.(jpg|jpeg|png|gif|webp|svg)/i.test(url) ||
         /media\.studymini\.com/i.test(url);
}

/**
 * URL이 YouTube 링크인지 확인합니다.
 */
export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

/**
 * URL이 Vimeo 링크인지 확인합니다.
 */
export function isVimeoUrl(url: string): boolean {
  return /vimeo\.com/i.test(url);
}

/**
 * CSV에서 이스케이프된 HTML을 정리합니다.
 */
export function unescapeCSVHTML(content: string): string {
  let result = content;
  
  // 더 구체적인 패턴을 먼저 처리하여 정확한 변환
  
  // 1. 완전한 a 태그 패턴 처리 (가장 구체적)
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
  
  // 5. 텍스트 내용의 이중 따옴표 처리 (마지막에)
  // 예: ""수강 완료하기"" → "수강 완료하기"
  result = result.replace(/""([^"<>]*)""/g, '"$1"');
  
  return result;
}

/**
 * 텍스트에서 URL을 찾고 이미지나 비디오로 변환합니다.
 */
export function processMediaContent(content: string): string {
  // 먼저 CSV 이스케이프된 HTML을 정리
  let processedContent = unescapeCSVHTML(content);
  
  // 디버깅 로그
  if (processedContent.includes('youtube') || processedContent.includes('wp-content')) {
    console.log('🔍 미디어 처리 시작:', processedContent.substring(0, 100));
  }
  
  // 1. 단독 라인의 URL 처리 (p 태그로 감싸진 URL - 더 넓은 패턴)
  processedContent = processedContent.replace(/<p>(https?:\/\/[^<>]+?)<\/p>/gi, (match, url) => {
    console.log('🎯 URL 매칭됨:', url);
    // 이미지 URL 처리
    if (isImageUrl(url)) {
      return `<div style="margin: 16px 0; text-align: center;">
        <img 
          src="${url}" 
          alt="FAQ 이미지" 
          style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" 
        />
      </div>`;
    }
    
    // YouTube 비디오 처리
    if (isYouTubeUrl(url)) {
      const videoId = getYouTubeVideoId(url);
      if (videoId) {
        return `<div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; margin: 16px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
          <iframe 
            src="https://www.youtube.com/embed/${videoId}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
            allowfullscreen
            loading="lazy"
            title="YouTube 비디오"
          ></iframe>
        </div>`;
      }
    }
    
    // Vimeo 비디오 처리
    if (isVimeoUrl(url)) {
      const videoId = getVimeoVideoId(url);
      if (videoId) {
        return `<div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; margin: 16px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
          <iframe 
            src="https://player.vimeo.com/video/${videoId}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
            allowfullscreen
            loading="lazy"
            title="Vimeo 비디오"
          ></iframe>
        </div>`;
      }
    }
    
    return match; // 처리되지 않은 URL은 원래대로
  });
  
  // 2. 일반 텍스트 내의 URL 처리 (링크로 변환)
  const urlRegex = /(?<!src="|href=")(https?:\/\/[^\s<>"]+)(?!")/gi;
  
  return processedContent.replace(urlRegex, (url) => {
    // 이미 처리된 URL은 건드리지 않음
    if (processedContent.includes(`src="${url}"`) || processedContent.includes(`href="${url}"`)) {
      return url;
    }
    
    // 일반 링크로 변환
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}
