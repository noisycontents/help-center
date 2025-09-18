export type ErrorType =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limit'
  | 'offline';

export type Surface =
  | 'chat'
  | 'auth'
  | 'api'
  | 'stream'
  | 'database'
  | 'history'
  | 'vote'
  | 'document'
  | 'suggestions';

export type ErrorCode = `${ErrorType}:${Surface}`;

export type ErrorVisibility = 'response' | 'log' | 'none';

export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  database: 'log',
  chat: 'response',
  auth: 'response',
  stream: 'response',
  api: 'response',
  history: 'response',
  vote: 'response',
  document: 'response',
  suggestions: 'response',
};

export class ChatSDKError extends Error {
  public type: ErrorType;
  public surface: Surface;
  public statusCode: number;

  constructor(errorCode: ErrorCode, cause?: string) {
    super();

    const [type, surface] = errorCode.split(':');

    this.type = type as ErrorType;
    this.cause = cause;
    this.surface = surface as Surface;
    this.message = getMessageByErrorCode(errorCode);
    this.statusCode = getStatusCodeByType(this.type);
  }

  public toResponse() {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { message, cause, statusCode } = this;

    if (visibility === 'log') {
      console.error({
        code,
        message,
        cause,
      });

      return Response.json(
        { code: '', message: 'Something went wrong. Please try again later.' },
        { status: statusCode },
      );
    }

    return Response.json({ code, message, cause }, { status: statusCode });
  }
}

export function getMessageByErrorCode(errorCode: ErrorCode): string {
  if (errorCode.includes('database')) {
    return '데이터베이스 쿼리 실행 중 오류가 발생했습니다.';
  }

  switch (errorCode) {
    case 'bad_request:api':
      return "요청을 처리할 수 없습니다. 입력 내용을 확인한 뒤 다시 시도해주세요.";

    case 'unauthorized:auth':
      return '계속하려면 로그인해야 합니다.';
    case 'forbidden:auth':
      return '이 기능에 접근할 수 없는 계정입니다.';

    case 'rate_limit:chat':
      return `안녕하세요! 😊<br>오늘 질문 한도에 도달하셨습니다.<br><br>📝 로그인하면 추가 질문이 가능합니다.<br>혹은 <a href="/chat?mode=help" style="color: #2563eb; text-decoration: underline;">도움말 센터</a>에서 정보를 찾아보실 수 있습니다.<br><br>🔗 <a href="https://studymini.com/inquiry" target="_blank" style="color: #2563eb; text-decoration: underline;">일대일 문의하기</a><br>1:1 문의 게시판을 통해 문의해 주시면 최대한 빠르게 답변드리겠습니다.<br><br>양해 부탁드립니다. 감사합니다! 🙏`;
      case 'not_found:chat':
        return '요청하신 채팅을 찾을 수 없습니다.';
      case 'forbidden:chat':
        return '이 채팅은 다른 사용자에게 속해 있습니다.';
      case 'unauthorized:chat':
        return '채팅을 보려면 로그인해야 합니다. 로그인 후 다시 시도해주세요.';
      case 'offline:chat':
        return '메시지를 보내는 데 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';

      case 'not_found:document':
        return '요청하신 문서를 찾을 수 없습니다.';
      case 'forbidden:document':
        return '이 문서는 다른 사용자에게 속해 있습니다.';
      case 'unauthorized:document':
        return '문서를 보려면 로그인해야 합니다. 로그인 후 다시 시도해주세요.';
      case 'bad_request:document':
        return '문서를 생성하거나 업데이트하는 요청이 올바르지 않습니다. 입력 내용을 확인한 뒤 다시 시도해주세요.';

    default:
      return '문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
}

function getStatusCodeByType(type: ErrorType) {
  switch (type) {
    case 'bad_request':
      return 400;
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'rate_limit':
      return 429;
    case 'offline':
      return 503;
    default:
      return 500;
  }
}
