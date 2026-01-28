import { Wallet as WalletIcon, Wrench } from 'lucide-react';

const WalletPage = () => {
  return (
    <div className="min-h-screen py-8 pt-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'
          }}>
            <WalletIcon className="w-8 h-8" style={{ color: '#0A0A0F' }} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold casino-text-primary mb-4">
            Wallet & Transactions
          </h1>
          
          <div className="card-casino rounded-2xl p-8 mb-6 casino-border text-center">
            <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{
              background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)',
              boxShadow: '0 0 20px rgba(106, 27, 154, 0.3)'
            }}>
              <Wrench className="w-10 h-10" style={{ color: '#F5F5F5' }} />
            </div>
            <h2 className="text-xl font-semibold casino-text-primary mb-2">
              Under Maintenance
            </h2>
            <p className="casino-text-secondary text-sm sm:text-base">
              The wallet system is currently undergoing maintenance. Please check back soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
