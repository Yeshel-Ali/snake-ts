const isDev = process.env.NODE_ENV !== 'production';

export const debug: (...args: unknown[]) => void = isDev
    ? console.debug.bind(console)
    : () => {};
