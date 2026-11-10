import React from 'react';
import { useCurrency } from '@/lib/currency';
import { DollarSign, Euro, PoundSterling, SwissFranc } from './custom-icons';

type IconProps = React.ComponentProps<typeof Euro>;

/** Money icon that follows the active band currency (€ / $ / £ / CHF). */
export const CurrencyIcon: React.FC<IconProps> = (props) => {
  const { code } = useCurrency();
  const Icon = code === 'USD' ? DollarSign : code === 'GBP' ? PoundSterling : code === 'CHF' ? SwissFranc : Euro;
  return <Icon {...props} />;
};
