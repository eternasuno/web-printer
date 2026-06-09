declare module '@mozilla/readability' {
  const Readability: new (
    doc: Document,
    options?: {
      debug?: boolean;
      maxElemsToParse?: number;
      nbTopCandidates?: number;
      charThreshold?: number;
      classesToPreserve?: string[];
      keepClasses?: boolean;
      serializer?: (node: Node) => string;
      disableJSONLD?: boolean;
      allowedVideoRegex?: RegExp;
    }
  ) => {
    parse(): {
      title: string;
      content: string;
      textContent: string;
      length: number;
      excerpt: string;
      byline: string;
      dir: string;
      lang: string;
      siteName: string;
      publishedTime: string;
    } | null;
  };
  export default Readability;
}
