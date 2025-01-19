import {
    BlockhashWithExpiryBlockHeight,
    Connection,
    TransactionExpiredBlockheightExceededError,
    VersionedTransactionResponse,
  } from "@solana/web3.js";
  import promiseRetry from "promise-retry";
  
  export const wait = (time: number) =>
    new Promise((resolve) => setTimeout(resolve, time));
  
  type TransactionSenderAndConfirmationWaiterArgs = {
    connection: Connection; 
    serializedTransaction: Buffer;
    blockhashWithExpiryBlockHeight: BlockhashWithExpiryBlockHeight;
  }; 
  
  const SEND_OPTIONS = {
    skipPreflight: true,
  };
  
  export async function transactionSenderAndConfirmationWaiter({
    connection,
    serializedTransaction,
    blockhashWithExpiryBlockHeight,
  }: TransactionSenderAndConfirmationWaiterArgs): Promise<VersionedTransactionResponse | null> {
    const txid = await connection.sendRawTransaction(
      serializedTransaction,
      SEND_OPTIONS
    );
  
    console.log("Initial send transaction", txid);
  
    const controller = new AbortController();
    const abortSignal = controller.signal;
  
    const abortableResender = async () => {
      while (true) {
        await wait(2_000);
        if (abortSignal.aborted) return;
        try {
          const txId2 = await connection.sendRawTransaction(
            serializedTransaction,
            SEND_OPTIONS
          );
          console.log("RETRY send transaction", txId2);
        } catch (e) {
          console.warn(`Failed to resend transaction: ${e}`);
        }
      }
    };
  
    try {
      abortableResender();
      const lastValidBlockHeight =
        blockhashWithExpiryBlockHeight.lastValidBlockHeight - 150;
  
      // this would throw TransactionExpiredBlockheightExceededError
      await Promise.race([
        connection.confirmTransaction(
          {
            ...blockhashWithExpiryBlockHeight,
            lastValidBlockHeight,
            signature: txid,
            abortSignal,
          },
          "confirmed"
        ),
        new Promise(async (resolve) => {
          // in case ws socket died
          while (!abortSignal.aborted) {
            await wait(2_000);
            const tx = await connection.getSignatureStatus(txid, {
              searchTransactionHistory: false,
            });
            console.log("CONFIRMED?", tx?.value);
            if (tx?.value?.confirmationStatus === "confirmed") {
              resolve(tx);
            }
          }
        }),
      ]);
    } catch (e) {
      if (e instanceof TransactionExpiredBlockheightExceededError) {
        // we consume this error and getTransaction would return null
        return null;
      } else {
        // invalid state from web3.js
        throw e;
      }
    } finally {
      controller.abort();
    }
  
    // in case rpc is not synced yet, we add some retries
    const response = promiseRetry(
      async (retry: (error: Error) => never) => {
        const response = await connection.getTransaction(txid, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        if (!response) {
          retry(new Error('Transaction not found'));
        }
        return response;
      },
      {
        retries: 5,
        minTimeout: 1e3,
      }
    );
  
    return response;
  }