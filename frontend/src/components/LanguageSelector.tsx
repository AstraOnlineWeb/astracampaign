import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' }
];

interface LanguageSelectorProps {
    variant?: 'header' | 'navigation';
}

export function LanguageSelector({ variant = 'header' }: LanguageSelectorProps) {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLanguageChange = (langCode: string) => {
        i18n.changeLanguage(langCode);
        setIsOpen(false);
    };

    if (variant === 'navigation') {
        return (
            <div ref={dropdownRef} className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 text-white/70 hover:text-white hover:bg-white/10"
                    title={currentLanguage.name}
                >
                    <span className="text-xl">{currentLanguage.flag}</span>

                    {/* Tooltip */}
                    <div className="absolute left-16 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                        {currentLanguage.name}
                    </div>
                </button>

                {isOpen && (
                    <div className="absolute left-14 bottom-0 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageChange(lang.code)}
                                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${lang.code === i18n.language
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <span className="text-lg">{lang.flag}</span>
                                <span>{lang.name}</span>
                                {lang.code === i18n.language && (
                                    <svg className="w-4 h-4 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Header variant (default)
    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            >
                <span className="text-lg">{currentLanguage.flag}</span>
                <span className="hidden sm:inline">{currentLanguage.name}</span>
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageChange(lang.code)}
                                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${lang.code === i18n.language
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <span className="text-lg">{lang.flag}</span>
                                <span>{lang.name}</span>
                                {lang.code === i18n.language && (
                                    <svg className="w-4 h-4 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
