import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { V2WorkstationShell } from "./V2WorkstationShell";

describe("V2 workstation shell", () => {
  it("keeps operations and the fulfillment table on one simple page", () => {
    const output = renderToStaticMarkup(
      <V2WorkstationShell
        operations={<p>Connection and device status live here.</p>}
        fulfillment={<p>Packing details are read-only.</p>}
      />,
    );

    expect(output).toContain("Operations");
    expect(output).toContain("Fulfillment Queue");
    expect(output).toContain("Connection and device status live here.");
    expect(output).toContain("Packing details are read-only.");
    expect(output).toContain("Read-only");
    expect(output).not.toContain("Open queue");
    expect(output).not.toContain("Collapse fulfillment queue");
    expect(output).not.toContain("transition-[grid-template-columns]");
  });
});
