import { m } from '@/paraglide/messages.js';
import { FooterBadgeList } from '@/components/footer-badge-list';
import { SiteFooter, type FooterColumn } from '@/components/site-footer';

export function Footer() {
  const contact = m['landing.footer.contact']();
  const columns: FooterColumn[] = [
    {
      title: m['landing.footer.product'](),
      links: [
        { label: m['landing.nav.create'](), href: '/#create' },
        { label: m['landing.nav.drift'](), href: '/#drift' },
        { label: m['landing.nav.pricing'](), href: '/pricing' },
        { label: m['landing.nav.faq'](), href: '/#faq' },
      ],
    },
    {
      title: m['landing.footer.resources'](),
      links: [
        { label: m['landing.footer.blog'](), href: '/blog' },
        { label: contact, href: `mailto:${contact}` },
      ],
    },
    {
      title: m['landing.footer.legal'](),
      links: [
        { label: m['landing.footer.privacy'](), href: '/privacy-policy' },
        { label: m['landing.footer.terms'](), href: '/terms-of-service' },
        { label: m['landing.footer.aup'](), href: '/acceptable-use-policy' },
      ],
    },
  ];

  return (
    <SiteFooter
      tagline={m['landing.footer.tagline']()}
      copyright={`© ${new Date().getFullYear()} ideogram-45.com · ${m['landing.footer.disclaimer']()}`}
      columns={columns}
      badges={<FooterBadgeList className="mt-10" />}
    />
  );
}
