import type { ScreenBState } from './ScreenB.types';

export function createScreenBMockState(): ScreenBState {
  return {
    pageTitle: "Screen B",
    routeName: "screen-b",
    states: [
  {
    "cid": "state-b",
    "screenMetaCid": "screen-b",
    "name": "B",
    "position": 0,
    "itemCount": 3,
    "widgetCount": 2,
    "interactionCount": 1
  }
],
  };
}
