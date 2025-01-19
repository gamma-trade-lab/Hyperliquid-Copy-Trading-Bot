import { PublicKey } from '@solana/web3.js';
import logger from './logger';


export type ChainType = 'solana' | 'ethereum' | 'invalid';

/**
 * Validates a Solana address using PublicKey
 */
export const validateSolanaAddress = (address: string): boolean => {
  try {
    // Use PublicKey for proper validation
    new PublicKey(address);
    // Additional check for length and character set
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  } catch (error) {
    return false;
  }
};

/**
 * Validates a Solana transaction signature
 */
export const validateTransactionHash = (hash: string): boolean => {
  try {
    // Solana transaction signatures are 88 characters long
    if (!/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(hash)) {
      return false;
    }
    
    // Additional validation logic could be added here
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Determines the chain type from an address
 */
export const getChainType = (address: string): ChainType => {
  try {
    if (!address) return 'invalid';

    // Check for Ethereum address
    if (address.startsWith('0x') && /^0x[a-fA-F0-9]{40}$/.test(address)) {
      return 'ethereum';
    }

    // Check for Solana address
    if (validateSolanaAddress(address)) {
      return 'solana';
    }

    return 'invalid';
  } catch (error) {
    logger.error('Error in getChainType:', error);
    return 'invalid';
  }
};

/**
 * Validates a Solana amount (in SOL)
 */
export const validateSolanaAmount = (amount: number): boolean => {
  try {
    // Check if amount is a valid number
    if (!Number.isFinite(amount)) return false;
    
    // Check if amount is positive
    if (amount <= 0) return false;
    
    // Check for maximum reasonable amount (1 billion SOL)
    if (amount > 1_000_000_000) return false;
    
    // Check decimal places (max 9 decimals for SOL)
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    if (decimalPlaces > 9) return false;
    
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validates token decimals
 */
export const validateTokenDecimals = (decimals: number): boolean => {
  try {
    return Number.isInteger(decimals) && decimals >= 0 && decimals <= 9;
  } catch {
    return false;
  }
};

/**
 * Validates a program ID
 */
export const validateProgramId = (programId: string): boolean => {
  try {
    new PublicKey(programId);
    return true;
  } catch {
    return false;
  }
};

/**
 * Formats and validates a Solana address for display
 */
export const formatAddress = (address: string, shortForm: boolean = true): string => {
  try {
    if (!validateSolanaAddress(address)) {
      throw new Error('Invalid address');
    }
    
    if (shortForm) {
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
    
    return address;
  } catch (error) {
    logger.error('Error formatting address:', error);
    return 'Invalid Address';
  }
};

/**
 * Validates transaction parameters
 */
export const validateTransactionParams = (params: {
  sender?: string;
  recipient?: string;
  amount?: number;
  programId?: string;
}): { isValid: boolean; error?: string } => {
  try {
    const { sender, recipient, amount, programId } = params;

    if (sender && !validateSolanaAddress(sender)) {
      return { isValid: false, error: 'Invalid sender address' };
    }

    if (recipient && !validateSolanaAddress(recipient)) {
      return { isValid: false, error: 'Invalid recipient address' };
    }

    if (amount && !validateSolanaAmount(amount)) {
      return { isValid: false, error: 'Invalid amount' };
    }

    if (programId && !validateProgramId(programId)) {
      return { isValid: false, error: 'Invalid program ID' };
    }

    return { isValid: true };
  } catch (error) {
    logger.error('Error validating transaction params:', error);
    return { isValid: false, error: 'Validation error' };
  }
};

/**
 * Check if an address is a token mint
 */
export const isTokenMint = (address: string): boolean => {
  try {
    if (!validateSolanaAddress(address)) return false;
    
    // Additional token program checks could be added here
    return true;
  } catch {
    return false;
  }
};

// Export types for use in other modules
export type ValidationResult = {
  isValid: boolean;
  error?: string;
};