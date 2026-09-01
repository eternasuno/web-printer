export type RawLink = {
  readonly href: string;
  readonly text?: string | null;
  readonly ariaLabel?: string | null;
  readonly imageAlt?: string | null;
  readonly order: number;
};

export type PageSnapshot = {
  readonly url: string;
  readonly title: string;
  readonly links: readonly RawLink[];
};

export type CandidateLink = {
  readonly url: string;
  readonly label: string;
  readonly path: string;
  readonly order: number;
};

export type SelectedPage = {
  readonly url: string;
  readonly label: string;
  readonly order: number;
};

export type SelectionState = {
  readonly candidates: readonly CandidateLink[];
  readonly selected: ReadonlySet<string>;
  readonly canStart: boolean;
};

export type FetchResponse = {
  readonly status: number;
  readonly contentType: string | null;
  readonly body: string;
  readonly finalUrl: string;
};

export type FetchFailure =
  | { readonly type: 'network'; readonly message: string }
  | { readonly type: 'timeout' };

export type ExtractedArticle = {
  readonly title: string | null;
  readonly documentTitle: string;
  readonly contentHtml: string;
};

export type PrintableArticle = {
  readonly title: string;
  readonly contentHtml: string;
  readonly sourceUrl?: string;
};

export type CollectedPage =
  | {
      readonly type: 'success';
      readonly page: SelectedPage;
      readonly article: PrintableArticle;
    }
  | {
      readonly type: 'failure';
      readonly page: SelectedPage;
      readonly reason: string;
    }
  | { readonly type: 'cancelled'; readonly page: SelectedPage };

export type CollectionProgress = {
  readonly completed: number;
  readonly total: number;
  readonly state: 'fetching' | 'cancelling' | 'assembling' | 'completed';
};

export type PrintItem =
  | {
      readonly type: 'article';
      readonly title: string;
      readonly contentHtml: string;
      readonly sourceUrl: string;
      readonly breakBefore: boolean;
    }
  | {
      readonly type: 'failure';
      readonly label: string;
      readonly url: string;
      readonly reason: string;
      readonly breakBefore: boolean;
    }
  | {
      readonly type: 'cancelled';
      readonly label: string;
      readonly url: string;
      readonly breakBefore: boolean;
    };

export type CollectionSummary = {
  readonly succeeded: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly failures: readonly {
    readonly label: string;
    readonly url: string;
    readonly reason: string;
  }[];
};

export type PrintDocument = {
  readonly title: string;
  readonly summary: CollectionSummary;
  readonly items: readonly PrintItem[];
};
