import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSwipeNavigation } from "../components/mobile/useSwipeNavigation";

describe("useSwipeNavigation", () => {
  it("fires onLeft on swipe left", () => {
    const onLeft = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onLeft, enabled: true }));
    const start = { touches: [{ clientX: 200, clientY: 200 }] };
    const end = { changedTouches: [{ clientX: 100, clientY: 205 }] };
    result.current.onTouchStart(start);
    result.current.onTouchEnd(end);
    expect(onLeft).toHaveBeenCalled();
  });
});
