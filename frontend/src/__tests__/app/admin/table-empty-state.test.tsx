import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Brain } from "lucide-react";
import { TableEmptyState } from "@/components/admin/TableEmptyState";

vi.mock("@heroui/react", async () => {
  const actual = await vi.importActual<typeof import("@heroui/react")>("@heroui/react");
  return {
    ...actual,
    Button: ({
      children,
      onPress,
      ...props
    }: { children: React.ReactNode; onPress?: () => void } & Record<string, unknown>) => (
      <button onClick={onPress} {...props}>
        {children}
      </button>
    ),
  };
});

describe("TableEmptyState", () => {
  it("shows filter text when hasFilter is true", () => {
    render(<TableEmptyState icon={Brain} hasFilter={true} filterEmptyText="没有匹配的测试" emptyText="暂无测试数据" />);
    expect(screen.getByText("没有匹配的测试")).toBeInTheDocument();
    expect(screen.queryByText("暂无测试数据")).not.toBeInTheDocument();
  });

  it("shows empty text when hasFilter is false", () => {
    render(
      <TableEmptyState
        icon={Brain}
        hasFilter={false}
        filterEmptyText="没有匹配的测试"
        emptyText="暂无测试数据"
        emptyHint="点击按钮创建"
      />
    );
    expect(screen.getByText("暂无测试数据")).toBeInTheDocument();
    expect(screen.getByText("点击按钮创建")).toBeInTheDocument();
  });

  it("shows action button when not filtered and action provided", () => {
    const onClick = vi.fn();
    render(
      <TableEmptyState
        icon={Brain}
        hasFilter={false}
        filterEmptyText="没有匹配"
        emptyText="暂无数据"
        action={{ label: "新建", onPress: onClick }}
      />
    );
    expect(screen.getByText("新建")).toBeInTheDocument();
  });

  it("hides action button when filtered", () => {
    render(
      <TableEmptyState
        icon={Brain}
        hasFilter={true}
        filterEmptyText="没有匹配"
        emptyText="暂无数据"
        action={{ label: "新建", onPress: vi.fn() }}
      />
    );
    expect(screen.queryByText("新建")).not.toBeInTheDocument();
  });
});
