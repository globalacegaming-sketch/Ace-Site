import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';
import { PageMeta } from '../components/PageMeta';
import { CosmicCard, PageShell } from '../components/cosmic';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta title="Page Not Found (404) | Global Ace Gaming" description="The page you were looking for does not exist. Return to the Global Ace Gaming home page." noIndex />
      <PageShell
        background="subtle"
        width="3xl"
        contentClassName="flex min-h-[60vh] items-center justify-center"
      >
        <CosmicCard variant="solid" padding="lg" className="w-full max-w-md text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-400">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="cosmic-h1 mb-2">404</h1>
          <p className="cosmic-body mb-8">Page not found</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-casino-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 font-medium"
          >
            <Home className="h-4 w-4" />
            Go to Home
          </button>
        </CosmicCard>
      </PageShell>
    </>
  );
};

export default NotFound;
