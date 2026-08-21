import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EdgePaceStrip } from "@/components/EdgePaceStrip";
import type { SessionModeUiState } from "@/lib/types";

const edgeState: SessionModeUiState = {
  mode: "edge_pace",
  label: "Edge Pace · R1 · Build",
  phase: "build",
  round: 0,
  phaseRemainingSec: 70,
  phaseElapsedSec: 0,
  phaseDurationSec: 70,
  coachCue: "hold with me",
  fireLine: "edge it slow",
  phaseChips: ["slower", "hold"],
};

const normalState: SessionModeUiState = {
  mode: "normal",
  label: "Normal",
  phase: "build",
  round: 0,
  phaseRemainingSec: 0,
  coachCue: "natural pace",
};

describe("EdgePaceStrip", () => {
  it("renders the phase label in edge_pace mode", () => {
    const { container } = render(<EdgePaceStrip modeState={edgeState} />);
    expect(container.textContent).toContain("Edge Pace · R1 · Build");
  });

  it("renders nothing in normal mode", () => {
    const { container } = render(<EdgePaceStrip modeState={normalState} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mounts consistently across a mode switch (hooks order stable)", () => {
    // Guards the react-hooks/rules-of-hooks fix: hooks must run whether or not
    // the early `return null` (normal mode) is taken.
    const { container, rerender } = render(<EdgePaceStrip modeState={normalState} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<EdgePaceStrip modeState={edgeState} />);
    expect(container.textContent).toContain("Edge Pace · R1 · Build");
    rerender(<EdgePaceStrip modeState={normalState} />);
    expect(container).toBeEmptyDOMElement();
  });
});
