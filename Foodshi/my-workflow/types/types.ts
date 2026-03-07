export type Config = {
  backendUrl: string;
  emissionPoolReceiverAddress: string;
  chainId: number;
};

export type DailyPointsResponse = {
  date: string;
  users: Array<{
    walletAddress: string;
    points: number;
  }>;
};
