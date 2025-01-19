import { validateApiKey } from '@/utils/groq';
import { useState, useEffect } from 'react';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@headlessui/react';

interface ApiKeyModalProps {
  onApiKeySubmit: (apiKey: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiKeyModal({ onApiKeySubmit, isOpen, onClose }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setApiKey('');
      setError('');
      setShowKey(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsValidating(true);

    try {
      const isValid = await validateApiKey(apiKey.trim());
      
      if (isValid) {
        localStorage.setItem('jenna_api_key', apiKey.trim());
        onApiKeySubmit(apiKey.trim());
        onClose();
      } else {
        setError('Invalid Groq API key. Please check and try again.');
      }
    } catch (error) {
      setError('Error validating API key. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').trim();
    setApiKey(pastedText);
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={() => !isValidating && onClose()}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            
            <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-white text-center">
              Connect Your Groq API Key
            </Dialog.Title>
            
            <p className="text-gray-600 dark:text-gray-300 mt-2 text-center text-sm">
              Get your API key from <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-600">Groq Console</a>
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onPaste={handlePaste}
                placeholder="gsk_..."
                className="w-full p-4 border-2 rounded-xl pr-24 bg-transparent dark:border-gray-600 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 outline-none font-mono"
                required
              />
              
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showKey ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            
            {error && (
              <Alert variant="destructive" className="flex items-center space-x-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </Alert>
            )}
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isValidating}
                className="flex-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-xl p-4 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={isValidating || !apiKey.trim()}
                className="flex-1 bg-purple-500 text-white rounded-xl p-4 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                {isValidating ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Validating...</span>
                  </div>
                ) : (
                  'Connect'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your API key is stored locally and never sent to our servers
            </p>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}