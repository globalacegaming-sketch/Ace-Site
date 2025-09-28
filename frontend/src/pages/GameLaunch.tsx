import { Gamepad2 } from 'lucide-react';

const GameLaunch = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center mb-4">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Game Launch
          </h1>
          <p className="text-gray-600 mb-8">
            Launch your selected game and start playing.
          </p>
          
          <div className="card max-w-md mx-auto">
            <p className="text-gray-600">
              🚧 Game launch page is under development. Coming soon with FortunePanda integration!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLaunch;
