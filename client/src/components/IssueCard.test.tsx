import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssueCard } from "./IssueCard";

const issue = { line: 7, severity: "critical" as const, category: "security" as const, message: "SQL injection", suggestion: "Use parameters" };

describe("IssueCard", () => {
  it("shows severity, category, message and fix", () => {
    render(<IssueCard issue={issue} />);
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("SQL injection")).toBeInTheDocument();
    expect(screen.getByText("Use parameters")).toBeInTheDocument();
  });

  it("calls onSelectLine with the issue's line", async () => {
    const onSelectLine = vi.fn();
    render(<IssueCard issue={issue} onSelectLine={onSelectLine} />);
    await userEvent.click(screen.getByRole("button", { name: "Line 7" }));
    expect(onSelectLine).toHaveBeenCalledWith(7);
  });
});
