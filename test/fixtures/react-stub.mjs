// 单测用的最小 react 桩：只为让 esbuild 能打包 client/settings.ts（它经 ui.ts import react）。
// 本测试只调用 settings.ts 里的纯函数（isPickerUnavailable / pickErrorText），不渲染组件。
const React = {
  createElement: () => null,
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useRef: (v) => ({ current: v }),
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
};
export default React;
export const createElement = React.createElement;
