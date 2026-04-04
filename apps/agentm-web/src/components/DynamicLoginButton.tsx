/**
 * Dynamic Login Button Component
 *
 * 使用 Dynamic SDK 的登录按钮
 *
 * @module components/DynamicLoginButton
 */

import React from 'react';
import { useDynamic } from '../lib/dynamic/provider';

interface DynamicLoginButtonProps {
  /** 按钮样式变体 */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 自定义类名 */
  className?: string;
}

export const DynamicLoginButton: React.FC<DynamicLoginButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const { login, logout, isAuthenticated, isLoading, user } = useDynamic();

  // 已登录状态
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {user.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">
              {user.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-xs text-gray-500">Connected</p>
          </div>
        </div>
        <button
          onClick={logout}
          disabled={isLoading}
          className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          {isLoading ? '...' : 'Logout'}
        </button>
      </div>
    );
  }

  // 未登录状态
  return (
    <button
      onClick={login}
      disabled={isLoading}
      className={getButtonClasses(variant, size, className)}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Connecting...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
          Sign In
        </span>
      )}
    </button>
  );
};

function getButtonClasses(
  variant: 'primary' | 'secondary' | 'ghost',
  size: 'sm' | 'md' | 'lg',
  className: string
): string {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900',
    secondary: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
}

export default DynamicLoginButton;
