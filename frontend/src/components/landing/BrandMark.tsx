import { Link } from 'react-router-dom';
import officialYommiLogo from '../../../../design/assets/logos/webp/512/yommigo-logotipo-horizontal-blanco.webp';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`brand-mark ${compact ? 'brand-mark--compact' : ''}`} aria-label="Yommi, ir al inicio">
      <img src={officialYommiLogo} alt="" width="512" height="512" decoding="async" />
    </Link>
  );
}
