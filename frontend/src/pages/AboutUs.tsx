import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  Zap,
  Wallet,
  Users,
  Target,
  Eye,
  Headphones,
  Heart,
  Check,
} from 'lucide-react';
import { PageMeta } from '../components/PageMeta';
import { PageShell } from '../components/cosmic';

const PAYMENT_METHODS = [
  'Cards',
  'Crypto',
  'Apple Pay',
  'Cash App',
  'Chime',
  'Online wallets',
  'And more',
] as const;

const MISSION_FOCUS = [
  'Reliable customer experience',
  'Secure transactions',
  'Responsive support',
  'Platform consistency',
  'Continuous improvement',
] as const;

type Differentiator = {
  icon: LucideIcon;
  title: string;
  description: string;
  list?: readonly string[];
};

const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: Calendar,
    title: 'Trusted Since 2019',
    description:
      'Global Ace Gaming has been operating and growing since late 2019, serving players consistently with dedication and reliability.',
  },
  {
    icon: Zap,
    title: 'Fast & Reliable Transactions',
    description:
      'From deposits to withdrawals, our goal is to make every transaction quick, smooth, and hassle-free.',
  },
  {
    icon: Wallet,
    title: 'Multiple Payment Methods',
    description: 'We support flexible payment solutions including:',
    list: PAYMENT_METHODS,
  },
  {
    icon: Users,
    title: 'Community Focused',
    description:
      'Our players are at the center of everything we do. We continuously improve our services, support, and platform experience based on real user feedback.',
  },
];

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="cosmic-h2 border-b border-white/10 pb-3 text-left lg:pb-4">
      {children}
    </h2>
  );
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full lg:h-11 lg:w-11"
      style={{
        background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,165,0,0.06))',
        border: '1px solid rgba(255,215,0,0.18)',
      }}
    >
      <Icon className="h-5 w-5" style={{ color: 'var(--casino-highlight-gold)' }} aria-hidden />
    </div>
  );
}

