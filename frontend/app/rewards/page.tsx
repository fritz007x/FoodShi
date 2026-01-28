'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Heart, Coins, Trophy, ArrowRight, Lock } from 'lucide-react';
import Layout from '@/components/Layout';
import { rewardsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { cn, MEDAL_COLORS, MEDAL_REQUIREMENTS } from '@/lib/utils';

export default function RewardsPage() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [karma, setKarma] = useState({ confirmed: 0, pending: 0, total: 0 });
  const [medals, setMedals] = useState<any>(null);
  const [exchangeAmount, setExchangeAmount] = useState(100);
  const [isExchanging, setIsExchanging] = useState(false);

  useEffect(() => {
    loadRewards();
  }, []);

  async function loadRewards() {
    try {
      const [karmaRes, medalsRes] = await Promise.all([
        rewardsApi.getKarma(),
        rewardsApi.getMedals(),
      ]);

      setKarma(karmaRes.data.karma);
      setMedals(medalsRes.data);
    } catch (error) {
      toast.error('Failed to load rewards');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExchange() {
    if (!user?.walletAddress) {
      toast.error('Please link your wallet first');
      return;
    }

    setIsExchanging(true);
    try {
      const { data } = await rewardsApi.exchange({ karmaAmount: exchangeAmount });
      toast.success(`Exchanged ${exchangeAmount} karma for ${data.exchange.tokenAmount} $SHARE`);
      loadRewards();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Exchange failed');
    } finally {
      setIsExchanging(false);
    }
  }

  async function handleMintMedal(tier: string) {
    if (!user?.walletAddress) {
      toast.error('Please link your wallet first');
      return;
    }

    try {
      const { data } = await rewardsApi.mintMedal({ tier: tier as any });
      toast.success(data.message);
      loadRewards();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Minting failed');
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Rewards</h1>

        {/* Karma Balance */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Karma Points</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <Heart className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary-700">{karma.confirmed}</div>
              <div className="text-sm text-primary-600">Confirmed</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <Heart className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-yellow-700">{karma.pending}</div>
              <div className="text-sm text-yellow-600">Pending</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Heart className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-700">{karma.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>
        </div>

        {/* Exchange Karma */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Exchange Karma for $SHARE</h2>
          <p className="text-gray-600 text-sm mb-4">
            Exchange rate: 10 Karma = 1 $SHARE. Minimum 100 Karma required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Karma Amount
              </label>
              <input
                type="number"
                min={100}
                max={karma.confirmed}
                step={10}
                value={exchangeAmount}
                onChange={(e) => setExchangeAmount(Number(e.target.value))}
                className="input"
              />
            </div>
            <div className="flex items-end">
              <ArrowRight className="h-5 w-5 text-gray-400 hidden sm:block mx-4 mb-3" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                $SHARE Tokens
              </label>
              <div className="input bg-gray-50 flex items-center">
                <Coins className="h-5 w-5 text-primary-600 mr-2" />
                {(exchangeAmount / 10).toFixed(1)} $SHARE
              </div>
            </div>
          </div>

          {!user?.walletAddress ? (
            <p className="text-sm text-yellow-600 mt-4">
              <Lock className="h-4 w-4 inline mr-1" />
              Link your wallet to exchange karma
            </p>
          ) : (
            <button
              onClick={handleExchange}
              disabled={isExchanging || karma.confirmed < 100}
              className="btn-primary mt-4"
            >
              {isExchanging ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Exchange'
              )}
            </button>
          )}
        </div>

        {/* Medal NFTs */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">NFT Medals</h2>

          {medals?.progress ? (
            <div className="text-sm text-gray-600 mb-4">
              <p>First donation: {medals.progress.firstDonationDate ? new Date(medals.progress.firstDonationDate).toLocaleDateString() : 'N/A'}</p>
              <p>Total confirmed donations: {medals.progress.totalConfirmedDonations}</p>
              <p>Days active: {medals.progress.daysSinceFirst}</p>
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-4">
              Start donating to unlock medal NFTs!
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {(['bronze', 'silver', 'gold', 'platinum'] as const).map((tier) => {
              const req = MEDAL_REQUIREMENTS[tier];
              const colors = MEDAL_COLORS[tier];
              const eligibility = medals?.eligibility?.[tier];
              const isOwned = medals?.owned?.includes(tier);

              return (
                <div
                  key={tier}
                  className={cn(
                    'p-4 rounded-lg border-2',
                    isOwned ? colors.border : 'border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', colors.bg)}>
                      <Trophy className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold capitalize">{tier}</h3>
                      {isOwned && (
                        <span className="text-xs text-green-600">Owned</span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1 mb-3">
                    <p>{req.days} days active</p>
                    <p>{req.donations} donations</p>
                    <p>{req.burn} $SHARE burn cost</p>
                  </div>

                  {!isOwned && (
                    <button
                      onClick={() => handleMintMedal(tier)}
                      disabled={!eligibility?.eligible || !user?.walletAddress}
                      className={cn(
                        'w-full py-2 rounded-lg text-sm font-medium',
                        eligibility?.eligible
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      )}
                    >
                      {eligibility?.eligible
                        ? 'Mint Medal'
                        : eligibility?.reason || 'Not eligible'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
