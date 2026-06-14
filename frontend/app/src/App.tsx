import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell,
  ConfirmRoot,
  ContentRegion,
  EmptyState,
  HolisticMark,
  Sidebar,
  Spinner,
  Text,
  Toaster,
  TopBar,
  confirm,
  toast,
  type HolisticUser,
  type ServiceContextProps,
  type ServicePlugin,
} from '@holistic/ui';
import { authApi, scopedApi } from './api/holisticClient';
import { SERVICES, serviceById } from './registry';
import { LoginScreen } from './auth/LoginScreen';
import { RegisterScreen } from './auth/RegisterScreen';
import { ChangePasswordModal } from './auth/ChangePasswordModal';

class ServiceBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error) {
      return (
        <ContentRegion>
          <EmptyState title="Something went wrong" description="This service ran into an error. Try switching away and back." />
        </ContentRegion>
      );
    }
    return this.props.children;
  }
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <HolisticMark className="h-8 w-8" />
      <Text variant="subhead" weight="semibold" className="tracking-[-0.01em]">
        Holistic
      </Text>
    </div>
  );
}

function Shell({ user, onSignOut }: { user: HolisticUser; onSignOut: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [title, setTitle] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);

  const isVisible = (s: ServicePlugin) => s.visible?.(user) ?? true;
  const visibleServices = SERVICES.filter(isVisible);

  const match = location.pathname.match(/^\/app\/([^/]+)(?:\/(.*))?/);
  const requestedId = match?.[1];
  const subPath = match?.[2] ?? '';
  const requested = requestedId ? serviceById(requestedId) : undefined;
  // Route only to services the user may actually see — the same gate as the sidebar.
  // A URL naming an unknown service, or one the user can't access (e.g. /app/privleg
  // carried over from another session), falls back to their first visible service.
  const active = requested && isVisible(requested) ? requested : visibleServices[0];
  const serviceId = active?.id;

  useEffect(() => {
    if (active && requestedId !== active.id) navigate(`/app/${active.id}`, { replace: true });
  }, [active, requestedId, navigate]);
  useEffect(() => {
    setTitle(null);
  }, [serviceId]);

  const ctx = useMemo<ServiceContextProps | null>(() => {
    if (!active) return null;
    return {
      user,
      api: scopedApi(active.id),
      nav: {
        path: subPath,
        navigate: (p: string) => navigate(`/app/${active.id}/${p}`.replace(/\/+$/, '')),
        setTitle,
      },
      ui: { toast, confirm },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, subPath, user]);

  const items = visibleServices.map((s) => ({ id: s.id, label: s.displayName, icon: s.icon }));

  return (
    <AppShell
      sidebar={<Sidebar header={<Brand />} items={items} activeId={serviceId} onSelect={(id) => navigate(`/app/${id}`)} />}
      topBar={<TopBar title={title ?? active?.displayName} user={user} onSignOut={onSignOut} onChangePassword={() => setPwOpen(true)} />}
    >
      <ServiceBoundary key={serviceId}>
        {active && ctx ? <active.Component {...ctx} /> : <ContentRegion><EmptyState title="No services installed" description="Add a service and rebuild the dashboard." /></ContentRegion>}
      </ServiceBoundary>
      <ChangePasswordModal open={pwOpen} onOpenChange={setPwOpen} />
    </AppShell>
  );
}

function Splash() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-base">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<HolisticUser | null | undefined>(undefined);
  const [view, setView] = useState<'login' | 'register'>('login');

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function signOut() {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }

  return (
    <>
      {user === undefined ? (
        <Splash />
      ) : user === null ? (
        view === 'login' ? (
          <LoginScreen onSuccess={setUser} onRegister={() => setView('register')} />
        ) : (
          <RegisterScreen onSuccess={setUser} onLogin={() => setView('login')} />
        )
      ) : (
        <BrowserRouter>
          <Shell user={user} onSignOut={signOut} />
        </BrowserRouter>
      )}
      <Toaster />
      <ConfirmRoot />
    </>
  );
}
