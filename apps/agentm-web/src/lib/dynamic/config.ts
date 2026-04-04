// Dynamic Configuration
// Get your Environment ID from https://app.dynamic.xyz

export const dynamicConfig = {
    environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || '',
    appName: 'AgentM',
    appLogoUrl: 'https://your-logo-url.com/logo.png',
    
    // Wallets configuration
    wallets: {
        solana: {
            enabled: true,
        },
    },
    
    // Social providers
    socialProviders: {
        google: {
            enabled: true,
        },
        twitter: {
            enabled: true,
        },
        discord: {
            enabled: true,
        },
    },
    
    // Theme
    theme: {
        colorScheme: 'light',
        accentColor: '#C6BBFF',
        backgroundColor: '#F3F3F8',
        textColor: '#16161A',
    },
};
