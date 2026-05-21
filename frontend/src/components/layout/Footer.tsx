import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const linkStyle = { color: 'var(--casino-text-secondary)' } as const;

/**
 * Casino-themed footer — desktop only (hidden on phone; use bottom tab bar + Support page).
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { isAuthenticated } = useAuthStore();
  const homeHref = isAuthenticated ? '/dashboard' : '/';

  const linkClass =
    'transition-colors duration-200 hover:text-[color:var(--casino-highlight-gold)]';
  const desktopLinkClass = `inline-block text-sm ${linkClass}`;

  return (
    <footer
      className="relative z-10 hidden shrink-0 border-t lg:block"
      style={{
        backgroundColor: 'var(--casino-secondary-dark)',
        borderTopColor: 'var(--casino-card-border)',
        color: 'var(--casino-text-primary)',
      }}
    >
      <div className="cosmic-content-width px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-6 md:grid-cols-4 md:gap-8">
          <div className="sm:col-span-2 md:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <img
                src="/logo.png"
                alt=""
                className="h-9 w-9 shrink-0 object-contain"
              />
              <span className="text-xl font-bold">Global Ace Gaming</span>
            </div>
            <p className="cosmic-body mb-4 max-w-md text-left">
              Play online slots, fish games, and table games on one secure platform.
              Bonuses, referrals, and dedicated support — on desktop and mobile.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#"
                aria-label="Facebook"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--casino-card-border)',
                }}
              >
                <Facebook className="h-4 w-4" style={{ color: 'var(--casino-text-secondary)' }} />
              </a>
              <a
                href="#"
                aria-label="Twitter / X"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--casino-card-border)',
                }}
              >
                <Twitter className="h-4 w-4" style={{ color: 'var(--casino-text-secondary)' }} />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--casino-card-border)',
                }}
              >
                <Instagram className="h-4 w-4" style={{ color: 'var(--casino-text-secondary)' }} />
              </a>
            </div>
          </div>

          <nav aria-label="Quick links" className="min-w-0">
            <h2 className="cosmic-h3 mb-4">Explore</h2>
            <ul className="space-y-2.5">
              <li>
                <Link to={homeHref} className={desktopLinkClass} style={linkStyle}>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/games" className={desktopLinkClass} style={linkStyle}>
                  Games
                </Link>
              </li>
              <li>
                <Link to="/platforms" className={desktopLinkClass} style={linkStyle}>
                  Platforms
                </Link>
              </li>
              <li>
                <Link to="/bonuses" className={desktopLinkClass} style={linkStyle}>
                  Bonuses
                </Link>
              </li>
              <li>
                <Link to="/about-us" className={desktopLinkClass} style={linkStyle}>
                  About Us
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Support and legal" className="min-w-0">
            <h2 className="cosmic-h3 mb-4">Support</h2>
            <ul className="space-y-2.5">
              <li>
                <Link to="/support" className={desktopLinkClass} style={linkStyle}>
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/terms" className={desktopLinkClass} style={linkStyle}>
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className={desktopLinkClass} style={linkStyle}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/cookies" className={desktopLinkClass} style={linkStyle}>
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div
          className="mt-8 grid grid-cols-1 gap-4 border-t pt-8 sm:grid-cols-2"
          style={{ borderColor: 'var(--casino-card-border)' }}
        >
          <a
            href="mailto:support@globalacegaming.com"
            className={`${desktopLinkClass} flex min-w-0 items-center gap-2 break-all`}
            style={linkStyle}
          >
            <Mail className="h-4 w-4 shrink-0" />
            <span>support@globalacegaming.com</span>
          </a>
          <a
            href="tel:+15551234567"
            className={`${desktopLinkClass} flex items-center gap-2`}
            style={linkStyle}
          >
            <Phone className="h-4 w-4 shrink-0" />
            <span>+1 (555) 123-4567</span>
          </a>
        </div>

        <div
          className="mt-8 border-t pt-8 text-center"
          style={{ borderColor: 'var(--casino-card-border)' }}
        >
          <div
            className="mb-2 inline-flex flex-wrap items-center justify-center gap-2 text-xs"
            style={{ color: 'var(--casino-text-secondary)' }}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--casino-accent-green)' }} />
            <span>18+ only · Play responsibly.</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--casino-text-secondary)' }}>
            &copy; {currentYear} Global Ace Gaming. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
