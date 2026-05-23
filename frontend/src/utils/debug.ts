const isDev = import.meta.env.DEV;

export const debug: (...args: unknown[]) => void = isDev
    ? console.debug.bind(console)
    : () => {};
