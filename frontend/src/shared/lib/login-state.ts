export interface AddToCartIntent {
  productId: number;
  quantity: number;
  productName: string;
}

export interface LoginState {
  from?: { pathname: string; search: string };
  addToCart?: AddToCartIntent;
}

export function readLoginState(state: unknown): LoginState {
  return typeof state === 'object' && state !== null ? state : {};
}
