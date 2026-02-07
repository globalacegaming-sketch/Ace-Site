import { Link } from 'react-router-dom';
import { PageMeta } from '../components/PageMeta';

const Terms = () => (
  <div
    className="min-h-screen pt-20 pb-16"
    style={{
      background:
        'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)',
    }}
  >
    <PageMeta
      title="Terms of Service | Global Ace Gaming"
      description="Comprehensive Terms of Service and End User License Agreement for Global Ace Gaming."
    />

    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <header className="mb-10 border-b border-gray-700 pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold casino-text-primary mb-4">
          Terms of Service
        </h1>
        <p className="text-sm casino-text-secondary">
          Last Revised: <span className="casino-text-primary">February 7, 2026</span>
        </p>
      </header>

      <div className="space-y-8 text-sm sm:text-base casino-text-secondary leading-relaxed text-justify">
        
        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            1. Contractual Relationship
          </h2>
          <p>
            These Terms of Service ("Terms") constitute a legally binding agreement between you ("User") and 
            <strong> Global Ace Gaming</strong> ("Company", "we", "us"). By accessing our website, applications, 
            or services (collectively, the "Platform"), you acknowledge that you have read, understood, and 
            agree to be bound by these Terms. If you do not agree to these Terms, you must immediately 
            cease all use of the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            2. Eligibility and Jurisdiction
          </h2>
          <p className="mb-4">
            You must be at least <strong>18 years of age</strong> (or the legal age of majority in your jurisdiction) 
            to create an account. By using the Platform, you represent and warrant that:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>You have the legal capacity to enter into this agreement.</li>
            <li>You are not accessing the Platform from a "Prohibited Jurisdiction" where online gaming or the services provided are illegal.</li>
            <li>You have not been previously suspended or removed from our services.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            3. Account Registration and Security
          </h2>
          <p>
            To access certain features, you must register for an account. You agree to provide accurate, 
            current, and complete information. You are solely responsible for safeguarding your password 
            and for any activities or actions under your account. Global Ace Gaming will not be liable 
            for any loss or damage arising from your failure to comply with this security obligation. 
            <strong> One user is permitted only one account.</strong> Duplicate accounts may be terminated 
            without notice.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            4. User Conduct and Prohibited Activities
          </h2>
          <p className="mb-4">
            The Platform must be used for lawful, entertainment purposes only. You are strictly prohibited from:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Engaging in any form of "cheating," including using bots, software exploits, or collusion with other users.</li>
            <li>Utilizing the Platform for money laundering, financing of illegal activities, or fraudulent transactions.</li>
            <li>Reverse-engineering, decompiling, or attempting to extract the source code of our gaming software.</li>
            <li>Harassing, abusing, or harming other users or Company staff.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            5. Intellectual Property Rights
          </h2>
          <p>
            The Platform and its entire contents, features, and functionality (including but not limited to 
            all information, software, text, displays, images, video, and audio) are owned by Global Ace Gaming 
            and are protected by international copyright, trademark, and other intellectual property laws. 
            You are granted a limited, non-exclusive, non-transferable license to access the Platform 
            strictly for personal, non-commercial use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            6. Disclaimers and "As-Is" Provision
          </h2>
          <p>
            The Platform is provided on an "AS IS" and "AS AVAILABLE" basis. Global Ace Gaming makes no 
            warranties, expressed or implied, regarding the reliability, accuracy, or availability of its 
            services. We do not guarantee that gameplay will be uninterrupted or error-free. To the 
            fullest extent permitted by law, we disclaim all warranties, including implied warranties of 
            merchantability and fitness for a particular purpose.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            7. Limitation of Liability
          </h2>
          <p>
            In no event shall Global Ace Gaming, its directors, employees, or partners be liable for any 
            indirect, incidental, special, consequential, or punitive damages, including without limitation, 
            loss of profits, data, or use, resulting from your access to or inability to access the Platform, 
            even if we have been advised of the possibility of such damages.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            8. Termination
          </h2>
          <p>
            We reserve the right, without notice and in our sole discretion, to terminate your account or 
            restrict your access to the Platform for any reason, including but not limited to a breach of 
            these Terms or suspected fraudulent activity. Upon termination, all licenses granted to you 
            hereunder shall immediately cease.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold casino-text-primary mb-2">
            9. Governing Law and Disputes
          </h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction 
            in which the Company is registered, without regard to its conflict of law provisions. Any 
            dispute arising out of these Terms shall be resolved through binding arbitration or in a 
            court of competent jurisdiction.
          </p>
          <p>src/components/chat/UserChatWidget.tsx(75,10): error TS6133: 'isAnimating' is declared but its value is never read.
          Error: Command "npm run build" exited with 2
            Questions regarding these Terms? Contact our legal department via our{' '}
            <Link to="/support" className="text-yellow-400 hover:underline font-semibold">
              Support Page
            </Link>.
          </p>
        </section>
      </div>
    </div>
  </div>
);

export default Terms;