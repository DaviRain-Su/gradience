'use client';

import { motion } from 'framer-motion';
import { PrivyLogin } from '../components/auth/PrivyLogin';
import { WalletDiscovery } from '../components/demo/WalletDiscovery';
import { Github, Twitter, ExternalLink } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto mb-12"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xl font-bold">
              G
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Gradience</h1>
              <p className="text-xs text-gray-400">OWS + Privy Demo</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/gradience/ows-adapter" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <Github className="w-5 h-5" />
              <span className="hidden md:inline">GitHub</span>
            </a>
            <a 
              href="https://docs.privy.io" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="hidden md:inline">Privy Docs</span>
            </a>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-4xl mx-auto text-center mb-12"
      >
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
          <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Open Wallet Standard
          </span>
          <br />
          <span className="text-2xl md:text-3xl text-gray-400">
            with Privy Authentication
          </span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          A universal wallet adapter supporting MetaMask, Phantom, OKX Wallet, and more. 
          Combined with Privy&apos;s seamless social login and embedded wallet infrastructure.
        </p>
      </motion.section>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
        {/* Privy Section */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <PrivyLogin />
          
          <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
            <h3 className="font-semibold text-white mb-2">Privy Features</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                Google, Email, Twitter login
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                Auto-generated embedded wallet
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                MPC key management
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                External wallet connection
              </li>
            </ul>
          </div>
        </motion.section>

        {/* OWS Section */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <WalletDiscovery />
          
          <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
            <h3 className="font-semibold text-white mb-2">OWS Standard</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                Universal wallet discovery
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                Standardized connection interface
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                Multi-chain support
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                OKX On-chain OS integration
              </li>
            </ul>
          </div>
        </motion.section>
      </div>

      {/* Hackathon Badge */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-4xl mx-auto mt-16 text-center"
      >
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30">
          <span className="text-2xl">🏆</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">OWS Hackathon Miami</p>
            <p className="text-xs text-gray-400">April 5-7, 2026</p>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="max-w-6xl mx-auto mt-16 pt-8 border-t border-gray-800"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© 2026 Gradience Labs</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors flex items-center gap-1">
              <Twitter className="w-4 h-4" />
              Twitter
            </a>
          </div>
        </div>
      </motion.footer>
    </main>
  );
}
