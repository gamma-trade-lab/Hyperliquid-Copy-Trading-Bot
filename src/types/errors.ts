export class TwitterAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwitterAuthError';
  }
}

export class TwitterAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwitterAPIError';
  }
}
