'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { Loader2, Wallet, Link2, Unlink, Coins, Lock, Clock } from 'lucide-react';
import Layout from '@/components/Layout';
import { authApi, rewardsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatAddress, cn } from '@/lib/utils';
import { CONTRACT_ADDRESSES } from '@/lib/wagmi';

export default function WalletPage() {
  const { user, setUser } = useAuthStore();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [isLoading, setIsLoading] = useState(true);
  const [tokenData, setTokenData] = useState<any>(null);
  const [isLinking, setIsLinking] = useState(false);

  const { data: maticBalance } = useBalance({
    address: address,
  });

  useEffect(() => {
    loadTokenData();
  }, [user?.walletAddress]);

  async function loadTokenData() {
    if (!user?.walletAddress) {
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await rewardsApi.getTokens();
      setTokenData(data);
    } catch (error) {
      console.error('Failed to load token data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLinkWallet() {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLinking(true);
    try {
      await authApi.linkWallet({ walletAddress: address });
      const { data } = await authApi.getMe();
      setUser(data.user);
      toast.success('Wallet linked successfully!');
      loadTokenData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to link wallet');
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Wallet</h1>

        {/* Connect Wallet */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Connect Wallet</h2>

          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Connected</p>
                    <p className="text-sm text-green-600">{formatAddress(address!, 6)}</p>
                  </div>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="btn-ghost text-red-600"
                >
                  <Unlink className="h-4 w-4 mr-1" />
                  Disconnect
                </button>
              </div>

              {maticBalance && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">MATIC Balance</p>
                  <p className="text-lg font-semibold">
                    {parseFloat(maticBalance.formatted).toFixed(4)} MATIC
                  </p>
                </div>
              )}

              {user?.walletAddress !== address?.toLowerCase() && (
                <button
                  onClick={handleLinkWallet}
                  disabled={isLinking}
                  className="btn-primary w-full"
                >
                  {isLinking ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Link to Account
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => connect({ connector })}
                  className="btn-secondary w-full justify-start"
                >
                  <Wallet className="h-5 w-5 mr-3" />
                  {connector.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Linked Wallet */}
        {user?.walletAddress && (
          <div className="card mb-6">
            <h2 className="text-lg font-semibold mb-4">Linked Wallet</h2>
            <div className="p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-600">Your FOODSHI wallet</p>
              <p className="font-mono text-primary-800">{user.walletAddress}</p>
            </div>
          </div>
        )}

        {/* Token Balances */}
        {user?.walletAddress && (
          <div className="card mb-6">
            <h2 className="text-lg font-semibold mb-4">$SHARE Tokens</h2>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              </div>
            ) : tokenData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Coins className="h-4 w-4 text-primary-600" />
                      <span className="text-sm text-gray-600">Total Balance</span>
                    </div>
                    <p className="text-xl font-bold">{parseFloat(tokenData.balance).toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-600">Transferable</span>
                    </div>
                    <p className="text-xl font-bold">{parseFloat(tokenData.transferable).toFixed(2)}</p>
                  </div>
                </div>

                {/* Staking Info */}
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-3">Staking</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Staked Amount</span>
                      <span className="font-medium">{parseFloat(tokenData.staked).toFixed(2)} $SHARE</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Super Donor Status</span>
                      <span className={cn('font-medium', tokenData.isSuperDonor ? 'text-green-600' : 'text-gray-400')}>
                        {tokenData.isSuperDonor ? 'Active (1.5x)' : 'Inactive'}
                      </span>
                    </div>
                    {tokenData.unlockTime > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Unlock Date</span>
                        <span className="font-medium">
                          {new Date(tokenData.unlockTime * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500 mb-3">
                      <Lock className="h-3 w-3 inline mr-1" />
                      Stake 10+ $SHARE to enable withdrawals. Stake 500 $SHARE for 3 months to become a Super Donor (1.5x rewards).
                    </p>
                    <button className="btn-primary w-full">
                      Manage Staking
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Unable to load token data</p>
            )}
          </div>
        )}

        {/* Contract Info */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Contract Addresses</h2>
          <div className="space-y-2 text-sm">
            {[
              { name: '$SHARE Token', address: CONTRACT_ADDRESSES.shareToken },
              { name: 'Staking', address: CONTRACT_ADDRESSES.staking },
              { name: 'Medal NFT', address: CONTRACT_ADDRESSES.medalNFT },
            ].map((contract) => (
              <div key={contract.name} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-gray-600">{contract.name}</span>
                <code className="text-xs text-gray-800">
                  {contract.address ? formatAddress(contract.address, 6) : 'Not deployed'}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
