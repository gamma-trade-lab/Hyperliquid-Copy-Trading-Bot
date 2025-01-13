import { BigNumber as BN } from "bignumber.js";
// Configure BigNumber
BN.set({
    DECIMAL_PLACES: 18,
    ROUNDING_MODE: BN.ROUND_DOWN
});
// Helper function to create new BigNumber instances
export function toBN(value) {
    if (BN.isBigNumber(value)) {
        return value;
    }
    return new BN(value.toString());
}
// Common constants
export const ZERO = new BN(0);
export const ONE = new BN(1);
export const TEN = new BN(10);
// Re-export BigNumber class
export { BN };
