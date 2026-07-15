import { Link } from 'react-router-dom';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`brand-mark ${compact ? 'brand-mark--compact' : ''}`} aria-label="Yommigo, ir al inicio">
      <span>Yommigo</span><i aria-hidden="true" />
    </Link>
  );
}