const AboutUs = () => {
  return (
    <>
      <PageMeta
        title="About Global Ace Gaming | Our Platform & Mission"
        description="Global Ace Gaming — trusted since 2019. Fast transactions, flexible payments, responsive support, and access to recognized gaming platforms."
      />
      <PageShell
        title="About Global Ace Gaming"
        subtitle="Trusted gaming services · Serving players since late 2019"
        width="6xl"
        background="subtle"
        contentClassName="pb-4"
      >
        <article className="space-y-10 sm:space-y-12 lg:space-y-14">
          <section className="border-b border-white/10 pb-8 sm:pb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end lg:gap-12 lg:pb-12">
            <div className="min-w-0">
              <p className="text-base font-medium leading-relaxed casino-text-primary sm:text-lg lg:text-xl lg:leading-[1.65] xl:text-[1.35rem]">
                At Global Ace Gaming, we believe online gaming should feel{' '}
                <span style={{ color: 'var(--casino-highlight-gold)' }}>fast, secure, exciting,</span>
                {' '}and community-driven. Since late 2019, we have continuously served players with
                trusted gaming services, fast transactions, responsive support, and access to
                internationally recognized platforms—building our reputation on reliability,
                smooth user experience, and long-term customer trust.
              </p>
              <p className="mt-5 text-sm leading-relaxed casino-text-secondary sm:text-base lg:mt-6 lg:max-w-3xl lg:text-lg">
                We are not game developers. We work alongside official gaming providers and
                platforms so you can load, play, and redeem through one simple, user-friendly system.
              </p>
            </div>
            <aside
              className="mt-6 hidden text-right lg:mt-0 lg:block"
              aria-label="Established"
            >
              <p
                className="text-5xl font-black leading-none tracking-tight xl:text-6xl"
                style={{ color: 'var(--casino-highlight-gold)' }}
              >
                2019
              </p>
              <p className="cosmic-label mt-2">Trusted since</p>
            </aside>
            <p
              className="cosmic-label mt-4 lg:hidden"
              style={{ color: 'var(--casino-highlight-gold)' }}
            >
              Trusted since 2019
            </p>
          </section>

          {/* Differentiators — list on mobile, 2-col grid on desktop, no per-item cards */}
          <section>
            <SectionHeading>What Makes Us Different</SectionHeading>
            <ul className="mt-6 divide-y divide-white/10 lg:mt-8 lg:grid lg:grid-cols-2 lg:gap-x-14 lg:gap-y-10 lg:divide-y-0">
              {DIFFERENTIATORS.map(({ icon, title, description, list }) => (
                <li key={title} className="flex gap-4 py-6 first:pt-0 lg:py-0">
                  <IconBadge icon={icon} />
                  <div className="min-w-0 flex-1">
                    <h3 className="cosmic-h3 mb-1.5">{title}</h3>
                    <p className="cosmic-body text-sm leading-relaxed lg:text-base">
                      {description}
                    </p>
                    {list ? (
                      <ul className="mt-3 flex flex-wrap gap-2 lg:mt-4">
                        {list.map((item) => (
                          <li
                            key={item}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs casino-text-secondary lg:text-sm"
                          >
                            <Check
                              className="h-3 w-3 shrink-0"
                              style={{ color: 'var(--casino-highlight-gold)' }}
                              aria-hidden
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Mission + Vision — side by side on large screens */}
          <section className="lg:grid lg:grid-cols-2 lg:gap-14 lg:gap-y-0">
            <div className="border-t border-white/10 pt-8 lg:border-t-0 lg:pt-0 lg:pr-8 lg:border-r lg:border-white/10">
              <div className="mb-4 flex items-center gap-3">
                <IconBadge icon={Target} />
                <h2 className="cosmic-h2">Our Mission</h2>
              </div>
              <p className="cosmic-body leading-relaxed">
                Our mission is to create a trusted gaming environment where players can enjoy
                entertainment with confidence, convenience, and speed.
              </p>
              <p className="cosmic-label mt-5 mb-3">We focus on:</p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {MISSION_FOCUS.map((item) => (
                  <li key={item} className="flex items-start gap-2 cosmic-body text-sm">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: 'var(--casino-highlight-gold)' }}
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-white/10 pt-8 lg:border-t-0 lg:pt-0 lg:pl-8">
              <div className="mb-4 flex items-center gap-3">
                <IconBadge icon={Eye} />
                <h2 className="cosmic-h2">Our Vision</h2>
              </div>
              <p className="cosmic-body leading-relaxed lg:text-base">
                We aim to become one of the most trusted global gaming service platforms by
                combining modern technology, strong customer support, and a seamless gaming
                experience.
              </p>
            </div>
          </section>

          {/* Support + responsible — two columns on xl */}
          <section className="border-t border-white/10 pt-8 lg:grid lg:grid-cols-5 lg:gap-10 lg:pt-10">
            <div className="lg:col-span-3">
              <div className="mb-3 flex items-center gap-3">
                <IconBadge icon={Headphones} />
                <h2 className="cosmic-h2">Dedicated Support</h2>
              </div>
              <p className="cosmic-body leading-relaxed lg:pr-4 lg:text-base">
                We understand how important fast assistance is in online gaming. Our team works
                hard to provide responsive and helpful support whenever players need help with
                recharges, withdrawals, bonuses, or account-related concerns.
              </p>
            </div>

            <div className="mt-8 border-t border-white/10 pt-8 lg:col-span-2 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div className="mb-3 flex items-center gap-3">
                <Heart className="h-6 w-6 shrink-0 text-rose-400" aria-hidden />
                <h2 className="cosmic-h3">Play Smart. Stay Responsible.</h2>
              </div>
              <p className="cosmic-body text-sm leading-relaxed lg:text-base">
                Gaming should always remain fun and responsible. We encourage all players to
                enjoy gaming responsibly as a form of entertainment.
              </p>
            </div>
          </section>

          {/* Footer line — no card */}
          <footer className="border-t border-white/10 pt-8 text-center lg:pt-10">
            <p
              className="text-lg font-bold tracking-tight sm:text-xl lg:text-2xl"
              style={{ color: 'var(--casino-highlight-gold)' }}
            >
              Global Ace Gaming
            </p>
            <p className="cosmic-body mt-2">Trusted by players since 2019.</p>
          </footer>
        </article>
      </PageShell>
    </>
  );
};

export default AboutUs;
