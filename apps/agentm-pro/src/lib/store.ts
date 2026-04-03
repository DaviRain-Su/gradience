import { create } from 'zustand';
import type { ActiveView, AgentProfile, AuthState } from '@/types';

interface ProStore {
    auth: AuthState;
    activeView: ActiveView;
    profiles: AgentProfile[];
    currentProfile: AgentProfile | null;
    setAuth: (auth: AuthState) => void;
    setActiveView: (view: ActiveView) => void;
    setProfiles: (profiles: AgentProfile[]) => void;
    setCurrentProfile: (profile: AgentProfile | null) => void;
}

const initialAuth: AuthState = {
    authenticated: false,
    publicKey: null,
    email: null,
    privyUserId: null,
};

export const useProStore = create<ProStore>((set) => ({
    auth: initialAuth,
    activeView: 'dashboard',
    profiles: [],
    currentProfile: null,
    setAuth: (auth) => set({ auth }),
    setActiveView: (view) => set({ activeView: view }),
    setProfiles: (profiles) => set({ profiles }),
    setCurrentProfile: (profile) => set({ currentProfile: profile }),
}));
