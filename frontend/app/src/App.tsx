import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell,
  ConfirmRoot,
  ContentRegion,
  EmptyState,
  HolisticMark,
  NotificationCenter,
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

  // The notification centre talks to the notify service; memoise the client so its live SSE
  // connection isn't torn down and rebuilt on every shell re-render.
  const notifyApi = useMemo(() => scopedApi('notify'), []);
  const notifications = <NotificationCenter api={notifyApi} onOpenUrl={(url) => navigate(url)} />;

  return (
    <AppShell
      sidebar={<Sidebar header={<Brand />} items={items} activeId={serviceId} onSelect={(id) => navigate(`/app/${id}`)} />}
      topBar={<TopBar title={title ?? (active ? serviceLabel(active) : undefined)} actions={notifications} user={user} onSignOut={onSignOut} onEditProfile={() => setProfileOpen(true)} onChangePassword={() => setPwOpen(true)} />}
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

const SSO_BOUNCE_KEY = 'h_sso_bounce';

/** Read a validated `return` target from the query string. Open-redirect–safe: the target must be
 *  on the SAME registrable zone as this dashboard (e.g. *.example.com) and same protocol, so a
 *  sibling service like DevLab can bounce the user here to sign in and get sent straight back. */
function safeReturnUrl(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('return');
    if (!raw) return null;
    const url = new URL(raw, window.location.origin);
    if (url.protocol !== window.location.protocol) return null;
    const host = window.location.hostname;
    const labels = host.split('.');
    const zone = labels.length > 2 ? labels.slice(1).join('.') : host;
    if (url.hostname === host || url.hostname === zone || url.hostname.endsWith('.' + zone)) return url.href;
    return null;
  } catch {
    return null;
  }
}

/** Send the user back to the return target, exactly once. The one-shot sessionStorage guard breaks
 *  a redirect loop if the shared cookie isn't yet visible on the sibling subdomain (e.g. a stale
 *  host-only session mid cookie-domain rollout). Returns true when it navigated away. */
function returnRedirect(url: string): boolean {
  try {
    if (sessionStorage.getItem(SSO_BOUNCE_KEY)) {
      sessionStorage.removeItem(SSO_BOUNCE_KEY);
      return false;
    }
    sessionStorage.setItem(SSO_BOUNCE_KEY, '1');
  } catch {
    /* sessionStorage unavailable — still redirect once below */
  }
  window.location.replace(url);
  return true;
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

  // A sibling service (e.g. DevLab) can pass ?return=<its url>; after auth we send the user back
  // there instead of showing this dashboard, so they don't have to re-open it manually.
  const returnUrl = useMemo(() => safeReturnUrl(), []);

  // Completes auth from the login/register screens: bounce back to the caller if asked, else render
  // the dashboard. A fresh login just re-issued the shared (domain-scoped) cookie, so the sibling
  // will see the session.
  const completeAuth = (u: HolisticUser) => {
    if (returnUrl && returnRedirect(returnUrl)) return;
    setUser(u);
  };

  useEffect(() => {
    authApi
      .me()
      .then((u) => {
        // Already signed in and asked to return → go straight back (guarded against a loop).
        if (returnUrl && returnRedirect(returnUrl)) return;
        setUser(u);
      })
      .catch(() => setUser(null));
    instanceApi.get().then(setInstance).catch(() => {});
  }, [returnUrl]);

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
          <LoginScreen onSuccess={completeAuth} onRegister={() => setView('register')} />
        ) : (
          <RegisterScreen onSuccess={completeAuth} onLogin={() => setView('login')} />
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
