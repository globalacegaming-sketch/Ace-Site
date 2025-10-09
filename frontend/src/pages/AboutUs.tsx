import { Users, Award, Shield, Globe, Heart, Target } from 'lucide-react';

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

  const team = [
    {
      name: 'Alex Johnson',
      role: 'CEO & Founder',
      image: '/api/placeholder/150/150',
      description: 'Gaming industry veteran with 15+ years of experience in online gaming platforms.'
    },
    {
      name: 'Sarah Chen',
      role: 'CTO',
      image: '/api/placeholder/150/150',
      description: 'Technology leader specializing in scalable gaming infrastructure and security.'
    },
    {
      name: 'Mike Rodriguez',
      role: 'Head of Operations',
      image: '/api/placeholder/150/150',
      description: 'Operations expert ensuring smooth gaming experiences and customer satisfaction.'
    },
    {
      name: 'Emma Wilson',
      role: 'Head of Customer Support',
      image: '/api/placeholder/150/150',
      description: 'Customer experience specialist dedicated to providing exceptional player support.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              About Global Ace Gaming
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 max-w-3xl mx-auto">
              Your premier destination for online gaming excellence, where entertainment meets innovation
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="text-center">
                <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <IconComponent className="w-8 h-8 text-primary-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Our Story */}
        <div className="mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h2>
              <div className="space-y-4 text-gray-700">
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
            <div className="bg-gradient-to-br from-primary-100 to-secondary-100 rounded-xl p-8">
              <div className="text-center">
                <Target className="w-16 h-16 text-primary-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h3>
                <p className="text-gray-700">
                  To provide the ultimate gaming experience through innovative technology, 
                  fair play, and exceptional service, while maintaining the highest standards 
                  of security and responsible gaming.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Our Values */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const IconComponent = value.icon;
              return (
                <div key={index} className="bg-white rounded-xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow duration-300">
                  <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="w-8 h-8 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{value.title}</h3>
                  <p className="text-gray-600">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Meet Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div className="bg-gradient-to-br from-primary-100 to-secondary-100 h-48 flex items-center justify-center">
                  <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">{member.name}</h3>
                  <p className="text-primary-600 font-medium mb-3">{member.role}</p>
                  <p className="text-gray-600 text-sm">{member.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Why Choose Global Ace Gaming?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Licensed & Regulated</h3>
              <p className="text-gray-600">
                We operate under strict licensing requirements, ensuring your safety and security at all times.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Award-Winning Games</h3>
              <p className="text-gray-600">
                Our game portfolio includes award-winning titles from top providers, ensuring quality entertainment.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Global Community</h3>
              <p className="text-gray-600">
                Join a worldwide community of players and enjoy localized support in multiple languages.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl p-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Your Gaming Journey?</h2>
          <p className="text-xl text-primary-100 mb-8">
            Join thousands of satisfied players and experience the best in online gaming
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200">
              Get Started Today
            </button>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-primary-600 transition-colors duration-200">
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
