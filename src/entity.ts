export type Link = {
  readonly id: number;
  readonly url: string;
  readonly label: string;
  readonly path: string;
};

export type Post =
  | {
      readonly type: 'success';
      readonly link: Link;
      readonly title: string;
      readonly contentHtml: string;
      readonly sourceUrl: string;
    }
  | {
      readonly type: 'failure';
      readonly link: Link;
      readonly reason: string;
    };

export type PrintDocument = {
  readonly title: string;
  readonly posts: readonly Post[];
};
