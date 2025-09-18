'use client';

import { useEffect, useRef } from 'react';

interface HTMLContentProps {
  content: string;
  className?: string;
}

export const HTMLContent = ({ content, className = '' }: HTMLContentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // HTML 엔티티 처리
      let processedContent = content
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      
      // 미디어 URL 처리 - 더 강력한 패턴 매칭
      console.log('🔍 미디어 처리 시작, content 길이:', processedContent.length);
      
      // 1. 이미지 URL 처리 (media.studymini.com 포함한 더 넓은 패턴)
      const imageMatches = processedContent.match(/<p>(https?:\/\/[^<>]*?(?:\.(jpg|jpeg|png|gif|webp|svg)|media\.studymini\.com)[^<>]*?)<\/p>/gi);
      if (imageMatches) {
        console.log('🖼️ 발견된 이미지 패턴들:', imageMatches);
      }
      
      processedContent = processedContent.replace(/<p>(https?:\/\/[^<>]*?(?:\.(jpg|jpeg|png|gif|webp|svg)|media\.studymini\.com)[^<>]*?)<\/p>/gi, (match, url) => {
        console.log('🖼️ 이미지 URL 처리 중:', url);
        
        // URL 정리
        const cleanUrl = url.trim();
        
        // 단순한 이미지 태그로 처리
        const imageHTML = `<div style="margin: 16px 0; text-align: center;">
          <img 
            src="${cleanUrl}" 
            alt="FAQ 첨부 이미지" 
            style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" 
          />
        </div>`;
        console.log('✅ 이미지 HTML 생성됨:', imageHTML);
        return imageHTML;
      });
      
      // 2. YouTube URL 처리 (더 넓은 패턴)
      const youtubeMatches = processedContent.match(/<p>(https?:\/\/[^<>]*?youtube[^<>]*?)<\/p>/gi);
      if (youtubeMatches) {
        console.log('🎥 발견된 YouTube 패턴들:', youtubeMatches);
      }
      
      processedContent = processedContent.replace(/<p>(https?:\/\/[^<>]*?youtube[^<>]*?)<\/p>/gi, (match, url) => {
        console.log('🎥 YouTube URL 처리 중:', url);
        
        // 더 강력한 video ID 추출
        let videoId = null;
        const patterns = [
          /youtube\.com\/embed\/([^?&\n#]+)/,
          /youtube\.com\/watch\?v=([^?&\n#]+)/,
          /youtu\.be\/([^?&\n#]+)/
        ];
        
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match) {
            videoId = match[1];
            break;
          }
        }
        
        if (videoId) {
          console.log('✅ YouTube 비디오 ID 추출됨:', videoId);
          return `<div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; margin: 16px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            <iframe 
              src="https://www.youtube.com/embed/${videoId}" 
              style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
              allowfullscreen
              loading="lazy"
              title="YouTube 비디오"
            ></iframe>
          </div>`;
        } else {
          console.log('❌ YouTube 비디오 ID 추출 실패:', url);
        }
        return match;
      });
      
      // 3. Vimeo URL 처리
      processedContent = processedContent.replace(/<p>(https?:\/\/[^<>]*?vimeo[^<>]*?)<\/p>/gi, (match, url) => {
        console.log('🎬 Vimeo URL 발견:', url);
        const videoIdMatch = url.match(/vimeo\.com\/([0-9]+)/);
        if (videoIdMatch) {
          const videoId = videoIdMatch[1];
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
        return match;
      });
      
      // 위험한 태그 제거 (하지만 iframe은 우리가 생성한 것이므로 허용)
      processedContent = processedContent.replace(/<script[^>]*>.*?<\/script>/gi, '');
      
      containerRef.current.innerHTML = processedContent;
      
      console.log('🔍 HTMLContent 최종 결과:', {
        originalLength: content.length,
        processedLength: processedContent.length,
        hasImages: processedContent.includes('<img'),
        hasHref: processedContent.includes('href='),
        processedHTML: processedContent
      });
    }
  }, [content]);

  return <div ref={containerRef} className={className} />;
};
