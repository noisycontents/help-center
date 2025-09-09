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
      
      // 1. 이미지 URL 처리 (더 넓은 패턴)
      const imageMatches = processedContent.match(/<p>(https?:\/\/[^<>]*?\.(jpg|jpeg|png|gif|webp|svg)[^<>]*?)<\/p>/gi);
      if (imageMatches) {
        console.log('🖼️ 발견된 이미지 패턴들:', imageMatches);
      }
      
      processedContent = processedContent.replace(/<p>(https?:\/\/[^<>]*?\.(jpg|jpeg|png|gif|webp|svg)[^<>]*?)<\/p>/gi, (match, url) => {
        console.log('🖼️ 이미지 URL 처리 중:', url);
        
        // URL 정리
        const cleanUrl = url.trim();
        
        // studymini.com의 hotlink protection으로 인해 직접 표시 불가
        // 우아한 이미지 링크 카드로 표시
        const fileName = cleanUrl.split('/').pop() || 'image';
        
        return `<div style="margin: 16px 0; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); text-align: center; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
          <div style="margin-bottom: 12px;">
            <span style="font-size: 32px; display: block; margin-bottom: 8px;">🖼️</span>
            <p style="margin: 4px 0; font-weight: 600; color: #1f2937; font-size: 16px;">FAQ 첨부 이미지</p>
            <p style="margin: 4px 0; font-size: 13px; color: #6b7280; font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; display: inline-block;">${fileName}</p>
          </div>
          <a 
            href="${cleanUrl}" 
            target="_blank" 
            rel="noopener noreferrer"
            style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500; transition: all 0.2s; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);"
            onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.4)'"
            onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(59, 130, 246, 0.3)'"
          >
            <span>🔗</span>
            <span>이미지 새 창에서 보기</span>
          </a>
          <p style="margin: 12px 0 0 0; font-size: 12px; color: #9ca3af; font-style: italic;">※ 이미지 보호 정책으로 인해 직접 표시가 제한됩니다</p>
        </div>`;
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
      
      console.log('🔍 HTMLContent 디버깅:', {
        original: content.substring(0, 100),
        processed: processedContent.substring(0, 100),
        hasHref: processedContent.includes('href='),
        containerHTML: containerRef.current.innerHTML.substring(0, 100)
      });
    }
  }, [content]);

  return <div ref={containerRef} className={className} />;
};
