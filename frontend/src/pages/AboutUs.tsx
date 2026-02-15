import { Users, Award, Shield, Globe, Heart, Target } from 'lucide-react';
import { PageMeta } from '../components/PageMeta';
import { Link } from 'react-router-dom';

const AboutUs = () => {
  const stats = [
    { number: '10K+', label: 'Active Players', icon: Users },
    { number: '500+', label: 'Games Available', icon: Award },
    { number: '99.9%', label: 'Uptime Guarantee', icon: Shield },
    { number: '24/7', label: 'Customer Support', icon: Globe }
  ];

  const values = [
    {
      icon: Shield,
      title: 'Security First',
      description: 'We prioritize the security of our players with advanced encryption and secure payment processing.'
    },
    {
      icon: Heart,
      title: 'Player Focused',
      description: 'Every decision we make is centered around providing the best possible experience for our players.'
    },
    {
      icon: Award,
      title: 'Fair Gaming',
      description: 'We ensure all our games are fair, transparent, and regularly audited by independent testing agencies.'
    },
    {
      icon: Globe,
      title: 'Global Reach',
      description: 'Serving players worldwide with localized support and multiple language options.'
    }
  ];

  return (
    <div className="min-h-screen pt-20 pb-4 sm:pb-6 lg:pb-8" style={{
      background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)'
    }}>
      <PageMeta title="About Global Ace Gaming | Our Platform & Games" description="Learn about Global Ace Gaming: online slots, fish, table games, and our commitment to safe, transparent play." />

      {/* Decorative orbs */}
      <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse" style={{ backgroundColor: 'var(--casino-accent-purple)' }} />
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-15" style={{ backgroundColor: 'var(--casino-accent-blue)' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl font-bold casino-text-primary mb-3 sm:mb-4">
            About Global Ace Gaming
          </h1>
          <p className="text-sm sm:text-xl casino-text-secondary max-w-3xl mx-auto">
            Your premier destination for online gaming excellence, where entertainment meets innovation
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={index}
                className="casino-bg-secondary rounded-xl sm:rounded-2xl casino-border border p-4 sm:p-6 text-center transition-all duration-300 hover:border-[#FFD700]/40"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
              >
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.08))', border: '1px solid rgba(255,215,0,0.2)' }}
                >
                  <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: 'var(--casino-highlight-gold)' }} />
                </div>
                <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--casino-highlight-gold)' }}>
                  {stat.number}
                </div>
                <div className="text-xs sm:text-sm casino-text-secondary">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Our Story */}
        <div className="casino-bg-secondary rounded-xl sm:rounded-2xl casino-border border p-4 sm:p-8 mb-6 sm:mb-8" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10 items-center">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold casino-text-primary mb-4 sm:mb-6">Our Story</h2>
              <div className="space-y-3 sm:space-y-4 text-sm sm:text-base casino-text-secondary leading-relaxed">
                <p>
                  Founded in 2020, Global Ace Gaming emerged from a simple vision: to create
                  the most engaging, secure, and innovative online gaming platform. What started
                  as a small team of gaming enthusiasts has grown into a global platform serving
                  thousands of players worldwide.
                </p>
                <p>
                  Our journey began with a commitment to fair play, cutting-edge technology,
                  and exceptional customer service. Today, we're proud to offer a diverse
                  portfolio of games, from classic casino favorites to the latest Fortune Panda
                  slots, all powered by state-of-the-art technology.
                </p>
                <p>
                  We believe that gaming should be fun, fair, and accessible to everyone.
                  That's why we've built our platform with player safety and satisfaction
                  at its core, ensuring every player has an amazing experience.
                </p>
              </div>
            </div>
            <div
              className="rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(106,27,154,0.1))', border: '1px solid rgba(255,215,0,0.15)' }}
            >
              <Target className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4" style={{ color: 'var(--casino-highlight-gold)' }} />
              <h3 className="text-xl sm:text-2xl font-bold casino-text-primary mb-3 sm:mb-4">Our Mission</h3>
              <p className="text-sm sm:text-base casino-text-secondary leading-relaxed">
                To provide the ultimate gaming experience through innovative technology,
                fair play, and exceptional service, while maintaining the highest standards
                of security and responsible gaming.
              </p>
            </div>
          </div>
        </div>

        {/* Our Values */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold casino-text-primary text-center mb-6 sm:mb-8">Our Values</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {values.map((value, index) => {
              const IconComponent = value.icon;
              return (
                <div
                  key={index}
                  className="casino-bg-secondary rounded-xl sm:rounded-2xl casino-border border p-4 sm:p-6 text-center transition-all duration-300 hover:border-[#FFD700]/40"
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4"
                    style={{ background: 'linear-gradient(135deg, rgba(106,27,154,0.2), rgba(0,176,255,0.15))', border: '1px solid rgba(106,27,154,0.25)' }}
                  >
                    <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: 'var(--casino-highlight-gold)' }} />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold casino-text-primary mb-2 sm:mb-3">{value.title}</h3>
                  <p className="text-xs sm:text-sm casino-text-secondary">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="casino-bg-secondary rounded-xl sm:rounded-2xl casino-border border p-4 sm:p-8 mb-6 sm:mb-8" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          <h2 className="text-xl sm:text-2xl font-bold casino-text-primary text-center mb-6 sm:mb-8">Why Choose Global Ace Gaming?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              { icon: Shield, title: 'Licensed & Regulated', desc: 'We operate under strict licensing requirements, ensuring your safety and security at all times.' },
              { icon: Award, title: 'Award-Winning Games', desc: 'Our game portfolio includes award-winning titles from top providers, ensuring quality entertainment.' },
              { icon: Globe, title: 'Global Community', desc: 'Join a worldwide community of players and enjoy localized support in multiple languages.' },
            ].map((item, index) => {
              const IconComponent = item.icon;
              return (
                <div key={index} className="text-center">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4"
                    style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.08))', border: '1px solid rgba(255,215,0,0.2)' }}
                  >
                    <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: 'var(--casino-highlight-gold)' }} />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold casino-text-primary mb-2 sm:mb-3">{item.title}</h3>
                  <p className="text-xs sm:text-sm casino-text-secondary">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Call to Action */}
        <div
          className="rounded-xl sm:rounded-2xl p-6 sm:p-10 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(139,0,0,0.2) 50%, rgba(255,215,0,0.1) 100%)',
            border: '1px solid rgba(255,215,0,0.2)',
            boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
          }}
        >
          <h2 className="text-xl sm:text-3xl font-bold casino-text-primary mb-3 sm:mb-4">Ready to Start Your Gaming Journey?</h2>
          <p className="text-sm sm:text-lg casino-text-secondary mb-6 sm:mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied players and experience the best in online gaming
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to="/register"
              className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-bold text-sm sm:text-base transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                color: '#0A0A0F',
                boxShadow: '0 0 15px rgba(255,215,0,0.25)',
              }}
            >
              Get Started Today
            </Link>
            <Link
              to="/games"
              className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation casino-text-primary"
              style={{
                border: '2px solid rgba(255,215,0,0.4)',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              Explore Games
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
