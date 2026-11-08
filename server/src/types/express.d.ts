declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth after the access token is verified. */
      userId?: string;
    }
  }
}

export {};
