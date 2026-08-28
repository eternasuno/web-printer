export type RawLink = { text: string; href: string; downloadable?: boolean };

export type PageResponse = {
  status: number;
  contentType: string;
  responseText: string;
  finalUrl: string;
};
