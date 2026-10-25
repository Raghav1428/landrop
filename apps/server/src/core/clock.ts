export interface Dependencies {
  now?: () => number;
  monotonic?: () => number;
  schedule?: boolean;
}
