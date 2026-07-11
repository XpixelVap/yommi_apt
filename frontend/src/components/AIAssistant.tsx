import { useState } from 'react';
import { Bot, Send, MapPin } from 'lucide-react';

export function AIAssistant() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState<any[]>([]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse('');
    setPlaces([]);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      setResponse(data.text);
      if (data.restaurants) {
        setPlaces(data.restaurants);
      } else if (data.places) {
        setPlaces(data.places);
      }
    } catch (error) {
      setResponse('Hubo un error al consultar al asistente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-orange-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-orange-100 p-2 rounded-xl">
          <Bot className="w-6 h-6 text-orange-600" />
        </div>
        <h2 className="text-xl font-bold">Asistente IA</h2>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Pregúntame sobre restaurantes cercanos o recomendaciones de comida.
      </p>

      <form onSubmit={handleAsk} className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Ej: ¿Qué restaurantes italianos hay cerca?"
          className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-orange-600 text-white p-2 px-4 rounded-xl hover:bg-orange-700 disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

      {loading && <div className="text-orange-600 text-sm animate-pulse">Pensando...</div>}
      
      {response && (
        <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-800 whitespace-pre-wrap">
          {response}
        </div>
      )}

      {places.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="font-bold text-sm text-gray-700">Restaurantes encontrados:</h3>
          {places.map((place, i) => (
            <a
              key={i}
              href={place.id ? `/restaurant/${place.id}` : place.uri}
              target={place.id ? "_self" : "_blank"}
              rel="noopener noreferrer"
              className="flex items-start gap-2 p-3 bg-white border border-gray-100 rounded-xl hover:border-orange-300 transition-colors"
            >
              <MapPin className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-sm">{place.name || place.title}</div>
                <div className="text-xs text-gray-500 truncate max-w-[200px] sm:max-w-xs">{place.description || place.uri}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
