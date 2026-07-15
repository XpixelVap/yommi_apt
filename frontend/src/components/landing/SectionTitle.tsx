import { ArrowRight } from 'lucide-react';

export function SectionTitle({ children, href = '/restaurants' }: { children: string; href?: string }) {
  return <div className="landing-section-title"><h2>{children}</h2><a href={href}>Ver todas <ArrowRight aria-hidden="true" /></a></div>;
}
