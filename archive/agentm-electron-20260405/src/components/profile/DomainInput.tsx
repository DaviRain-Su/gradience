/**
 * DomainInput Component
 *
 * Input component for registering or linking blockchain domains
 *
 * @module components/profile/DomainInput
 */

import { useState, useCallback, useEffect } from 'react';
import type { DomainType, DomainValidationResult } from './types.ts';

export interface DomainInputProps {
    /** Supported domain types */
    supportedTypes?: DomainType[];
    /** Current input value */
    value?: string;
    /** Default placeholder text */
    placeholder?: string;
    /** Loading state during validation */
    isValidating?: boolean;
    /** External error message */
    externalError?: string | null;
    /** Callback when domain value changes */
    onChange?: (value: string, result: DomainValidationResult) => void;
    /** Callback to trigger registration/linking */
    onSubmit?: (domain: string, type: DomainType) => void | Promise<void>;
    /** Custom validator function */
    validator?: (value: string) => DomainValidationResult | Promise<DomainValidationResult>;
    /** Additional CSS classes */
    className?: string;
}

const DEFAULT_SUPPORTED_TYPES: DomainType[] = ['sol', 'eth', 'ens'];

const TYPE_PATTERNS: Record<DomainType, RegExp> = {
    sol: /^[a-zA-Z0-9-]+\.sol$/i,
    eth: /^[a-zA-Z0-9-]+\.eth$/i,
    ens: /^[a-zA-Z0-9-]+\.ens$/i,
    bonfida: /^[a-zA-Z0-9-]+\.bonfida$/i,
};

const TYPE_PLACEHOLDERS: Record<DomainType, string> = {
    sol: 'example.sol',
    eth: 'example.eth',
    ens: 'example.ens',
    bonfida: 'example.bonfida',
};

/**
 * Default domain validator
 */
function defaultValidator(value: string): DomainValidationResult {
    const trimmed = value.trim().toLowerCase();

    if (!trimmed) {
        return { valid: false, error: 'Domain is required' };
    }

    // Check for valid domain format
    const hasValidExtension = Object.keys(TYPE_PATTERNS).some((type) =>
        trimmed.endsWith(`.${type}`),
    );

    if (!hasValidExtension) {
        return {
            valid: false,
            error: 'Domain must end with .sol, .eth, .ens, or .bonfida',
        };
    }

    // Validate specific type pattern
    for (const [type, pattern] of Object.entries(TYPE_PATTERNS)) {
        if (trimmed.endsWith(`.${type}`) && !pattern.test(trimmed)) {
            return {
                valid: false,
                error: `Invalid ${type} domain format`,
            };
        }
    }

    // Check minimum length (e.g., a.sol is too short)
    const namePart = trimmed.split('.')[0];
    if (namePart.length < 2) {
        return {
            valid: false,
            error: 'Domain name must be at least 2 characters',
        };
    }

    return { valid: true, normalized: trimmed };
}

/**
 * Detect domain type from value
 */
function detectDomainType(value: string): DomainType | null {
    const lower = value.toLowerCase();
    for (const type of Object.keys(TYPE_PATTERNS) as DomainType[]) {
        if (lower.endsWith(`.${type}`)) {
            return type;
        }
    }
    return null;
}

/**
 * DomainInput - Input field for domain registration/linking
 *
 * Features:
 * - Real-time validation
 * - Domain type auto-detection
 * - Support for .sol, .eth, .ens, .bonfida domains
 * - Visual feedback for validation state
 */
