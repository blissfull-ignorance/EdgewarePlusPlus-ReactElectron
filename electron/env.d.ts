declare module 'fengari' {
  export const lua: any
  export const lauxlib: any
  export const lualib: any
}

declare module 'fengari-interop' {
  export const interop: {
    tojs(L: any, index: number): unknown
  }
}
