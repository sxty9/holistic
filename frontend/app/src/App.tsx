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
  serviceVisibleByDefault,
  toast,
  useT,
  type HolisticUser,
  type InstanceInfo,
  type ServiceContextProps,
  type ServicePlugin,
} from '@holistic/ui';
import { authApi, instanceApi, scopedApi } from './api/holisticClient';
import { SERVICES, serviceById } from './registry';
import { LoginScreen } from './auth/LoginScreen';
import { RegisterScreen } from './auth/RegisterScreen';
import { ChangePasswordModal } from './auth/ChangePasswordModal';
import { ProfileModal } from './auth/ProfileModal';

function ServiceErrorFallback() {
  const t = useT();
  return (
    <ContentRegion>
      <EmptyState title={t('app.serviceErrorTitle')} description={t('app.serviceErrorDesc')} />
    </ContentRegion>
  );
}

class ServiceBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error) {
      return <ServiceErrorFallback />;
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

function Shell({ user, instance, onSignOut, onUserChange }: { user: HolisticUser; instance: InstanceInfo; onSignOut: () => void; onUserChange: (u: HolisticUser) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const [title, setTitle] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // A service defines its own gate, else the default rights gate applies (admin, or holds one
  // of the service's hp_<id>_* rights) — so a service the user has no rights for never shows.
  const isVisible = (s: ServicePlugin) => (s.visible ? s.visible(user) : serviceVisibleByDefault(user, s.id));
  const visibleServices = SERVICES.filter(isVisible);
  // A service may register a localized name under `service.<id>`; otherwise its
  // static displayName (the canonical English label) stands in.
  const serviceLabel = (s: ServicePlugin) => (t.has(`service.${s.id}`) ? t(`service.${s.id}`) : s.displayName);

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
      apiFor: scopedApi,
      nav: {
        path: subPath,
        navigate: (p: string) => navigate(`/app/${active.id}/${p}`.replace(/\/+$/, '')),
        setTitle,
        openService: (id: string, p?: string) => navigate(`/app/${id}${p ? `/${p}` : ''}`.replace(/\/+$/, '')),
      },
      ui: { toast, confirm },
      instance,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, subPath, user, instance]);

  const items = visibleServices.map((s) => ({ id: s.id, label: serviceLabel(s), icon: s.icon }));

  return (
    <AppShell
      sidebar={<Sidebar header={<Brand />} items={items} activeId={serviceId} onSelect={(id) => navigate(`/app/${id}`)} />}
      topBar={<TopBar title={title ?? (active ? serviceLabel(active) : undefined)} user={user} onSignOut={onSignOut} onEditProfile={() => setProfileOpen(true)} onChangePassword={() => setPwOpen(true)} />}
    >
      <ServiceBoundary key={serviceId}>
        {active && ctx ? <active.Component {...ctx} /> : <ContentRegion><EmptyState title={t('app.noServicesTitle')} description={t('app.noServicesDesc')} /></ContentRegion>}
      </ServiceBoundary>
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} user={user} onUserChange={onUserChange} />
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
  // Seed from the current URL so it's always valid; /api/instance refines it (e.g. the
  // canonical mailDomain, which window.location can't know).
  const [instance, setInstance] = useState<InstanceInfo>(() => ({
    origin: window.location.origin,
    host: window.location.hostname,
    mailDomain: '',
  }));

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null));
    instanceApi.get().then(setInstance).catch(() => {});
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
          <Shell user={user} instance={instance} onSignOut={signOut} onUserChange={setUser} />
        </BrowserRouter>
      )}
      <Toaster />
      <ConfirmRoot />
    </>
  );
}
