import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ActivatePageClient } from "./ActivatePageClient";

const mockActivateUser = vi.fn();
type AuthStoreMockState = {
  setAuth: ReturnType<typeof vi.fn>;
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api/auth", () => ({
  authApi: {
    activateUser: (...args: unknown[]) => mockActivateUser(...args),
  },
}));

vi.mock("@/store/auth-store", () => ({
  useAuthStore: (selector: (state: AuthStoreMockState) => unknown) =>
    selector({
      setAuth: vi.fn(),
    }),
}));

vi.mock("@/components/ui", () => ({
  Spinner: () => <div>loading</div>,
}));

describe("ActivatePageClient", () => {
  it("缺少必要参数时直接显示错误且不调用激活接口", async () => {
    render(<ActivatePageClient />);

    expect(await screen.findByText("激活失败")).toBeInTheDocument();
    expect(screen.getByText("激活链接无效：缺少必要参数。")).toBeInTheDocument();
    expect(mockActivateUser).not.toHaveBeenCalled();
  });
});