export function DomainInput({
    supportedTypes = DEFAULT_SUPPORTED_TYPES,
    value: controlledValue,
    placeholder = 'Enter domain (e.g., example.sol)',
    isValidating = false,
    externalError,
    onChange,
    onSubmit,
    validator = defaultValidator,
    className = '',
}: DomainInputProps) {
    const [internalValue, setInternalValue] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [detectedType, setDetectedType] = useState<DomainType | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const value = controlledValue ?? internalValue;

    // Update placeholder based on detected type
    const dynamicPlaceholder = detectedType
        ? TYPE_PLACEHOLDERS[detectedType]
        : placeholder;

    // Validate on change
    useEffect(() => {
        const trimmed = value.trim();

        if (!trimmed) {
            setIsValid(false);
            setValidationError(null);
            setDetectedType(null);
            return;
        }

        // Detect type
        const type = detectDomainType(trimmed);
        setDetectedType(type);

        // Run validation
        const runValidation = async () => {
            const result = await Promise.resolve(validator(trimmed));
            setIsValid(result.valid);
            setValidationError(result.error ?? null);
            onChange?.(trimmed, result);
        };

        void runValidation();
    }, [value, validator, onChange]);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            if (controlledValue === undefined) {
                setInternalValue(newValue);
            }
            onChange?.(newValue, { valid: false });
        },
        [controlledValue, onChange],
    );

    const handleSubmit = useCallback(async () => {
        if (!isValid || !detectedType || isSubmitting) return;

        const result = await Promise.resolve(validator(value.trim()));
        if (!result.valid || !result.normalized) return;

        setIsSubmitting(true);
        try {
            await onSubmit?.(result.normalized, detectedType);
            // Clear on success if uncontrolled
            if (controlledValue === undefined) {
                setInternalValue('');
                setIsValid(false);
                setDetectedType(null);
            }
        } finally {
            setIsSubmitting(false);
        }
    }, [isValid, detectedType, isSubmitting, validator, value, onSubmit, controlledValue]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && isValid) {
                void handleSubmit();
            }
        },
        [handleSubmit, isValid],
    );

    const displayError = externalError ?? validationError;
    const isLoading = isValidating || isSubmitting;

    // Type badge colors
    const typeColors: Record<DomainType, string> = {
        sol: 'bg-purple-600 text-white',
        eth: 'bg-blue-600 text-white',
        ens: 'bg-indigo-600 text-white',
        bonfida: 'bg-pink-600 text-white',
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Type selector tabs */}
            <div className="flex gap-1 p-1 bg-gray-800 rounded-lg">
                {supportedTypes.map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => {
                            const newValue = value.split('.')[0] + `.${type}`;
                            if (controlledValue === undefined) {
                                setInternalValue(newValue);
                            }
                            onChange?.(newValue, { valid: false });
                        }}
                        className={`
                            px-3 py-1 text-xs font-medium rounded capitalize transition
                            ${detectedType === type
                                ? typeColors[type]
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                            }
                        `}
                    >
                        .{type}
                    </button>
                ))}
            </div>

            {/* Input field */}
            <div className="relative">
                <input
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={dynamicPlaceholder}
                    disabled={isLoading}
                    className={`
                        w-full bg-gray-900 border rounded-lg px-4 py-3 text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500/50
                        transition-colors
                        ${displayError
                            ? 'border-red-500/50 focus:border-red-500'
                            : isValid
                                ? 'border-green-500/50 focus:border-green-500'
                                : 'border-gray-700 focus:border-blue-500'
                        }
                        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                />

                {/* Status indicator */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isLoading && (
                        <span className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                    )}
                    {!isLoading && isValid && (
                        <span className="text-green-500 text-lg">✓</span>
                    )}
                    {!isLoading && displayError && (
                        <span className="text-red-500 text-lg">✗</span>
                    )}
                </div>
            </div>

            {/* Error message */}
            {displayError && (
                <p className="text-xs text-red-400">{displayError}</p>
            )}

            {/* Help text */}
            {!displayError && !isValid && (
                <p className="text-xs text-gray-500">
                    Enter your blockchain domain name to link it to your profile
                </p>
            )}

            {/* Submit button */}
            {onSubmit && (
                <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={!isValid || isLoading}
                    className={`
                        w-full px-4 py-2 rounded-lg text-sm font-medium transition
                        ${isValid && !isLoading
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }
                    `}
                >
                    {isSubmitting ? 'Linking...' : 'Link Domain'}
                </button>
            )}
        </div>
    );
}

/**
 * DomainInputCompact - Compact variant for inline usage
 */
export interface DomainInputCompactProps {
    value?: string;
    onChange?: (value: string, result: DomainValidationResult) => void;
    onSubmit?: (domain: string, type: DomainType) => void | Promise<void>;
    className?: string;
}

export function DomainInputCompact({
    value: controlledValue,
    onChange,
    onSubmit,
    className = '',
}: DomainInputCompactProps) {
    const [internalValue, setInternalValue] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [detectedType, setDetectedType] = useState<DomainType | null>(null);

    const value = controlledValue ?? internalValue;

    useEffect(() => {
        const trimmed = value.trim();
        const type = detectDomainType(trimmed);
        setDetectedType(type);

        const result = defaultValidator(trimmed);
        setIsValid(result.valid);
        onChange?.(trimmed, result);
    }, [value, onChange]);

    const handleSubmit = useCallback(() => {
        if (!isValid || !detectedType) return;

        const result = defaultValidator(value.trim());
        if (result.valid && result.normalized) {
            void onSubmit?.(result.normalized, detectedType);
            if (controlledValue === undefined) {
                setInternalValue('');
            }
        }
    }, [isValid, detectedType, value, onSubmit, controlledValue]);

    const typeColors: Record<DomainType, string> = {
        sol: 'text-purple-400 border-purple-500/30',
        eth: 'text-blue-400 border-blue-500/30',
        ens: 'text-indigo-400 border-indigo-500/30',
        bonfida: 'text-pink-400 border-pink-500/30',
    };

    return (
        <div className={`flex gap-2 ${className}`}>
            <div className="relative flex-1">
                {detectedType && (
                    <span
                        className={`
                            absolute left-3 top-1/2 -translate-y-1/2
                            text-xs font-medium px-2 py-0.5 rounded
                            border ${typeColors[detectedType]} bg-gray-800
                        `}
                    >
                        .{detectedType}
                    </span>
                )}
                <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                        const newValue = e.target.value;
                        if (controlledValue === undefined) {
                            setInternalValue(newValue);
                        }
                        onChange?.(newValue, { valid: false });
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="example.sol"
                    className={`
                        w-full bg-gray-900 border border-gray-700 rounded-lg
                        ${detectedType ? 'pl-16' : 'pl-4'} pr-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500/50
                        focus:border-blue-500 transition-colors
                    `}
                />
            </div>
            <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid}
                className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition
                    ${isValid
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }
                `}
            >
                Link
            </button>
        </div>
    );
}

export default DomainInput;
