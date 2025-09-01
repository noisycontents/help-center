import { compare } from 'bcrypt-ts';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createGuestUser, getUser, createOrGetWordPressUser } from '@/lib/db/queries';
import { authConfig } from './auth.config';
import { DUMMY_PASSWORD } from '@/lib/constants';
import type { DefaultJWT } from 'next-auth/jwt';

// WordPress OAuth 제공자 설정
const WordPressProvider = {
  id: 'wordpress',
  name: 'WordPress',
  type: 'oauth' as const,
  authorization: {
    url: `${process.env.WP_SITE_URL}/oauth/authorize`,
    params: {
      scope: 'basic email profile',
      response_type: 'code',
    },
  },
  token: {
    url: `${process.env.WP_SITE_URL}/oauth/token`,
    async request({ params, provider }: { params: any; provider: any }) {
      const response = await fetch(provider.token.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: provider.clientId!,
          client_secret: provider.clientSecret!,
          code: params.code!,
          redirect_uri: params.redirect_uri!,
        }),
      });
      
      const tokens = await response.json();
      return { tokens };
    },
  },
  userinfo: {
    url: `${process.env.WP_SITE_URL}/wp-json/wp/v2/users/me`,
    async request({ tokens, provider }: { tokens: any; provider: any }) {
      const response = await fetch(provider.userinfo.url, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Accept': 'application/json',
        },
      });
      
      const profile = await response.json();
      console.log('WordPress 사용자 프로필:', profile);
      return profile;
    },
  },
  clientId: process.env.WP_CLIENT_ID,
  clientSecret: process.env.WP_CLIENT_SECRET,
  profile(profile: any) {
    console.log('WordPress profile 전체 데이터:', JSON.stringify(profile, null, 2));
    
    // 다양한 이메일 필드 확인
    const email = profile.email || profile.user_email || profile.data?.user_email || null;
    const name = profile.display_name || profile.name || profile.username || profile.data?.display_name || '미니학습지 사용자';
    
    return {
      id: profile.id.toString(),
      email: email,
      name: name,
      type: 'regular' as UserType,
    };
  },
};

export type UserType = 'guest' | 'regular';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/login',
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined,
      },
    },
    callbackUrl: {
      name: `__Secure-next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined,
      },
    },
    csrfToken: {
      name: `__Host-next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
  },
  providers: [
    WordPressProvider as any,
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const users = await getUser(email);

        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;

        if (!user.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) return null;

        return { ...user, type: 'regular' };
      },
    }),
    Credentials({
      id: 'guest',
      credentials: {},
      async authorize() {
        try {
          console.log('Creating guest user...');
          const guestUser = await createGuestUser();
          console.log('Guest user created:', guestUser);
          return { ...guestUser, type: 'guest' };
        } catch (error) {
          console.error('Error creating guest user:', error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
        token.name = user.name;
      }

      // WordPress OAuth 사용자는 signIn 콜백에서 이미 처리됨

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        session.user.name = token.name;
      }

      return session;
    },
    async signIn({ user, account, profile }) {
      // WordPress OAuth 로그인 시 사용자 생성
      if (account?.provider === 'wordpress' && user) {
        try {
          // WordPress 실제 ID 사용 (16557 등)
          const wpUserId = profile?.id?.toString() || user.id;
          const dbUser = await createOrGetWordPressUser(wpUserId!, user.email || undefined, user.name || undefined);
          // 실제 DB에 저장된 사용자 ID로 업데이트
          user.id = dbUser.id;
          console.log('WordPress 사용자 signIn 콜백에서 생성 완료:', dbUser.id, 'WP ID:', wpUserId);
          return true;
        } catch (error) {
          console.error('WordPress 사용자 생성 실패:', error);
          return false;
        }
      }
      
      return true;
    },
  },
});
