import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { HeaderRight } from "./index";

type Selector<TState, TResult = unknown> = (state: TState) => TResult;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: { src: string; alt: string } & Record<string, unknown>) => {
    delete props.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, ...props }: { icon: string } & Record<string, unknown>) => <span data-icon={icon} {...props} />,
}));

vi.mock("@heroui/react", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/use-media-query", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-travelling-link", () => ({
  useTravellingLink: () => ({ handleTravelClick: vi.fn() }),
}));

vi.mock("@/utils/avatar", () => ({
  getUserAvatarUrl: () => "/avatar.png",
}));

vi.mock("@/components/layout/Header/components/Console", () => ({
  Console: () => null,
}));

const mockUseAuthStore = vi.fn();
const mockUseSiteConfigStore = vi.fn();

vi.mock("@/store/auth-store", () => ({
  useAuthStore: (selector?: Selector<typeof authState>) => mockUseAuthStore(selector),
}));

vi.mock("@/store/site-config-store", () => ({
  useSiteConfigStore: (selector?: Selector<typeof siteState>) => mockUseSiteConfigStore(selector),
}));

const authState = {
  user: {
    id: "1",
    created_at: "",
    updated_at: "",
    username: "admin",
    nickname: "管理员",
    avatar: "",
    email: "admin@example.com",
    lastLoginAt: null,
    userGroupID: 1,
    userGroup: { id: "1", name: "管理员", description: "" },
    status: 1,
  },
  isAuthenticated: true,
  logout: vi.fn(),
  isAdmin: () => true,
};

const siteState = {
  enableRegistration: () => true,
  siteConfig: {},
  userPanelConfig: () => ({
    showUserCenter: false,
    showNotifications: true,
    showPublishArticle: true,
    showAdminDashboard: false,
  }),
};

describe("HeaderRight app user panel", () => {
  beforeEach(() => {
    mockUseAuthStore.mockImplementation(selector => (selector ? selector(authState) : authState));
    mockUseSiteConfigStore.mockImplementation(selector => (selector ? selector(siteState) : siteState));
  });

  it("按配置显示和隐藏社区版用户面板入口", () => {
    render(
      <HeaderRight
        navConfig={{ travelling: false }}
        isTransparent={false}
        scrollPercent={50}
        isFooterVisible={false}
        isConsoleOpen={false}
        onToggleConsole={vi.fn()}
      />
    );

    expect(screen.queryByText("用户中心")).not.toBeInTheDocument();
    expect(screen.getByText("全部通知")).toBeInTheDocument();
    expect(screen.getByText("发布文章")).toBeInTheDocument();
    expect(screen.queryByText("后台管理")).not.toBeInTheDocument();
    expect(screen.queryByText("发布说说")).not.toBeInTheDocument();
  });
});
