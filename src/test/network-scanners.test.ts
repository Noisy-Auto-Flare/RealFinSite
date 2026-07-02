import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();

async function setupMockFetch(responses: any[]) {
  // After all specific responses, return empty/default for any extra calls
  const defaultRes = { ok: true, json: () => Promise.resolve({ ok: true, result: [] }) };
  for (const r of responses) {
    mockFetch.mockResolvedValueOnce(r);
  }
  mockFetch.mockResolvedValue(defaultRes);
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

describe("SolanaScanner", () => {
  it("should parse SOL transfer from Helius response", async () => {
    await setupMockFetch([
      {
        ok: true,
        json: () => Promise.resolve([
          {
            type: "TRANSFER",
            timestamp: 1700000000,
            signature: "sol_tx_hash_1",
            slot: 250000000,
            nativeTransfers: [
              {
                fromUserAccount: "sender123",
                toUserAccount: "receiver456",
                amount: 1000000000,
              },
            ],
            tokenTransfers: [],
          },
        ]),
      },
    ]);

    const { SolanaScanner } = await import("@/lib/scanners/solana");
    const scanner = new SolanaScanner();
    const events = await scanner.fetchNewTransactions("receiver456", 0);

    expect(events.length).toBe(1);
    expect(events[0].txHash).toBe("sol_tx_hash_1");
    expect(events[0].fromAddress).toBe("sender123");
    expect(events[0].toAddress).toBe("receiver456");
    expect(events[0].amount).toBe("1000000000");
    expect(events[0].decimals).toBe(9);
    expect(events[0].tokenSymbol).toBe("SOL");
    expect(events[0].tokenContract).toBeNull();
    expect(events[0].blockNumber).toBe(250000000);
  });

  it("should parse SPL token transfer", async () => {
    await setupMockFetch([
      {
        ok: true,
        json: () => Promise.resolve([
          {
            type: "TRANSFER",
            timestamp: 1700000001,
            signature: "spl_tx_hash",
            slot: 250000001,
            nativeTransfers: [],
            tokenTransfers: [
              {
                fromUserAccount: "sender_spl",
                toUserAccount: "receiver_spl",
                mint: "mint_address_123",
                rawTokenAmount: { tokenAmount: "5000000000" },
              },
            ],
          },
        ]),
      },
      {
        ok: true,
        json: () => Promise.resolve([
          { decimals: 6, symbol: "USDC" },
        ]),
      },
    ]);

    const { SolanaScanner } = await import("@/lib/scanners/solana");
    const scanner = new SolanaScanner();
    const events = await scanner.fetchNewTransactions("receiver_spl", 0);

    expect(events.length).toBe(1);
    expect(events[0].tokenContract).toBe("mint_address_123");
    expect(events[0].decimals).toBe(6);
    expect(events[0].tokenSymbol).toBe("USDC");
    expect(events[0].amount).toBe("5000000000");
  });

  it("should filter by slot number", async () => {
    await setupMockFetch([
      {
        ok: true,
        json: () => Promise.resolve([
          {
            type: "TRANSFER",
            timestamp: 1700000002,
            signature: "tx_old",
            slot: 100,
            nativeTransfers: [{ fromUserAccount: "a", toUserAccount: "b", amount: 100 }],
            tokenTransfers: [],
          },
          {
            type: "TRANSFER",
            timestamp: 1700000003,
            signature: "tx_new",
            slot: 200,
            nativeTransfers: [{ fromUserAccount: "a", toUserAccount: "b", amount: 200 }],
            tokenTransfers: [],
          },
        ]),
      },
    ]);

    const { SolanaScanner } = await import("@/lib/scanners/solana");
    const scanner = new SolanaScanner();
    const events = await scanner.fetchNewTransactions("b", 150);

    expect(events.length).toBe(1);
    expect(events[0].txHash).toBe("tx_new");
  });
});

describe("TonScanner", () => {
  it("should parse TON transfer from TonCenter response", async () => {
    // Return one tx with very high LT value so the loop only fetches once,
    // then return empty for subsequent pagination calls
    await setupMockFetch([
      {
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          result: [
            {
              transaction_id: { lt: "3000000000", hash: "ton_tx_hash_1" },
              time: 1700000100,
              in_msg: {
                source: "sender_ton",
                destination: "receiver_ton",
                value: "500000000",
              },
              out_msgs: [],
            },
          ],
        }),
      },
    ]);

    const { TonScanner } = await import("@/lib/scanners/ton");
    const scanner = new TonScanner();
    const events = await scanner.fetchNewTransactions("receiver_ton", 0);

    expect(events.length).toBe(1);
    expect(events[0].txHash).toBe("ton_tx_hash_1");
    expect(events[0].fromAddress).toBe("sender_ton");
    expect(events[0].toAddress).toBe("receiver_ton");
    expect(events[0].amount).toBe("500000000");
    expect(events[0].decimals).toBe(9);
    expect(events[0].tokenSymbol).toBe("TON");
  });

  it("should parse Jetton transfer", async () => {
    await setupMockFetch([
      // getTransactions — empty
      { ok: true, json: () => Promise.resolve({ ok: true, result: [] }) },
      // getJettonTransfers — one result
      {
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          result: [
            {
              transaction_id: { lt: "4000000000", hash: "jetton_tx_hash" },
              time: 1700000200,
              source: "jetton_sender",
              destination: "jetton_receiver",
              amount: "1000000000",
              jetton_master_address: "jetton_master_123",
              jetton_wallet_address: "jetton_wallet_456",
            },
          ],
        }),
      },
      // getJettonInfo — metadata
      {
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          result: { decimals: 9, symbol: "JETTON" },
        }),
      },
    ]);

    const { TonScanner } = await import("@/lib/scanners/ton");
    const scanner = new TonScanner();
    const events = await scanner.fetchNewTransactions("jetton_receiver", 0);

    expect(events.length).toBe(1);
    expect(events[0].tokenContract).toBe("jetton_master_123");
    expect(events[0].decimals).toBe(9);
    expect(events[0].tokenSymbol).toBe("JETTON");
    expect(events[0].amount).toBe("1000000000");
  });
});
