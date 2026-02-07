import { Link } from 'react-router-dom';
import { PageMeta } from '../components/PageMeta';

const Privacy = () => (
  <div
    className="min-h-screen pt-20 pb-16"
    style={{
      background:
        'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)',
    }}
  >
    <PageMeta
      title="Privacy Policy | Global Ace Gaming"
      description="Global Ace Gaming Privacy Policy: Detailed information on how we handle, protect, and process your personal data."
    />

    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <header className="mb-10 border-b border-gray-700 pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold casino-text-primary mb-4">
          Privacy Policy
        </h1>
        <p className="text-sm casino-text-secondary">
          Last Updated: <span className="casino-text-primary">February 7, 2026</span>
        </p>
      </header>

      <div className="space-y-8 text-sm sm:text-base casino-text-secondary leading-relaxed text-justify">
        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            1. Information Collection and Origin
          </h2>
          <p className="mb-4">
            Global Ace Gaming ("the Platform") collects several types of information to provide and improve our services to you:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="casino-text-primary">Personal Identification Data:</strong> Name, email address, phone number, and date of birth provided during registration.
            </li>
            <li>
              <strong className="casino-text-primary">Usage & Technical Data:</strong> IP addresses, browser type, device identifiers, operating system, and detailed logs of your interactions with the Platform.
            </li>
            <li>
              <strong className="casino-text-primary">Financial Information:</strong> Transaction history, deposit/withdrawal records, and partial payment method details processed through secure third-party gateways.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            2. Purpose and Legal Basis for Processing
          </h2>
          <p className="mb-4">We process your data under the following legal frameworks:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Contractual Necessity:</strong> To manage your account and facilitate gameplay.</li>
            <li><strong>Legal Obligation:</strong> To comply with Anti-Money Laundering (AML) and Know Your Customer (KYC) regulations.</li>
            <li><strong>Legitimate Interests:</strong> To detect and prevent fraud, improve platform performance, and ensure network security.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            3. Data Sharing and Disclosure
          </h2>
          <p>
            We do not sell, rent, or trade your personal data to third parties for marketing purposes. Data disclosure is limited to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li><strong>Service Providers:</strong> Verified partners hosting our infrastructure, processing payments, or performing analytics.</li>
            <li><strong>Regulatory Authorities:</strong> When required by law, subpoena, or to protect the safety and integrity of our users.</li>
            <li><strong>Business Transfers:</strong> In the event of a merger or sale, where data protection remains a priority.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            4. Data Security Protocols
          </h2>
          <p>
            We employ rigorous technical and organizational measures to safeguard your data. This includes <strong>AES-256 encryption</strong> for data at rest, <strong>TLS/SSL protocols</strong> for data in transit, and multi-factor authentication (MFA) options for account access. While we strive for absolute security, no method of electronic transmission is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            5. User Rights and Data Portability
          </h2>
          <p className="mb-4">Depending on your jurisdiction, you may exercise the following rights:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Right of Erasure:</strong> The "Right to be Forgotten" via account deletion.</li>
            <li><strong>Right to Rectification:</strong> Correction of inaccurate personal records.</li>
            <li><strong>Right to Object:</strong> Opting out of specific data processing or marketing communications.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            6. International Data Transfers
          </h2>
          <p>
            Your information may be transferred to—and maintained on—computers located outside of your state or country. By using the Platform, you consent to the transfer of information to our global data centers, ensuring that such transfers comply with standard contractual clauses.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold casino-text-primary mb-2">
            7. Contact and Compliance
          </h2>
          <p>
            For formal Data Subject Access Requests (DSAR) or privacy grievances, please contact our Data Protection Officer (DPO) via the{' '}
            <Link to="/support" className="text-yellow-400 hover:underline font-semibold">
              Support Portal
            </Link>
            . We aim to respond to all inquiries within 30 days.
          </p>
        </section>
      </div>
    </div>
  </div>
);

export default Privacy;