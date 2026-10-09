import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { V2WorkstationShell } from "./V2WorkstationShell";

describe("V2 workstation shell", () => {
  it("keeps operations and the future fulfillment region structurally separate", () => {
    const output = renderToStaticMarkup(
      <V2WorkstationShell
        operations={<p>Connection and device status live here.</p>}
        fulfillment={<p>Packing details will appear here after queue API work.</p>}
      />,
    );

    expect(output).toContain("Operations workstation");
    expect(output).toContain("Fulfillment Queue");
    expect(output).toContain("Connection and device status live here.");
    expect(output).toContain("Packing details will appear here after queue API work.");
    expect(output).toContain("Read-only");
  });
});
