import { Link } from 'react-router-dom';
import { PageMeta } from '../components/PageMeta';

const Cookies = () => (
  <div className="min-h-screen pt-20 pb-16" style={{ background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)' }}>
    <PageMeta title="Cookie Policy | Global Ace Gaming" description="Learn how Global Ace Gaming uses cookies and similar technologies." />
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold casino-text-primary mb-6">Cookie Policy</h1>

      <div className="space-y-6 text-sm sm:text-base casino-text-secondary leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">1. What Are Cookies</h2>
          <p>Cookies are small text files stored on your device when you visit a website. They help the Platform function correctly and improve your experience.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">2. Cookies We Use</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="casino-text-primary">Essential cookies</strong> — required for authentication, session management, and security.</li>
            <li><strong className="casino-text-primary">Preference cookies</strong> — remember your settings (theme, language, music).</li>
            <li><strong className="casino-text-primary">Analytics cookies</strong> — help us understand how users interact with the Platform so we can improve it.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">3. Managing Cookies</h2>
          <p>You can control cookies through your browser settings. Disabling essential cookies may prevent the Platform from functioning correctly.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">4. Third-Party Cookies</h2>
          <p>Some cookies are set by third-party services we use (e.g. analytics, push notifications). These are governed by the respective third party's privacy policy.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">5. Contact</h2>
          <p>Questions about our cookie practices? Contact us via <Link to="/support" className="text-yellow-400 hover:underline">Support</Link>.</p>
        </section>
      </div>
    </div>
  </div>
);

export default Cookies;
