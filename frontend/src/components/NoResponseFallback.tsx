import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { decreaseResponseScore } from '../utils/whatsapp';

export function NoResponseFallback() {
  const [attempt, setAttempt] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAttempt = () => {
      try {
        const stored = localStorage.getItem('lastOrderAttempt');
        if (stored) {
          const parsed = JSON.parse(stored);
          const elapsed = Date.now() - parsed.timestamp;
          if (elapsed >= 2 * 60 * 1000) { // 2 minutes
            setAttempt(parsed);
          }
        }
      } catch (e) {
        console.error('Error checking order attempt', e);
      }
    };

    // Check on mount
    checkAttempt();

    // Check when window regains focus
    window.addEventListener('focus', checkAttempt);
    
    // Also check periodically just in case they stay on the page
    const interval = setInterval(checkAttempt, 30000);

    return () => {
      window.removeEventListener('focus', checkAttempt);
      clearInterval(interval);
    };
  }, []);

  if (!attempt) return null;

  const handleWait = () => {
    localStorage.removeItem('lastOrderAttempt');
    setAttempt(null);
  };

  const handleAlternatives = () => {
    if (attempt?.restaurant_id) {
      decreaseResponseScore(attempt.restaurant_id);
    }
    localStorage.removeItem('lastOrderAttempt');
    setAttempt(null);
    navigate(`/restaurants?category=${encodeURIComponent(attempt.category)}&exclude=${attempt.restaurant_id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-300">
        <button 
          onClick={handleWait} 
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-2xl font-bold mb-3 text-gray-900">¿No te respondieron?</h2>
        
        <p className="text-gray-600 mb-6 text-lg">
          Parece que <span className="font-bold text-gray-900">{attempt.restaurant_name}</span> no respondió. 
          Te mostramos opciones que responden más rápido 🍔
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={handleAlternatives}
            className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-sm text-lg"
          >
            Ver opciones disponibles
          </button>
          <button 
            onClick={handleWait}
            className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors text-lg"
          >
            Seguir esperando
          </button>
        </div>
      </div>
    </div>
  );
}
