import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions that will be populated in each test
const mockBalanceOf = vi.fn();
const mockTransferableBalanceOf = vi.fn();
const mockStakes = vi.fn();
const mockIsWithdrawalEligible = vi.fn();
const mockAddFraudStrike = vi.fn();
const mockRecordPointsBatch = vi.fn();
const mockFinalizeDay = vi.fn();
const mockExchangeRate = vi.fn();
const mockMint = vi.fn();
const mockCanMintMedal = vi.fn();
const mockGetUserMedals = vi.fn();
const mockMedalRequirements = vi.fn();
const mockSetTokenMetadataURI = vi.fn();
const mockGetStoredTokenURI = vi.fn();
const mockParseLog = vi.fn();

// Mock ethers module
vi.mock('ethers', () => {
  return {
    ethers: {
      JsonRpcProvider: class MockProvider {},
      Wallet: class MockWallet {
        constructor(_privateKey: string, _provider: unknown) {}
      },
      Contract: class MockContract {
        interface = { parseLog: mockParseLog };
        balanceOf = mockBalanceOf;
        transferableBalanceOf = mockTransferableBalanceOf;
        stakes = mockStakes;
        isWithdrawalEligible = mockIsWithdrawalEligible;
        addFraudStrike = mockAddFraudStrike;
        recordPointsBatch = mockRecordPointsBatch;
        finalizeDay = mockFinalizeDay;
        exchangeRate = mockExchangeRate;
        mint = mockMint;
        canMintMedal = mockCanMintMedal;
        getUserMedals = mockGetUserMedals;
        medalRequirements = mockMedalRequirements;
        setTokenMetadataURI = mockSetTokenMetadataURI;
        getStoredTokenURI = mockGetStoredTokenURI;
      },
      formatEther: (value: bigint) => (Number(value) / 1e18).toString(),
    },
  };
});

// Import after mocking
import * as blockchain from './blockchain';

const TEST_ADDRESSES = {
  shareToken: '0x1111111111111111111111111111111111111111',
  staking: '0x2222222222222222222222222222222222222222',
  emissionPool: '0x3333333333333333333333333333333333333333',
  medalNFT: '0x4444444444444444444444444444444444444444',
  treasury: '0x5555555555555555555555555555555555555555',
};

const TEST_WALLET = '0xabcdef1234567890abcdef1234567890abcdef12';

