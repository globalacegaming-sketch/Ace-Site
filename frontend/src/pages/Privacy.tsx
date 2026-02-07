import { Link } from 'react-router-dom';
import { PageMeta } from '../components/PageMeta';

const Privacy = () => (
  <div className="min-h-screen pt-20 pb-16" style={{ background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)' }}>
    <PageMeta title="Privacy Policy | Global Ace Gaming" description="Learn how Global Ace Gaming collects, uses, and protects your data." />
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold casino-text-primary mb-6">Privacy Policy</h1>

      <div className="space-y-6 text-sm sm:text-base casino-text-secondary leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">1. Information We Collect</h2>
          <p>We collect information you provide when registering (name, email, phone number) and data generated through your use of the Platform (game activity, device info, IP address).</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">2. How We Use Your Information</h2>
          <p>We use your data to: operate and improve the Platform; process transactions; communicate with you; detect fraud; and comply with legal obligations.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">3. Data Sharing</h2>
          <p>We do not sell your personal data. We may share information with trusted service providers who assist in operating the Platform, under strict confidentiality agreements.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">4. Data Security</h2>
          <p>We implement industry-standard security measures including encryption, secure servers, and access controls to protect your information.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">5. Your Rights</h2>
          <p>You may request access to, correction of, or deletion of your personal data by contacting our <Link to="/support" className="text-yellow-400 hover:underline">Support</Link> team.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">6. Changes to This Policy</h2>
          <p>We may update this Privacy Policy periodically. We will notify you of material changes via email or a notice on the Platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">7. Contact</h2>
          <p>For privacy-related inquiries, please reach out via our <Link to="/support" className="text-yellow-400 hover:underline">Support</Link> page.</p>
        </section>
      </div>
    </div>
  </div>
);

export default Privacy;
