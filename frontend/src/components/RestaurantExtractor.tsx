import { useState } from 'react';
import { Bot, Send, Copy, ExternalLink, CheckCircle, Plus } from 'lucide-react';
import { useAuthStore } from '../store';

interface RestaurantExtractorProps {
  onAddToDirectory?: (data: any) => void;
}

export function RestaurantExtractor({ onAddToDirectory }: RestaurantExtractorProps) {
  const { token } = useAuthStore();
  const [sourceText, setSourceText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceText.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setCopied(false);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/extract-restaurant`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sourceText })
      });

      if (!res.ok) {
        throw new Error('Error al extraer información');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold mb-2">Extractor de Restaurantes IA</h1>
        <p className="text-gray-500">
          Pega texto, direcciones o enlaces de Google Maps para extraer automáticamente la información del restaurante y generar enlaces de invitación.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-orange-600" />
            <h2 className="font-bold text-lg">Fuente de Datos</h2>
          </div>
          
          <form onSubmit={handleExtract} className="flex flex-col flex-1">
            <textarea
              className="flex-1 w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none mb-4 font-mono text-sm"
              placeholder="Pega aquí la información del restaurante (texto de Google Maps, dirección, etc.)..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !sourceText.trim()}
              className="w-full bg-orange-600 text-white py-3 rounded-xl font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Extraer Información
                </>
              )}
            </button>
          </form>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Output Section */}
        <div className="bg-gray-900 p-6 rounded-2xl shadow-sm flex flex-col h-[600px] text-gray-300 relative">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-white">Resultado JSON</h2>
            {result && (
              <button 
                onClick={handleCopy}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-auto bg-black/50 rounded-xl p-4 font-mono text-sm">
            {result ? (
              <pre className="whitespace-pre-wrap text-orange-400">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-600 italic">
                El resultado aparecerá aquí...
              </div>
            )}
          </div>

          {result?.boton_invitar?.link && (
            <div className="mt-4 space-y-3">
              <a
                href={result.boton_invitar.link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-white text-gray-900 py-3 rounded-xl font-bold hover:bg-gray-100 flex items-center justify-center gap-2 transition-colors"
              >
                {result.boton_invitar.texto || 'INVITAR A YOMMI'}
                <ExternalLink className="w-4 h-4" />
              </a>
              <p className="text-center text-xs text-gray-500 uppercase tracking-wider">
                Vía {result.boton_invitar.tipo}
              </p>
              
              {onAddToDirectory && (
                <button
                  onClick={() => onAddToDirectory(result)}
                  className="w-full bg-orange-600/20 text-orange-400 py-3 rounded-xl font-bold hover:bg-orange-600/30 flex items-center justify-center gap-2 transition-colors border border-orange-500/30"
                >
                  <Plus className="w-4 h-4" />
                  Agregar al Directorio
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
