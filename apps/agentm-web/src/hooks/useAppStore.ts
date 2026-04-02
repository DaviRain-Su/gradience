import { useStore } from 'zustand';
import { createAppStore } from '../lib/store.ts';

const store = createAppStore();

export function useAppStore<T>(selector: (state: ReturnType<typeof store.getState>) => T): T {
    return useStore(store, selector);
}

export { store };
