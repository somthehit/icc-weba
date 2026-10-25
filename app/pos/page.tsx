import React from 'react';
import { StoreProvider } from '@/context/StoreContext';
import { SeoProvider } from '@/context/SeoContext';
import CounterPosTerminal from '@/components/pos/CounterPosTerminal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dedicated Counter POS System | Intel Computer Center',
  description: 'Streamlined Counter POS System focused solely on retail billing and cashier sessions with dual-custody authorization.',
};

export default function PosPage() {
  return (
    <StoreProvider>
      <SeoProvider>
        <CounterPosTerminal />
      </SeoProvider>
    </StoreProvider>
  );
}
