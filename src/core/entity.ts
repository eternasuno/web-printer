export type FetchResult = {
  url: string;
  html: string;
  ok: boolean;
  error?: string;
};

export type ExtractedPage = {
  url: string;
  title: string;
  html: string;
};

export type LinkInfo = {
  text: string;
  url: string;
};

export type ProgressState = {
  done: number;
  total: number;
  phase: string;
};
