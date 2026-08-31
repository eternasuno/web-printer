export type SourceLink = { text: string; url: string };
export type Article = { title: string; content: string };
export type FailureCode =
  | 'network-error'
  | 'timeout'
  | 'http-error'
  | 'cross-origin-redirect'
  | 'unsupported-content-type'
  | 'parse-failed'
  | 'no-readable-content'
  | 'sanitized-content-empty'
  | 'cancelled'
  | 'internal-error';
export type Failure = { url: string; code: FailureCode; message: string };
export type BatchResult = { articles: Article[]; failures: Failure[] };
