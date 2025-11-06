import { z } from 'zod';
import { tool } from 'ai';
import { eq, like, or, desc, asc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { product } from '@/lib/db/schema';

// Product 검색 함수
async function searchProducts(query: string, language?: string, sortBy?: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  }

  const client = postgres(connectionString, { max: 10, idle_timeout: 20 });
  const db = drizzle(client);
  
  try {
    let whereConditions = [];
    
    // 검색어가 있는 경우 상품명, 카테고리, SKU에서 검색
    if (query.trim()) {
      whereConditions.push(
        or(
          like(product.productName, `%${query}%`),
          like(product.category, `%${query}%`),
          like(product.sku, `%${query}%`)
        )
      );
    }
    
    // 언어 필터
    if (language) {
      whereConditions.push(eq(product.language, language));
    }
    
    let queryBuilder = db
      .select({
        sku: product.sku,
        language: product.language,
        category: product.category,
        productName: product.productName,
        price: product.price,
        discountPrice: product.discountPrice,
        productUrl: product.productUrl,
        createdAt: product.createdAt
      })
      .from(product);
    
    // WHERE 조건 적용
    if (whereConditions.length > 0) {
      queryBuilder = queryBuilder.where(
        whereConditions.length === 1 
          ? whereConditions[0] 
          : whereConditions.reduce((acc, condition) => or(acc, condition))
      );
    }
    
    // 정렬 적용
    switch (sortBy) {
      case 'price_asc':
        queryBuilder = queryBuilder.orderBy(asc(product.price));
        break;
      case 'price_desc':
        queryBuilder = queryBuilder.orderBy(desc(product.price));
        break;
      case 'name':
        queryBuilder = queryBuilder.orderBy(asc(product.productName));
        break;
      case 'newest':
        queryBuilder = queryBuilder.orderBy(desc(product.createdAt));
        break;
      default:
        queryBuilder = queryBuilder.orderBy(asc(product.productName));
    }
    
    const results = await queryBuilder.limit(20).execute();
    
    await client.end();
    
    return {
      success: true,
      products: results,
      total: results.length
    };
    
  } catch (error) {
    console.error('Product 검색 오류:', error);
    await client.end();
    throw error;
  }
}

// 특정 언어별 상품 통계
async function getProductStatsByLanguage() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  }

  const client = postgres(connectionString, { max: 10, idle_timeout: 20 });
  const db = drizzle(client);
  
  try {
    const stats = await db
      .select({
        language: product.language,
        count: 'count(*)',
        avgPrice: 'avg(price)',
        minPrice: 'min(price)',
        maxPrice: 'max(price)'
      })
      .from(product)
      .groupBy(product.language)
      .orderBy(desc('count(*)'));
    
    await client.end();
    
    return {
      success: true,
      stats
    };
    
  } catch (error) {
    console.error('Product 통계 조회 오류:', error);
    await client.end();
    throw error;
  }
}

export const searchProductTool = tool({
  description: '스터디미니 상품을 검색하고 가격 정보를 조회합니다. 상품명, 언어, 가격 등으로 검색할 수 있습니다.',
  inputSchema: z.object({
    query: z.string().describe('검색할 상품명, 카테고리, 또는 SKU'),
    language: z.string().optional().describe('언어 필터 (예: 영어, 일본어, 독일어, 프랑스어, 스페인어, 중국어)'),
    sortBy: z.enum(['price_asc', 'price_desc', 'name', 'newest']).optional().describe('정렬 방식'),
  }),
  execute: async ({ query, language, sortBy }) => {
    try {
      const result = await searchProducts(query, language, sortBy);
      
      if (result.products.length === 0) {
        return {
          success: false,
          message: '검색 조건에 맞는 상품을 찾을 수 없습니다.',
          products: []
        };
      }
      
      return {
        success: true,
        message: `${result.total}개의 상품을 찾았습니다.`,
        products: result.products.map(p => ({
          sku: p.sku,
          language: p.language,
          category: p.category,
          productName: p.productName,
          price: p.price,
          discountPrice: p.discountPrice,
          productUrl: p.productUrl,
          finalPrice: p.discountPrice || p.price,
          discount: p.discountPrice ? Math.round((1 - p.discountPrice / p.price) * 100) : 0
        }))
      };
      
    } catch (error) {
      console.error('Product 검색 도구 오류:', error);
      return {
        success: false,
        message: '상품 검색 중 오류가 발생했습니다.',
        products: []
      };
    }
  }
});

export const getProductStatsTool = tool({
  description: '언어별 상품 통계를 조회합니다. 각 언어별 상품 수, 평균 가격, 최저/최고 가격을 확인할 수 있습니다.',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const result = await getProductStatsByLanguage();
      
      if (!result.success) {
        return {
          success: false,
          message: '통계 조회에 실패했습니다.',
          stats: []
        };
      }
      
      return {
        success: true,
        message: '언어별 상품 통계를 조회했습니다.',
        stats: result.stats
      };
      
    } catch (error) {
      console.error('Product 통계 도구 오류:', error);
      return {
        success: false,
        message: '통계 조회 중 오류가 발생했습니다.',
        stats: []
      };
    }
  }
});
