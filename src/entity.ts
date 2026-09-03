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
    };

export type CollectionProgress = {
  readonly completed: number;
  readonly total: number;
  readonly state: 'fetching' | 'assembling' | 'completed';
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
    };

export type CollectionSummary = {
  readonly succeeded: number;
  readonly failed: number;
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
