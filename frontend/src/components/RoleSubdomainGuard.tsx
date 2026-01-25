import { type ReactNode } from 'react';
import NotFound from '../pages/NotFound';

/** aceadmin.globalacegaming.com — /aceadmin/login, /aceadmin/dashboard */
const AGENT_SUBDOMAIN_HOST = 'aceadmin.globalacegaming.com';
/** aceagent.globalacegaming.com — /aceagent, /aceagent/login */
const ADMIN_SUBDOMAIN_HOST = 'aceagent.globalacegaming.com';

const DEV_HOSTS = ['localhost', '127.0.0.1'];

type RoleSubdomainGuardProps = {
  children: ReactNode;
  /** 'agent' = aceadmin (/aceadmin/login, /aceadmin/dashboard); 'admin' = aceagent (/aceagent, /aceagent/login) */
  role: 'agent' | 'admin';
};

/**
 * Only render children if the hostname matches the subdomain for this role. Fail closed (404) otherwise.
 * - agent → aceadmin.globalacegaming.com (/aceadmin/login, /aceadmin/dashboard)
 * - admin → aceagent.globalacegaming.com (/aceagent, /aceagent/login)
 * Local dev (localhost/127.0.0.1) always allowed.
 */
export default function RoleSubdomainGuard({ children, role }: RoleSubdomainGuardProps) {
  if (typeof window === 'undefined') {
    return <NotFound />;
  }

  const host = window.location.hostname;
  const allowed =
    DEV_HOSTS.includes(host) ||
    (role === 'agent' && host === AGENT_SUBDOMAIN_HOST) ||
    (role === 'admin' && host === ADMIN_SUBDOMAIN_HOST);

  if (!allowed) {
    return <NotFound />;
  }

  return <>{children}</>;
}
