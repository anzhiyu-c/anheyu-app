import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { setupAdminMocks } from "./admin-test-helpers";

setupAdminMocks();

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, variants, whileHover, whileTap, ...rest } = props;
      void initial;
      void animate;
      void exit;
      void transition;
      void variants;
      void whileHover;
      void whileTap;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, ...props }: { icon: string } & Record<string, unknown>) => <span data-icon={icon} {...props} />,
}));

import { AdminSidebar } from "@/components/admin/AdminSidebar";

describe("AdminSidebar", () => {
  it("renders menu groups and items for admin role", () => {
    render(<AdminSidebar />);
    expect(screen.getByText("概览")).toBeInTheDocument();
    expect(screen.getByText("内容管理")).toBeInTheDocument();
    expect(screen.getByText("系统管理")).toBeInTheDocument();
    expect(screen.getByText("首页")).toBeInTheDocument();
  });

  it("shows user info", () => {
    render(<AdminSidebar />);
    expect(screen.getByText("管理员")).toBeInTheDocument();
    expect(screen.getByText("admin@test.com")).toBeInTheDocument();
  });

  it("shows logout button", () => {
    render(<AdminSidebar />);
    expect(screen.getByText("退出登录")).toBeInTheDocument();
  });
});