describe('blockchain service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set environment variables
    process.env.AMOY_RPC_URL = 'https://rpc.amoy.test';
    process.env.POLYGON_RPC_URL = 'https://polygon.mainnet';
    process.env.BACKEND_PRIVATE_KEY = '0x' + 'a'.repeat(64);
    process.env.SHARE_TOKEN_ADDRESS = TEST_ADDRESSES.shareToken;
    process.env.STAKING_ADDRESS = TEST_ADDRESSES.staking;
    process.env.EMISSION_POOL_ADDRESS = TEST_ADDRESSES.emissionPool;
    process.env.MEDAL_NFT_ADDRESS = TEST_ADDRESSES.medalNFT;
    process.env.TREASURY_ADDRESS = TEST_ADDRESSES.treasury;

    // Reset contract addresses
    blockchain.setContractAddresses(null);
  });

  describe('setContractAddresses', () => {
    it('should set contract addresses manually', () => {
      expect(() => blockchain.setContractAddresses(TEST_ADDRESSES)).not.toThrow();
    });

    it('should accept null to reset addresses', () => {
      blockchain.setContractAddresses(TEST_ADDRESSES);
      expect(() => blockchain.setContractAddresses(null)).not.toThrow();
    });
  });

  describe('getTokenBalance', () => {
    it('should return formatted token balance', async () => {
      const balanceWei = BigInt('1000000000000000000'); // 1 token
      mockBalanceOf.mockResolvedValue(balanceWei);

      const balance = await blockchain.getTokenBalance(TEST_WALLET);

      expect(mockBalanceOf).toHaveBeenCalledWith(TEST_WALLET);
      expect(balance).toBe('1');
    });

    it('should return zero for empty balance', async () => {
      mockBalanceOf.mockResolvedValue(BigInt(0));

      const balance = await blockchain.getTokenBalance(TEST_WALLET);

      expect(balance).toBe('0');
    });

    it('should handle large balances', async () => {
      const largeBalance = BigInt('1000000000000000000000000'); // 1M tokens
      mockBalanceOf.mockResolvedValue(largeBalance);

      const balance = await blockchain.getTokenBalance(TEST_WALLET);

      expect(mockBalanceOf).toHaveBeenCalledWith(TEST_WALLET);
      expect(balance).toBe('1000000');
    });
  });

  describe('getTransferableBalance', () => {
    it('should return formatted transferable balance', async () => {
      const balanceWei = BigInt('500000000000000000'); // 0.5 tokens
      mockTransferableBalanceOf.mockResolvedValue(balanceWei);

      const balance = await blockchain.getTransferableBalance(TEST_WALLET);

      expect(mockTransferableBalanceOf).toHaveBeenCalledWith(TEST_WALLET);
      expect(balance).toBe('0.5');
    });

    it('should return zero when no transferable balance', async () => {
      mockTransferableBalanceOf.mockResolvedValue(BigInt(0));

      const balance = await blockchain.getTransferableBalance(TEST_WALLET);

      expect(balance).toBe('0');
    });
  });

  describe('getStakeInfo', () => {
    it('should return stake information', async () => {
      const mockStake = {
        amount: BigInt('10000000000000000000'), // 10 tokens
        stakedAt: BigInt(1700000000),
        unlockTime: BigInt(1702592000),
        isSuperDonor: true,
        fraudStrikes: 0,
      };
      mockStakes.mockResolvedValue(mockStake);

      const stakeInfo = await blockchain.getStakeInfo(TEST_WALLET);

      expect(mockStakes).toHaveBeenCalledWith(TEST_WALLET);
      expect(stakeInfo).toEqual({
        amount: '10',
        stakedAt: 1700000000,
        unlockTime: 1702592000,
        isSuperDonor: true,
        fraudStrikes: 0,
      });
    });

    it('should handle user with fraud strikes', async () => {
      const mockStake = {
        amount: BigInt('5000000000000000000'),
        stakedAt: BigInt(1700000000),
        unlockTime: BigInt(1702592000),
        isSuperDonor: false,
        fraudStrikes: 2,
      };
      mockStakes.mockResolvedValue(mockStake);

      const stakeInfo = await blockchain.getStakeInfo(TEST_WALLET);

      expect(stakeInfo.fraudStrikes).toBe(2);
      expect(stakeInfo.isSuperDonor).toBe(false);
    });

    it('should handle user with no stake', async () => {
      const mockStake = {
        amount: BigInt(0),
        stakedAt: BigInt(0),
        unlockTime: BigInt(0),
        isSuperDonor: false,
        fraudStrikes: 0,
      };
      mockStakes.mockResolvedValue(mockStake);

      const stakeInfo = await blockchain.getStakeInfo(TEST_WALLET);

      expect(stakeInfo.amount).toBe('0');
      expect(stakeInfo.stakedAt).toBe(0);
    });
  });

  describe('isWithdrawalEligible', () => {
    it('should return true when eligible', async () => {
      mockIsWithdrawalEligible.mockResolvedValue(true);

      const eligible = await blockchain.isWithdrawalEligible(TEST_WALLET);

      expect(mockIsWithdrawalEligible).toHaveBeenCalledWith(TEST_WALLET);
      expect(eligible).toBe(true);
    });

    it('should return false when not eligible', async () => {
      mockIsWithdrawalEligible.mockResolvedValue(false);

      const eligible = await blockchain.isWithdrawalEligible(TEST_WALLET);

      expect(eligible).toBe(false);
    });
  });

  describe('addFraudStrike', () => {
    it('should add fraud strike and return tx hash', async () => {
      const mockTx = {
        hash: '0xtxhash123',
        wait: vi.fn().mockResolvedValue({}),
      };
      mockAddFraudStrike.mockResolvedValue(mockTx);

      const txHash = await blockchain.addFraudStrike(TEST_WALLET);

      expect(mockAddFraudStrike).toHaveBeenCalledWith(TEST_WALLET);
      expect(mockTx.wait).toHaveBeenCalled();
      expect(txHash).toBe('0xtxhash123');
    });

    it('should wait for transaction confirmation', async () => {
      const mockTx = {
        hash: '0xwaitinghash',
        wait: vi.fn().mockResolvedValue({ blockNumber: 12345 }),
      };
      mockAddFraudStrike.mockResolvedValue(mockTx);

      await blockchain.addFraudStrike(TEST_WALLET);

      expect(mockTx.wait).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordPointsOnChain', () => {
    it('should batch record points for multiple users', async () => {
      const users = [TEST_WALLET, '0xuser2'];
      const points = [100, 200];
      const mockTx = {
        hash: '0xbatchhash',
        wait: vi.fn().mockResolvedValue({}),
      };
      mockRecordPointsBatch.mockResolvedValue(mockTx);

      const txHash = await blockchain.recordPointsOnChain(users, points);

      expect(mockRecordPointsBatch).toHaveBeenCalledWith(users, points);
      expect(txHash).toBe('0xbatchhash');
    });

    it('should handle single user batch', async () => {
      const users = [TEST_WALLET];
      const points = [50];
      const mockTx = {
        hash: '0xsinglehash',
        wait: vi.fn().mockResolvedValue({}),
      };
      mockRecordPointsBatch.mockResolvedValue(mockTx);

      const txHash = await blockchain.recordPointsOnChain(users, points);

      expect(mockRecordPointsBatch).toHaveBeenCalledWith(users, points);
      expect(txHash).toBe('0xsinglehash');
    });

    it('should handle empty batch', async () => {
      const mockTx = {
        hash: '0xemptyhash',
        wait: vi.fn().mockResolvedValue({}),
      };
      mockRecordPointsBatch.mockResolvedValue(mockTx);

      const txHash = await blockchain.recordPointsOnChain([], []);

      expect(mockRecordPointsBatch).toHaveBeenCalledWith([], []);
      expect(txHash).toBe('0xemptyhash');
    });
  });

  describe('finalizeDay', () => {
    it('should finalize a day and return tx hash', async () => {
      const mockTx = {
        hash: '0xfinalizehash',
        wait: vi.fn().mockResolvedValue({}),
      };
      mockFinalizeDay.mockResolvedValue(mockTx);

      const txHash = await blockchain.finalizeDay(42);

      expect(mockFinalizeDay).toHaveBeenCalledWith(42);
      expect(txHash).toBe('0xfinalizehash');
    });

    it('should handle day 0', async () => {
      const mockTx = {
        hash: '0xday0hash',
        wait: vi.fn().mockResolvedValue({}),
      };
      mockFinalizeDay.mockResolvedValue(mockTx);

      const txHash = await blockchain.finalizeDay(0);

      expect(mockFinalizeDay).toHaveBeenCalledWith(0);
      expect(txHash).toBe('0xday0hash');
    });
  });

  describe('getExchangeRate', () => {
    it('should return exchange rate as number', async () => {
      mockExchangeRate.mockResolvedValue(BigInt(100));

      const rate = await blockchain.getExchangeRate();

      expect(mockExchangeRate).toHaveBeenCalled();
      expect(rate).toBe(100);
    });

    it('should handle large exchange rates', async () => {
      mockExchangeRate.mockResolvedValue(BigInt(1000000));

      const rate = await blockchain.getExchangeRate();

      expect(rate).toBe(1000000);
    });
  });

  describe('mintMedal', () => {
    it('should mint medal and return tx hash and token id', async () => {
      const mockReceipt = {
        logs: [
          {
            topics: ['0xevent'],
            data: '0xdata',
          },
        ],
      };
      const mockTx = {
        hash: '0xminthash',
        wait: vi.fn().mockResolvedValue(mockReceipt),
      };
      mockMint.mockResolvedValue(mockTx);
      mockParseLog.mockReturnValue({
        name: 'MedalMinted',
        args: { tokenId: BigInt(123) },
      });

      const result = await blockchain.mintMedal(
        TEST_WALLET,
        1,
        1700000000,
        10
      );

      expect(mockMint).toHaveBeenCalledWith(
        TEST_WALLET,
        1,
        1700000000,
        10
      );
      expect(result.txHash).toBe('0xminthash');
      expect(result.tokenId).toBe(123);
    });

    it('should return tokenId 0 if event not found', async () => {
      const mockReceipt = { logs: [] };
      const mockTx = {
        hash: '0xminthash',
        wait: vi.fn().mockResolvedValue(mockReceipt),
      };
      mockMint.mockResolvedValue(mockTx);

      const result = await blockchain.mintMedal(TEST_WALLET, 0, 1700000000, 5);

      expect(result.tokenId).toBe(0);
    });

    it('should handle parse errors gracefully', async () => {
      const mockReceipt = {
        logs: [{ topics: ['0xother'], data: '0x' }],
      };
      const mockTx = {
        hash: '0xminthash',
        wait: vi.fn().mockResolvedValue(mockReceipt),
      };
      mockMint.mockResolvedValue(mockTx);
      mockParseLog.mockImplementation(() => {
        throw new Error('Not matching');
      });

      const result = await blockchain.mintMedal(TEST_WALLET, 2, 1700000000, 20);

      expect(result.tokenId).toBe(0);
      expect(result.txHash).toBe('0xminthash');
    });

    it('should skip non-MedalMinted events', async () => {
      const mockReceipt = {
        logs: [
          { topics: ['0xother'], data: '0x' },
          { topics: ['0xmedal'], data: '0x' },
        ],
      };
      const mockTx = {
        hash: '0xminthash',
        wait: vi.fn().mockResolvedValue(mockReceipt),
      };
      mockMint.mockResolvedValue(mockTx);
      mockParseLog
        .mockReturnValueOnce({ name: 'Transfer', args: {} })
        .mockReturnValueOnce({ name: 'MedalMinted', args: { tokenId: BigInt(456) } });

      const result = await blockchain.mintMedal(TEST_WALLET, 1, 1700000000, 10);

      expect(result.tokenId).toBe(456);
    });
  });

  describe('canMintMedal', () => {
    it('should return canMint true with empty reason', async () => {
      mockCanMintMedal.mockResolvedValue([true, '']);

      const result = await blockchain.canMintMedal(TEST_WALLET, 1, 1700000000, 10);

      expect(mockCanMintMedal).toHaveBeenCalledWith(
        TEST_WALLET,
        1,
        1700000000,
        10
      );
      expect(result).toEqual({ canMint: true, reason: '' });
    });

    it('should return canMint false with reason', async () => {
      mockCanMintMedal.mockResolvedValue([
        false,
        'Insufficient donations',
      ]);

      const result = await blockchain.canMintMedal(TEST_WALLET, 2, 1700000000, 5);

      expect(result).toEqual({
        canMint: false,
        reason: 'Insufficient donations',
      });
    });

    it('should handle already minted tier', async () => {
      mockCanMintMedal.mockResolvedValue([
        false,
        'Already minted this tier',
      ]);

      const result = await blockchain.canMintMedal(TEST_WALLET, 0, 1700000000, 100);

      expect(result.canMint).toBe(false);
      expect(result.reason).toBe('Already minted this tier');
    });
  });

  describe('getUserMedals', () => {
    it('should return array of medal token ids', async () => {
      mockGetUserMedals.mockResolvedValue([
        BigInt(0),
        BigInt(101),
        BigInt(0),
        BigInt(305),
      ]);

      const medals = await blockchain.getUserMedals(TEST_WALLET);

      expect(mockGetUserMedals).toHaveBeenCalledWith(TEST_WALLET);
      expect(medals).toEqual([0, 101, 0, 305]);
    });

    it('should return all zeros for user with no medals', async () => {
      mockGetUserMedals.mockResolvedValue([
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
      ]);

      const medals = await blockchain.getUserMedals(TEST_WALLET);

      expect(medals).toEqual([0, 0, 0, 0]);
    });

    it('should return all tiers for fully minted user', async () => {
      mockGetUserMedals.mockResolvedValue([
        BigInt(1),
        BigInt(2),
        BigInt(3),
        BigInt(4),
      ]);

      const medals = await blockchain.getUserMedals(TEST_WALLET);

      expect(medals).toEqual([1, 2, 3, 4]);
    });
  });

  describe('getMedalRequirements', () => {
    it('should return medal requirements for tier 1 (silver)', async () => {
      mockMedalRequirements.mockResolvedValue({
        minDays: BigInt(30),
        minDonations: BigInt(10),
        burnCost: BigInt('100000000000000000000'), // 100 tokens
      });

      const requirements = await blockchain.getMedalRequirements(1);

      expect(mockMedalRequirements).toHaveBeenCalledWith(1);
      expect(requirements).toEqual({
        minDays: 30,
        minDonations: 10,
        burnCost: '100',
      });
    });

    it('should handle tier 0 (bronze) requirements', async () => {
      mockMedalRequirements.mockResolvedValue({
        minDays: BigInt(7),
        minDonations: BigInt(3),
        burnCost: BigInt('10000000000000000000'), // 10 tokens
      });

      const requirements = await blockchain.getMedalRequirements(0);

      expect(requirements).toEqual({
        minDays: 7,
        minDonations: 3,
        burnCost: '10',
      });
    });

    it('should handle tier 3 (platinum) requirements', async () => {
      mockMedalRequirements.mockResolvedValue({
        minDays: BigInt(365),
        minDonations: BigInt(100),
        burnCost: BigInt('1000000000000000000000'), // 1000 tokens
      });

      const requirements = await blockchain.getMedalRequirements(3);

      expect(requirements).toEqual({
        minDays: 365,
        minDonations: 100,
        burnCost: '1000',
      });
    });
  });

  describe('setTokenMetadataURI', () => {
    it('should set metadata URI and return tx hash', async () => {
      const mockTx = {
        hash: '0xmetadatahash',
        wait: vi.fn().mockResolvedValue({}),
      };
      mockSetTokenMetadataURI.mockResolvedValue(mockTx);

      const txHash = await blockchain.setTokenMetadataURI(
        123,
        'ipfs://QmTest123'
      );

      expect(mockSetTokenMetadataURI).toHaveBeenCalledWith(
        123,
        'ipfs://QmTest123'
      );
      expect(txHash).toBe('0xmetadatahash');
    });

    it('should handle different URI formats', async () => {
      const mockTx = {
        hash: '0xhash',
        wait: vi.fn().mockResolvedValue({}),
      };
      mockSetTokenMetadataURI.mockResolvedValue(mockTx);

      await blockchain.setTokenMetadataURI(1, 'https://example.com/metadata.json');

      expect(mockSetTokenMetadataURI).toHaveBeenCalledWith(
        1,
        'https://example.com/metadata.json'
      );
    });
  });

  describe('getStoredTokenURI', () => {
    it('should return stored token URI', async () => {
      mockGetStoredTokenURI.mockResolvedValue('ipfs://QmStoredURI');

      const uri = await blockchain.getStoredTokenURI(123);

      expect(mockGetStoredTokenURI).toHaveBeenCalledWith(123);
      expect(uri).toBe('ipfs://QmStoredURI');
    });

    it('should return empty string for unset URI', async () => {
      mockGetStoredTokenURI.mockResolvedValue('');

      const uri = await blockchain.getStoredTokenURI(999);

      expect(uri).toBe('');
    });
  });

  describe('error handling', () => {
    it('should propagate contract call errors', async () => {
      mockBalanceOf.mockRejectedValue(new Error('Contract reverted'));

      await expect(blockchain.getTokenBalance(TEST_WALLET)).rejects.toThrow(
        'Contract reverted'
      );
    });

    it('should propagate transaction errors', async () => {
      mockAddFraudStrike.mockRejectedValue(
        new Error('Transaction failed')
      );

      await expect(blockchain.addFraudStrike(TEST_WALLET)).rejects.toThrow(
        'Transaction failed'
      );
    });

    it('should propagate tx.wait errors', async () => {
      const mockTx = {
        hash: '0xhash',
        wait: vi.fn().mockRejectedValue(new Error('Transaction reverted')),
      };
      mockFinalizeDay.mockResolvedValue(mockTx);

      await expect(blockchain.finalizeDay(1)).rejects.toThrow('Transaction reverted');
    });
  });
});
