import { Link } from 'react-router-dom';
import { PageMeta } from '../components/PageMeta';

const Terms = () => (
  <div className="min-h-screen pt-20 pb-16" style={{ background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)' }}>
    <PageMeta title="Terms of Service | Global Ace Gaming" description="Read the Terms of Service for Global Ace Gaming." />
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold casino-text-primary mb-6">Terms of Service</h1>

      <div className="space-y-6 text-sm sm:text-base casino-text-secondary leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">1. Acceptance of Terms</h2>
          <p>By accessing or using Global Ace Gaming ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">2. Eligibility</h2>
          <p>You must be at least 18 years of age to use this Platform. By registering, you confirm that you meet the minimum age requirement in your jurisdiction.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">3. Account Responsibility</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us immediately of any unauthorized use.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">4. Prohibited Conduct</h2>
          <p>You agree not to: use the Platform for illegal purposes; attempt to exploit, hack, or disrupt the service; create multiple accounts; or engage in fraudulent activity.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">5. Intellectual Property</h2>
          <p>All content, branding, and software on the Platform are owned by Global Ace Gaming or its licensors and are protected by applicable intellectual property laws.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">6. Limitation of Liability</h2>
          <p>Global Ace Gaming is not liable for indirect, incidental, or consequential damages arising from your use of the Platform. The Platform is provided "as is."</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">7. Changes to Terms</h2>
          <p>We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance. We encourage you to review this page periodically.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold casino-text-primary mb-2">8. Contact</h2>
          <p>If you have questions about these Terms, please contact us via our <Link to="/support" className="text-yellow-400 hover:underline">Support</Link> page.</p>
        </section>
      </div>
    </div>
  </div>
);

export default Terms;
