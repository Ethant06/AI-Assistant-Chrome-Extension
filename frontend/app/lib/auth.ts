/**
 * Auth helpers
 *
 * The JWT lives in an HTTPOnly cookie set by the backend - JavaScript cannot read
 * or write it. There is no token storage here.
 *
 * To check authentication status, call the API rather than checking local state,
 * since the cookie is invisible to JavaScript
 */