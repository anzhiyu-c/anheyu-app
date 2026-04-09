import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import LoginPageWrapper from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("register=1"),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("LoginPage", () => {
  it("register=1 时默认进入注册流程", async () => {
    render(<LoginPageWrapper />);
    expect(await screen.findByText("创建新账号")).toBeInTheDocument();
  });
});
