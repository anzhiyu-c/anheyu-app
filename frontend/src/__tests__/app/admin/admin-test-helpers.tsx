import { vi } from "vitest";

export function setupAdminMocks() {
  vi.mock("next/navigation", () => ({
    usePathname: () => "/admin/dashboard",
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
  }));

  vi.mock("next/image", () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      const { fill, priority, unoptimized, ...rest } = props;
      void fill;
      void priority;
      void unoptimized;
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      return <img {...rest} />;
    },
  }));

  vi.mock("next-themes", () => ({
    useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
  }));

  vi.mock("@/store/auth-store", () => ({
    useAuthStore: (selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        accessToken: "test-token",
        refreshToken: "test-refresh",
        user: {
          id: "1",
          username: "admin",
          nickname: "管理员",
          email: "admin@test.com",
          avatar: "",
          userGroupID: 1,
          status: 1,
        },
        roles: ["1"],
        _hasHydrated: true,
        isAuthenticated: () => true,
        isAdmin: () => true,
        logout: vi.fn(),
        setAuth: vi.fn(),
        updateAccessToken: vi.fn(),
        setHasHydrated: vi.fn(),
      };
      return selector(state);
    },
  }));

  vi.mock("@/store/site-config-store", () => ({
    useSiteConfigStore: (selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        siteConfig: {
          GRAVATAR_URL: "https://www.gravatar.com/avatar/",
          DEFAULT_GRAVATAR_TYPE: "mp",
        },
        getLogo: () => "/logo.png",
        getTitle: () => "Test Site",
      };
      return selector(state);
    },
  }));

  vi.mock("@/hooks/use-theme", () => ({
    useTheme: () => ({ isDark: false, toggleTheme: vi.fn(), mounted: true }),
  }));
}
