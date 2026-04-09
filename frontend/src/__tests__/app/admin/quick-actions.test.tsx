import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, ...props }: { icon: string } & Record<string, unknown>) => <span data-icon={icon} {...props} />,
}));

import { QuickActions } from "@/components/admin/QuickActions";

describe("QuickActions", () => {
  it("renders all quick action links", () => {
    render(<QuickActions />);
    expect(screen.getByText("写文章")).toBeInTheDocument();
    expect(screen.getByText("上传文件")).toBeInTheDocument();
    expect(screen.getByText("管理评论")).toBeInTheDocument();
    expect(screen.getByText("系统设置")).toBeInTheDocument();
  });

  it("does NOT render dead links to /admin/categories or /admin/pages", () => {
    const { container } = render(<QuickActions />);
    const links = container.querySelectorAll("a");
    const hrefs = Array.from(links).map(l => l.getAttribute("href"));
    expect(hrefs).not.toContain("/admin/categories");
    expect(hrefs).not.toContain("/admin/pages");
  });

  it("links point to valid admin routes", () => {
    const { container } = render(<QuickActions />);
    const links = container.querySelectorAll("a");
    const hrefs = Array.from(links).map(l => l.getAttribute("href"));
    expect(hrefs).toContain("/admin/post-management");
    expect(hrefs).toContain("/admin/file-management");
    expect(hrefs).toContain("/admin/comments");
    expect(hrefs).toContain("/admin/doc-series");
    expect(hrefs).toContain("/admin/friends");
    expect(hrefs).toContain("/admin/settings");
  });
});
