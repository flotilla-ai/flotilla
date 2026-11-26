export type PriceTable = {
  version: string;
  unverified: boolean;
  models: Record<string, { inputPerMillionMicro: number; outputPerMillionMicro: number; cachePerMillionMicro: number }>;
};

export const placeholderPriceTable: PriceTable = {
  version: 'p1-placeholder-unverified',
  unverified: true,
  models: {
    default: { inputPerMillionMicro: 0, outputPerMillionMicro: 0, cachePerMillionMicro: 0 }
  }
};
