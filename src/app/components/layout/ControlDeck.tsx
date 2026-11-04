import React from 'react';
import { IdentityHub, IdentityHubProps } from './IdentityHub';

export interface ControlDeckProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (item: string) => void;
  isAdmin?: boolean;
}

/**
 * @deprecated ControlDeck has been consolidated into the unified IdentityHub (Account & Workspace Hub).
 * This component delegates directly to IdentityHub to eliminate navigation redundancy.
 */
export const ControlDeck: React.FC<ControlDeckProps & Partial<IdentityHubProps>> = (props) => {
  const { isOpen, onClose, onNavigate, bands, selectedBand, setSelectedBand, ...rest } = props;
  return (
    <IdentityHub
      isOpen={isOpen}
      onClose={onClose}
      bands={bands || []}
      selectedBand={selectedBand || ({ id: 1, name: 'Band', members: 1 } as any)}
      setSelectedBand={setSelectedBand || (() => {})}
      onOpenPricing={() => onNavigate?.('PricingSettings')}
      onOpenSettings={(section) => onNavigate?.(section ? `Settings:${section}` : 'Settings')}
      {...rest}
    />
  );
};
