import type { FormEvent } from 'react';
import { YommigoIcon } from '../YommigoIcon';

interface SearchBarProps {
  city: string;
  query: string;
  onCityChange: (city: string) => void;
  onQueryChange: (query: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  compact?: boolean;
}

const CITIES = [{ value: 'Monterrey', label: 'Monterrey, N.L.' }, { value: 'Tijuana', label: 'Tijuana, B.C.' }, { value: 'Mexicali', label: 'Mexicali, B.C.' }, { value: 'La Paz', label: 'La Paz, B.C.S.' }, { value: 'Ensenada', label: 'Ensenada, B.C.' }];

export function SearchBar({ city, query, onCityChange, onQueryChange, onSubmit, compact = false }: SearchBarProps) {
  return (
    <form className={`landing-search ${compact ? 'landing-search--compact' : ''}`} onSubmit={onSubmit} role="search">
      <label className="landing-search__location">
        <YommigoIcon name="ubicacion" size={32} alt="" loading="eager" />
        <span className="sr-only">Ciudad</span>
        <select value={city} onChange={(event) => onCityChange(event.target.value)}>
          {CITIES.map((availableCity) => <option key={availableCity.value} value={availableCity.value}>{availableCity.label}</option>)}
        </select>
      </label>
      {!compact && <span className="landing-search__divider" aria-hidden="true" />}
      {!compact && <label className="landing-search__query"><span className="sr-only">Buscar comida o restaurante</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={'\u00bfQu\u00e9 se te antoja hoy?'} /></label>}
      {!compact && <button type="submit" className="landing-search__button" aria-label="Buscar"><YommigoIcon name="busqueda" size={32} alt="" loading="eager" /></button>}
    </form>
  );
}