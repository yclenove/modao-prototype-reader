export interface ScreenBState {
  pageTitle: string;
  routeName: string;
  states: Array<{
    cid: string | null;
    name: string | null;
    itemCount: number;
    widgetCount: number;
    interactionCount: number;
  }>;
}
