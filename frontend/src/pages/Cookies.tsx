import { Link } from 'react-router-dom';
import { PageMeta } from '../components/PageMeta';

const Cookies = () => (
  <div
    className="min-h-screen pt-20 pb-16"
    style={{
      background:
        'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)',
    }}
  >
    <PageMeta
      title="Cookie Policy | Global Ace Gaming"
      description="Detailed Cookie Policy and Tracking Technologies Disclosure for Global Ace Gaming."
    />

    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <header className="mb-10 border-b border-gray-700 pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold casino-text-primary mb-4">
          Cookie Policy
        </h1>
        <p className="text-sm casino-text-secondary">
          Effective Date: <span className="casino-text-primary">February 7, 2026</span>
        </p>
      </header>

      <div className="space-y-8 text-sm sm:text-base casino-text-secondary leading-relaxed text-justify">
        
        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            1. Introduction and Scope
          </h2>
          <p>
            This Cookie Policy explains how <strong>Global Ace Gaming</strong> ("we", "us", and "our") 
            uses cookies and similar tracking technologies (collectively, "Cookies") when you visit our 
            Platform. This policy should be read in conjunction with our <strong>Privacy Policy</strong> and 
            <strong>Terms of Service</strong>. By continuing to browse or use the Platform, you agree 
            to our use of cookies as described herein.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            2. Definition of Cookies
          </h2>
          <p>
            Cookies are small data files—typically composed of letters and numbers—placed on your device 
            (computer, smartphone, or tablet) when you visit a website. They are widely used by online 
            service providers to facilitate interaction, improve efficiency, and provide analytical information. 
            Technologies such as "web beacons," "pixels," or "local storage" serve a similar purpose and are 
            included under the definition of "Cookies" for this policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            3. Categories of Cookies Used
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold casino-text-primary">3.1 Strictly Necessary Cookies</h3>
              <p>
                These are essential for the technical operation of our Platform. Without these, services you 
                have requested (such as secure login, gameplay persistence, and wallet transactions) cannot 
                be provided. These cookies do not require user consent under most data protection laws.
              </p>
            </div>

            <div>
              <h3 className="font-semibold casino-text-primary">3.2 Performance and Analytics Cookies</h3>
              <p>
                These allow us to recognize and count the number of visitors and see how visitors move around 
                the Platform. This helps us improve the way our website works, for example, by ensuring that 
                users find what they are looking for easily and identifying technical errors.
              </p>
            </div>

            <div>
              <h3 className="font-semibold casino-text-primary">3.3 Functionality and Preference Cookies</h3>
              <p>
                Used to recognize you when you return to our Platform. This enables us to personalize our 
                content for you, greet you by name, and remember your preferences (e.g., your choice of 
                language, region, or audio settings).
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            4. Third-Party Tracking
          </h2>
          <p>
            In certain instances, third parties (such as analytics providers or anti-fraud services) may 
            set cookies on your device through our Platform. These third parties may use Cookies to 
            collect information about your online activities over time and across different websites. 
            We do not have direct control over the data collected by these third parties.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            5. Consent and User Control
          </h2>
          <p className="mb-4">
            Upon your first visit to the Platform, you are presented with a cookie banner. You have the 
            right to decide whether to accept or reject non-essential cookies.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Browser Settings:</strong> You can set or amend your web browser controls to 
              accept or refuse cookies. If you choose to reject cookies, you may still use our 
              website though your access to some functionality and areas may be restricted.
            </li>
            <li>
              <strong>Global Privacy Control (GPC):</strong> Our Platform honors GPC signals in 
              applicable jurisdictions to automatically opt-out of non-essential tracking.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            6. Data Retention
          </h2>
          <p>
            The length of time a cookie will stay on your browsing device depends on whether it is a 
            "persistent" or "session" cookie. Session cookies will only stay on your device until 
            you stop browsing. Persistent cookies stay on your browsing device until they expire or 
            are deleted.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold casino-text-primary mb-3">
            7. Amendments to This Policy
          </h2>
          <p>
            Global Ace Gaming reserves the right to modify this Cookie Policy at any time. We encourage 
            users to frequently check this page for any changes. Your continued use of the Platform 
            following the posting of changes will be deemed as your acceptance of those changes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold casino-text-primary mb-2">
            8. Contact Information
          </h2>
          <p className="text-sm">
            For further information regarding our use of cookies or to exercise your data rights, 
            please reach out to our Compliance Team via our{' '}
            <Link to="/support" className="text-yellow-400 hover:underline font-semibold">
              Support Center
            </Link> 
            .
          </p>
        </section>
      </div>
    </div>
  </div>
);

export default Cookies;