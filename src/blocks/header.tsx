import { m } from '@/paraglide/messages.js';
import { SiteHeader } from '@/components/site-header';

export function Header() {
  const navLinks = [
    { href: '/#create', label: m['landing.nav.create']() },
    { href: '/#drift', label: m['landing.nav.drift']() },
    { href: '/#guide', label: m['landing.nav.guide']() },
    { href: '/pricing', label: m['landing.nav.pricing']() },
    { href: '/#faq', label: m['landing.nav.faq']() },
  ];

  return (
    <SiteHeader navLinks={navLinks} logoAlt={m['landing.nav.logo_alt']()} />
  );
}
